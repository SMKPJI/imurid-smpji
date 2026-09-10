/**
 * iMURID-SMPJI — Sistem Analisis Kehadiran Murid
 * Google Apps Script backend
 *
 * Fungsi:
 * 1. setupSheet() — auto-setup tab (Tetapan, Murid, Kehadiran, Arkib)
 * 2. doGet — REST API untuk website (getAll, cari)
 * 3. doPost — upload laporan PDF + import data kehadiran
 *
 * Flow bulanan:
 * 1. Admin upload PDF laporan KPM dalam website (tab Muat Naik)
 * 2. doPost uploadLaporan → simpan PDF ke Drive + rekod dalam Arkib
 * 3. Jongos (script Python) extract data dari PDF → POST importKehadiran
 * 4. Data bulan masuk tab Kehadiran → trend bulanan terkumpul
 */

const CONFIG = {
  SHEETS: {
    TETAPAN: 'Tetapan',
    MURID: 'Murid',
    KEHADIRAN: 'Kehadiran',
    ARKIB: 'Arkib'
  },
  FOLDER_LAPORAN: 'PASTE_FOLDER_ID_DI_SINI',  // folder Drive untuk simpan PDF
  // URL Vercel serverless function (api/extract.py) — letak selepas deploy Vercel
  EXTRACT_API_URL: 'PASTE_VERCEL_API_URL_DI_SINI'  // contoh: https://imurid-smpji.vercel.app/api/extract
};

const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogs', 'Sep', 'Okt', 'Nov', 'Dis'];

// ============================================================
// SETUP SHEET
// ============================================================
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const sheets = ss.getSheets();
  for (let i = sheets.length - 1; i > 0; i--) {
    ss.deleteSheet(sheets[i]);
  }
  
  const sheetPertama = ss.getSheets()[0];
  sheetPertama.setName(CONFIG.SHEETS.TETAPAN);
  
  setupTab(ss, CONFIG.SHEETS.TETAPAN, ['Kunci', 'Nilai'], [200, 300]);
  setupTab(ss, CONFIG.SHEETS.MURID, ['ID', 'Nama', 'NoIC', 'Tingkatan', 'Kelas'], [80, 280, 130, 120, 120]);
  const headerKehadiran = ['NoIC', 'Nama'].concat(BULAN.map(b => b + ' 2026')).concat(['Jumlah']);
  setupTab(ss, CONFIG.SHEETS.KEHADIRAN, headerKehadiran, [130, 280].concat(Array(12).fill(60)).concat([70]));
  setupTab(ss, CONFIG.SHEETS.ARKIB, ['Bulan', 'Status', 'Tarikh', 'FailID'], [100, 120, 120, 200]);
  
  seedData(ss);
  SpreadsheetApp.getUi().alert('✅ Setup siap! Set folderLaporan dalam tab Tetapan.');
}

function setupTab(ss, name, headers, widths) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}

function seedData(ss) {
  const t = ss.getSheetByName(CONFIG.SHEETS.TETAPAN);
  const tetapan = [
    ['namaSistem', 'iMurid-SMPJI'],
    ['namaSekolah', 'SMK (P) Jalan Ipoh'],
    ['logoUrl', ''],
    ['warnaUtama', '#3b82f6'],
    ['tahun', '2026'],
    ['folderLaporan', CONFIG.FOLDER_LAPORAN],
    ['kataLaluanAdmin', 'admin123']
  ];
  t.getRange(2, 1, tetapan.length, 2).setValues(tetapan);

  const m = ss.getSheetByName(CONFIG.SHEETS.MURID);
  const murid = [
    ['m01', "A'ISYAH BINTI MOHD ASRAF", '111128101460', '1', 'Amanah'],
    ['m02', 'AABHARANA A/P MUTHU', '111111141474', '1', 'Amanah'],
    ['m03', 'ABBY CHAI ZHI HUI', '090418140302', '1', 'Bestari'],
    ['m04', 'AHMAD FAIZ BIN RAZAK', '010203040506', '1', 'Bestari'],
    ['m05', 'SITI AMINAH BINTI KAMAL', '020304050607', '2', 'Amanah'],
    ['m06', 'LIM WEI JIE', '050607080910', '2', 'Amanah'],
    ['m07', 'NURUL IZZAH BINTI HASSAN', '080910111213', '2', 'Bestari'],
    ['m08', 'KAVINESH A/L MURUGAN', '070809101112', 'Peralihan', 'Arif'],
    ['m09', 'FARIS DANIEL BIN AZMAN', '091011121314', 'Peralihan', 'Arif'],
    ['m10', 'TAN MEI LING', '060708091011', '3', 'Amanah'],
    ['m11', 'MOHAMAD HAKIM BIN ZAINAL', '030405060708', '3', 'Amanah'],
    ['m12', 'AINA SOFEA BINTI RAHMAN', '101112131415', '3', 'Bestari']
  ];
  m.getRange(2, 1, murid.length, 5).setValues(murid);

  // Kehadiran contoh (12 murid, 12 bulan)
  const k = ss.getSheetByName(CONFIG.SHEETS.KEHADIRAN);
  const dataK = [
    ['111128101460', "A'ISYAH BINTI MOHD ASRAF", 0,0,0,1,0,1,0,0,0,0,0,0, 2],
    ['111111141474', 'AABHARANA A/P MUTHU', 2,3,2,0,0,2,3,1,0,0,0,0, 13],
    ['090418140302', 'ABBY CHAI ZHI HUI', 0,2,0,0,3,0,1,0,0,0,0,0, 6],
    ['010203040506', 'AHMAD FAIZ BIN RAZAK', 1,1,2,0,1,0,0,2,0,0,1,0, 8],
    ['020304050607', 'SITI AMINAH BINTI KAMAL', 0,0,0,0,0,0,0,0,0,0,0,0, 0],
    ['050607080910', 'LIM WEI JIE', 2,1,3,2,1,2,0,1,2,3,1,2, 20],
    ['080910111213', 'NURUL IZZAH BINTI HASSAN', 1,0,0,0,1,0,0,0,0,0,0,0, 2],
    ['070809101112', 'KAVINESH A/L MURUGAN', 3,2,4,3,5,2,4,3,2,4,3,5, 40],
    ['091011121314', 'FARIS DANIEL BIN AZMAN', 0,0,1,0,0,0,0,0,0,0,0,0, 1],
    ['060708091011', 'TAN MEI LING', 0,1,0,0,0,0,1,0,0,0,0,0, 2],
    ['030405060708', 'MOHAMAD HAKIM BIN ZAINAL', 1,2,1,1,2,1,1,2,1,1,2,1, 16],
    ['101112131415', 'AINA SOFEA BINTI RAHMAN', 0,0,0,0,0,0,0,0,0,0,0,0, 0]
  ];
  k.getRange(2, 1, dataK.length, 15).setValues(dataK);

  const a = ss.getSheetByName(CONFIG.SHEETS.ARKIB);
  const arkib = [
    ['Jan 2026', 'SELESAI', new Date(), ''],
    ['Feb 2026', 'SELESAI', new Date(), ''],
    ['Mac 2026', 'MENUNGGU', new Date(), '']
  ];
  a.getRange(2, 1, arkib.length, 4).setValues(arkib.map(r => [r[0], r[1], Utilities.formatDate(r[2], ss.getSpreadsheetTimeZone(), 'dd-MM-yyyy'), r[3]]));
}

// ============================================================
// ⚠️ BAET TAB KEHADIRAN SAHAJA (tak sentuh tab Murid!)
// ============================================================
// Guna fungsi ni jika tab Kehadiran takde header bulan yang betul.
// Ia hanya baiki/cipta tab Kehadiran — data Murid SELAMAT.
// ============================================================
function setupTabKehadiran() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const headerKehadiran = ['NoIC', 'Nama'].concat(BULAN.map(b => b + ' 2026')).concat(['Jumlah']);
  
  let sheet = ss.getSheetByName(CONFIG.SHEETS.KEHADIRAN);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEETS.KEHADIRAN);
  
  // Baiki header baris 1 sahaja (data sedia ada di bawah kekal)
  sheet.getRange(1, 1, 1, headerKehadiran.length).setValues([headerKehadiran]);
  sheet.getRange(1, 1, 1, headerKehadiran.length).setFontWeight('bold');
  // PENTING: paksa header sebagai TEKS supaya "Jan 2026" tidak jadi tarikh
  sheet.getRange(1, 1, 1, headerKehadiran.length).setNumberFormat('@');
  sheet.setFrozenRows(1);
  const widths = [130, 280].concat(Array(12).fill(60)).concat([70]);
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  
  // Baiki juga kolum Bulan dalam tab Arkib (elak auto-jadi tarikh)
  const arkib = ss.getSheetByName(CONFIG.SHEETS.ARKIB);
  if (arkib) {
    const lastRow = Math.max(arkib.getLastRow(), 2);
    arkib.getRange(2, 1, lastRow - 1, 1).setNumberFormat('@');
  }
  
  const laporanK = '✅ Tab Kehadiran dibaiki: header ' + headerKehadiran.join(', ') + '\n\nData Murid TIDAK disentuh.';
  Logger.log(laporanK);
  try { SpreadsheetApp.getUi().alert(laporanK); } catch (e) { /* run dari editor: log sahaja */ }
  return laporanK;
}

// ============================================================
// 🧹 BAET SEMUA — format teks + buang rekod pelik
// ============================================================
// 1. Format kolum Bulan (Arkib) sebagai Plain Text
// 2. Format header Kehadiran sebagai teks
// 3. Padam rekod Arkib yang Bulan-nya format tarikh (bukan "Jan 2026")
// ============================================================
function baikiSemua() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let dipadam = 0;   // FIX: diisytihar di luar blok supaya boleh dibaca di alert
  
  // 1. Arkib: format kolum Bulan sebagai teks + buang rekod pelik
  const arkib = ss.getSheetByName(CONFIG.SHEETS.ARKIB);
  if (arkib) {
    const data = arkib.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      const b = String(data[i][0] || '');
      // Rekod pelik = format tarikh (bukan "Jan 2026" pattern)
      if (b.indexOf('-') !== -1 || /^\d{4}/.test(b)) {
        arkib.deleteRow(i + 1);
        dipadam++;
      }
    }
    const lastRow = Math.max(arkib.getLastRow(), 2);
    arkib.getRange(2, 1, lastRow - 1, 1).setNumberFormat('@');
  }
  
  // 2. Kehadiran: header teks
  const k = ss.getSheetByName(CONFIG.SHEETS.KEHADIRAN);
  if (k) {
    const lastCol = Math.max(k.getLastColumn(), 14);
    k.getRange(1, 1, 1, lastCol).setNumberFormat('@');
  }
  
  // 3. Murid: NoIC & ID sebagai teks (elak 0 depan hilang)
  const m = ss.getSheetByName(CONFIG.SHEETS.MURID);
  if (m) {
    const lastRow = Math.max(m.getLastRow(), 2);
    m.getRange(2, 1, lastRow - 1, 3).setNumberFormat('@');
  }
  
  const laporan = '✅ BaikiSemua siap!\n\n- Rekod Arkib format tarikh: dipadam ' + dipadam +
                  '\n- Kolum Bulan: Plain Text\n- Header Kehadiran: teks\n- NoIC Murid: teks';
  Logger.log(laporan);
  try { SpreadsheetApp.getUi().alert(laporan); } catch (e) { /* run dari editor: log sahaja */ }
  return laporan;
}

// ============================================================
// REST API — GET
// ============================================================
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e?.parameter?.action || '';
  let result = { success: true };
  
  try {
    switch (action) {
      case 'getAll':
        result = {
          success: true,
          murid: getData_(ss, CONFIG.SHEETS.MURID),
          kehadiran: getData_(ss, CONFIG.SHEETS.KEHADIRAN),
          arkib: getData_(ss, CONFIG.SHEETS.ARKIB),
          tetapan: getData_(ss, CONFIG.SHEETS.TETAPAN)
        };
        break;
        
      case 'cari':
        const q = String(e?.parameter?.q || '').trim().toUpperCase();
        if (!q) {
          result = { success: false, error: 'Sila masukkan nama atau IC' };
          break;
        }
        const muridList = getData_(ss, CONFIG.SHEETS.MURID);
        const jumpa = muridList.filter(function (m) {
          return String(m.Nama || '').toUpperCase().indexOf(q) !== -1 ||
                 String(m.NoIC || '').padStart(12, '0').indexOf(q) !== -1;
        });
        result = { success: true, data: jumpa };
        break;
        
      default:
        result = { success: true, message: 'iMurid-SMPJI API v1.0' };
    }
  } catch (err) {
    result = { success: false, error: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// REST API — POST
// ============================================================
function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    const data = JSON.parse(e?.postData?.contents || '{}');
    const action = data.action || '';
    let result = { success: true };
    
    switch (action) {
      case 'uploadLaporan': result = uploadLaporan_(ss, data.bulan, data.failName, data.failContent); break;
      case 'importKehadiran': result = importKehadiran_(ss, data.bulan, data.rows); break;
      case 'importGoogleSheet': result = importGoogleSheet_(ss, data.bulan, data.sheetUrl); break;
      case 'updateTetapan': result = updateTetapan_(ss, data.kunci, data.nilai); break;
      default: result = { success: false, error: 'Action tidak dikenali: ' + action };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// UPLOAD LAPORAN — simpan PDF ke Drive + rekod Arkib
// ============================================================
function uploadLaporan_(ss, bulan, failName, failContent) {
  const tetapan = getTetapanObj_(ss);
  const folderId = tetapan.folderLaporan;
  
  if (!folderId || folderId.indexOf('PASTE_FOLDER_ID') !== -1) {
    return { success: false, error: 'folderLaporan belum diset dalam Tetapan.' };
  }
  if (!bulan || !failContent) {
    return { success: false, error: 'Bulan atau fail tidak lengkap.' };
  }
  
  try {
    const folder = DriveApp.getFolderById(folderId);
    const namaFail = 'Kehadiran_' + bulan.replace(/\s+/g, '') + '.pdf';
    
    // Buang fail lama untuk bulan sama (kalau ada)
    const sediaAda = folder.getFilesByName(namaFail);
    while (sediaAda.hasNext()) {
      sediaAda.next().setTrashed(true);
    }
    
    const blob = Utilities.newBlob(Utilities.base64Decode(failContent), 'application/pdf', namaFail);
    const failBaru = folder.createFile(blob);
    
    // Update/rekod dalam Arkib — status PROSES
    const arkib = ss.getSheetByName(CONFIG.SHEETS.ARKIB);
    const data = arkib.getDataRange().getValues();
    const tz = ss.getSpreadsheetTimeZone();
    const tarikh = Utilities.formatDate(new Date(), tz, 'dd-MM-yyyy HH:mm');
    let dijumpai = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === bulan.trim()) {
        arkib.getRange(i + 1, 2).setValue('PROSES');
        arkib.getRange(i + 1, 3).setValue(tarikh);
        arkib.getRange(i + 1, 4).setValue(failBaru.getId());
        dijumpai = true;
        break;
      }
    }
    if (!dijumpai) {
      arkib.appendRow([bulan, 'PROSES', tarikh, failBaru.getId()]);
    }
    
    // cuba extract automatik
    const extractResult = extractAndImport_(ss, bulan, failBaru);
    
    return {
      success: true,
      message: extractResult.success
        ? 'Laporan ' + bulan + ' dimuat naik & data berjaya diimport (' + extractResult.dikemaskini + ' dikemaskini, ' + extractResult.ditambah + ' baru).'
        : 'Laporan ' + bulan + ' dimuat naik. Extraction gagal: ' + (extractResult.error || 'unknown') + '. Sila guna script extract_kehadiran.py.',
      failId: failBaru.getId(),
      extracted: extractResult.success
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================================
// EXTRACT AUTOMATIK — panggil Vercel function (pymupdf), fallback parser
// ============================================================
function extractAndImport_(ss, bulan, fail) {
  try {
    const blob = fail.getBlob();
    const contentType = blob.getContentType();
    
    if (contentType && contentType.indexOf('pdf') === -1) {
      return { success: false, error: 'Bukan fail PDF. Guna extract_kehadiran.py.' };
    }
    
    // 1) Cuba Vercel function (pymupdf handle PDF gambar/teks)
    const apiUrl = (getTetapanObj_(ss).extractApiUrl || CONFIG.EXTRACT_API_URL || '').trim();
    if (apiUrl && apiUrl.indexOf('PASTE_VERCEL') === -1) {
      try {
        const pdfB64 = Utilities.base64Encode(blob.getBytes());
        const options = {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({ pdf_b64: pdfB64 }),
          muteHttpExceptions: true
        };
        const resp = UrlFetchApp.fetch(apiUrl, options);
        const hasil = JSON.parse(resp.getContentText());
        
        if (hasil.success && hasil.rows && hasil.rows.length) {
          const importResult = importKehadiran_(ss, bulan, hasil.rows);
          return {
            success: importResult.success,
            dikemaskini: importResult.dikemaskini || 0,
            ditambah: importResult.ditambah || 0,
            error: importResult.success ? null : importResult.error,
            source: 'vercel'
          };
        }
        // gagal di Vercel — fallback ke parser teks Apps Script
        Logger.log('Vercel extract gagal: ' + (hasil.error || 'unknown'));
      } catch (vercelErr) {
        Logger.log('Vercel extract exception: ' + vercelErr.toString());
      }
    }
    
    // 2) Fallback: parser teks Apps Script (PDF bukan gambar)
    let text = '';
    try {
      text = blob.getDataAsString('utf-8');
    } catch (e) {
      return { success: false, error: 'PDF gambar/scanned — perlu guna extract_kehadiran.py manual.' };
    }
    
    if (!text || text.length < 100) {
      return { success: false, error: 'PDF tiada teks (gambar/scanned) — perlu extract_kehadiran.py manual.' };
    }
    if ((text.match(/\d{12}/g) || []).length < 1) {
      return { success: false, error: 'PDF tiada nombor IC. Bukan format laporan KPM?' };
    }
    
    const rows = parseKpmText_(text);
    if (!rows || rows.length === 0) {
      return { success: false, error: 'Tiada data murid dijumpai. Guna extract_kehadiran.py.' };
    }
    
    const importResult = importKehadiran_(ss, bulan, rows);
    return {
      success: importResult.success,
      dikemaskini: importResult.dikemaskini || 0,
      ditambah: importResult.ditambah || 0,
      error: importResult.success ? null : importResult.error,
      source: 'appsscript'
    };
  } catch (err) {
    return { success: false, error: 'Extract error: ' + err.toString() };
  }
}

// ============================================================
// PARSER — extract data murid dari teks PDF KPM
// ============================================================
function parseKpmText_(text) {
  const lines = text.split(/\r?\n/);
  const murid = [];
  const seen = new Set();
  
  const icPattern = /\d{12}/;
  const bulanPattern = /^(Jan|Feb|Mac|Apr|Mei|Jun|Jul|Ogs|Sep|Okt|Nov|Dis)\s+20\d{2}$/i;
  
  let headerFound = false;
  let monthCols = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // cari header bulan
    if (!headerFound && bulanPattern.test(line)) {
      headerFound = true;
      continue;
    }
    
    if (!headerFound) continue;
    
    // cari IC 12 digit
    const icMatch = line.match(icPattern);
    if (!icMatch) continue;
    
    const ic = icMatch[0];
    if (seen.has(ic)) continue;
    
    // cari nama — baris sebelum IC biasanya nama
    let nama = '';
    if (i > 0) {
      const prevLine = lines[i - 1].trim();
      if (prevLine && !icPattern.test(prevLine) && prevLine.length > 3) {
        nama = prevLine;
      }
    }
    
    // fallback: nama mungkin dalam baris yang sama
    if (!nama) {
      const parts = line.split(ic);
      if (parts[0] && parts[0].trim().length > 3) {
        nama = parts[0].trim();
      }
    }
    
    if (!nama) continue;
    
    // extract nilai bulan — 12 nombor selepas IC
    const afterIc = line.substring(line.indexOf(ic) + 12);
    const nums = afterIc.match(/\d+/g) || [];
    const nilai = [];
    for (let j = 0; j < 12; j++) {
      nilai.push(parseInt(nums[j], 10) || 0);
    }
    
    // jumlah — nombor terakhir
    let jumlah = 0;
    if (nums.length > 12) {
      jumlah = parseInt(nums[12], 10) || 0;
    } else {
      jumlah = nilai.reduce(function (a, b) { return a + b; }, 0);
    }
    
    seen.add(ic);
    murid.push({ ic: ic, nama: nama, nilai: nilai, jumlah: jumlah });
  }
  
  return murid;
}

// ============================================================
// IMPORT KEHADIRAN — data bulan masuk (dipanggil oleh script Jongos)
// ============================================================
// data.rows = [{ic, nama, nilai: [12 nilai bulan], jumlah}]
// data.bulan = 'Mac 2026' — tentukan kolum bulan
// ============================================================
function importKehadiran_(ss, bulan, rows) {
  if (!rows || rows.length === 0) {
    return { success: false, error: 'Tiada data untuk diimport.' };
  }

  const sheet = ss.getSheetByName(CONFIG.SHEETS.KEHADIRAN);
  if (!sheet) {
    return { success: false, error: 'Tab Kehadiran tidak dijumpai.' };
  }

  // Baca sekali sahaja. Jangan gunakan setValue/getRange dalam gelung murid:
  // 679 murid boleh menyebabkan Apps Script melebihi had masa.
  const lastCol = Math.max(sheet.getLastColumn(), 15);
  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  let kolumIdx = -1;
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === String(bulan).trim()) {
      kolumIdx = i + 1;
      break;
    }
  }
  if (kolumIdx === -1) {
    return { success: false, error: 'Kolum bulan ' + bulan + ' tidak dijumpai. Run setupTabKehadiran() dahulu.' };
  }

  const nilaiIdx = BULAN.map(function (b) {
    return b.toLowerCase();
  }).indexOf(String(bulan).split(/\s+/)[0].toLowerCase());
  if (nilaiIdx < 0) {
    return { success: false, error: 'Nama bulan tidak disokong: ' + bulan };
  }

  const data = sheet.getDataRange().getValues();
  const indeksNoIC = {};
  for (let i = 1; i < data.length; i++) {
    const icRow = String(data[i][0] == null ? '' : data[i][0]).trim().replace(/[^0-9]/g, '').padStart(12, '0');
    if (icRow && icRow !== '000000000000') indeksNoIC[icRow] = i;
  }

  let dikemaskini = 0;
  const barisBaharu = [];
  const diproses = {};

  rows.forEach(function (r) {
    const ic = String(r.ic || '').trim().replace(/[^0-9]/g, '').padStart(12, '0');
    if (!ic || ic === '000000000000' || diproses[ic]) return;
    diproses[ic] = true;

    const nilai = r.nilai || [];
    const nilaiBulan = Number(nilai[nilaiIdx]) || 0;
    const rowIndex = indeksNoIC[ic];

    if (rowIndex !== undefined) {
      // Kemas kini cache dalam memori; nilai sebenar ditulis secara kelompok di bawah.
      data[rowIndex][kolumIdx - 1] = nilaiBulan;
      dikemaskini++;
    } else {
      const rowBaru = [ic, r.nama || ''].concat(Array(12).fill(0)).concat([0]);
      rowBaru[kolumIdx - 1] = nilaiBulan;
      rowBaru[14] = Array(12).fill(0).reduce(function (jumlah, _, j) {
        return jumlah + (j === nilaiIdx ? nilaiBulan : 0);
      }, 0);
      barisBaharu.push(rowBaru);
    }
  });

  // Kira semula Jumlah berdasarkan 12 bulan untuk semua baris sedia ada.
  for (let i = 1; i < data.length; i++) {
    data[i][14] = data[i].slice(2, 14).reduce(function (jumlah, nilai) {
      return jumlah + (Number(nilai) || 0);
    }, 0);
  }

  // Maksimum dua operasi tulis untuk data sedia ada + satu operasi append.
  if (data.length > 1) {
    sheet.getRange(2, kolumIdx, data.length - 1, 1).setValues(
      data.slice(1).map(function (row) { return [row[kolumIdx - 1]]; })
    );
    sheet.getRange(2, 15, data.length - 1, 1).setValues(
      data.slice(1).map(function (row) { return [row[14]]; })
    );
  }
  if (barisBaharu.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, barisBaharu.length, 15).setValues(barisBaharu);
  }

  // Update status Arkib → SELESAI
  const arkib = ss.getSheetByName(CONFIG.SHEETS.ARKIB);
  if (arkib) {
    const arkibData = arkib.getDataRange().getValues();
    const tz = ss.getSpreadsheetTimeZone();
    const tarikh = Utilities.formatDate(new Date(), tz, 'dd-MM-yyyy HH:mm');
    for (let i = 1; i < arkibData.length; i++) {
      if (String(arkibData[i][0]).trim() === String(bulan).trim()) {
        arkib.getRange(i + 1, 2, 1, 2).setValues([['SELESAI', tarikh]]);
        break;
      }
    }
  }

  const mesej = 'Import ' + bulan + ' siap: ' + dikemaskini + ' dikemaskini, ' + barisBaharu.length + ' baru.';
  return { success: true, message: mesej, dikemaskini: dikemaskini, ditambah: barisBaharu.length };
}

// ============================================================
// IMPORT DARIPADA GOOGLE SHEET SUMBER
// Format disokong:
// Bil | Nama (dan NoIC dalam sel sama) | Jan 2026 | ... | Jumlah
// atau Bil | Nama | NoIC | Jan 2026 | ... | Jumlah
// ============================================================
function importGoogleSheet_(ss, bulan, sheetUrl) {
  if (!bulan || !sheetUrl) {
    return { success: false, error: 'Bulan atau link Google Sheet tidak lengkap.' };
  }

  try {
    const idMatch = String(sheetUrl).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const sheetId = idMatch ? idMatch[1] : String(sheetUrl).trim();
    if (!/^[a-zA-Z0-9-_]{20,}$/.test(sheetId)) {
      return { success: false, error: 'Link Google Sheet tidak sah. Tampal link /spreadsheets/d/...' };
    }

    const source = SpreadsheetApp.openById(sheetId);
    const sourceSheet = source.getSheets()[0];
    const values = sourceSheet.getDataRange().getDisplayValues();
    if (values.length < 2) return { success: false, error: 'Google Sheet sumber kosong.' };

    const headers = values[0].map(h => String(h || '').trim());
    const findHeader = function (patterns) {
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i].toLowerCase().replace(/\s+/g, ' ');
        if (patterns.some(p => h === p || h.indexOf(p) !== -1)) return i;
      }
      return -1;
    };

    const bulanIdx = findHeader([bulan.toLowerCase()]);
    if (bulanIdx === -1) {
      return { success: false, error: 'Kolum "' + bulan + '" tidak dijumpai dalam Google Sheet sumber. Header yang ada: ' + headers.join(', ') };
    }

    const noIcIdx = findHeader(['noic', 'no ic', 'ic number', 'ic']);
    const namaIdx = findHeader(['nama', 'name']);
    const jumlahIdx = findHeader(['jumlah', 'total']);
    const bulanNombor = BULAN.map(b => b.toLowerCase()).indexOf(String(bulan).split(/\s+/)[0].toLowerCase());
    if (bulanNombor < 0) {
      return { success: false, error: 'Nama bulan tidak disokong: ' + bulan };
    }
    const rows = [];

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row.every(c => String(c || '').trim() === '')) continue;

      let nama = namaIdx >= 0 ? String(row[namaIdx] || '').trim() : '';
      let ic = noIcIdx >= 0 ? String(row[noIcIdx] || '').replace(/[^0-9]/g, '') : '';
      // Format sumber Najmi: Nama + NoIC dalam satu sel
      const gabung = row.map(c => String(c || '')).join(' ');
      const icMatch = gabung.match(/\d{12}/);
      if (!ic && icMatch) ic = icMatch[0];
      if (nama) nama = nama.replace(/\s*\d{12}\s*$/, '').trim();
      if (!nama && namaIdx < 0) nama = gabung.replace(/\d{12}/, '').trim();
      if (!ic || !nama) continue;

      const nilaiBulan = Number(String(row[bulanIdx] || '0').replace(/[^0-9.-]/g, '')) || 0;
      const jumlah = jumlahIdx >= 0
        ? Number(String(row[jumlahIdx] || '0').replace(/[^0-9.-]/g, '')) || 0
        : nilaiBulan;
      const nilai = Array(12).fill(0);
      if (bulanNombor >= 0) nilai[bulanNombor] = nilaiBulan;
      rows.push({ ic: ic.padStart(12, '0'), nama: nama, nilai: nilai, jumlah: jumlah });
    }

    if (!rows.length) return { success: false, error: 'Tiada baris murid yang mempunyai Nama dan NoIC 12 digit.' };
    const result = importKehadiran_(ss, bulan, rows);
    if (!result.success) return result;

    // Rekod sumber Google Sheet dalam Arkib supaya status boleh dijejak
    const arkib = ss.getSheetByName(CONFIG.SHEETS.ARKIB);
    if (arkib) {
      const arkibData = arkib.getDataRange().getValues();
      const tarikh = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'dd-MM-yyyy HH:mm');
      let dijumpai = false;
      for (let i = 1; i < arkibData.length; i++) {
        if (String(arkibData[i][0]).trim() === bulan.trim()) {
          arkib.getRange(i + 1, 2, 1, 3).setValues([['SELESAI', tarikh, String(sheetUrl).trim()]]);
          dijumpai = true;
          break;
        }
      }
      if (!dijumpai) arkib.appendRow([bulan, 'SELESAI', tarikh, String(sheetUrl).trim()]);
    }

    result.sourceRows = rows.length;
    result.sourceSheet = sourceSheet.getName();
    result.message = 'Import ' + bulan + ' siap daripada Google Sheet: ' + rows.length + ' baris sumber diproses (' + (result.dikemaskini || 0) + ' dikemaskini, ' + (result.ditambah || 0) + ' baru).';
    return result;
  } catch (err) {
    return { success: false, error: 'Gagal baca Google Sheet: ' + err.toString() };
  }
}

// ============================================================
// BANTU
// ============================================================
function getData_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i].every(c => c === '')) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      let v = values[i][idx];
      // NoIC: pastikan 12 digit (0 depan tidak hilang)
      if (/noic/i.test(h) && v !== '') {
        v = String(v).trim().padStart(12, '0');
      }
      obj[h] = v;
    });
    rows.push(obj);
  }
  return rows;
}

function getTetapanObj_(ss) {
  const data = getData_(ss, CONFIG.SHEETS.TETAPAN);
  const obj = {};
  data.forEach(function (r) {
    if (r && r.Kunci) obj[r.Kunci] = r.Nilai;
  });
  return obj;
}

function updateTetapan_(ss, kunci, nilai) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.TETAPAN);
  if (!sheet) return { success: false, error: 'Sheet Tetapan tidak dijumpai' };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == kunci) {
      sheet.getRange(i + 1, 2).setValue(nilai);
      return { success: true, message: 'Tetapan dikemaskini' };
    }
  }
  sheet.appendRow([kunci, nilai]);
  return { success: true, message: 'Tetapan baru' };
}

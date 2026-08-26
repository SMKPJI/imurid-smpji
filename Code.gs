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
  FOLDER_LAPORAN: 'PASTE_FOLDER_ID_DI_SINI'  // folder Drive untuk simpan PDF
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
  setupTab(ss, CONFIG.SHEETS.MURID, ['ID', 'Nama', 'NoIC', 'Kelas'], [80, 280, 130, 120]);
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
    ['m01', "A'ISYAH BINTI MOHD ASRAF", '111128101460', '1 Amanah'],
    ['m02', 'AABHARANA A/P MUTHU', '111111141474', '1 Amanah'],
    ['m03', 'ABBY CHAI ZHI HUI', '090418140302', '1 Bestari'],
    ['m04', 'AHMAD FAIZ BIN RAZAK', '010203040506', '1 Bestari'],
    ['m05', 'SITI AMINAH BINTI KAMAL', '020304050607', '2 Amanah'],
    ['m06', 'LIM WEI JIE', '050607080910', '2 Amanah'],
    ['m07', 'NURUL IZZAH BINTI HASSAN', '080910111213', '2 Bestari'],
    ['m08', 'KAVINESH A/L MURUGAN', '070809101112', 'Peralihan Arif'],
    ['m09', 'FARIS DANIEL BIN AZMAN', '091011121314', 'Peralihan Arif'],
    ['m10', 'TAN MEI LING', '060708091011', '3 Amanah'],
    ['m11', 'MOHAMAD HAKIM BIN ZAINAL', '030405060708', '3 Amanah'],
    ['m12', 'AINA SOFEA BINTI RAHMAN', '101112131415', '3 Bestari']
  ];
  m.getRange(2, 1, murid.length, 4).setValues(murid);

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
    
    const blob = Utilities.newBlob(failContent, 'application/pdf', namaFail);
    const failBaru = folder.createFile(blob);
    
    // Update/rekod dalam Arkib
    const arkib = ss.getSheetByName(CONFIG.SHEETS.ARKIB);
    const data = arkib.getDataRange().getValues();
    const tz = ss.getSpreadsheetTimeZone();
    const tarikh = Utilities.formatDate(new Date(), tz, 'dd-MM-yyyy HH:mm');
    let dijumpai = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == bulan) {
        arkib.getRange(i + 1, 2).setValue('MENUNGGU');
        arkib.getRange(i + 1, 3).setValue(tarikh);
        arkib.getRange(i + 1, 4).setValue(failBaru.getId());
        dijumpai = true;
        break;
      }
    }
    if (!dijumpai) {
      arkib.appendRow([bulan, 'MENUNGGU', tarikh, failBaru.getId()]);
    }
    
    return { success: true, message: 'Laporan ' + bulan + ' dimuat naik. Status: MENUNGGU (extraction).', failId: failBaru.getId() };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
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
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Cari kolum bulan (contoh: 'Mac 2026')
  let kolumIdx = -1;
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i]).indexOf(bulan) !== -1) {
      kolumIdx = i + 1;
      break;
    }
  }
  if (kolumIdx === -1) {
    return { success: false, error: 'Kolum bulan ' + bulan + ' tidak dijumpai. Run setupSheet() dahulu.' };
  }
  
  const data = sheet.getDataRange().getValues();
  let dikemaskini = 0;
  let ditambah = 0;
  
  rows.forEach(function (r) {
    const ic = String(r.ic || '').trim().padStart(12, '0');
    const nilai = r.nilai || [];
    const jumlah = r.jumlah != null ? r.jumlah : 0;
    let jumpa = false;
    
    for (let i = 1; i < data.length; i++) {
      const icRow = String(data[i][0] || '').trim().padStart(12, '0');
      if (icRow === ic) {
        // Update nilai bulan + jumlah
        sheet.getRange(i + 1, kolumIdx).setValue(nilai[kolumIdx - 3] != null ? nilai[kolumIdx - 3] : 0);
        // Kira semula jumlah (jumlah semua kolum 3..14)
        const bulanValues = sheet.getRange(i + 1, 3, 1, 12).getValues()[0];
        const jumlahBaru = bulanValues.reduce(function (a, b) { return (Number(a) || 0) + (Number(b) || 0); }, 0);
        sheet.getRange(i + 1, 15).setValue(jumlahBaru);
        data[i][0] = ic; // update cache
        dikemaskini++;
        jumpa = true;
        break;
      }
    }
    
    if (!jumpa) {
      // Murid takde dalam sheet — tambah baris baru
      const rowBaru = [ic, r.nama || ''].concat(Array(12).fill(0)).concat([jumlah]);
      rowBaru[kolumIdx - 1] = nilai[kolumIdx - 3] != null ? nilai[kolumIdx - 3] : 0;
      sheet.appendRow(rowBaru);
      ditambah++;
    }
  });
  
  // Update status Arkib → SELESAI
  const arkib = ss.getSheetByName(CONFIG.SHEETS.ARKIB);
  if (arkib) {
    const arkibData = arkib.getDataRange().getValues();
    const tz = ss.getSpreadsheetTimeZone();
    const tarikh = Utilities.formatDate(new Date(), tz, 'dd-MM-yyyy HH:mm');
    for (let i = 1; i < arkibData.length; i++) {
      if (arkibData[i][0] == bulan) {
        arkib.getRange(i + 1, 2).setValue('SELESAI');
        arkib.getRange(i + 1, 3).setValue(tarikh);
        break;
      }
    }
  }
  
  return { success: true, message: 'Import ' + bulan + ' siap: ' + dikemaskini + ' dikemaskini, ' + ditambah + ' baru.', dikemaskini: dikemaskini, ditambah: ditambah };
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

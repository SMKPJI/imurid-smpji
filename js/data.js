/* ==========================================================================
   iMurid-SMPJI — Lapisan Data
   SMK (P) Jalan Ipoh · Analisis Kehadiran Murid 2026
   --------------------------------------------------------------------------
   - Data disimpan dalam localStorage (berfungsi terus via file://)
   - Sambungan API Google Sheets (Apps Script) melalui window.API_URL
   - Tetapkan API_URL di bawah selepas deploy Code.gs
   ========================================================================== */

/* ---------- Tetapan API (isi selepas deploy Apps Script) ---------- */
window.API_URL = '';   /* Contoh: 'https://script.google.com/macros/s/ABCDEF/exec' */

/* ---------- Kunci localStorage ---------- */
var KUNCI_MURID     = 'imurid_murid';
var KUNCI_KEHADIRAN = 'imurid_kehadiran';
var KUNCI_ARKIB     = 'imurid_arkib';
var KUNCI_TETAPAN   = 'imurid_tetapan';
var KUNCI_VERSI     = 'imurid_versi';
var VERSI_DATA      = '1.0.0';

/* ---------- Senarai Bulan (Singkatan Malaysia) ---------- */
var BULAN = [
  { k: 'jan', n: 'Januari'   },
  { k: 'feb', n: 'Februari'  },
  { k: 'mac', n: 'Mac'       },
  { k: 'apr', n: 'April'     },
  { k: 'mei', n: 'Mei'       },
  { k: 'jun', n: 'Jun'       },
  { k: 'jul', n: 'Julai'     },
  { k: 'ogs', n: 'Ogos'      },
  { k: 'sep', n: 'September' },
  { k: 'okt', n: 'Oktober'   },
  { k: 'nov', n: 'November'  },
  { k: 'dis', n: 'Disember'  }
];

var BULAN_PENDEK = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogs', 'Sep', 'Okt', 'Nov', 'Dis'];

/* ==========================================================================
   DATA CONTOH (MOCK) — 12 murid, 4 kelas
   ========================================================================== */

var MOCK_TETAPAN = {
  namaSistem: 'iMurid-SMPJI',
  namaSekolah: 'SMK (P) Jalan Ipoh',
  logoUrl: '',
  warnaUtama: '#3b82f6',
  tahun: '2026',
  kataLaluanAdmin: 'admin123'
};

var MOCK_MURID = [
  { id: 'M001', nama: 'Nur Aisyah binti Ahmad',            ic: '130101140001', kelas: '1 Amanah'      },
  { id: 'M002', nama: 'Muhammad Daniel bin Ismail',        ic: '130215080312', kelas: '1 Amanah'      },
  { id: 'M003', nama: 'Nurul Izzah binti Abdullah',        ic: '130305041234', kelas: '1 Amanah'      },
  { id: 'M004', nama: 'Ahmad Faiz bin Rahman',             ic: '130410021187', kelas: '1 Amanah'      },
  { id: 'M005', nama: 'Siti Nurhaliza binti Yusof',        ic: '130520100212', kelas: '1 Bestari'     },
  { id: 'M006', nama: 'Muhammad Haikal bin Zulkifli',      ic: '130605031908', kelas: '1 Bestari'     },
  { id: 'M007', nama: 'Nur Anis Syazwani binti Kamarudin', ic: '130712020454', kelas: '1 Bestari'     },
  { id: 'M008', nama: 'Lim Wei Jian',                      ic: '120815071021', kelas: '2 Amanah'      },
  { id: 'M009', nama: 'Aina Sofea binti Mohd Nazri',       ic: '120921050688', kelas: '2 Amanah'      },
  { id: 'M010', nama: 'Muhammad Adam bin Hassan',          ic: '121105011455', kelas: '2 Amanah'      },
  { id: 'M011', nama: 'Farah Nadia binti Aziz',            ic: '130110060321', kelas: 'Peralihan Arif' },
  { id: 'M012', nama: 'Tan Wen Xuan',                      ic: '130225081110', kelas: 'Peralihan Arif' }
];

/* Nilai = bilangan hari tidak hadir bagi setiap bulan (2026) */
var MOCK_KEHADIRAN = [
  { ic: '130101140001', nama: 'Nur Aisyah binti Ahmad',            bulan: { jan: 0, feb: 0, mac: 1, apr: 0, mei: 0, jun: 0, jul: 1, ogs: 0, sep: 0, okt: 1, nov: 0, dis: 0 } },
  { ic: '130215080312', nama: 'Muhammad Daniel bin Ismail',        bulan: { jan: 2, feb: 1, mac: 0, apr: 0, mei: 1, jun: 2, jul: 0, ogs: 1, sep: 0, okt: 0, nov: 1, dis: 0 } },
  { ic: '130305041234', nama: 'Nurul Izzah binti Abdullah',        bulan: { jan: 1, feb: 2, mac: 0, apr: 1, mei: 2, jun: 0, jul: 1, ogs: 2, sep: 1, okt: 1, nov: 0, dis: 2 } },
  { ic: '130410021187', nama: 'Ahmad Faiz bin Rahman',             bulan: { jan: 1, feb: 1, mac: 2, apr: 0, mei: 0, jun: 0, jul: 1, ogs: 0, sep: 1, okt: 0, nov: 0, dis: 0 } },
  { ic: '130520100212', nama: 'Siti Nurhaliza binti Yusof',        bulan: { jan: 0, feb: 1, mac: 0, apr: 0, mei: 0, jun: 0, jul: 0, ogs: 0, sep: 0, okt: 0, nov: 0, dis: 1 } },
  { ic: '130605031908', nama: 'Muhammad Haikal bin Zulkifli',      bulan: { jan: 1, feb: 0, mac: 0, apr: 2, mei: 1, jun: 0, jul: 0, ogs: 1, sep: 0, okt: 0, nov: 0, dis: 0 } },
  { ic: '130712020454', nama: 'Nur Anis Syazwani binti Kamarudin', bulan: { jan: 0, feb: 1, mac: 2, apr: 0, mei: 0, jun: 0, jul: 1, ogs: 0, sep: 0, okt: 2, nov: 1, dis: 0 } },
  { ic: '120815071021', nama: 'Lim Wei Jian',                      bulan: { jan: 1, feb: 1, mac: 1, apr: 1, mei: 1, jun: 0, jul: 1, ogs: 1, sep: 1, okt: 0, nov: 1, dis: 1 } },
  { ic: '120921050688', nama: 'Aina Sofea binti Mohd Nazri',       bulan: { jan: 0, feb: 0, mac: 0, apr: 0, mei: 0, jun: 1, jul: 0, ogs: 0, sep: 0, okt: 0, nov: 0, dis: 0 } },
  { ic: '121105011455', nama: 'Muhammad Adam bin Hassan',          bulan: { jan: 3, feb: 1, mac: 2, apr: 0, mei: 2, jun: 1, jul: 0, ogs: 1, sep: 1, okt: 1, nov: 0, dis: 0 } },
  { ic: '130110060321', nama: 'Farah Nadia binti Aziz',            bulan: { jan: 1, feb: 0, mac: 0, apr: 1, mei: 0, jun: 0, jul: 0, ogs: 1, sep: 0, okt: 0, nov: 2, dis: 0 } },
  { ic: '130225081110', nama: 'Tan Wen Xuan',                      bulan: { jan: 0, feb: 0, mac: 1, apr: 0, mei: 1, jun: 0, jul: 0, ogs: 0, sep: 1, okt: 0, nov: 0, dis: 0 } }
];

/* Kira jumlah setahun secara automatik (elak silap kira) */
MOCK_KEHADIRAN.forEach(function (k) {
  k.jumlah = BULAN.reduce(function (s, b) { return s + (k.bulan[b.k] || 0); }, 0);
});

var MOCK_ARKIB = [
  { Bulan: 'Jan 2026', Status: 'SELESAI',  Tarikh: '05/02/2026', FailID: 'LAPORAN-JAN-2026.pdf' },
  { Bulan: 'Feb 2026', Status: 'SELESAI',  Tarikh: '05/03/2026', FailID: 'LAPORAN-FEB-2026.pdf' },
  { Bulan: 'Mac 2026', Status: 'MENUNGGU', Tarikh: '',           FailID: ''                     },
  { Bulan: 'Apr 2026', Status: 'GAGAL',    Tarikh: '02/05/2026', FailID: 'LAPORAN-APR-2026.pdf' }
];

/* ==========================================================================
   PEMULAAN & SEEDING (dikunci oleh versi data)
   ========================================================================== */
function initData() {
  try {
    if (localStorage.getItem(KUNCI_VERSI) !== VERSI_DATA) {
      localStorage.setItem(KUNCI_MURID, JSON.stringify(MOCK_MURID));
      localStorage.setItem(KUNCI_KEHADIRAN, JSON.stringify(MOCK_KEHADIRAN));
      localStorage.setItem(KUNCI_ARKIB, JSON.stringify(MOCK_ARKIB));
      localStorage.setItem(KUNCI_TETAPAN, JSON.stringify(MOCK_TETAPAN));
      localStorage.setItem(KUNCI_VERSI, VERSI_DATA);
    }
  } catch (e) {
    /* penyimpanan disekat — guna mock dalam memori sahaja */
  }
}

/* ==========================================================================
   PEMBACA DATA
   ========================================================================== */
function getTetapan() {
  try {
    var raw = localStorage.getItem(KUNCI_TETAPAN);
    if (raw) {
      var t = JSON.parse(raw);
      if (t && typeof t === 'object') return Object.assign({}, MOCK_TETAPAN, t);
    }
  } catch (e) { /* langkau */ }
  return Object.assign({}, MOCK_TETAPAN);
}

function getMurid() {
  try {
    var raw = localStorage.getItem(KUNCI_MURID);
    if (raw) {
      var m = JSON.parse(raw);
      if (Array.isArray(m)) return m;
    }
  } catch (e) { /* langkau */ }
  return MOCK_MURID.slice();
}

function getKehadiran() {
  try {
    var raw = localStorage.getItem(KUNCI_KEHADIRAN);
    if (raw) {
      var k = JSON.parse(raw);
      if (Array.isArray(k)) return k;
    }
  } catch (e) { /* langkau */ }
  return MOCK_KEHADIRAN.slice();
}

function getArkib() {
  try {
    var raw = localStorage.getItem(KUNCI_ARKIB);
    if (raw) {
      var a = JSON.parse(raw);
      if (Array.isArray(a)) return a;
    }
  } catch (e) { /* langkau */ }
  return MOCK_ARKIB.slice();
}

/* ---------- Format No. IC: 010203040506 -> 010203-04-0506 ---------- */
function formatIC(ic) {
  var d = String(ic == null ? '' : ic).replace(/[^0-9]/g, '');
  if (d.length === 12) {
    return d.slice(0, 6) + '-' + d.slice(6, 8) + '-' + d.slice(8);
  }
  return String(ic == null ? '' : ic);
}

/* ==========================================================================
   CARIAN MURID (nama ATAU nombor IC, tidak peka huruf besar/kecil)
   ========================================================================== */
function cariMurid(q) {
  q = String(q == null ? '' : q).trim().toLowerCase();
  if (!q) return [];
  var kehadiran = getKehadiran();
  var qBersih = q.replace(/[^0-9a-z ]/g, '').replace(/ /g, '');
  var hasil = [];

  getMurid().forEach(function (m) {
    var nama = String(m.nama || '').toLowerCase();
    var icRaw = String(m.ic || '').replace(/[^0-9]/g, '');
    var padan = false;
    if (nama.indexOf(q) !== -1) padan = true;
    if (!padan && qBersih && icRaw.indexOf(qBersih) !== -1) padan = true;
    if (!padan) {
      /* IC berformat seperti 130101-14-0001 */
      var icFormat = String(formatIC(m.ic) || '').toLowerCase();
      if (icFormat.indexOf(q) !== -1) padan = true;
    }
    if (!padan) return;

    var kh = null;
    for (var i = 0; i < kehadiran.length; i++) {
      if (String(kehadiran[i].ic || '').replace(/[^0-9]/g, '') === icRaw) {
        kh = kehadiran[i];
        break;
      }
    }
    hasil.push({ murid: m, kehadiran: kh });
  });

  return hasil;
}

/* ==========================================================================
   SEGERAK DATA DARIPADA API (Google Sheets via Apps Script)
   --------------------------------------------------------------------------
   API ?action=getAll dijangka memulangkan:
     data.murid:     [{ID, Nama, NoIC, Kelas}]
     data.kehadiran: [{NoIC, Nama, "Jan 2026", ..., "Dis 2026", Jumlah}]
     data.arkib:     [{Bulan, Status, Tarikh, FailID}]
     data.tetapan:   [{Kunci, Nilai}]  -> ditukar kepada objek
   ========================================================================== */
function syncDataFromApi() {
  if (!window.API_URL) return Promise.resolve(false);

  return fetch(window.API_URL + '?action=getAll')
    .then(function (res) { return res.json(); })
    .then(function (json) {
      var data = (json && json.data) ? json.data : (json || {});

      /* Murid — NoIC mungkin tiba sebagai nombor (sifar pendahulu hilang) */
      var murid = (data.murid || []).map(function (r) {
        return {
          id:    String(r.ID || ''),
          nama:  String(r.Nama || ''),
          ic:    String(r.NoIC == null ? '' : r.NoIC).trim().padStart(12, '0'),
          kelas: String(r.Kelas || '')
        };
      });

      /* Kehadiran — cari lajur bulan secara fleksibel ("Jan 2026", "Jan", "januari", ...) */
      var kehadiran = (data.kehadiran || []).map(function (r) {
        var peta = {};
        Object.keys(r).forEach(function (kunci) { peta[String(kunci).toLowerCase()] = r[kunci]; });
        var b = {};
        BULAN.forEach(function (m) {
          var calon = [m.k, m.n.toLowerCase(), m.k + ' 2026', m.n.toLowerCase() + ' 2026', m.k + '2026'];
          var nilai = 0;
          for (var i = 0; i < calon.length; i++) {
            if (peta[calon[i]] !== undefined) { nilai = parseInt(peta[calon[i]], 10) || 0; break; }
          }
          b[m.k] = nilai;
        });
        var jum = parseInt(peta['jumlah'], 10);
        if (!(jum >= 0)) {
          jum = BULAN.reduce(function (s, m) { return s + b[m.k]; }, 0);
        }
        return {
          ic:     String(r.NoIC == null ? '' : r.NoIC).trim().padStart(12, '0'),
          nama:   String(r.Nama || ''),
          bulan:  b,
          jumlah: jum
        };
      });

      /* Arkib */
      var arkib = (data.arkib || []).map(function (r) {
        return {
          Bulan:  String(r.Bulan || ''),
          Status: String(r.Status || ''),
          Tarikh: String(r.Tarikh || ''),
          FailID: String(r.FailID || '')
        };
      });

      /* Tetapan — tukar tatasusunan [{Kunci,Nilai}] kepada objek */
      var tetapan = {};
      (data.tetapan || []).forEach(function (r) {
        if (r && r.Kunci) tetapan[String(r.Kunci)] = String(r.Nilai == null ? '' : r.Nilai);
      });

      localStorage.setItem(KUNCI_MURID, JSON.stringify(murid));
      localStorage.setItem(KUNCI_KEHADIRAN, JSON.stringify(kehadiran));
      localStorage.setItem(KUNCI_ARKIB, JSON.stringify(arkib));
      if (Object.keys(tetapan).length) {
        localStorage.setItem(KUNCI_TETAPAN, JSON.stringify(tetapan));
      }

      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new Event('imurid:synced'));
      }
      return true;
    })
    .catch(function (err) {
      console.warn('iMurid: gagal segerak data API —', err);
      return false;
    });
}

/* ==========================================================================
   MUAT NAIK LAPORAN (PDF) — POST ke Apps Script
   --------------------------------------------------------------------------
   doPost menerima FormData: {action:'uploadLaporan', bulan, file}
   ========================================================================== */
function uploadLaporan(bulan, fileObj) {
  var fd = new FormData();
  fd.append('action', 'uploadLaporan');
  fd.append('bulan', bulan);
  fd.append('file', fileObj);
  return fetch(window.API_URL, { method: 'POST', body: fd });
}

/* ---------- Simpan arkib (guna oleh halaman admin / mod demo) ---------- */
function simpanArkib(arkib) {
  localStorage.setItem(KUNCI_ARKIB, JSON.stringify(arkib));
}

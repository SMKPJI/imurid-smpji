/* ==========================================================================
   iMurid-SMPJI — Fungsi Umum (Header, Footer, Tema, Boot)
   SMK (P) Jalan Ipoh · Analisis Kehadiran Murid 2026
   ========================================================================== */

/* ---------- Utiliti ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function bulanPenuh(k) {
  for (var i = 0; i < BULAN.length; i++) {
    if (BULAN[i].k === k) return BULAN[i].n;
  }
  return String(k || '');
}

function bulanPendek(k) {
  for (var i = 0; i < BULAN.length; i++) {
    if (BULAN[i].k === k) return BULAN_PENDEK[i];
  }
  return String(k || '');
}

function inisial(nama) {
  var bahagian = String(nama || ' ').trim().split(/\s+/);
  var a = bahagian[0] ? bahagian[0].charAt(0) : '';
  var b = bahagian[1] ? bahagian[1].charAt(0) : '';
  return (a + b).toUpperCase();
}

/* ---------- Tema (gelap lalai, simpan dalam localStorage) ---------- */
function getTema() {
  try { return localStorage.getItem('imurid_tema') || 'gelap'; } catch (e) { return 'gelap'; }
}

function setTema(t) {
  try { localStorage.setItem('imurid_tema', t); } catch (e) { /* langkau */ }
  document.documentElement.setAttribute('data-tema', t);
  updateButangTema();
}

function toggleTema() {
  setTema(getTema() === 'gelap' ? 'cerah' : 'gelap');
}

function updateButangTema() {
  var b = document.getElementById('butang-tema');
  if (b) b.textContent = (getTema() === 'gelap') ? '🌙' : '☀️';
}

/* ---------- Tetapan Sistem (tajuk + warna utama) ---------- */
function applySettings() {
  var tet = getTetapan() || {};
  document.title = (tet.namaSistem || 'iMurid-SMPJI') + ' — Analisis Kehadiran Murid';
  if (tet.warnaUtama) {
    document.documentElement.style.setProperty('--akcent', tet.warnaUtama);
  }
}

/* ---------- Header (jenama + nav + butang tema) ---------- */
function navLink(fail, label, semasa) {
  var aktif = (semasa === fail) ? ' nav-link-aktif' : '';
  return '<a class="nav-link' + aktif + '" href="' + fail + '">' + label + '</a>';
}

function renderHeader() {
  var el = document.getElementById('header-placeholder');
  if (!el) return;
  var tet = getTetapan() || {};
  var fail = location.pathname.split('/').pop() || 'index.html';

  var logo = tet.logoUrl
    ? '<img class="logo-img" src="' + esc(tet.logoUrl) + '" alt="Logo">'
    : '<span class="logo-emoji">📊</span>';

  el.innerHTML =
    '<header class="header">' +
      '<div class="container header-dalam">' +
        '<a class="jenama" href="index.html">' + logo +
          '<span class="jenama-teks">' +
            '<span class="jenama-sistem">' + esc(tet.namaSistem || 'iMurid-SMPJI') + '</span>' +
            '<span class="jenama-sekolah">' + esc(tet.namaSekolah || '') + '</span>' +
          '</span>' +
        '</a>' +
        '<nav class="nav" aria-label="Navigasi utama">' +
          navLink('index.html', 'Utama', fail) +
          navLink('analisis.html', 'Analisis Kelas', fail) +
          navLink('murid.html', 'Cari Murid', fail) +
          navLink('admin.html', 'Admin', fail) +
        '</nav>' +
        '<button type="button" class="butang-tema" id="butang-tema" title="Tukar tema (gelap/cerah)" aria-label="Tukar tema">🌙</button>' +
      '</div>' +
    '</header>';

  updateButangTema();
}

/* ---------- Footer ---------- */
function renderFooter() {
  var el = document.getElementById('footer-placeholder');
  if (!el) return;
  var tet = getTetapan() || {};
  var tahun = tet.tahun || String(new Date().getFullYear());

  el.innerHTML =
    '<footer class="footer">' +
      '<div class="container">' +
        '<p class="footer-utama">© ' + esc(tahun) + ' <strong>' + esc(tet.namaSistem || 'iMurid-SMPJI') + '</strong> · ' + esc(tet.namaSekolah || '') + '</p>' +
        '<p class="footer-muted">Analisis Kehadiran Murid · HTML &amp; CSS tulen · Data melalui Google Sheets API</p>' +
      '</div>' +
    '</footer>';
}

/* ---------- Butang tema ---------- */
function initTemaToggle() {
  var b = document.getElementById('butang-tema');
  if (b) b.addEventListener('click', toggleTema);
}

/* ==========================================================================
   BOOT — lari pada setiap halaman
   --------------------------------------------------------------------------
   Setiap halaman boleh mentakrifkan fungsi renderHalaman() untuk
   melukis kandungannya; ia akan dipanggil selepas data sedia.
   ========================================================================== */
function boot() {
  initData();          /* seed mock jika versi berbeza */
  applySettings();     /* tajuk + warna utama */
  renderHeader();
  renderFooter();
  initTemaToggle();

  /* Re-render selepas segerak API selesai */
  document.addEventListener('imurid:synced', function () {
    applySettings();
    renderHeader();
    renderFooter();
    if (typeof renderHalaman === 'function') renderHalaman();
  });

  /* Segerak dari API jika sudah dikonfigurasi */
  if (window.API_URL) {
    syncDataFromApi();
  }

  /* Lukis halaman (mock / cache dahulu) */
  if (typeof renderHalaman === 'function') renderHalaman();
}

document.addEventListener('DOMContentLoaded', boot);

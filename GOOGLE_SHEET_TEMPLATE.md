# 📋 GOOGLE SHEET TEMPLATE — iMurid-SMPJI
## Sistem Analisis Kehadiran Murid. Import ke Google Sheet. Setiap jadual = 1 tab.

---

## TAB 1: Tetapan

```csv
Kunci,Nilai
namaSistem,iMurid-SMPJI
namaSekolah,SMK (P) Jalan Ipoh
logoUrl,
warnaUtama,#3b82f6
tahun,2026
folderLaporan,PASTE_FOLDER_ID_DI_SINI
kataLaluanAdmin,admin123
```

**folderLaporan**: ID folder Google Drive untuk simpan PDF laporan bulanan.
Cara dapat ID: buka folder → URL jadi `https://drive.google.com/drive/folders/XXXXX` → salin `XXXXX`.

## TAB 2: Murid

```csv
ID,Nama,NoIC,Kelas
m01,A'ISYAH BINTI MOHD ASRAF,111128101460,1 Amanah
m02,AABHARANA A/P MUTHU,111111141474,1 Amanah
m03,ABBY CHAI ZHI HUI,090418140302,1 Bestari
```

**PENTING**: Isi SEMUA murid sekolah (679 orang) — sistem cross-check PDF dengan tab ini untuk tahu kelas.

## TAB 3: Kehadiran

```csv
NoIC,Nama,Jan 2026,Feb 2026,Mac 2026,Apr 2026,Mei 2026,Jun 2026,Jul 2026,Ogs 2026,Sep 2026,Okt 2026,Nov 2026,Dis 2026,Jumlah
111128101460,A'ISYAH BINTI MOHD ASRAF,0,0,0,1,0,1,0,0,0,0,0,0,2
111111141474,AABHARANA A/P MUTHU,2,3,2,0,0,2,3,1,0,0,0,0,13
```

**Kosongkan** — data diisi automatik oleh script extract setiap bulan.

## TAB 4: Arkib

```csv
Bulan,Status,Tarikh,FailID
Jan 2026,SELESAI,17-08-2026,
Feb 2026,MENUNGGU,17-08-2026,
```

---

## ⭐ FLOW BULANAN (Setiap Kali Kau Dapat PDF Baru Dari KPM)

### 1. Upload PDF dalam website
```
Website iMurid → Admin (admin123) → tab "Muat Naik Laporan"
→ pilih bulan → pilih fail PDF → Muat Naik
```
PDF disimpan dalam Drive + rekod dalam Arkib (status: MENUNGGU).

### 2. Extract & import (Jongos buat — 30 saat, 0 token)
```
Jongos run: extract_kehadiran.py <fail.pdf> --api <URL_API> --bulan "Mac 2026"
→ data bulan masuk tab Kehadiran
→ status Arkib → SELESAI
```

### 3. Website auto-update
```
Dashboard → graf bulanan terkini
Analisis → kelas kerap tidak hadir
Carian murid → trend terkumpul bulan ke bulan
```

---

## Cara Setup Penuh

1. Buka [sheets.new](https://sheets.new) → namakan "iMurid-SMPJI Data"
2. Extensions → Apps Script → paste `Code.gs` → Simpan
3. Run `setupSheet()` — tab auto-jadi (Tetapan, Murid, Kehadiran, Arkib)
4. Set `folderLaporan` dalam tab Tetapan (ID folder Drive)
5. Isi tab **Murid** — Nama, NoIC, Kelas (679 murid)
6. Deploy → Web app → Anyone → copy URL
7. Paste URL dalam `js/data.js` → `API_URL`
8. Push GitHub + deploy Vercel → siap!

## Nota

- **NoIC**: Google Sheets simpan sebagai nombor → 0 depan hilang. Sistem handle sendiri (padStart 12 digit).
- **Kolom bulan**: `Jan 2026` ... `Dis 2026` — jangan ubah nama header.
- **Import berulang**: run import untuk bulan sama = update nilai (tak duplikat).

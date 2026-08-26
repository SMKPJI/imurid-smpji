#!/usr/bin/env python3
"""
iMURID-SMPJI — Extract Data Kehadiran dari PDF KPM
====================================================
Guna: python3 extract_kehadiran.py <fail.pdf> [--bulan "Mac 2026"] [--api URL] [--output fail.csv]

Baca PDF "Analisis Rekod Tidak Hadir Mengikut Pelajar" (format KPM),
extract jadual (Bil | Nama+IC | 12 bulan | Jumlah),
dan:
  a) Simpan sebagai CSV (check dulu), ATAU
  b) POST terus ke Apps Script API (importKehadiran)

Format PDF KPM:
  Header: Bil | Nama | Jan 2026 | Feb 2026 | ... | Dis 2026 | Jumlah
  Setiap baris: Nama + NoIC (dalam sel sama, dipisah newline)

Guna pymupdf find_tables() — 0 token AI, pantas.
"""

import argparse
import json
import re
import sys
import urllib.request

try:
    import pymupdf  # pip install pymupdf
except ImportError:
    print("❌ pymupdf tak dipasang. Run: pip install pymupdf")
    sys.exit(1)

BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogs', 'Sep', 'Okt', 'Nov', 'Dis']


def extract_dari_pdf(path_pdf):
    """Extract semua baris murid dari PDF. Return list of dicts."""
    doc = pymupdf.open(path_pdf)
    murid = []
    seen = set()

    for p in range(len(doc)):
        page = doc[p]
        tabs = page.find_tables()
        for t in tabs.tables:
            rows = t.extract()
            for r in rows[1:]:  # skip header
                bil = str(r[0] or '').strip()
                if not bil.isdigit():
                    continue

                # Sel Nama mengandungi "NAMA\nNOIC"
                sel_nama = str(r[1] or '').strip()
                nama = sel_nama
                ic = ''
                if '\n' in sel_nama:
                    bahagian = sel_nama.split('\n')
                    nama = bahagian[0].strip()
                    # Cari 12 digit dalam bahagian kedua (atau mana-mana)
                    m = re.search(r'(\d{12})', sel_nama)
                    if m:
                        ic = m.group(1)

                # Kalau IC tak jumpa dalam sel nama, cari dalam sel lain
                if not ic:
                    for sel in r[2:]:
                        s = str(sel or '')
                        m = re.search(r'(\d{12})', s)
                        if m:
                            ic = m.group(1)
                            break

                # Nilai 12 bulan (kolum 2-13) + jumlah (kolum 14)
                nilai = []
                for x in r[2:14]:
                    try:
                        nilai.append(int(str(x or '0').strip() or 0))
                    except ValueError:
                        nilai.append(0)

                jumlah = 0
                try:
                    jumlah = int(str(r[14] or '0').strip() or 0)
                except ValueError:
                    jumlah = sum(nilai)

                # Skip jika nama kosong atau IC tak jumpa
                if not nama or not ic:
                    continue

                # Dedup (PDF mungkin ada header berulang per muka)
                key = ic
                if key in seen:
                    continue
                seen.add(key)

                murid.append({
                    'ic': ic,
                    'nama': nama,
                    'nilai': nilai,      # 12 nilai bulan
                    'jumlah': jumlah
                })

    return murid


def simpan_csv(murid, path_csv):
    with open(path_csv, 'w', encoding='utf-8') as f:
        f.write('NoIC,Nama,' + ','.join(BULAN) + ',Jumlah\n')
        for m in murid:
            f.write(m['ic'] + ',' + m['nama'] + ',' + ','.join(str(x) for x in m['nilai']) + ',' + str(m['jumlah']) + '\n')
    print(f'✅ CSV disimpan: {path_csv}')


def post_api(murid, api_url, bulan):
    payload = {
        'action': 'importKehadiran',
        'bulan': bulan,
        'rows': murid
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        api_url,
        data=data,
        headers={'Content-Type': 'text/plain;charset=utf-8'}
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            hasil = json.loads(resp.read().decode('utf-8'))
            if hasil.get('success'):
                print(f"✅ Import {bulan} BERJAYA: {hasil.get('message', '')}")
            else:
                print(f"❌ Import gagal: {hasil.get('error', 'unknown')}")
            return hasil
    except Exception as e:
        print(f"❌ Ralat API: {e}")
        return None


def main():
    ap = argparse.ArgumentParser(description='Extract kehadiran dari PDF KPM')
    ap.add_argument('pdf', help='Laluan ke fail PDF')
    ap.add_argument('--bulan', default='', help='Nama bulan, contoh: "Mac 2026"')
    ap.add_argument('--api', default='', help='URL API Apps Script')
    ap.add_argument('--output', default='', help='Laluan fail CSV output')
    args = ap.parse_args()

    print(f'📄 Membaca: {args.pdf}')
    murid = extract_dari_pdf(args.pdf)
    print(f'✅ {len(murid)} murid di-extract')

    if not murid:
        print('❌ Tiada data. Semak format PDF.')
        sys.exit(1)

    # Preview 3
    print('\nContoh:')
    for m in murid[:3]:
        print(f"  {m['nama'][:40]} | IC: {m['ic']} | Jumlah: {m['jumlah']}")

    if args.output:
        simpan_csv(murid, args.output)

    if args.api and args.bulan:
        post_api(murid, args.api, args.bulan)
    else:
        print('\n💡 Guna --api <URL> --bulan "Mac 2026" untuk import terus ke Google Sheet.')


if __name__ == '__main__':
    main()

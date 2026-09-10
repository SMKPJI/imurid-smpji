"""
iMURID-SMPJI — Vercel Serverless Function: Extract Kehadiran dari PDF
=====================================================================
Terima POST JSON: {pdf_b64}
Guna pymupdf untuk extract data murid dari PDF KPM.
Return JSON: {success, rows: [{ic, nama, nilai:[12], jumlah}]}

Endpoint: <Vercel-URL>/api/extract
"""

import base64
import json
import re

try:
    import pymupdf  # PyMuPDF
except ImportError:  # pragma: no cover
    pymupdf = None

BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogs', 'Sep', 'Okt', 'Nov', 'Dis']


def extract_dari_bytes(data_bytes):
    """Extract semua baris murid dari PDF bytes. Return list of dicts."""
    doc = pymupdf.open(stream=data_bytes, filetype="pdf")
    murid = []
    seen = set()

    for page in doc:
        tabs = page.find_tables()
        for t in tabs.tables:
            rows = t.extract()
            for r in rows[1:]:  # skip header
                bil = str(r[0] or '').strip()
                if not bil.isdigit():
                    continue

                # Sel Nama mungkin "NAMA\nNOIC"
                sel_nama = str(r[1] or '').strip()
                nama = sel_nama
                ic = ''
                m = re.search(r'(\d{12})', sel_nama)
                if m:
                    ic = m.group(1)
                    nama = sel_nama.replace(ic, '').strip().rstrip('\n').strip()

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

                # Clean nama: buang nombor/IC sisa
                nama = re.sub(r'\d{6,}', '', nama).strip()
                nama = re.sub(r'[\s]+', ' ', nama).strip()

                if not nama or not ic:
                    continue

                key = ic
                if key in seen:
                    continue
                seen.add(key)

                murid.append({
                    'ic': ic,
                    'nama': nama,
                    'nilai': nilai,
                    'jumlah': jumlah
                })

    return murid


def handler(request):
    if request.method != 'POST':
        return json_response({'success': False, 'error': 'Method mesti POST.'}, 405)

    try:
        payload = request.get_json(silent=True) or {}
    except Exception:
        payload = {}

    pdf_b64 = payload.get('pdf_b64') or ''
    if not pdf_b64:
        return json_response({'success': False, 'error': 'pdf_b64 tiada.'}, 400)

    if pymupdf is None:
        return json_response({'success': False, 'error': 'pymupdf tidak dipasang di server.'}, 500)

    try:
        data_bytes = base64.b64decode(pdf_b64)
    except Exception as e:
        return json_response({'success': False, 'error': 'pdf_b64 tidak sah: ' + str(e)}, 400)

    try:
        rows = extract_dari_bytes(data_bytes)
    except Exception as e:
        return json_response({'success': False, 'error': 'Gagal baca PDF: ' + str(e)}, 422)

    if not rows:
        return json_response({
            'success': False,
            'error': 'Tiada data murid dijumpai dalam PDF. Semak format KPM.'
        }, 422)

    return json_response({'success': True, 'rows': rows})


def json_response(obj, status=200):
    from flask import jsonify
    body = jsonify(obj)
    body.status_code = status
    return body

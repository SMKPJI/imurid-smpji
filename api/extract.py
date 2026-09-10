"""
iMurid-SMPJI — Vercel Serverless Function: Extract Kehadiran dari PDF.
Terima POST JSON: {pdf_b64} dan pulangkan {success, rows}.
"""

import base64
import json
import re
from http.server import BaseHTTPRequestHandler

try:
    import pymupdf
except ImportError:  # pragma: no cover
    pymupdf = None


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if pymupdf is None:
            self._send({"success": False, "error": "pymupdf tidak dipasang di server."}, 500)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            pdf_b64 = payload.get("pdf_b64") or ""
            if not pdf_b64:
                self._send({"success": False, "error": "pdf_b64 tiada."}, 400)
                return

            data_bytes = base64.b64decode(pdf_b64)
            rows = extract_dari_bytes(data_bytes)
            if not rows:
                self._send(
                    {"success": False, "error": "Tiada data murid dijumpai dalam PDF."},
                    422,
                )
                return
            self._send({"success": True, "rows": rows}, 200)
        except Exception as error:
            self._send({"success": False, "error": "Gagal baca PDF: " + str(error)}, 422)

    def do_OPTIONS(self):
        self._send({}, 204)

    def _send(self, payload, status):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        if body and status != 204:
            self.wfile.write(body)

    def log_message(self, *_args):
        return


def extract_dari_bytes(data_bytes):
    """Extract semua baris murid daripada jadual PDF KPM."""
    doc = pymupdf.open(stream=data_bytes, filetype="pdf")
    murid = []
    seen = set()

    for page in doc:
        tabs = page.find_tables()
        for table in tabs.tables:
            for row in table.extract()[1:]:
                if not str(row[0] or "").strip().isdigit():
                    continue

                sel_nama = str(row[1] or "").strip()
                match = re.search(r"(\d{12})", sel_nama)
                if not match:
                    for cell in row[2:]:
                        match = re.search(r"(\d{12})", str(cell or ""))
                        if match:
                            break
                if not match:
                    continue

                ic = match.group(1)
                if ic in seen:
                    continue
                nama = re.sub(r"\d{6,}", "", sel_nama)
                nama = re.sub(r"\s+", " ", nama).strip()
                if not nama:
                    continue

                nilai = []
                for cell in row[2:14]:
                    try:
                        nilai.append(int(str(cell or "0").strip() or 0))
                    except ValueError:
                        nilai.append(0)
                while len(nilai) < 12:
                    nilai.append(0)

                try:
                    jumlah = int(str(row[14] or "0").strip() or 0)
                except (ValueError, IndexError):
                    jumlah = sum(nilai)

                seen.add(ic)
                murid.append({"ic": ic, "nama": nama, "nilai": nilai, "jumlah": jumlah})

    return murid

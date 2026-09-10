"""
iMurid-SMPJI — proxy same-origin ke Google Apps Script.

Browser -> /api/proxy pada domain Vercel sendiri
       -> Google Apps Script Web App
"""

import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlsplit


APPS_SCRIPT_URL = os.environ.get(
    "IMURID_APPS_SCRIPT_URL",
    "https://script.google.com/macros/s/AKfycbwSG1L_YdZDacKBx1oaPfPBf0q5_qVj9TjT6jut8ok00LFKAMglE7z1fQXDjfAXo_O_/exec",
)


class handler(BaseHTTPRequestHandler):
    """Vercel Python serverless handler."""

    def do_OPTIONS(self):
        self._send(b"", 204, "text/plain")

    def do_GET(self):
        self._forward("GET")

    def do_POST(self):
        self._forward("POST")

    def _forward(self, method):
        request_url = urlsplit(self.path)
        target_url = APPS_SCRIPT_URL
        if request_url.query:
            target_url += "?" + request_url.query

        body = None
        if method == "POST":
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length)

        upstream_request = urllib.request.Request(
            target_url,
            data=body,
            headers={
                "Accept": "application/json",
                "Content-Type": "text/plain;charset=utf-8",
            },
            method=method,
        )

        try:
            with urllib.request.urlopen(upstream_request, timeout=120) as upstream:
                response_body = upstream.read()
                status = upstream.status
                content_type = upstream.headers.get(
                    "Content-Type", "application/json; charset=utf-8"
                )
        except urllib.error.HTTPError as error:
            response_body = error.read()
            status = error.code
            content_type = error.headers.get(
                "Content-Type", "application/json; charset=utf-8"
            )
        except Exception as error:
            response_body = json.dumps(
                {
                    "success": False,
                    "error": "Proxy gagal menghubungi Apps Script: " + str(error),
                }
            ).encode("utf-8")
            status = 502
            content_type = "application/json; charset=utf-8"

        self._send(response_body, status, content_type.split(";", 1)[0])

    def _send(self, body, status, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def log_message(self, *_args):
        return

"""
iMurid-SMPJI — proxy same-origin ke Google Apps Script.

Browser -> /api/proxy pada domain Vercel sendiri
       -> Google Apps Script Web App

Ini mengelakkan browser tersekat pada redirect Google Apps Script yang tidak
sentiasa membawa header CORS pada respons pertama.
"""

import json
import os
import urllib.error
import urllib.request

from flask import Response, request


APPS_SCRIPT_URL = os.environ.get(
    "IMURID_APPS_SCRIPT_URL",
    "https://script.google.com/macros/s/AKfycbwSG1L_YdZDacKBx1oaPfPBf0q5_qVj9TjT6jut8ok00LFKAMglE7z1fQXDjfAXo_O_/exec",
)


def handler(_request):
    """Terima GET/POST daripada frontend dan teruskan ke Apps Script."""
    method = request.method.upper()
    query = request.query_string.decode("utf-8", errors="replace")
    target_url = APPS_SCRIPT_URL + ("?" + query if query else "")

    body = request.get_data(cache=False) if method not in ("GET", "HEAD") else None
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

    return Response(
        response_body,
        status=status,
        content_type=content_type.split(";", 1)[0],
        headers={
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    )

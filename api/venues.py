"""Vercel function for creating café venues.

The browser calls this endpoint instead of Supabase directly so the Supabase
secret key remains server-side and can safely bypass Row Level Security.
"""

import json
import os
from http.server import BaseHTTPRequestHandler
from typing import Any, Dict, Tuple

from supabase import Client, create_client


def send_json(request: BaseHTTPRequestHandler, status: int, payload: Dict[str, Any]) -> None:
    """Write a JSON response with a consistent content type."""
    request.send_response(status)
    request.send_header("Content-Type", "application/json")
    request.end_headers()
    request.wfile.write(json.dumps(payload).encode("utf-8"))


def read_json_body(request: BaseHTTPRequestHandler) -> Tuple[Dict[str, Any], str]:
    """Return the request JSON object, or an error message for malformed input."""
    try:
        content_length = int(request.headers.get("Content-Length", "0"))
        body = request.rfile.read(content_length)
        data = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError):
        return {}, "Request body must be valid JSON."

    if not isinstance(data, dict):
        return {}, "Request body must be a JSON object."

    return data, ""


def get_supabase_client() -> Client:
    """Create the server-only client from Vercel environment variables."""
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be configured.")
    return create_client(supabase_url, supabase_key)


class handler(BaseHTTPRequestHandler):
    """Handle POST /api/venues."""

    def do_POST(self) -> None:
        payload, error = read_json_body(self)
        if error:
            send_json(self, 400, {"error": error})
            return

        name = payload.get("name")
        suburb = payload.get("suburb")
        seats = payload.get("seats")

        # bool is intentionally rejected even though bool is an int subclass.
        if not isinstance(name, str) or not name.strip():
            send_json(self, 400, {"error": "name is required."})
            return
        if not isinstance(suburb, str) or not suburb.strip():
            send_json(self, 400, {"error": "suburb is required."})
            return
        if isinstance(seats, bool) or not isinstance(seats, int) or seats < 1:
            send_json(self, 400, {"error": "seats must be a positive whole number."})
            return

        try:
            result = (
                get_supabase_client()
                .table("venues")
                .insert({"name": name.strip(), "suburb": suburb.strip(), "seats": seats})
                .execute()
            )
            venue = result.data[0] if result.data else None
            if not venue or not venue.get("id"):
                raise RuntimeError("Supabase did not return the new venue.")
        except Exception as exc:
            # Do not expose database implementation details to the browser.
            print(f"Unable to create venue: {exc}")
            send_json(self, 500, {"error": "Trim could not save your venue. Please try again."})
            return

        send_json(self, 201, {"id": venue["id"]})

    def do_GET(self) -> None:
        send_json(self, 405, {"error": "Method not allowed."})

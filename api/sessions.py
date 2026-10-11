"""Vercel function for saving and reading daily waste-log sessions."""

import json
import os
from http.server import BaseHTTPRequestHandler
from typing import Any, Dict, List, Tuple
from urllib.parse import parse_qs, urlparse

from supabase import Client, create_client


def send_json(request: BaseHTTPRequestHandler, status: int, payload: Dict[str, Any]) -> None:
    """Write a JSON response with a consistent content type."""
    request.send_response(status)
    request.send_header("Content-Type", "application/json")
    request.end_headers()
    request.wfile.write(json.dumps(payload, default=str).encode("utf-8"))


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


def is_number(value: Any) -> bool:
    """Numbers sent in JSON may be ints or floats, but never booleans."""
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def validate_session_payload(payload: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]], str]:
    """Validate and prepare the session row and the related entry rows."""
    venue_id = payload.get("venue_id")
    duration_seconds = payload.get("duration_seconds")
    estimated_value = payload.get("estimated_value")
    status = payload.get("status")
    entries = payload.get("entries")

    if not isinstance(venue_id, str) or not venue_id.strip():
        return {}, [], "venue_id is required."
    if isinstance(duration_seconds, bool) or not isinstance(duration_seconds, int) or duration_seconds < 0:
        return {}, [], "duration_seconds must be a non-negative whole number."
    if not is_number(estimated_value) or estimated_value < 0:
        return {}, [], "estimated_value must be a non-negative number."
    if not isinstance(status, str) or not status.strip():
        return {}, [], "status is required."
    if not isinstance(entries, list) or not entries:
        return {}, [], "entries must contain at least one waste entry."

    prepared_entries: List[Dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            return {}, [], "Each entry must be a JSON object."

        item_name = entry.get("item_name")
        waste_level = entry.get("waste_level")
        unit_cost = entry.get("unit_cost")
        if not isinstance(item_name, str) or not item_name.strip():
            return {}, [], "Each entry requires item_name."
        if not isinstance(waste_level, str) or not waste_level.strip():
            return {}, [], "Each entry requires waste_level."
        if not is_number(unit_cost) or unit_cost < 0:
            return {}, [], "Each entry requires a non-negative unit_cost."

        prepared_entries.append(
            {"item_name": item_name.strip(), "waste_level": waste_level.strip(), "unit_cost": unit_cost}
        )

    session_row = {
        "venue_id": venue_id.strip(),
        "duration_seconds": duration_seconds,
        "estimated_value": estimated_value,
        "status": status.strip(),
    }
    return session_row, prepared_entries, ""


class handler(BaseHTTPRequestHandler):
    """Handle POST and GET requests for /api/sessions."""

    def do_POST(self) -> None:
        payload, error = read_json_body(self)
        if error:
            send_json(self, 400, {"error": error})
            return

        session_row, entries, error = validate_session_payload(payload)
        if error:
            send_json(self, 400, {"error": error})
            return

        client = None
        session_id = None
        try:
            client = get_supabase_client()
            session_result = client.table("log_sessions").insert(session_row).execute()
            session = session_result.data[0] if session_result.data else None
            if not session or not session.get("id"):
                raise RuntimeError("Supabase did not return the new session.")

            session_id = session["id"]
            entry_rows = [{**entry, "session_id": session_id} for entry in entries]
            client.table("waste_entries").insert(entry_rows).execute()
        except Exception as exc:
            # Supabase REST inserts are separate requests. Clean up the session if
            # the entry insert fails, so the API does not leave a partial log behind.
            if client is not None and session_id is not None:
                try:
                    client.table("log_sessions").delete().eq("id", session_id).execute()
                except Exception as cleanup_error:
                    print(f"Unable to clean up partial session {session_id}: {cleanup_error}")
            print(f"Unable to create waste-log session: {exc}")
            send_json(self, 500, {"error": "Trim could not save your closing log. Please try again."})
            return

        send_json(self, 201, {"id": session_id})

    def do_GET(self) -> None:
        query = parse_qs(urlparse(self.path).query)
        venue_id = query.get("venue_id", [""])[0].strip()
        if not venue_id:
            send_json(self, 400, {"error": "venue_id query parameter is required."})
            return

        try:
            client = get_supabase_client()
            session_result = (
                client.table("log_sessions")
                .select("id, venue_id, duration_seconds, estimated_value, status, created_at")
                .eq("venue_id", venue_id)
                .order("created_at", desc=True)
                .execute()
            )
            sessions = session_result.data or []
            session_ids = [session["id"] for session in sessions]

            entries_by_session: Dict[str, List[Dict[str, Any]]] = {session_id: [] for session_id in session_ids}
            if session_ids:
                entry_result = (
                    client.table("waste_entries")
                    .select("id, session_id, item_name, waste_level, unit_cost, created_at")
                    .in_("session_id", session_ids)
                    .order("created_at", desc=False)
                    .execute()
                )
                for entry in entry_result.data or []:
                    entries_by_session.setdefault(entry["session_id"], []).append(entry)

            for session in sessions:
                session["entries"] = entries_by_session.get(session["id"], [])
        except Exception as exc:
            print(f"Unable to fetch waste-log sessions: {exc}")
            send_json(self, 500, {"error": "Trim could not load past sessions. Please try again."})
            return

        send_json(self, 200, {"sessions": sessions})

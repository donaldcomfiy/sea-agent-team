# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import logging
import os
import re
from urllib.parse import unquote

# Helper to load .env files safely
def load_dotenv():
    paths_to_check = [
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
    ]
    for path in paths_to_check:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, val = line.split("=", 1)
                        key = key.strip()
                        val = val.strip().strip("'\"")
                        if key and key not in os.environ:
                            os.environ[key] = val

load_dotenv()

# Map VITE_GEMINI_API_KEY to GEMINI_API_KEY for convenience
if "VITE_GEMINI_API_KEY" in os.environ and not os.environ.get("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.environ["VITE_GEMINI_API_KEY"]

import google.auth
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
# Note: StaticFiles is no longer imported — the scaffold frontend mount was
# removed (see comment near line 685). Re-add `from fastapi.staticfiles import
# StaticFiles` if you ever revive an internal SPA mount.
from google.adk.cli.fast_api import get_fast_api_app
from google.cloud import logging as google_cloud_logging
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.firebase_auth import get_current_user, get_user_id
from app.user_context import reset_current_user_id, set_current_user_id

from app import conversation_store, google_ads_client, google_ads_oauth, google_ads_settings
from app.app_utils.telemetry import setup_telemetry
from app.app_utils.typing import Feedback

setup_telemetry()

# Setup logger safely, fallback to Python logging if GCP credentials are not present
logger = None
try:
    _, project_id = google.auth.default()
    logging_client = google_cloud_logging.Client()
    logger = logging_client.logger(__name__)
except Exception:
    import logging
    logger = logging.getLogger(__name__)
def _normalize_origin(origin: str) -> str:
    return origin.strip().rstrip("/")


def _parse_allow_origins() -> list[str] | None:
    raw = os.getenv("ALLOW_ORIGINS", "")
    if not raw:
        return None
    origins = [_normalize_origin(origin) for origin in raw.split(",")]
    origins = [origin for origin in origins if origin]
    return origins or None


allow_origins = _parse_allow_origins()

# Artifact bucket for ADK (created by Terraform, passed via env var)
logs_bucket_name = os.environ.get("LOGS_BUCKET_NAME")

AGENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# In-memory session configuration - no persistent storage
session_service_uri = None

artifact_service_uri = f"gs://{logs_bucket_name}" if logs_bucket_name else None

# Check if we have GCP credentials to enable otel_to_cloud
has_gcp_creds = False
try:
    import google.auth
    google.auth.default()
    has_gcp_creds = True
except Exception:
    pass

otel_to_cloud = has_gcp_creds and os.environ.get("OTEL_TO_CLOUD", "false").lower() == "true"

# web=False disables the bundled ADK Angular dev UI (and its builder endpoints)
# so we can serve our own SPA at "/" instead. The agent API routes (/run_sse,
# /apps/.../sessions, ...) are registered regardless of this flag.
app: FastAPI = get_fast_api_app(
    agents_dir=AGENT_DIR,
    web=False,
    artifact_service_uri=artifact_service_uri,
    allow_origins=allow_origins,
    session_service_uri=session_service_uri,
    otel_to_cloud=otel_to_cloud,
)
app.title = "sea-team-lead"
app.description = "API for interacting with the Agent sea-team-lead"

if allow_origins:
    # Apply an explicit top-level CORS middleware for all custom routes and
    # error responses. The ADK app already gets allow_origins, but our own
    # auth/middleware stack can otherwise produce 401/403 responses without the
    # CORS headers Chrome expects.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


def _enforce_auth_if_enabled(request: Request) -> None:
    """Require a valid Firebase token when auth is configured, else no-op."""
    get_current_user(request)


def _request_user_id(request: Request) -> str:
    """User scope for per-user integration settings.

    With Firebase enabled we always use the verified token UID. In local dev we
    fall back to a stable single-user id so the app remains usable without a
    Firebase setup.
    """
    user = get_current_user(request)
    if user:
        return user.uid
    return "local-dev"


def _validate_adk_user_scope(request: Request) -> JSONResponse | None:
    """Block cross-user ADK access when Firebase auth is enabled.

    The bundled ADK routes accept the user ID in either the URL
    (`/apps/.../users/{user_id}/...`) or the JSON body (`/run_sse`). When a
    verified Firebase token is present we enforce that those user IDs match the
    authenticated UID, preventing a caller from swapping in another user's ID.
    """
    user = get_current_user(request)
    if user is None:
        return None

    path = request.url.path
    if path.startswith("/apps/"):
        parts = [unquote(p) for p in path.split("/") if p]
        if len(parts) >= 5 and parts[2] == "users":
            requested_user_id = parts[3]
            if requested_user_id != user.uid:
                return JSONResponse(status_code=403, content={"detail": "user_id passt nicht zum Token"})

    if path == "/run_sse":
        try:
            import json

            payload = json.loads(request._body.decode("utf-8")) if hasattr(request, "_body") else {}
        except Exception:
            payload = {}
        requested_user_id = payload.get("user_id")
        if requested_user_id and requested_user_id != user.uid:
            return JSONResponse(status_code=403, content={"detail": "user_id passt nicht zum Token"})

    return None


@app.middleware("http")
async def enforce_user_scope(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    if path == "/run_sse":
        await request.body()

    context_user_id: str | None = None
    context_token = None
    should_reset = True
    try:
        if path.startswith("/apps/") or path == "/run_sse":
            scoped_response = _validate_adk_user_scope(request)
            if scoped_response is not None:
                return scoped_response

            requested_user_id: str | None = None
            user = get_current_user(request)
            if user:
                requested_user_id = user.uid
            elif path.startswith("/apps/"):
                parts = [unquote(p) for p in path.split("/") if p]
                if len(parts) >= 5 and parts[2] == "users":
                    requested_user_id = parts[3]
            elif path == "/run_sse":
                try:
                    import json

                    payload = json.loads(request._body.decode("utf-8")) if hasattr(request, "_body") else {}
                except Exception:
                    payload = {}
                requested_user_id = payload.get("user_id") or "local-dev"

            context_user_id = requested_user_id
            if path == "/run_sse":
                # The SSE response continues streaming after the middleware gets
                # the response object back, so resetting here would drop the
                # request-scoped user before downstream tool calls finish.
                should_reset = False
        elif path.startswith("/google-ads") or path.startswith("/google-sheets") or path == "/integrations/status":
            context_user_id = _request_user_id(request)

        context_token = set_current_user_id(context_user_id)

        return await call_next(request)
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    finally:
        if should_reset and context_token is not None:
            reset_current_user_id(context_token)


@app.post("/feedback")
@limiter.limit("10/minute")
def collect_feedback(request: Request, feedback: Feedback) -> dict[str, str]:
    """Collect and log feedback.

    Args:
        feedback: The feedback data to log

    Returns:
        Success message
    """
    if hasattr(logger, "log_struct"):
        logger.log_struct(feedback.model_dump(), severity="INFO")
    else:
        logger.info(f"Feedback: {feedback.model_dump()}")
    return {"status": "success"}


# --- Generated Excel exports ---
# save_campaign_as_excel writes .xlsx files to data/exports/. This endpoint
# lets the browser download them by name. (Cloud Run note: the filesystem is
# per-instance and ephemeral; for multi-instance reliability move exports to
# GCS later.)
EXPORTS_DIR = os.path.join(AGENT_DIR, "data", "exports")


@app.get("/exports/{filename}")
def download_export(filename: str) -> FileResponse:
    """Serve a generated Excel campaign file by name from data/exports/."""
    safe_name = os.path.basename(filename)
    base = os.path.realpath(EXPORTS_DIR)
    filepath = os.path.realpath(os.path.join(base, safe_name))
    if not filepath.startswith(base + os.sep) or not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    return FileResponse(
        filepath,
        filename=safe_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


# --- Google Sheets Export ---

def get_drive_access_token(user_id: str | None = None) -> str:
    from app.google_ads_settings import get_config
    cfg = get_config(user_id)
    client_id = cfg.get("client_id")
    client_secret = cfg.get("client_secret")
    refresh_token = cfg.get("refresh_token")
    if not client_id or not client_secret or not refresh_token:
        raise ValueError("Google Ads/Drive Credentials fehlen in den Einstellungen. Bitte verknüpfe zuerst dein Google-Konto in den Einstellungen.")
    
    import requests
    resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=(10, 20),
    )
    if resp.status_code != 200:
        raise ValueError(f"Fehler beim Erneuern des Google Tokens: {resp.text}")
    return resp.json()["access_token"]


_KNOWN_CARD_TYPES = {"ads", "strategy", "keywords", "landing_page_analysis", "campaign_build"}


def _extract_json_cards(text: str) -> list[dict]:
    """Pull every ```json fenced block out of an agent message and return the
    ones that parse cleanly and carry a known card type. Order is preserved so
    the export reads top-to-bottom."""
    import json
    import re

    out: list[dict] = []
    for m in re.finditer(r"```json\s*(.*?)```", text, flags=re.DOTALL):
        try:
            obj = json.loads(m.group(1).strip())
        except Exception:
            continue
        if isinstance(obj, dict) and obj.get("type") in _KNOWN_CARD_TYPES:
            out.append(obj)
    return out


def _ads_card_to_rows(card: dict) -> list[list[str]]:
    """Flatten an 'ads' card (one bubble per ad group with positions/headlines
    and descriptions) into spreadsheet rows. One row per headline/description,
    columns for the ad group, the position label, the text itself, the length
    and the Google-Ads limit so an editor can scan compliance at a glance."""
    rows: list[list[str]] = [["Ad Group", "Section", "Position", "Text", "Zeichen", "Limit", "OK"]]
    for ag in card.get("ad_groups") or []:
        name = str(ag.get("name") or "")
        positions = ag.get("positions") or []
        if positions:
            for i, pos in enumerate(positions):
                label = str(pos.get("label") or f"Pos {i + 1}")
                for h in pos.get("headlines") or []:
                    t = str(h)
                    rows.append([name, "Headline", label, t, str(len(t)), "30", "OK" if len(t) <= 30 else "ZU LANG"])
        else:
            for i, h in enumerate(ag.get("headlines") or []):
                t = str(h)
                rows.append([name, "Headline", f"Pos {i + 1}", t, str(len(t)), "30", "OK" if len(t) <= 30 else "ZU LANG"])
        for i, d in enumerate(ag.get("descriptions") or []):
            t = str(d)
            rows.append([name, "Description", f"Desc {i + 1}", t, str(len(t)), "90", "OK" if len(t) <= 90 else "ZU LANG"])
        rows.append([])
    return rows


def _strategy_card_to_rows(card: dict) -> list[list[str]]:
    rows: list[list[str]] = [
        ["Kampagne", "Typ", "Budget/Tag", "Budget %", "Gebotsstrategie", "Conversion-Ziel", "Purpose"],
    ]
    for c in card.get("campaigns") or []:
        rows.append([
            str(c.get("name") or ""),
            str(c.get("campaign_type") or ""),
            f"{c.get('daily_budget_eur', '')} EUR",
            f"{c.get('budget_share_percent', '')} %",
            str(c.get("bid_strategy") or ""),
            str(c.get("primary_conversion_goal") or ""),
            str(c.get("purpose") or ""),
        ])
    rows.append([])
    geo = card.get("geo_targeting") or []
    lang = card.get("language_targeting") or ""
    rows.append(["Geo-Targeting", ", ".join(geo) if isinstance(geo, list) else str(geo)])
    rows.append(["Sprache", str(lang)])
    rows.append(["Tagesbudget gesamt", f"{card.get('total_daily_budget_eur', '')} EUR"])
    neg = card.get("recommended_negative_keywords") or []
    if neg:
        rows.append([])
        rows.append(["Negative Keywords (Starter)"])
        for n in neg:
            rows.append(["", str(n)])
    pmax = card.get("pmax_recommendation") or ""
    if pmax:
        rows.append([])
        rows.append(["PMax-Empfehlung", str(pmax)])
    return rows


def _keywords_card_to_rows(card: dict) -> list[list[str]]:
    rows: list[list[str]] = [["Kampagne", "Anzeigengruppe", "Keyword", "Match Type", "Use in Copy"]]
    for camp in card.get("campaigns") or []:
        camp_name = str(camp.get("name") or "") if isinstance(camp, dict) else ""
        for ag in (camp.get("ad_groups") or []) if isinstance(camp, dict) else []:
            ag_name = str(ag.get("name") or "") if isinstance(ag, dict) else ""
            for kw in (ag.get("keywords") or []) if isinstance(ag, dict) else []:
                if isinstance(kw, dict):
                    rows.append([
                        camp_name,
                        ag_name,
                        str(kw.get("keyword") or ""),
                        str(kw.get("match_type") or ""),
                        "Ja" if kw.get("use_in_copy") else "Nein",
                    ])
        neg = (camp.get("campaign_negatives") or []) if isinstance(camp, dict) else []
        if neg:
            for n in neg:
                rows.append([camp_name, "(Negatives)", str(n), "NEGATIVE", ""])
        rows.append([])
    return rows


def _lp_card_to_rows(card: dict) -> list[list[str]]:
    rows: list[list[str]] = []
    simple_fields = [
        ("Domain", "domain"), ("Branche", "industry"), ("Sprache", "language"),
        ("Markenname", "brand_name"), ("Tagline", "brand_tagline"),
    ]
    for label, key in simple_fields:
        val = card.get(key, "")
        if val:
            rows.append([label, str(val)])
    for label, key in [("Tonalität", "tonality"), ("Geo", "geography")]:
        val = card.get(key) or []
        if val:
            rows.append([label, ", ".join(str(v) for v in val) if isinstance(val, list) else str(val)])
    rows.append([])
    for section, key in [
        ("Brand USPs", "brand_usps"), ("Product USPs", "product_usps"),
        ("Brand Offers", "brand_offers"), ("Product Offers", "product_offers"),
        ("Conversion Goals", "conversion_goals"),
    ]:
        items = card.get(key) or []
        if items:
            rows.append([section])
            for item in items:
                rows.append(["", str(item)])
            rows.append([])
    return rows


def _campaign_build_to_rows(card: dict) -> list[list[str]]:
    rows: list[list[str]] = []
    rows.append(["Status", str(card.get("status", ""))])
    acc_name = card.get("target_account_name", "")
    acc_id = card.get("target_account_id", "")
    if acc_name or acc_id:
        rows.append(["Zielkonto", f"{acc_name} ({acc_id})"])
    rows.append([])
    rows.append(["Kampagne", "Anzeigengruppen"])
    for camp in card.get("campaigns") or []:
        if isinstance(camp, dict):
            ags = camp.get("ad_groups") or []
            rows.append([str(camp.get("name", "")), ", ".join(str(a) for a in ags)])
    return rows


def _all_markdown_tables_to_rows(text: str) -> list[list[str]]:
    """Walk every markdown table in the text (not just the first), separated by
    blank rows. Used as a fallback when no structured card is present."""
    import re

    rows: list[list[str]] = []
    cur: list[list[str]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("|") and stripped.endswith("|"):
            if re.match(r"^\|[\s\-:|]*\|$", stripped):
                continue  # skip the |---|---| separator
            cells = [p.strip() for p in stripped.split("|")]
            cur.append(cells[1:-1])
        elif cur:
            rows.extend(cur)
            rows.append([])
            cur = []
    if cur:
        rows.extend(cur)
    return rows


def markdown_to_csv(markdown_text: str) -> str:
    """Build a tidy CSV from an agent message.

    Priority chain so each agent's output lands in the spreadsheet in the most
    useful shape — structured cards first, then any markdown tables, then a
    single-cell fallback so we never lose data:
      1. Parse ```json``` cards (strategy / keywords / ads). For 'ads' each
         headline and description becomes its own row with length/limit/OK
         columns so the recipient can spot violations immediately.
      2. Concatenate all markdown tables found in the prose.
      3. Wrap the whole text in a single 'Agent-Nachricht' cell.
    """
    import io
    import csv

    cards = _extract_json_cards(markdown_text)
    sections: list[tuple[str, list[list[str]]]] = []
    _card_parsers = {
        "ads": ("Anzeigentexte (RSA)", _ads_card_to_rows),
        "strategy": ("Strategie", _strategy_card_to_rows),
        "keywords": ("Keywords", _keywords_card_to_rows),
        "landing_page_analysis": ("Landingpage-Analyse", _lp_card_to_rows),
        "campaign_build": ("Kampagnen-Setup", _campaign_build_to_rows),
    }
    for card in cards:
        ctype = card.get("type")
        if ctype in _card_parsers:
            label, parser = _card_parsers[ctype]
            sections.append((label, parser(card)))

    if not sections:
        table_rows = _all_markdown_tables_to_rows(markdown_text)
        if table_rows:
            sections.append(("Tables", table_rows))

    if not sections:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Agent-Nachricht"])
        writer.writerow([markdown_text])
        return output.getvalue()

    output = io.StringIO()
    writer = csv.writer(output)
    for i, (label, rows) in enumerate(sections):
        if i > 0:
            writer.writerow([])  # blank line between sections
        # Section header on its own line keeps the sheet readable when multiple
        # card types are exported in one go.
        # Plain-text section marker — must NOT start with '=' because Google
        # Sheets parses any leading '=' as the beginning of a formula and
        # surfaces a #ERROR! on import.
        writer.writerow([f"--- {label} ---"])
        for r in rows:
            writer.writerow(r)
    return output.getvalue()


class ExportTextPayload(BaseModel):
    text: str
    title: str = "Agent-Export"


@app.post("/google-sheets/export-file")
@limiter.limit("10/minute")
def export_file_to_sheets(request: Request, payload: dict) -> dict:
    _enforce_auth_if_enabled(request)
    user_id = _request_user_id(request)
    filename = payload.get("filename")
    if not filename:
        raise HTTPException(status_code=400, detail="Filename erforderlich")
    
    safe_name = os.path.basename(filename)
    base = os.path.realpath(EXPORTS_DIR)
    filepath = os.path.realpath(os.path.join(base, safe_name))
    if not filepath.startswith(base + os.sep) or not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Excel-Datei nicht gefunden")
    
    try:
        access_token = get_drive_access_token(user_id)
    except Exception:
        # Fallback for Demo/Mock Mode: Return a simulated view-only template spreadsheet URL
        demo_url = "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing"
        return {"status": "success", "url": demo_url, "demo": True}
        
    try:
        import requests
        import json
        
        metadata = {
            "name": safe_name.replace(".xlsx", ""),
            "mimeType": "application/vnd.google-apps.spreadsheet"
        }
        multipart_data = {
            "metadata": (None, json.dumps(metadata), "application/json"),
            "file": (safe_name, open(filepath, "rb"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        }
        upload_resp = requests.post(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            headers={"Authorization": f"Bearer {access_token}"},
            files=multipart_data,
            timeout=(15, 30),
        )
        if upload_resp.status_code != 200:
            # Special-case the "missing scope" 403: the existing refresh token was
            # granted before Drive scope was added — point the user at the fix
            # instead of dumping Google's raw JSON.
            if upload_resp.status_code == 403 and "insufficient" in upload_resp.text.lower():
                raise ValueError(
                    "Dein gespeicherter Google-Token hat keine Drive-Berechtigung. "
                    "Bitte in den Einstellungen erneut auf 'Mit Google verbinden' "
                    "klicken und beim Consent-Screen Drive zustimmen."
                )
            raise ValueError(f"Drive-Upload fehlgeschlagen: {upload_resp.text}")
            
        file_id = upload_resp.json()["id"]
        
        requests.post(
            f"https://www.googleapis.com/drive/v3/files/{file_id}/permissions",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json={"role": "reader", "type": "anyone"},
            timeout=(10, 20),
        )
        
        sheet_url = f"https://docs.google.com/spreadsheets/d/{file_id}/edit"
        return {"status": "success", "url": sheet_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google Sheets Export fehlgeschlagen: {str(e)}")


@app.post("/google-sheets/export-text")
@limiter.limit("10/minute")
def export_text_to_sheets(request: Request, payload: ExportTextPayload) -> dict:
    _enforce_auth_if_enabled(request)
    user_id = _request_user_id(request)
    try:
        access_token = get_drive_access_token(user_id)
    except Exception:
        # Fallback for Demo/Mock Mode: Return a simulated spreadsheet URL
        demo_url = "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing"
        return {"status": "success", "url": demo_url, "demo": True}
        
    try:
        csv_content = markdown_to_csv(payload.text)
        
        import requests
        import json
        
        metadata = {
            "name": payload.title,
            "mimeType": "application/vnd.google-apps.spreadsheet"
        }
        multipart_data = {
            "metadata": (None, json.dumps(metadata), "application/json"),
            "file": (payload.title + ".csv", csv_content.encode("utf-8"), "text/csv")
        }
        upload_resp = requests.post(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            headers={"Authorization": f"Bearer {access_token}"},
            files=multipart_data,
            timeout=(15, 30),
        )
        if upload_resp.status_code != 200:
            # Special-case the "missing scope" 403: the existing refresh token was
            # granted before Drive scope was added — point the user at the fix
            # instead of dumping Google's raw JSON.
            if upload_resp.status_code == 403 and "insufficient" in upload_resp.text.lower():
                raise ValueError(
                    "Dein gespeicherter Google-Token hat keine Drive-Berechtigung. "
                    "Bitte in den Einstellungen erneut auf 'Mit Google verbinden' "
                    "klicken und beim Consent-Screen Drive zustimmen."
                )
            raise ValueError(f"Drive-Upload fehlgeschlagen: {upload_resp.text}")
            
        file_id = upload_resp.json()["id"]
        
        requests.post(
            f"https://www.googleapis.com/drive/v3/files/{file_id}/permissions",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json={"role": "reader", "type": "anyone"},
            timeout=(10, 20),
        )
        
        sheet_url = f"https://docs.google.com/spreadsheets/d/{file_id}/edit"
        return {"status": "success", "url": sheet_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google Sheets Export fehlgeschlagen: {str(e)}")


# --- Conversation history ---
# Persists the rendered chat transcript per user so the sidebar can list past
# conversations and reload them. Backend is MongoDB Atlas when
# MDB_MCP_CONNECTION_STRING is set, else local JSON (see conversation_store.py).
# Every route is scoped by user_id; never echo the Mongo URI in errors.
_URI_RE = re.compile(r"mongodb(\+srv)?://[^\s\"']+")


def _safe_err(exc: Exception) -> str:
    return _URI_RE.sub("<redacted>", str(exc))


# Dedicated stdlib logger. The shared `logger` may be a google.cloud.logging
# Logger whose writes hang ~60s when GCP creds are missing/disabled locally
# (disabled_client) — never route request-path warnings through it.
_conv_logger = logging.getLogger("sea_team_lead.conversations")


def _log_warn(msg: str) -> None:
    _conv_logger.warning(msg)


class ConversationPayload(BaseModel):
    user_id: str
    title: str = "Konversation"
    messages: list[dict] = []
    download: str | None = None


@app.get("/conversations")
def list_conversations(request: Request) -> dict:
    """List the calling user's saved conversations (newest first, no message bodies)."""
    user_id = get_user_id(request)
    try:
        return {"conversations": conversation_store.list_conversations(user_id)}
    except Exception as e:
        _log_warn(f"list_conversations failed: {_safe_err(e)}")
        raise HTTPException(status_code=503, detail="History-Backend nicht erreichbar")


@app.get("/conversations/{conv_id}")
def get_conversation(conv_id: str, request: Request) -> dict:
    """Load one conversation (full transcript) belonging to the user."""
    user_id = get_user_id(request)
    try:
        doc = conversation_store.get_conversation(user_id, conv_id)
    except Exception as e:
        _log_warn(f"get_conversation failed: {_safe_err(e)}")
        raise HTTPException(status_code=503, detail="History-Backend nicht erreichbar")
    if not doc:
        raise HTTPException(status_code=404, detail="Konversation nicht gefunden")
    return doc


@app.put("/conversations/{conv_id}")
def put_conversation(conv_id: str, request: Request, payload: ConversationPayload) -> dict:
    """Create or update a conversation (upsert) for the user."""
    user_id = get_user_id(request)
    try:
        return conversation_store.save_conversation(
            user_id, conv_id, payload.title, payload.messages, payload.download
        )
    except Exception as e:
        _log_warn(f"put_conversation failed: {_safe_err(e)}")
        raise HTTPException(status_code=503, detail="History-Backend nicht erreichbar")


@app.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: str, request: Request) -> dict:
    """Delete one of the user's conversations."""
    user_id = get_user_id(request)
    try:
        conversation_store.delete_conversation(user_id, conv_id)
    except Exception as e:
        _log_warn(f"delete_conversation failed: {_safe_err(e)}")
        raise HTTPException(status_code=503, detail="History-Backend nicht erreichbar")
    return {"status": "deleted"}


# --- Google Ads connection settings ---
# Lets the settings page enter credentials/IDs and test the connection. Secrets
# are stored server-side (gitignored file, seeded from .env) and never returned
# to the browser in plaintext (see google_ads_settings.get_public). Settings are
# scoped per authenticated app user.
class GoogleAdsSettingsPayload(BaseModel):
    developer_token: str | None = None
    client_id: str | None = None
    client_secret: str | None = None
    refresh_token: str | None = None
    login_customer_id: str | None = None
    customer_id: str | None = None


@app.get("/integrations/status")
def get_integrations_status(request: Request) -> dict:
    """At-a-glance status for the Settings page's connection-dashboard strip.

    Reports each backend integration as `{configured, detail}`. Does NOT perform
    a live ping (that would be a per-request side effect and could hang on a bad
    cluster). The Google Ads section in the page already has its own dedicated
    test endpoint for a real round-trip check.
    """
    _enforce_auth_if_enabled(request)
    user_id = _request_user_id(request)
    pub = google_ads_settings.get_public(user_id)
    ads_ready = bool(
        pub.get("developer_token_set")
        and pub.get("client_id")
        and pub.get("client_secret_set")
        and pub.get("refresh_token_set")
    )
    mongodb_uri = os.environ.get("MDB_MCP_CONNECTION_STRING", "")
    mongodb_configured = bool(mongodb_uri)
    # Derive a friendly cluster identifier from the URI without leaking creds.
    mongodb_detail = ""
    if mongodb_uri:
        import re
        m = re.search(r"@([^/?]+)", mongodb_uri)
        if m:
            mongodb_detail = m.group(1)
    return {
        "google_ads": {
            "configured": ads_ready,
            "detail": pub.get("customer_id") or "",
        },
        "google_sheets": {
            "configured": bool(pub.get("refresh_token_set")),
            "detail": "drive.file Scope aktiv" if pub.get("refresh_token_set") else "",
        },
        "mongodb": {
            "configured": mongodb_configured,
            "detail": mongodb_detail,
        },
    }


@app.get("/google-ads/settings")
def get_google_ads_settings(request: Request) -> dict:
    """Current connection settings, with secrets masked to '<field>_set' booleans."""
    _enforce_auth_if_enabled(request)
    return google_ads_settings.get_public(_request_user_id(request))


@app.post("/google-ads/disconnect")
@limiter.limit("3/minute")
def disconnect_google_ads(request: Request) -> dict:
    """Revoke the OAuth grant at Google and wipe the local refresh_token. Other
    fields (client_id, developer_token, login_customer_id, customer_id) stay so
    the user can re-connect without re-entering everything. Sheets shares the
    same OAuth grant, so disconnecting here also kills the Drive scope."""
    _enforce_auth_if_enabled(request)
    user_id = _request_user_id(request)
    cfg = google_ads_settings.get_config(user_id)
    refresh = cfg.get("refresh_token") or ""
    revoke_status: str = "no_token"
    if refresh:
        try:
            import requests
            resp = requests.post(
                "https://oauth2.googleapis.com/revoke",
                data={"token": refresh},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=(10, 20),
            )
            # 200 = revoked, 400 = already invalid/expired (also fine).
            revoke_status = "revoked" if resp.status_code == 200 else f"http_{resp.status_code}"
        except Exception as e:
            revoke_status = f"error: {_safe_err(e)}"
    pub = google_ads_settings.clear_oauth(user_id)
    return {"status": "disconnected", "revoke": revoke_status, "settings": pub}


@app.put("/google-ads/settings")
@limiter.limit("5/minute")
def put_google_ads_settings(request: Request, payload: GoogleAdsSettingsPayload) -> dict:
    """Save connection settings. Omitted/empty secret fields keep their value."""
    _enforce_auth_if_enabled(request)
    user_id = _request_user_id(request)
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    try:
        return google_ads_settings.update(updates, user_id)
    except Exception as e:
        _log_warn(f"put_google_ads_settings failed: {_safe_err(e)}")
        raise HTTPException(status_code=500, detail="Einstellungen konnten nicht gespeichert werden")


@app.post("/google-ads/test")
@limiter.limit("5/minute")
def test_google_ads_connection(request: Request) -> dict:
    """Probe the Google Ads connection: try to list accessible accounts."""
    _enforce_auth_if_enabled(request)
    return google_ads_client.test_connection(_request_user_id(request))


def _oauth_redirect_uri(request: Request) -> str:
    """The callback URL Google redirects to. Same-origin as the app (in dev the
    Vite proxy preserves Host=localhost:5180). Overridable via env for prod."""
    override = os.environ.get("GOOGLE_ADS_REDIRECT_URI", "").strip()
    if override:
        return override
    return str(request.base_url).rstrip("/") + "/google-ads/oauth/callback"


def _oauth_close_page(message: str, ok: bool) -> str:
    import html as html_mod
    safe_message = html_mod.escape(message)
    color = "#4ADE80" if ok else "#FCA5A5"
    post_origin = _normalize_origin(os.environ.get("FRONTEND_ORIGIN", ""))
    target_origin = f"'{post_origin}'" if post_origin else "location.origin"
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>Google Ads</title></head>
<body style="font-family:system-ui;background:#0A0A0A;color:#FAFAFA;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <div style="text-align:center;max-width:420px;padding:24px">
    <p style="color:{color};font-size:15px;line-height:1.5">{safe_message}</p>
    <p style="color:#71717A;font-size:13px">Dieses Fenster schliesst sich automatisch.</p>
  </div>
  <script>
    try {{ if (window.opener) window.opener.postMessage({{type:'google-ads-oauth', ok:{str(ok).lower()}}}, {target_origin}); }} catch (e) {{}}
    setTimeout(function () {{ window.close(); }}, 1800);
  </script>
</body></html>"""


@app.get("/google-ads/oauth/start")
@limiter.limit("5/minute")
def google_ads_oauth_start(request: Request) -> dict:
    """Return the Google consent URL to open in a popup ('Connect with Google')."""
    _enforce_auth_if_enabled(request)
    user_id = _request_user_id(request)
    try:
        return {"auth_url": google_ads_oauth.build_auth_url(_oauth_redirect_uri(request), user_id)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=_safe_err(e))


@app.get("/google-ads/oauth/callback")
def google_ads_oauth_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> HTMLResponse:
    """Google's redirect target: exchange the code for a refresh token and store it."""
    if error:
        return HTMLResponse(_oauth_close_page(f"Google-Anmeldung abgebrochen: {error}", ok=False))
    if not code or not state:
        return HTMLResponse(_oauth_close_page("Fehlende Parameter von Google.", ok=False))
    try:
        google_ads_oauth.exchange_code(code, state)
        return HTMLResponse(_oauth_close_page("Verbunden! Der Refresh-Token wurde gespeichert.", ok=True))
    except Exception as e:
        return HTMLResponse(_oauth_close_page(f"Verbindung fehlgeschlagen: {_safe_err(e)}", ok=False))


# Note: the built-in scaffold frontend at app/frontend/dist used to be mounted
# here as the root UI. The real frontend lives in the standalone ads-ai-agent/
# project (Vite dev server on :5180 in dev, deployed separately in prod). The
# StaticFiles mount was removed when the scaffold frontend was deleted; revive
# it conditionally here if you ever rebuild a sea-team-lead-internal SPA.


# Main execution
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

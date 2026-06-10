# ruff: noqa
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.

# Shared infrastructure for every agent in app/agents/:
#   - env loading (.env + VITE_GEMINI_API_KEY mapping)
#   - Gemini/Vertex routing
#   - MongoDB MCP toolset (decided once at import time)
#   - GLOBAL_RULES + apply_rules
#   - mongodb_persist_directive + json_block_directive
#   - cached_skill_from(path) — pathlib-based loader so each agent's local
#     skills/ folder works without a central skills directory.

import os
from functools import lru_cache
from pathlib import Path

from google.adk.tools.mcp_tool.mcp_toolset import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters


# ----- .env loading + Gemini/Vertex routing --------------------------------

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

has_api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

if has_api_key:
    # Use Gemini Developer API (Google AI Studio)
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "False"
else:
    # Fall back to Vertex AI (Google Cloud)
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "True"
    os.environ["GOOGLE_CLOUD_LOCATION"] = "global"
    try:
        import google.auth
        _, project_id = google.auth.default()
        if project_id:
            os.environ["GOOGLE_CLOUD_PROJECT"] = project_id
    except Exception:
        pass


# ----- MongoDB MCP toolset (decided once at import time) -------------------

mongodb_uri = os.environ.get("MDB_MCP_CONNECTION_STRING")
mongodb_toolset = None
if mongodb_uri:
    mongodb_toolset = McpToolset(
        connection_params=StdioConnectionParams(
            server_params=StdioServerParameters(
                command="npx",
                args=["-y", "@mongodb-js/mongodb-mcp-server"],
                # Pass the full parent env (PATH, HOME, ...) plus the connection
                # string. Replacing env with only the URI strips PATH/HOME.
                env={**os.environ, "MDB_MCP_CONNECTION_STRING": mongodb_uri},
            ),
            # npx may cold-start (download) the server; the 5s default is too short.
            timeout=30,
        ),
        # The MongoDB MCP server exposes ~20 tools (many Atlas admin tools with
        # large schemas) which overwhelmed the flash model and stalled the run.
        # Restrict to the data tools the landing_page_agent actually needs.
        tool_filter=["connect", "find", "insert-many", "update-many", "list-collections", "list-databases"],
    )


# ----- Global behaviour rules ----------------------------------------------

GLOBAL_RULES = [
    "Verwende niemals Emojis in deinen Antworten, Headlines, Descriptions, Übersetzungen oder sonstigen Ausgaben. Emojis sind strikt verboten.",
    "Verwende keinerlei einleitende Floskeln, Metatexte oder Übergangssätze wie 'Hier ist die strukturierte Analyse...' oder 'Im Folgenden finden Sie...'. Gib die Ergebnisse immer direkt und ohne einleitende Erklärung aus. AUSNAHME: ```json-Codebloecke, die eine Agent-spezifische Pflicht-Ausgabe sind (siehe individuelle Instruction), sind ausdruecklich erlaubt und in dem Fall vorgeschrieben.",
    "Gib niemals Verbindungs-Strings, Datenbank-URIs, Passwoerter oder andere Credentials in deinen Antworten aus, auch nicht teilweise. Solche Werte sind strikt vertraulich.",
    "In deutschen Ausgaben verwende IMMER die echten Umlaute ä, ö, ü und ß. Schreibe NIEMALS die ASCII-Ersatzformen ae, oe, ue oder ss in user-sichtbarem Text (Prosa, Headlines, Descriptions, Werte in ```json-Bloecken). Beispiele: 'Tonalität' statt 'Tonalitaet', 'Bedürfnis' statt 'Beduerfnis', 'Größe' statt 'Groesse', 'Maß' statt 'Mass'. Diese Regel gilt fuer ALLE Ausgaben — auch fuer die Werte innerhalb von ```json-Bloecken.",
]


def apply_rules(instruction: str) -> str:
    rules_text = "\n\nGlobale Verhaltensregeln, die UNBEDINGT einzuhalten sind:\n" + "\n".join(f"- {rule}" for rule in GLOBAL_RULES)
    return instruction.strip() + rules_text


# ----- Directives appended to specialist agents ----------------------------

def mongodb_persist_directive(agent_field: str) -> str:
    """Shared MCP-write directive appended to every step-agent's instruction
    when MongoDB MCP is configured. Each agent extends the same per-URL
    document under `customer_profiles` with its own slice (`strategy`,
    `keywords`, `ads`...). Together they build up a full customer memory that
    the next session can resume from.

    The directive is best-effort: if the analysis block (and therefore the URL)
    is missing, or if any MCP call fails, the agent continues to its prose +
    JSON answer regardless — persistence must never block the user-visible
    output.
    """
    return f"""

## Persistenz nach MongoDB (Pflicht wenn verbunden)
Bevor du deine endgueltige Antwort sendest, persistiere dein Ergebnis im Customer-Memory:
1. Rufe `connect` auf (der Verbindungs-String ist bereits in der Umgebung konfiguriert, gib ihn NIEMALS in deiner Antwort aus).
2. Rufe `update-many` auf der Database `sea_team_lead`, Collection `customer_profiles` auf:
   - Filter: {{"url": "<landing_page_url aus dem landing_page_analysis-Block des LP-Agenten>"}}
   - Update: {{"$set": {{"{agent_field}": <dein vollstaendiges JSON-Objekt vom Typ "{agent_field}">, "last_built_at": "<aktueller ISO-Timestamp wie 2026-05-29T21:30:00Z>"}}}}
3. Fahre dann mit deiner Antwort fort (Prosa + JSON-Block am Ende).

Wichtige Spezialregeln:
- Wenn keine `landing_page_url` im Kontext verfuegbar ist (z. B. weil der Nutzer dich direkt ohne vorherige LP-Analyse aufgerufen hat), ueberspringe die Persistenz stillschweigend - kein connect, kein update.
- Wenn `connect` oder `update-many` einen Fehler zurueckgibt, fahre dennoch mit der Antwort fort - die Persistenz ist best-effort, der Nutzer sieht immer das Ergebnis.
- Persistiere NICHT in Antworten, die nur eine Rueckfrage an den Nutzer sind (z. B. Account-Picker, Confirm). Persistiere nur dein finales Ergebnis.
"""


def json_block_directive(example: str) -> str:
    """Directive appended to specialist agents so the frontend can render rich
    cards: emit a machine-readable JSON block in addition to the prose answer."""
    return (
        "\n\nGib am Ende deiner Antwort zusaetzlich einen maschinenlesbaren JSON-Block "
        "in einem mit ```json markierten Codeblock aus (keine weiteren Zeichen danach), "
        "exakt in dieser Struktur (Werte auf Deutsch, an den Kunden angepasst):\n"
        f"```json\n{example}\n```"
    )


# ----- Agent-local skill loader --------------------------------------------

def load_skill_from(path) -> str:
    """Read a skill markdown file. Each agent owns its skills under
    app/agents/<name>/skills/<file>.md; this loader resolves the path the
    agent passes in (typically `Path(__file__).parent / "skills" / "x.md"`).

    Returns "" if missing — a typo or pending file must not crash agent boot.
    """
    try:
        return Path(path).read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


@lru_cache(maxsize=32)
def cached_skill_from(path_str: str) -> str:
    """Same as load_skill_from but cached per process — backend restart still
    re-reads the file. Path is passed as a string so it's hashable for lru_cache.
    """
    return load_skill_from(path_str)

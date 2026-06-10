# ruff: noqa
import json
import os
from typing import Any

from google.adk.agents import Agent
from google.adk.models import Gemini
from google.genai import types

from app.common import apply_rules, mongodb_persist_directive, mongodb_toolset
from app.user_context import get_current_user_id


def _read_profile(url: str) -> dict[str, Any] | None:
    """Read customer_profiles document from MongoDB by URL. Returns None on any failure."""
    uri = os.environ.get("MDB_MCP_CONNECTION_STRING")
    if not uri or not url:
        return None
    try:
        from pymongo import MongoClient
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        doc = client["sea_team_lead"]["customer_profiles"].find_one({"url": url})
        client.close()
        return doc
    except Exception:
        return None


def collect_full_plan(landing_page_url: str) -> str:
    """Liest Strategy, Keywords und Ads aus MongoDB und merged sie zu einem
    vollstaendigen Plan-JSON fuer create_search_campaigns.

    Dieses Tool ersetzt das manuelle Zusammenbauen des Plans aus dem Chatverlauf.
    Es gibt ein fertiges JSON zurueck das direkt (nach Namens-Renames) an
    create_search_campaigns uebergeben werden kann.

    Args:
        landing_page_url: Die URL der Landingpage, die am Anfang des Workflows
            analysiert wurde (z. B. "https://www.esn.com/products/vitamin-d3-k2"
            oder "esn.com/products/vitamin-d3-k2"). Protokoll (https://) und
            www-Praefix werden automatisch entfernt fuer den DB-Lookup.

    Returns:
        JSON-String mit dem vollstaendigen Plan (domain, kampagnen, keywords,
        ads) oder ein Fehler-JSON wenn Daten fehlen.
    """
    url = landing_page_url.strip()
    url_stripped = url.lower().replace("https://", "").replace("http://", "").removeprefix("www.")
    doc = _read_profile(url)
    if not doc:
        doc = _read_profile(url_stripped)
    if not doc:
        doc = _read_profile("www." + url_stripped)
    if not doc:
        return json.dumps({
            "error": (
                f"Kein Customer-Profile fuer URL '{landing_page_url}' in MongoDB gefunden. "
                "Stelle sicher dass der LP-Agent, Strategy, Keywords und Copywriter vorher gelaufen sind."
            )
        }, ensure_ascii=False)

    strategy = doc.get("strategy")
    keywords = doc.get("keywords")
    ads = doc.get("ads")
    lp = doc.get("landing_page_analysis", {})

    missing = []
    if not strategy:
        missing.append("strategy")
    if not keywords:
        missing.append("keywords")
    if not ads:
        missing.append("ads")
    if missing:
        return json.dumps({
            "error": f"Unvollstaendiges Profil: {', '.join(missing)} fehlt in MongoDB. Diese Agents muessen zuerst laufen.",
            "vorhanden": [k for k in ["strategy", "keywords", "ads"] if doc.get(k)],
        }, ensure_ascii=False)

    domain = ""
    if isinstance(lp, dict):
        domain = lp.get("domain", "")
    if not domain and isinstance(strategy, dict):
        domain = strategy.get("domain", "")
    if not domain:
        raw_url = doc.get("url", "")
        if raw_url:
            parts = raw_url.split("/")
            domain = parts[0] if parts else raw_url

    kampagnen = []
    if isinstance(strategy, dict):
        for camp in (strategy.get("campaigns") or []):
            if isinstance(camp, dict):
                kampagnen.append({"name": camp.get("name", ""), "bid_strategy": camp.get("bid_strategy", "")})

    kw_flat: list[dict[str, Any]] = []
    if isinstance(keywords, dict):
        for camp in (keywords.get("campaigns") or []):
            camp_name = camp.get("name", "") if isinstance(camp, dict) else ""
            for ag in (camp.get("ad_groups") or []) if isinstance(camp, dict) else []:
                ag_name = ag.get("name", "") if isinstance(ag, dict) else ""
                for kw in (ag.get("keywords") or []) if isinstance(ag, dict) else []:
                    if isinstance(kw, dict):
                        kw_flat.append({
                            "kampagne": camp_name,
                            "anzeigengruppe": ag_name,
                            "keyword": kw.get("keyword", ""),
                            "match_type": kw.get("match_type", "BROAD"),
                        })

    plan: dict[str, Any] = {
        "domain": domain,
        "kampagnen": kampagnen,
        "keywords": kw_flat,
        "ads": ads,
    }

    return json.dumps(plan, ensure_ascii=False)


def list_google_ads_accounts() -> str:
    """Listet die erreichbaren Google Ads Kundenkonten (Name + ID) zur Auswahl.

    Ohne gesetzte Google-Ads-Credentials werden Demo-Konten geliefert, damit die
    Konto-Auswahl sofort funktioniert.

    Returns:
        JSON-String der Form {"type":"account_picker","accounts":[{"id","name"}]}.
        Gib dieses JSON unveraendert in einem ```json-Codeblock aus, damit das
        Frontend daraus ein Auswahl-Dropdown rendert.
    """
    from app.google_ads_client import list_accounts

    user_id = get_current_user_id()
    return json.dumps(
        {"type": "account_picker", "accounts": list_accounts(user_id)},
        ensure_ascii=False,
    )


def create_search_campaigns(campaign_data_json: str, customer_id: str = "") -> str:
    """Legt die finale Kampagnenstruktur ueber die Google Ads API als SUCHKAMPAGNEN an.

    SICHERHEIT (im Code erzwungen, nicht ueberschreibbar): Es werden nur SEARCH-
    Kampagnen angelegt, ALLES wird PAUSED erstellt und jede Kampagne erhaelt ein
    festes Tagesbudget von 1 Euro. Ohne gesetzte Google-Ads-Credentials laeuft ein
    Mock, der die Erstellung lediglich simuliert (es wird nichts real angelegt).

    Args:
        campaign_data_json: JSON-String mit derselben semantischen Struktur wie
            beim Excel-Export (Schluessel: domain, kampagnen, keywords,
            anzeigentexte). Budget- und Kampagnentyp-Angaben darin werden bewusst
            ignoriert, da die Sicherheitsregeln Vorrang haben.
        customer_id: Ziel-Kundenkonto (z. B. "123-456-7890"), das der Nutzer
            zuvor ausgewaehlt und bestaetigt hat. Leer -> Default aus der .env.

    Returns:
        Ein JSON-String mit dem Ergebnis: Modus (mock/live-pending), Ziel-Konto,
        angelegte Ressourcen samt Resource-Names, die erzwungenen
        Sicherheitsregeln und etwaige Warnungen (z. B. zu lange Headlines).
    """
    from app.google_ads_client import build_search_campaigns

    try:
        plan = json.loads(campaign_data_json)
    except (json.JSONDecodeError, TypeError) as e:
        return json.dumps({"error": f"Ungueltiges JSON fuer den Kampagnen-Build: {e}"}, ensure_ascii=False)

    try:
        result = build_search_campaigns(plan, customer_id or None, get_current_user_id())
    except Exception as e:
        return json.dumps({"error": f"Kampagnen-Build fehlgeschlagen: {e}"}, ensure_ascii=False)

    return json.dumps(result, ensure_ascii=False)


def create_campaign_builder_agent():
    extra_tools = [mongodb_toolset] if mongodb_toolset else []
    persist_block = mongodb_persist_directive("campaign_build") if mongodb_toolset else ""
    return Agent(
        name="campaign_builder_agent",
        model=Gemini(
            model="gemini-flash-latest",
            retry_options=types.HttpRetryOptions(attempts=3),
        ),
        instruction=apply_rules("""Du bist der Campaign Builder. Du setzt die fertige Kampagnenstruktur ueber die Google Ads API als SUCHKAMPAGNEN auf.

UNUMSTOESSLICHE SICHERHEITSREGELN (werden zusaetzlich im Code erzwungen):
- Es werden AUSSCHLIESSLICH Suchkampagnen (SEARCH) angelegt.
- ALLES wird auf PAUSED gesetzt. Aktiviere niemals eine Kampagne, Anzeigengruppe oder Anzeige.
- Jede Kampagne erhaelt ein festes Tagesbudget von 1 Euro. Schlage niemals ein anderes Budget vor und uebernimm kein Budget aus der Strategie.

Halte dich strikt an diesen fuenfstufigen Ablauf und ueberspringe NIEMALS einen Schritt:

SCHRITT 0 - Plan laden:
Rufe als ALLERERSTES das Tool `collect_full_plan` auf. Uebergib als Argument die Landingpage-URL aus dem bisherigen Gespraech (die URL die der LP-Agent analysiert hat). Du erhaeltst eine fertige JSON mit allen Sektionen (domain, kampagnen, keywords, ads). Merke dir dieses Ergebnis - es ist die Basis fuer alle weiteren Schritte. Falls das Tool einen Fehler meldet (fehlende Sektionen), informiere den Nutzer welche Agents noch laufen muessen.

SCHRITT 1 - Konto-Auswahl:
Rufe das Tool `list_google_ads_accounts` auf. Schreibe dann eine kurze Frage an den Nutzer, in welches Google Ads Konto die Kampagne aufgesetzt werden soll, und haenge das JSON-Ergebnis des Tools UNVERAENDERT in einem ```json-Codeblock an (es hat die Form {"type":"account_picker",...}). Beende dann deinen Zug und WARTE auf die Antwort des Nutzers. Rufe in diesem Schritt NICHT create_search_campaigns auf.

SCHRITT 2 - Namen anpassen:
Bestimme aus dem geladenen Plan die Liste der zu erstellenden Suchkampagnen (Performance Max, Display, Remarketing usw. werden uebersprungen) sowie deren Anzeigengruppen. Frage den Nutzer kurz, ob er die vorgeschlagenen Kampagnen- und Anzeigengruppen-Namen anpassen moechte, und haenge UNMITTELBAR danach einen ```json-Codeblock der Form {"type":"name_editor","campaigns":[{"name":"<Kampagnenname>","ad_groups":["<Anzeigengruppe 1>","<Anzeigengruppe 2>"]}]} an - eine Kampagne pro Eintrag, alle vorgeschlagenen Anzeigengruppen je Kampagne. Beende deinen Zug und WARTE. Der Nutzer antwortet im Format 'Kampagnenname: "X" -> "Y"; Anzeigengruppe: "A" -> "B"'. Merke dir die so bestaetigten FINALEN Namen und verwende sie ab jetzt bei allen Folgeschritten und Tool-Aufrufen.

SCHRITT 3 - Bestaetigung:
Fasse mit den FINALEN Namen aus Schritt 2 zusammen, was angelegt wird (Anzahl Kampagnen mit ihren neuen Namen, Anzeigengruppen, Keywords, Anzeigen) und betone ausdruecklich: alles PAUSED, festes Tagesbudget 1 Euro, nur Suchkampagnen. Frage explizit, ob im in Schritt 1 gewaehlten Konto (nenne Name UND ID) wirklich aufgesetzt werden soll, und haenge einen ```json-Codeblock {"type":"confirm"} an. Beende deinen Zug und WARTE auf die Bestaetigung.

SCHRITT 4 - Aufsetzen:
NUR nach ausdruecklicher Bestaetigung ("ja"/"aufsetzen"):
1. Nimm die Plan-JSON aus Schritt 0 (das Ergebnis von collect_full_plan).
2. Wende die Namens-Renames aus Schritt 2 an: ersetze die alten Namen durch die neuen in `kampagnen[].name`, `keywords[].kampagne`, `keywords[].anzeigengruppe` und `ads.ad_groups[].name`.
3. Rufe `create_search_campaigns` auf mit dem umbenannten Plan-JSON als erstem Argument und customer_id = der vom Nutzer in Schritt 1 gewaehlten Konto-ID.

Bricht der Nutzer ab, setze nichts auf und bestaetige den Abbruch. Gib danach das Ergebnis verstaendlich wieder: Ziel-Konto, angelegte Ressourcen (Anzahl Kampagnen/Anzeigengruppen/Keywords/Anzeigen), Modus (mock oder live) und etwaige Warnungen. Beim Modus mock weise klar darauf hin, dass es eine Simulation ohne echte Google-Ads-Verbindung war und nichts real angelegt wurde.""" + persist_block),
        description="Setzt die finale Kampagnenstruktur ueber die Google Ads API als Suchkampagnen auf - fragt in drei Schritten Zielkonto, Kampagnen-/Anzeigengruppen-Namen und finale Bestaetigung ab; immer pausiert und mit 1 Euro Tagesbudget (ohne Credentials als Mock-Simulation).",
        tools=[collect_full_plan, list_google_ads_accounts, create_search_campaigns] + extra_tools,
    )

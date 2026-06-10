# ruff: noqa
import json
import os
import re
from typing import Any

from google.adk.agents import Agent
from google.adk.models import Gemini
from google.genai import types

from app.common import apply_rules, mongodb_toolset


# ----- Local-file cache fallback -------------------------------------------
# Used when MongoDB MCP is not configured. The landing_page_agent picks the
# correct branch based on whether mongodb_toolset is None.

DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data",
    "customers",
)


def normalize_lp_url(url: str) -> str:
    """Normalise a landing-page URL into a stable cache key.

    The host is lowercased and `www.` is stripped, but the PATH is preserved
    (and trailing slashes are removed) so that "esn.com" and
    "esn.com/products/vitamin-d3-k2" map to DIFFERENT cache entries — they are
    different pages with different content and need separate analyses.
    """
    s = (url or "").strip()
    s = re.sub(r"^https?://", "", s, flags=re.IGNORECASE)
    s = re.sub(r"^www\.", "", s, flags=re.IGNORECASE)
    if "/" in s:
        host, _, rest = s.partition("/")
        s = host.lower() + "/" + rest
    else:
        s = s.lower()
    return s.rstrip("/")


def _get_profile_filepath(domain: str) -> str:
    # Different paths under the same host get different files so a brand page
    # and a specific product page never share a cache entry.
    clean = normalize_lp_url(domain)
    clean = re.sub(r'[^a-zA-Z0-9_.-]', '_', clean)
    return os.path.join(DATA_DIR, f"{clean}.json")


def save_customer_profile(domain: str, profile_data: str) -> str:
    """Speichert Prosa-Zusammenfassung UND strukturiertes landing_page_analysis-
    Objekt fuer eine Domain (lokaler Cache, kein MongoDB).
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    filepath = _get_profile_filepath(domain)

    doc: dict[str, Any] = {"domain": domain}
    stripped = (profile_data or "").lstrip()
    if stripped.startswith("{"):
        try:
            parsed = json.loads(profile_data)
            if isinstance(parsed, dict):
                if "profile_prose" in parsed:
                    doc["profile_prose"] = parsed.get("profile_prose", "")
                if "analysis" in parsed:
                    doc["analysis"] = parsed.get("analysis")
        except json.JSONDecodeError:
            pass
    if "profile_prose" not in doc and "analysis" not in doc:
        # Legacy fallback: plain prose blob.
        doc["profile_prose"] = profile_data
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    return f"Kundenprofil erfolgreich gespeichert unter {filepath}."


def load_customer_profile(domain: str) -> str:
    """Laedt das gespeicherte Kundenprofil fuer eine Domain.

    Gibt einen JSON-String zurueck: `{"profile_prose": "...", "analysis": {...} | null}`.
    """
    filepath = _get_profile_filepath(domain)
    if not os.path.exists(filepath):
        return "Kein gespeichertes Profil gefunden."
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return "Kein gespeichertes Profil gefunden."
    prose = data.get("profile_prose") or data.get("profile") or ""
    analysis = data.get("analysis")
    return json.dumps({"profile_prose": prose, "analysis": analysis}, ensure_ascii=False)


# ----- HTTP fetcher (used by both MongoDB and local-cache branches) --------

_BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


def _is_private_url(url: str) -> bool:
    """Block requests to private/internal network addresses (SSRF protection)."""
    import ipaddress
    from urllib.parse import urlparse

    parsed = urlparse(url)
    hostname = parsed.hostname or ""

    blocked_hosts = {"localhost", "metadata.google.internal"}
    if hostname in blocked_hosts:
        return True

    try:
        import socket
        resolved = socket.getaddrinfo(hostname, None)
        for _, _, _, _, sockaddr in resolved:
            ip = ipaddress.ip_address(sockaddr[0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return True
    except (socket.gaierror, ValueError):
        pass

    return False


def fetch_landing_page(url: str) -> str:
    """Laedt den sichtbaren Textinhalt einer Webseite und gibt ihn als Text zurueck.

    Folgt Weiterleitungen, sendet einen Browser-User-Agent und bricht nach einem
    Timeout ab, damit der Agent bei langsamen Servern nicht unbegrenzt haengt.
    """
    import requests
    from bs4 import BeautifulSoup

    if not url.lower().startswith(("http://", "https://")):
        url = "https://" + url

    if _is_private_url(url):
        return "Fehler: Interne oder private Adressen sind nicht erlaubt."

    try:
        response = requests.get(
            url,
            timeout=(10, 20),
            allow_redirects=True,
            headers={"User-Agent": _BROWSER_UA},
        )
    except requests.RequestException as e:
        return f"Fehler beim Laden der URL {url}: {e}"

    if response.status_code != 200:
        return f"Seite nicht erreichbar (HTTP {response.status_code}): {url}"

    soup = BeautifulSoup(response.content, "lxml")
    text = soup.get_text(separator="\n", strip=True)
    lines = [line for line in text.splitlines() if len(line.split()) > 3]
    return "\n".join(lines) or f"Kein Textinhalt gefunden unter {url}"


# ----- Output schema -------------------------------------------------------

LP_OUTPUT_SCHEMA = """

## Pflicht-Output: Landingpage-Analyse als JSON-Block

Zusaetzlich zur Prosa-Antwort an den Nutzer gibst du am Ende deiner Antwort GENAU EINEN ```json-Codeblock mit folgender festen Struktur aus. Jedes Feld MUSS vorhanden sein. Wenn ein Wert nicht aus der Landingpage ableitbar ist: leere Liste [], leerer String "" oder null. Werte stets auf Deutsch.

Bedeutung der Felder:
- `customer` (str): Marken-/Firmenname (z. B. "ESN")
- `product` (str): Hauptprodukt/-leistung in 1-3 Worten (z. B. "Flexpresso Protein Coffee")
- `landing_page_url` (str): die EXAKTE URL, die analysiert wurde, normalisiert (ohne `https://` und `www.`, ohne abschliessenden Slash). Bei Produktseiten inklusive Pfad - z. B. "esn.com/products/vitamin-d3-k2-120-kaps"
- `domain` (str): nackte Root-Domain ohne Pfad (z. B. "esn.com"). Wird vom Builder als Default-Domain genutzt
- `industry` (str): Branche/Vertical (z. B. "Sport-Nutrition E-Commerce")
- `language` (str): ISO-Code der Hauptsprache der LP ("de"/"en"/...)
- `geography` (list[str]): Laender-/Regionscodes ("DE","AT","CH",...). Leere Liste wenn nicht erkennbar
- `brand_usps` (list[str], 3-6): Verkaufsargumente auf Marken-Ebene (gelten fuer alle Produkte des Kunden)
- `brand_offers` (list[str]): markenweite Promos/Garantien (Versandkosten, Rueckgaberecht, ...)
- `brand_pain_points` (list[str]): branchenweite Probleme, die die Marke generell adressiert
- `brand_tagline` (str): zentrale Marken-Claim/Tagline (1 Satz)
- `product_usps` (list[str], 3-6): produktspezifische Verkaufsargumente
- `product_offers` (list[str]): produktspezifische Promos (Rabatte, Spar-Abo, ...)
- `product_pain_points` (list[str]): konkrete Probleme, die DIESES Produkt loest
- `product_price_anchor` (str): Preis-Anker im Format "ab X,XX EUR" wenn auf LP erkennbar
- `target_audience` (list[obj], 2-4): Personas mit {persona, needs, intent_stage}
    - `persona` (str): Kurzbeschreibung
    - `needs` (str): Hauptbeduerfnis dieser Persona
    - `intent_stage` (str): genau einer von "awareness", "consideration", "decision"
- `tonality` (list[str], 3): Tonalitaets-Adjektive (z. B. ["modern","energiegeladen","direkt"])
- `voice_rules` (obj): konkrete Copy-Regeln mit {address, emojis, sentence_length, exclamation}
    - `address` (str): "du" oder "Sie"
    - `emojis` (str): "none" | "sparingly" | "on"
    - `sentence_length` (str): "short" | "mixed" | "long"
    - `exclamation` (str): "none" | "on"
- `cta` (str): dominanter Call-to-Action der LP (z. B. "Jetzt kaufen")
- `conversion_goals` (list[str]): was zaehlt als Conversion (z. B. ["Produktkauf","Newsletter-Anmeldung"])
- `lp_keywords` (list[str]): verbatim Begriffe von der LP, die als Keyword-Seeds dienen
- `competitors` (list[str]): auf der LP erwaehnte oder offensichtliche Mitbewerber

Beispiel (Werte beispielhaft, du fuellst sie aus der echten LP):
```json
{
  "type": "landing_page_analysis",
  "customer": "ESN",
  "product": "Flexpresso Protein Coffee",
  "landing_page_url": "esn.com/products/flexpresso-protein-coffee",
  "domain": "esn.com",
  "industry": "Sport-Nutrition E-Commerce",
  "language": "de",
  "geography": ["DE","AT","CH"],
  "brand_usps": ["Made in Germany","Seit 2005","Ueber 1 Mio. Kunden"],
  "brand_offers": ["Versandkostenfrei ab 60 EUR","60 Tage Rueckgaberecht"],
  "brand_pain_points": ["Unsichere Qualitaet bei Supplements","Schlechter Geschmack ueblicher Produkte"],
  "brand_tagline": "Premium Sports Nutrition - made in Germany",
  "product_usps": ["20g Protein pro Portion","Ohne Zuckerzusatz","Cold-Brew-Verfahren"],
  "product_offers": ["10% Erstbesteller-Rabatt","Spar-Abo verfuegbar"],
  "product_pain_points": ["Kaffee ohne Naehrwert","Proteindrinks schmecken kuenstlich"],
  "product_price_anchor": "ab 24,90 EUR",
  "target_audience": [
    {"persona":"Junge Fitness-Enthusiasten","needs":"Protein-Boost im Alltag","intent_stage":"consideration"},
    {"persona":"Berufstaetige Kaffeetrinker","needs":"Energie + Muskelaufbau in einem","intent_stage":"awareness"}
  ],
  "tonality": ["modern","energiegeladen","direkt"],
  "voice_rules": {"address":"du","emojis":"sparingly","sentence_length":"short","exclamation":"on"},
  "cta": "Jetzt kaufen",
  "conversion_goals": ["Produktkauf","Newsletter-Anmeldung"],
  "lp_keywords": ["Protein-Kaffee","Flexpresso","Whey-Coffee","Iced Coffee Protein"],
  "competitors": ["MyProtein","Foodspring"]
}
```

## Pflicht-Struktur der Prosa

Die Prosa-Antwort MUSS so beginnen:
- ZUERST eine H1-Überschrift im Format `# LP-Analyse von <landing_page_url>` (verwende den Wert deines `landing_page_url`-Feldes aus dem JSON-Block – inkl. Pfad wenn eine Produktseite analysiert wurde).
- DANACH die sechs nummerierten Abschnitte in dieser Reihenfolge, jeweils mit Markdown-Überschrift `### N. Titel` und 1-3 Sätzen Inhalt. Lasse keine Sektion weg; wenn Infos fehlen, schreibe das ehrlich in 1 Satz.

1. **Marke & Positionierung** – wer ist der Kunde, in welcher Branche, Tagline, generelle Marktposition
2. **Brand-Profil** – die wichtigsten Brand-USPs, Brand-Offers/Garantien und welchen branchenweiten Schmerz die Marke insgesamt adressiert
3. **Produkt-Highlight** – das beworbene Hauptprodukt, seine USPs, Offers und welche konkreten Probleme es löst; Preis-Anker wenn vorhanden
4. **Zielgruppen** – 2-4 Personas, je Persona Bedarf und Intent-Stage (Awareness/Consideration/Decision)
5. **Tonalität & Voice** – Tonalitäts-Adjektive, Anredeform, dominanter CTA der LP
6. **SEA-Hebel** – Conversion-Goals, Geografie, wichtigste LP-Keywords, klare Wettbewerber

## Komplettes Beispiel einer KORREKTEN Antwort

So MUSS deine Antwort strukturiert sein – zuerst die H1 mit der URL, dann die sechs Sektionen als Markdown, dann der JSON-Block direkt darunter, OHNE weiteren Text danach:

---

# LP-Analyse von esn.com/products/flexpresso-protein-coffee

### 1. Marke & Positionierung
ESN ist ein deutscher Hersteller hochwertiger Sports-Nutrition mit Sitz in Elmshorn und positioniert sich seit 2005 als Premium-Anbieter im DACH-Raum. Die Marke arbeitet unter dem Claim "Premium Sports Nutrition - made in Germany" und richtet sich an leistungsorientierte Fitness-Kunden.

### 2. Brand-Profil
Die zentralen Brand-USPs sind Made in Germany, eigene Produktion und ueber 1 Mio. Kunden. Markenweite Hebel im Checkout sind Versandkosten frei ab 60 EUR und 60 Tage Rueckgaberecht. ESN adressiert damit den branchenweiten Schmerz, dass Supplements in puncto Qualitaet schwer einzuschaetzen sind.

### 3. Produkt-Highlight
Beworben wird Flexpresso Protein Coffee - ein Cold-Brew-basiertes Protein-Getraenk mit 20 g Whey pro Portion, ohne Zuckerzusatz. Kernofferte sind 10 % Erstbesteller-Rabatt und ein Spar-Abo; der Preis-Anker liegt bei "ab 24,90 EUR". Das Produkt loest das Problem, dass Kaffee keinen Naehrwert hat und gaengige Proteindrinks kuenstlich schmecken.

### 4. Zielgruppen
Hauptpersona sind junge Fitness-Enthusiasten (Consideration), die einen Protein-Boost im Alltag suchen. Zweite Persona sind berufstaetige Kaffeetrinker (Awareness), die Energie und Muskelaufbau in einem Produkt wollen. Bestandskunden runden das Bild als Decision-Stage ab.

### 5. Tonalitaet & Voice
Die Marke spricht modern, energiegeladen und direkt - Anrede im Du, Emojis sparsam, kurze Saetze, gezielte Ausrufe als Akzente. Dominanter Call-to-Action auf der LP ist "Jetzt kaufen".

### 6. SEA-Hebel
Konversionsziele sind Produktkauf und Newsletter-Anmeldung im DACH-Raum (DE/AT/CH). Wichtigste LP-Keywords sind Protein-Kaffee, Flexpresso und Whey-Coffee. Hauptwettbewerber: MyProtein und Foodspring.

```json
{
  "type": "landing_page_analysis",
  "customer": "ESN",
  "product": "Flexpresso Protein Coffee",
  "landing_page_url": "esn.com/products/flexpresso-protein-coffee",
  "domain": "esn.com",
  "industry": "Sport-Nutrition E-Commerce",
  "language": "de",
  "geography": ["DE","AT","CH"],
  "brand_usps": ["Made in Germany","Seit 2005","Ueber 1 Mio. Kunden"],
  "brand_offers": ["Versandkostenfrei ab 60 EUR","60 Tage Rueckgaberecht"],
  "brand_pain_points": ["Unsichere Qualitaet bei Supplements"],
  "brand_tagline": "Premium Sports Nutrition - made in Germany",
  "product_usps": ["20g Protein pro Portion","Ohne Zuckerzusatz","Cold-Brew-Verfahren"],
  "product_offers": ["10% Erstbesteller-Rabatt","Spar-Abo verfuegbar"],
  "product_pain_points": ["Kaffee ohne Naehrwert"],
  "product_price_anchor": "ab 24,90 EUR",
  "target_audience": [
    {"persona":"Junge Fitness-Enthusiasten","needs":"Protein-Boost im Alltag","intent_stage":"consideration"}
  ],
  "tonality": ["modern","energiegeladen","direkt"],
  "voice_rules": {"address":"du","emojis":"sparingly","sentence_length":"short","exclamation":"on"},
  "cta": "Jetzt kaufen",
  "conversion_goals": ["Produktkauf"],
  "lp_keywords": ["Protein-Kaffee","Flexpresso","Whey-Coffee"],
  "competitors": ["MyProtein","Foodspring"]
}
```
---

## END-CHECK (vor dem Senden)
Bevor du deine Antwort abschickst, pruefe: enthaelt sie am Ende einen ```json-Codeblock mit `"type": "landing_page_analysis"`? Wenn nicht, ist die Antwort UNVOLLSTAENDIG - haenge den Block jetzt an. Eine Antwort ohne diesen Block wird vom nachgelagerten System verworfen und der gesamte Workflow scheitert.
"""


# ----- Agent factory -------------------------------------------------------

def create_landing_page_agent():
    tools = [fetch_landing_page]
    if mongodb_toolset:
        tools.append(mongodb_toolset)
        # Hard rule first, workflow second. The output_schema directive sits at
        # the END of the instruction (where most of the field documentation
        # lives) — repeating the strict "must end with JSON" rule up here makes
        # sure the model treats it as a non-negotiable contract, not a footnote.
        instruction = f"""Du bist der Landingpage-Analyst.

UNUMSTOESSLICHE AUSGABE-REGEL (gilt ohne Ausnahme):
Jede Antwort von dir MUSS am Ende exakt EINEN ```json-Codeblock vom Typ `landing_page_analysis` enthalten. Eine Antwort ohne diesen Block gilt als nicht erledigt. Das Schema ist unten in dieser Instruction definiert. Diese Regel gilt sowohl bei einer frischen Analyse als auch beim Wiederverwenden eines Cache-Treffers.

CACHE-SCHLUESSEL (sehr wichtig):
Der Cache-Schluessel ist die VOLLSTAENDIGE URL, die der Nutzer angegeben hat - inklusive Pfad und ggf. Query, OHNE Protokoll, OHNE `www.` und ohne abschliessenden Slash. Eine Brand-Seite ("esn.com") und eine Produktseite ("esn.com/products/vitamin-d3-k2") sind verschiedene Seiten mit unterschiedlichem Inhalt und MUESSEN zwei getrennte Eintraege bekommen. Extrahiere niemals die nackte Domain als Cache-Key, wenn der Nutzer eine spezifische URL mit Pfad uebergibt.

Beispiele fuer korrekte Cache-Keys:
- Eingabe "https://www.esn.com/" -> Key "esn.com"
- Eingabe "esn.com/products/vitamin-d3-k2-120-kaps" -> Key "esn.com/products/vitamin-d3-k2-120-kaps"

WORKFLOW (MongoDB MCP):
Du hast Zugriff auf die MongoDB-Tools des Partners über den MongoDB MCP Server. Bevor du irgendein anderes MongoDB-Tool aufrufst, musst du dich IMMER zuerst mit der Datenbank verbinden:
Rufe hierzu das Tool `connect` auf (der Verbindungs-String ist bereits in der Umgebung konfiguriert, gib ihn NIEMALS in deiner Antwort aus).

Sobald die Verbindung steht, pruefe immer zuerst in der MongoDB, ob bereits eine Analyse fuer DIESE konkrete URL existiert. Verwende das MongoDB-Tool `find` in der Database `sea_team_lead` und der Collection `customer_profiles` mit einem Filter auf das Feld `url` (z. B. `{{ "url": "esn.com/products/vitamin-d3-k2-120-kaps" }}`). Verwende dabei den oben definierten Cache-Schluessel als Wert von `url`.

CACHE-HIT (Dokument gefunden):
- Wenn das gefundene Dokument bereits ein Feld `analysis` mit einem `landing_page_analysis`-Objekt enthaelt: gib eine kurze Prosa-Zusammenfassung aus (entweder aus `profile_prose` oder zusammengefasst aus `analysis`) UND haenge `analysis` UNVERAENDERT als JSON-Block an.
- Wenn das Dokument nur `profile` (Altformat ohne JSON) enthaelt: leite das `landing_page_analysis`-Objekt aus dem Prosa-Profil ab, gib dieses Objekt als JSON-Block am Ende der Antwort aus, UND schreibe das Dokument einmalig per `update-many` (Filter `{{ "url": "<cache-key>" }}`, Update `{{ "$set": {{ "profile_prose": "<bestehende Prosa>", "analysis": <das Objekt> }} }}`) zurueck.

CACHE-MISS (kein Dokument):
1. Nutze das `fetch_landing_page`-Tool, um den Textinhalt GENAU DER vom Nutzer uebergebenen URL zu laden (nicht der nackten Domain).
2. Extrahiere alle Felder des Schemas (Identitaet, Brand- und Product-Pools, Audience inkl. Intent-Stage, Tonalitaet, Voice Rules, CTA, Conversion-Goals, LP-Keywords, Competitors) und erstelle die Prosa-Zusammenfassung fuer den Nutzer.
3. Speichere das Ergebnis per `insert-many` in `sea_team_lead.customer_profiles` mit der Struktur `{{ "url": "<cache-key>", "domain": "<bare-domain>", "profile_prose": "<strukturierte Prosa>", "analysis": <das landing_page_analysis-Objekt> }}` in einer Liste unter `documents`. Setze `url` auf den oben definierten Cache-Schluessel und `domain` auf die nackte Host-Domain (z. B. "esn.com").
4. Gib in deiner Antwort zuerst die Prosa-Zusammenfassung und am Ende den `landing_page_analysis`-JSON-Block aus.""" + LP_OUTPUT_SCHEMA

    else:
        tools.extend([load_customer_profile, save_customer_profile])
        # Same "JSON block is mandatory" framing as the MCP branch, just with
        # the local-file cache instead of MongoDB. load_customer_profile returns
        # either the new {profile_prose, analysis} shape or the legacy plain
        # prose; the agent has to produce a JSON block either way.
        instruction = """Du bist der Landingpage-Analyst.

UNUMSTOESSLICHE AUSGABE-REGEL (gilt ohne Ausnahme):
Jede Antwort von dir MUSS am Ende exakt EINEN ```json-Codeblock vom Typ `landing_page_analysis` enthalten. Eine Antwort ohne diesen Block gilt als nicht erledigt. Das Schema ist unten in dieser Instruction definiert. Diese Regel gilt sowohl bei einer frischen Analyse als auch beim Wiederverwenden eines Cache-Treffers.

CACHE-SCHLUESSEL (sehr wichtig):
Der Cache-Schluessel ist die VOLLSTAENDIGE URL inklusive Pfad - "esn.com" und "esn.com/products/vitamin-d3-k2" sind ZWEI verschiedene Cache-Eintraege. Uebergib daher an `load_customer_profile` und `save_customer_profile` IMMER die exakt vom Nutzer angegebene URL (Pfad inklusive), niemals nur die nackte Domain.

WORKFLOW (lokaler Cache):
Nutze zuerst das `load_customer_profile`-Tool mit dem Cache-Schluessel als Argument, um zu pruefen, ob fuer DIESE URL bereits eine Analyse gespeichert ist.

CACHE-HIT:
- Wenn der zurueckgegebene Eintrag bereits ein `analysis`-Feld enthaelt: gib eine kurze Prosa-Zusammenfassung aus und haenge `analysis` UNVERAENDERT als JSON-Block an.
- Wenn nur Prosa (Altformat) zurueckkommt: leite das `landing_page_analysis`-Objekt aus dieser Prosa ab, gib es als JSON-Block am Ende der Antwort aus UND rufe `save_customer_profile` erneut auf, um die neue, vollstaendige Struktur (`profile_prose` + `analysis`) zu speichern.

CACHE-MISS:
1. Nutze das `fetch_landing_page`-Tool, um den Textinhalt GENAU DER vom Nutzer uebergebenen URL zu laden (nicht der nackten Domain).
2. Extrahiere alle Felder des Schemas und erstelle die Prosa-Zusammenfassung.
3. Speichere die Struktur per `save_customer_profile` mit dem Cache-Schluessel als Argument ab.
4. Antworte mit Prosa + abschliessendem `landing_page_analysis`-JSON-Block.""" + LP_OUTPUT_SCHEMA

    return Agent(
        name="landing_page_agent",
        model=Gemini(
            model="gemini-flash-latest",
            retry_options=types.HttpRetryOptions(attempts=3),
        ),
        instruction=apply_rules(instruction),
        description="Analysiert eine Landingpage-URL und extrahiert USPs, Zielgruppen und Kerninformationen unter Verwendung von Caching.",
        tools=tools,
    )

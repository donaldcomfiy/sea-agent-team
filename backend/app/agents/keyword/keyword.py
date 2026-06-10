# ruff: noqa
from pathlib import Path

from google.adk.agents import Agent
from google.adk.models import Gemini
from google.genai import types

from app.common import (
    apply_rules,
    cached_skill_from,
    mongodb_persist_directive,
    mongodb_toolset,
)


SKILL_PATH = Path(__file__).parent / "skills" / "keyword_skill.md"


KEYWORDS_OUTPUT_SCHEMA = """

## Pflicht-Output: Keyword-Recherche als JSON-Block

Zusätzlich zur Prosa-Antwort gibst du am Ende GENAU EINEN ```json-Codeblock mit folgender festen Struktur aus. Jedes Feld MUSS vorhanden sein. Werte stets auf Deutsch.

Bedeutung der Felder:
- `summary` (str): 2-3 Sätze. Total-Anzahl Keywords, grobe Match-Type-Verteilung, Schwerpunkte.
- `campaigns` (list[obj]): exakt die Kampagnen aus der `strategy` (gleiche `name`-Werte – 1:1 übernehmen).
    - `name` (str): identisch zum Strategy-Kampagnennamen.
    - `campaign_negatives` (list[str], 5-15): kampagnenweite Negatives. Übernimm zunächst die `recommended_negative_keywords` aus der Strategy und erweitere sie um 3-5 weitere Branchen-/Use-Case-spezifische Negatives (z. B. "rezept", "selber machen", "wikipedia", "youtube" bei E-Commerce).
    - `ad_groups` (list[obj]): exakt die Ad-Groups aus der `strategy.campaigns[].ad_groups` (gleiche `name`-Werte).
        - `name` (str): identisch zur Strategy-Ad-Group.
        - `intent_stage` (str): "awareness" | "consideration" | "decision" – übernimm den Wert aus der Strategy.
        - `voice_pool` (str): "brand" | "product" – übernimm den Wert aus der Strategy. Das bestimmt, ob die Keywords markennah ("esn", "esn supplements") oder produktnah ("vitamin d3 k2 kaufen", "knochengesundheit") gewählt werden.
        - `cluster_rationale` (str): EIN Satz. Warum diese Auswahl, woraus aus LP/Strategy abgeleitet (`lp_keywords` / `keyword_seed_clusters` referenzieren), und welcher Match-Type-Mix dominiert.
        - `keywords` (list[obj], 3-20): Liste der Keywords. Soft-Target 5-15 je Ad-Group, hard 3-20. Bei Brand-Ad-Groups sind 3-7 OK (Brand-Term + wenige Varianten); bei breiteren Generic-Clustern sind bis zu 20 OK. Begründe eine Abweichung von 5-15 im `cluster_rationale` mit einem Halbsatz.
            - `keyword` (str): das Keyword in Kleinschreibung, OHNE Match-Type-Klammern (kein "[...]" oder Anführungszeichen).
            - `match_type` (str): genau einer von "EXACT", "PHRASE", "BROAD".
            - `use_in_copy` (bool): true = **Headline-Anchor** (Copywriter zieht daraus seine Säule-1-Headlines), false = **Bidding-Only** (wird gebucht, aber NICHT in Headlines verwendet). Pro Ad-Group **3-7 Keywords** mit `use_in_copy: true` markieren – das ist Material für die Copy. Klassifikations-Kriterien:
                - `use_in_copy: true`: reine Brand-Terms ("esn flexpresso"), Spec-Modifier ohne Mehrdeutigkeit ("flexpresso 300g", "flexpresso caramel"), Money-Modifier ("protein kaffee kaufen"), klare Produktnamen-Varianten ("cold brew protein")
                - `use_in_copy: false`: Retail-Modifier ("flexpresso dm", "flexpresso aldi", "flexpresso rossmann") – würden "bei DM kaufen"-Headlines erzeugen, aber wir leiten zu esn.com; Research-/Test-Tails ("flexpresso erfahrungen", "vergleich", "testsieger") – User recherchiert, Hard-Sell-Headline unpassend; Long-Tail-Discovery ("protein kaffee mit milch", "iced coffee vegan" wenn LP nicht vegan ist) – zu spezifisch für RSA-Mischung
        - `ad_group_negatives` (list[str], 3-10): CROSS-Negatives, die diese Ad-Group gegen andere abgrenzen. Pflicht: Brand-Ad-Groups MÜSSEN die wichtigsten Generic-Begriffe als Negatives enthalten und umgekehrt – damit verhindern wir, dass Brand- und Generic-Kampagnen auf denselben Suchen miteinander konkurrieren und sich selbst überbieten.

MATCH-TYPE-LOGIK (verbindlich):
- EXACT: Brand-/Money-Keywords, enge Money-Terms ("esn", "esn flexpresso kaufen", "vitamin d3 k2 depot"). Höchster ROI bei exakten Treffern.
- PHRASE: mittelspezifische Suchen, bei denen die Wortreihenfolge die Intention prägt ("vitamin d3 k2 hochdosiert", "protein kaffee bestellen").
- BROAD: nur für generische Discovery-Keywords mit hohem Volumen und niedrigerer Conversion-Wahrscheinlichkeit ("supplements", "abnehmen tipps"). Sparsam einsetzen.
- Faustregel für den Mix pro Ad-Group: bei Brand und Decision-Stage mehrheitlich EXACT; bei Consideration mehrheitlich PHRASE; bei Awareness/Discovery PHRASE + sparsam BROAD.

ABLEITUNGS-PFLICHTEN (wichtig):
- 1:1-Übernahme der Kampagnen- und Ad-Group-Namen aus der `strategy`. Erfinde keine neuen.
- Pro Ad-Group MUSS mindestens ein Keyword aus `landing_page_analysis.lp_keywords` oder `strategy.campaigns[].ad_groups[].keyword_seed_clusters` als Seed verwendet werden – das stellt sicher, dass Keywords aus der LP-Sprache stammen.
- Cross-Negatives sind PFLICHT: in Brand-Ad-Groups MÜSSEN die zentralen Begriffe der Generic-Ad-Groups als `ad_group_negatives` stehen; in Generic-Ad-Groups MUSS der Marken-Name (und Varianten) als `ad_group_negatives` stehen.
- `voice_pool: "brand"` → Keywords drehen sich um Markenname + markenweite Begriffe; `voice_pool: "product"` → Keywords drehen sich um Produktname, Anwendungsfälle, Benefits, Wirkstoffe.

## Pflicht-Struktur der Prosa

Die Prosa-Antwort MUSS so beginnen:
- ZUERST eine H1-Überschrift im Format `# Keyword-Recherche zu <customer>` (verwende den Marken-/Kundennamen aus der LP-Analyse).
- DANACH die folgenden fünf nummerierten Abschnitte in dieser Reihenfolge, jeweils mit Markdown-Überschrift `### N. Titel` und 1-3 Sätzen Inhalt:
1. **Keyword-Strategie-Überblick** – Anzahl gesamt, grobe Match-Type-Verteilung, thematische Schwerpunkte
2. **Cluster pro Kampagne** – pro Kampagne knapp die Ad-Groups + Anzahl Keywords + dominanter Match-Type
3. **Match-Type-Verteilung** – Begründung warum welcher Mix wo dominiert
4. **Negative Keywords** – Kampagnen-Negatives als Liste + Cross-Negatives kurz erklärt (Brand negt Generic-Terms und umgekehrt)
5. **Erweiterungs-Empfehlungen** – Long-Tail / Saison / Phase-2-Themen, die jetzt bewusst NICHT drin sind

## Komplettes Beispiel einer KORREKTEN Antwort

So MUSS deine Antwort aufgebaut sein – zuerst H1, dann fünf Sektionen, dann der JSON-Block, OHNE weiteren Text danach:

---

# Keyword-Recherche zu ESN

### 1. Keyword-Strategie-Überblick
Insgesamt 32 Keywords über zwei Kampagnen und drei Ad-Groups. Match-Type-Mix: 40 % EXACT (Money-/Brand-Terms), 50 % PHRASE (Produkt + Modifier), 10 % BROAD (sparsam für Discovery). Schwerpunkt liegt auf produktnahen Long-Tail-Suchen rund um Vitamin D3 K2 und Depot-Wirkung.

### 2. Cluster pro Kampagne
**Brand Search – ESN**: 1 Ad-Group ("Brand Pure", 5 Keywords, mehrheitlich EXACT). **Generic – Vitamin D3 K2 Depot**: 2 Ad-Groups ("Vitamin D3 K2 Depot" mit 14 Keywords PHRASE-dominiert; "Knochengesundheit & Immunsystem" mit 13 Keywords PHRASE + BROAD).

### 3. Match-Type-Verteilung
Brand-Ad-Group ist EXACT-dominiert, weil Brand-Suchen sehr conversion-nah sind und Phrase-Streuung kostet. Generic-Ad-Groups setzen primär auf PHRASE, weil die Wortreihenfolge bei „vitamin d3 k2 hochdosiert" Intention vermittelt; einzelne BROAD-Terms sind nur in der zweiten Generic-Ad-Group für Awareness-Suchen gesetzt.

### 4. Negative Keywords
Kampagnenweite Negatives (für beide Kampagnen): kostenlos, gratis, jobs, gebraucht, ebay, amazon, rezept, selber machen, wikipedia, youtube, test, studie. Cross-Negatives: in Brand werden „vitamin d3 k2", „depot", „knochengesundheit" als Ad-Group-Negatives gesetzt; in den Generic-Ad-Groups wird „esn" als Ad-Group-Negative gesetzt – damit konkurrieren Brand und Generic nicht miteinander um dieselben Suchen.

### 5. Erweiterungs-Empfehlungen
In Phase 2 lohnt sich ein eigenes Cluster für Vergleichsanfragen ("vitamin d3 k2 dosierung", "vitamin d3 k2 wirkung") sowie eine saisonale Awareness-Welle Oktober–März (Vitamin-D-Mangel-Thematik). Long-Tail-Begriffe rund um konkrete Anwendungsfälle (Sportler, Senioren) liegen ebenfalls auf dem Tisch.

```json
{
  "type": "keywords",
  "summary": "32 Keywords über zwei Kampagnen und drei Ad-Groups. Match-Type-Mix 40/50/10 (EXACT/PHRASE/BROAD). Schwerpunkt produktnahe Long-Tail-Suchen zu Vitamin D3 K2.",
  "campaigns": [
    {
      "name": "Brand Search – ESN",
      "campaign_negatives": ["kostenlos","gratis","jobs","gebraucht","ebay","amazon","rezept","selber machen","wikipedia","youtube","test","studie"],
      "ad_groups": [
        {
          "name": "Brand Pure",
          "intent_stage": "decision",
          "voice_pool": "brand",
          "cluster_rationale": "Markenschutz – Seed aus strategy.keyword_seed_clusters ['Brand'] + lp_keywords ['ESN']. Bewusst nur 5 Keywords, da hochkonzentrierter Brand-Cluster (EXACT dominiert).",
          "keywords": [
            {"keyword": "esn", "match_type": "EXACT", "use_in_copy": true},
            {"keyword": "esn supplements", "match_type": "EXACT", "use_in_copy": true},
            {"keyword": "esn shop", "match_type": "EXACT", "use_in_copy": true},
            {"keyword": "esn vitamin d3 k2", "match_type": "PHRASE", "use_in_copy": true},
            {"keyword": "esn online kaufen", "match_type": "PHRASE", "use_in_copy": false}
          ],
          "ad_group_negatives": ["vitamin d3 k2","depot","knochengesundheit","immunsystem","supplements generisch"]
        }
      ]
    },
    {
      "name": "Generic – Vitamin D3 K2 Depot",
      "campaign_negatives": ["kostenlos","gratis","jobs","gebraucht","ebay","amazon","rezept","selber machen","wikipedia","youtube","test","studie"],
      "ad_groups": [
        {
          "name": "Vitamin D3 K2 Depot",
          "intent_stage": "consideration",
          "voice_pool": "product",
          "cluster_rationale": "Core-Produkt-Cluster aus lp_keywords ['Vitamin D3 K2', 'Depot'] + strategy seed ['Vitamin D3 K2', 'Depot']. PHRASE-Mehrheit, da Wortreihenfolge Kauf-Intention prägt. 5 Headline-Anchor.",
          "keywords": [
            {"keyword": "vitamin d3 k2 depot", "match_type": "EXACT", "use_in_copy": true},
            {"keyword": "vitamin d3 k2 kaufen", "match_type": "PHRASE", "use_in_copy": true},
            {"keyword": "vitamin d3 k2 hochdosiert", "match_type": "PHRASE", "use_in_copy": true},
            {"keyword": "vitamin d3 k2 depot kaufen", "match_type": "PHRASE", "use_in_copy": true},
            {"keyword": "vitamin d3 k2 1000 ie", "match_type": "PHRASE", "use_in_copy": true},
            {"keyword": "vitamin d3 k2 kombination", "match_type": "PHRASE", "use_in_copy": false},
            {"keyword": "vitamin d3 k2 erwachsene", "match_type": "PHRASE", "use_in_copy": false},
            {"keyword": "vitamin d3 k2 depot online", "match_type": "PHRASE", "use_in_copy": false},
            {"keyword": "vitamin d3 k2 mk7", "match_type": "PHRASE", "use_in_copy": false},
            {"keyword": "vitamin d3 k2 testsieger", "match_type": "PHRASE", "use_in_copy": false},
            {"keyword": "vitamin d3 k2 wochendosis", "match_type": "PHRASE", "use_in_copy": false},
            {"keyword": "vitamin d3 k2 tropfen alternative", "match_type": "PHRASE", "use_in_copy": false},
            {"keyword": "vitamin d3 k2 günstig", "match_type": "PHRASE", "use_in_copy": false},
            {"keyword": "vitamin d3 k2 depot stiftung warentest", "match_type": "BROAD", "use_in_copy": false}
          ],
          "ad_group_negatives": ["esn","esn supplements","brand","tropfen","baby","kinder"]
        },
        {
          "name": "Knochengesundheit & Immunsystem",
          "intent_stage": "consideration",
          "voice_pool": "product",
          "cluster_rationale": "Awareness-/Use-Case-Cluster aus strategy seed ['Knochengesundheit','Immunsystem']. PHRASE für Kombi-Suchen, ein BROAD für Discovery-Anfragen.",
          "keywords": [
            {"keyword": "knochengesundheit nahrungsergänzung", "match_type": "PHRASE", "use_in_copy": true},
            {"keyword": "knochen stärken vitamin", "match_type": "PHRASE", "use_in_copy": true},
            {"keyword": "immunsystem stärken vitamin", "match_type": "PHRASE", "use_in_copy": true},
            {"keyword": "vitamin für knochen", "match_type": "PHRASE", "use_in_copy": true},
            {"keyword": "vitamin für immunsystem", "match_type": "PHRASE", "use_in_copy": true},
            {"keyword": "knochenstoffwechsel unterstützen", "match_type": "PHRASE", "use_in_copy": false},
            {"keyword": "calcium aufnahme verbessern", "match_type": "PHRASE", "use_in_copy": false},
            {"keyword": "vitamin d mangel ausgleichen", "match_type": "PHRASE", "use_in_copy": false},
            {"keyword": "knochendichte verbessern", "match_type": "PHRASE", "use_in_copy": false},
            {"keyword": "winter immunsystem", "match_type": "PHRASE", "use_in_copy": false},
            {"keyword": "vitamin gegen erkältung", "match_type": "PHRASE", "use_in_copy": false},
            {"keyword": "knochen vitamin senior", "match_type": "PHRASE", "use_in_copy": false},
            {"keyword": "vitamine für sportler", "match_type": "BROAD", "use_in_copy": false}
          ],
          "ad_group_negatives": ["esn","esn supplements","brand","arzneimittel","apotheke rezeptpflichtig"]
        }
      ]
    }
  ]
}
```

---

## END-CHECK (vor dem Senden)
Bevor du deine Antwort abschickst, prüfe systematisch:
1. Beginnt die Antwort mit `# Keyword-Recherche zu <customer>`?
2. Sind ALLE fünf Prosa-Sektionen mit `### N.`-Überschriften vorhanden?
3. Enthält die Antwort am Ende GENAU einen ```json-Codeblock mit `"type": "keywords"`?
4. Stimmen die Kampagnen- und Ad-Group-Namen 1:1 mit der `strategy` überein (Schreibweise, Bindestriche, Großbuchstaben)?
5. Hat jede Ad-Group zwischen 3 und 20 Keywords (Soft 5-15, Brand-Cluster dürfen kleiner sein)?
6. Hat JEDE Generic-Ad-Group den Markennamen in `ad_group_negatives`?
7. Hat JEDE Brand-Ad-Group die zentralen Generic-Begriffe in `ad_group_negatives`?
8. Sind die `campaign_negatives` gefüllt (Starter-Set aus Strategy + 3-5 Ergänzungen)?
9. Sind alle Keywords in Kleinschreibung, ohne `[...]`-/`"..."`-Decoration?
10. **`use_in_copy`-Check:** Hat JEDES Keyword das Feld `use_in_copy` (true/false) gesetzt? Hat JEDE Ad-Group **3-7 Keywords mit `use_in_copy: true`** (Headline-Anchor für den Copywriter)? Sind Retail-Modifier (z. B. „dm", „aldi", „rossmann"), Research-Tails („testsieger", „erfahrungen", „vergleich") und sehr lange Long-Tails als `use_in_copy: false` markiert?
Wenn auch nur einer dieser Punkte nicht erfüllt ist, korrigiere die Antwort jetzt. Sonst scheitert der Workflow.
"""


def create_keyword_agent():
    extra_tools = [mongodb_toolset] if mongodb_toolset else []
    persist_block = mongodb_persist_directive("keywords") if mongodb_toolset else ""
    # Domain playbook for the keyword agent. Same pattern as the strategy
    # agent: external markdown file under app/skills/, conditionally loaded
    # and embedded as a clearly marked reference block. The output schema
    # below stays the source of truth for shape/format; the playbook informs
    # the *content* decisions (match types, cross-negatives, phantom-keyword
    # avoidance, two-token rule).
    skill_text = cached_skill_from(str(SKILL_PATH))
    skill_block = (
        "\n\n## Domänen-Playbook (Keyword Skill)\n\n"
        "Die folgende Markdown-Datei ist dein verbindliches SEA-Keyword-Playbook. "
        "Konsultiere sie bei JEDER Keyword-Recherche. Bei Konflikt mit dem JSON-Output-Schema unten gewinnt das Schema; "
        "bei Konflikt mit den ABLEITUNGS-PFLICHTEN gewinnen die ABLEITUNGS-PFLICHTEN. Das Playbook prägt die "
        "*Inhalte* deiner Keyword-Auswahl (Match-Type-Mix, Cross-Negatives, Phantom-Keyword-Verbot, "
        "Two-Token-Spezifität), nicht die *Form* deines Outputs.\n\n"
        "--- PLAYBOOK START ---\n"
        f"{skill_text}\n"
        "--- PLAYBOOK ENDE ---\n"
    ) if skill_text else ""
    return Agent(
        name="keyword_agent",
        model=Gemini(
            model="gemini-flash-latest",
            retry_options=types.HttpRetryOptions(attempts=3),
        ),
        tools=extra_tools,
        instruction=apply_rules(skill_block + """Du bist der Keyword-Spezialist.

UNUMSTÖSSLICHE AUSGABE-REGEL (gilt ohne Ausnahme):
Jede Antwort von dir MUSS am Ende exakt EINEN ```json-Codeblock vom Typ `keywords` enthalten und davor fünf nummerierte Prosa-Sektionen mit H1-Überschrift wie unten beschrieben. Eine Antwort ohne diesen Block oder mit fehlenden Sektionen gilt als nicht erledigt.

INPUT-NUTZUNG:
Du erhältst vom Team Lead den `landing_page_analysis`-Block, den `strategy`-Block UND - falls vorhanden - den `search_intent`-Block des search_intent_agent sowie den `account_briefing`-Block aus diesem Chat. Alle sind VERBINDLICHE Grundlage:

- Aus dem `account_briefing` (falls vorhanden): nutze `account_phase` als Match-Type-Hinweis (bei "new" / "ramping" PHRASE-dominant, bei "mature" mit tROAS auch BROAD zulaessig), `primary_goal` als Bias (bei "ROAS" eher EXACT/PHRASE-Money-Terms; bei "revenue_growth" auch PHRASE-Long-Tail), `notes` als Kontext.
- Aus der LP-Analyse: `lp_keywords` als Verbatim-Seeds, `target_audience.intent_stage` und `language`, `brand_*` / `product_*` für Themen-Pools, `competitors` (falls vorhanden).
- Aus der Strategy: `campaigns[].name` und `ad_groups[].name` (1:1 übernehmen!), `ad_groups[].keyword_seed_clusters` als Cluster-Vorgabe, `voice_pool` als Brand-vs-Product-Sprache, `intent_stage` als Match-Type-Bias, `recommended_negative_keywords` als Starter-Set für `campaign_negatives` (erweitern, nicht ersetzen).
- Aus dem search_intent (falls vorhanden): `queries_by_stage` als REALE User-Phrasings (Pflicht-Quelle, mindestens 50 % deiner Keywords pro Ad-Group MUESSEN aus den Decision-/Consideration-Queries dieses Blocks stammen statt erfunden); `negative_query_signals` direkt in deine `campaign_negatives` uebernehmen; `recommended_ad_group_mapping` als Hinweis welche Stage-Queries in welche Ad-Group gehoeren.
""" + KEYWORDS_OUTPUT_SCHEMA + persist_block),
        description="Generiert nested Keyword-Cluster (campaign → ad_group → keywords) basierend auf landing_page_analysis und strategy. Setzt Match-Types, Campaign- und Cross-Ad-Group-Negatives.",
    )

# Keyword Skill — SEA Keyword-Recherche Playbook

Domain knowledge that the `keyword_agent` always consults before producing
keyword clusters. Edit this file freely — the loader picks up changes on each
backend restart. The output schema (field shape, prose structure, END-CHECK)
lives in `KEYWORDS_OUTPUT_SCHEMA` in code and stays there; this playbook is
purely about *how* the keyword set is reasoned out.

---

## Kapitel 1 — Match-Type-Philosophie

Der Match-Type-Mix richtet sich nach **Intent-Stage** der Ad-Group und der
**Account-Phase** aus dem Briefing. Faustregeln pro Stage:

| Intent-Stage | Match-Type-Linie | Beispiel |
|---|---|---|
| **Decision** | **EXACT-lastig** (60-80 %), Rest PHRASE | `[esn flexpresso kaufen]` als EXACT, `"esn flexpresso 300g"` als PHRASE |
| **Consideration** | **PHRASE-dominant** (70-90 %), wenige EXACT für Money-Modifier | `"protein kaffee testsieger"` als PHRASE, `[protein kaffee dm]` als EXACT |
| **Awareness** | **PHRASE + sparsam BROAD** (nur bei Phase mature) | `"vitamin d3 mangel symptome"` als PHRASE |

**Match-Type-Bedeutung kurz:**
- **EXACT**: Money-Terms, Brand-Pure, klare Spec/Retail-Modifier. Höchster ROI, höchste Conversion-Rate, niedrigstes Volumen.
- **PHRASE**: Long-Tail mit Wortreihenfolge-Sensitivität. Standard für Consideration-Cluster. Gutes Volumen bei kontrolliertem Spillover.
- **BROAD**: nur in Kombination mit Smart Bidding (tROAS/tCPA) UND `account_phase: "mature"`. Ohne Smart Bidding ist BROAD ein Budget-Killer.

**Sonderfall Brand-Ad-Groups**: bewusst klein und EXACT-lastig (3–7 Keywords).
Brand-Suchen sind hochkonvertierend, PHRASE-Streuung kostet. Wenn die
Brand-Säule existiert: alle Brand-Terms gehören dort hin, NICHT in Generic.

### 1.1 Relevance-Scoring (1–10) für jede Query

Bevor du eine Query aus `search_intent.queries_by_stage` als Keyword
übernimmst, vergibst du intern einen **Relevance-Score 1–10**. Vier
Dimensionen, je Dimension max. 2,5 Punkte:

| Dimension | Frage | max. Punkte |
|---|---|---|
| **Thematic Fit** | Matched die Query `lp_keywords` ODER `product_usps`? | 2,5 |
| **Intent Fit** | Stimmt die Intent-Stage der Query mit dem `intent_stage` der Ad-Group überein? | 2,5 |
| **Audience Fit** | Passt sie zu einer der `target_audience[].persona`-Einträge? | 2,5 |
| **Price Fit** | Signalisiert sie ein Preisniveau, das zu `product_price_anchor` passt (kein „kostenlos" bei Premium, kein „luxus" bei Discount)? | 2,5 |

**Score → Action:**

| Score | Aktion |
|---|---|
| **8–10** | Übernehmen als positives Keyword, Match-Type nach Tabelle oben zuweisen |
| **5–7** | Übernehmen MIT Risiko-Note im `cluster_rationale` („Score 7, könnte streuen — Ad-Copy muss eng auf USP ziehen") |
| **1–4** | NICHT übernehmen — direkt in die Negative-Liste (Layer 3, siehe Kapitel 2) |

### 1.2 Match-Type-Entscheidungs-Tabelle (kombiniert Score + Intent)

| Bedingung | Match-Type |
|---|---|
| Score 8–10 + `decision` + Brand- oder Produkt-spezifisch | **EXACT** |
| Score 8–10 + `decision` + generisch | **PHRASE** |
| Score 6–10 + `consideration` | **PHRASE** |
| Score 5–7 + Thematic-Fit | **PHRASE** mit Risiko-Note |
| `awareness` + LP transaktional | meistens **Negativ** (Layer 5) — case-by-case |
| Score 1–4 | **Negativ** — siehe Kapitel 2 Layer 3 |
| **BROAD** | nur wenn `strategy.bid_strategy` Smart Bidding bestätigt UND `account_phase: "mature"` (siehe Kapitel 7) |

> TODO: Wenn du eigene Match-Type-Defaults pro Industry / Produkt-Typ hast,
> hier ergänzen. Z. B. „Bei Supplements / Beauty zusätzlich PHRASE für
> Inhaltsstoff-Suchen", „bei B2B Lead-Gen EXACT für Fach-Begriffe …".

---

## Kapitel 2 — Cross-Negatives & Selbst-Konkurrenz-Vermeidung

**Cross-Negatives sind Pflicht**, nicht optional. Sie verhindern, dass deine
eigenen Kampagnen sich gegenseitig überbieten und das Budget verbrennen.

**Standard-Set pro Kampagnentyp:**

- **Brand-Ad-Groups** MÜSSEN als `ad_group_negatives` enthalten:
    - Zentrale Generic-Themen-Tokens (z. B. „protein kaffee", „cold brew", „whey coffee" wenn Produkt = Flexpresso)
    - Recherche-Modifier („test", „erfahrungen", „vergleich") — gehören in Generic-Cluster, nicht Brand
- **Generic-Ad-Groups** MÜSSEN als `ad_group_negatives` enthalten:
    - Eigener Markenname und Marken-Varianten (z. B. „esn", „esn supplements")
    - ALLE Wettbewerbernamen aus `landing_page_analysis.competitors` (z. B. „myprotein", „foodspring", „more nutrition") — damit Phrase-/Broad-Match nicht ungewollt auf Konkurrenz-Brand-Suchen auslöst (NO-COMPETITOR-POLICY: wir bieten dort bewusst NICHT positiv)
- **KEINE Competitor-Ad-Groups**. Per Default-Policy (siehe Strategy-Skill Kapitel 5) bauen wir keine `vs <Wettbewerber>`-Ad-Groups. Wettbewerbernamen sind ausschließlich Negative-Material.

**Campaign-Level-Negatives**: das Strategy-Starter-Set (`recommended_negative_keywords`)
übernimmst du 1:1 (es enthält bereits die Wettbewerbernamen, siehe NO-COMPETITOR-POLICY)
und erweiterst um 3–5 Branchen-/Use-Case-Spezifika (z. B. „wikipedia", „youtube",
„forum", „anleitung", „pdf" bei E-Commerce).

### 2.1 Negative-Layer-Modell (5 Layer, additiv)

Bau die Negative-Liste **additiv in 5 Layern**, nie von null:

| Layer | Quelle | Beschreibung |
|---|---|---|
| **L1** | `strategy.recommended_negative_keywords[]` | 1:1 übernehmen — vom Strategie-Agent bereits validiert |
| **L2** | `search_intent.negative_query_signals[]` | jede dort markierte Query + ihren `reason` ins Set übernehmen, Match-Type nach Spezifität (siehe 2.3) |
| **L3** | Score 1–4 aus Kapitel 1.1 | Queries die du beim Relevance-Scoring ausgeschlossen hast |
| **L4** | LP-Gap-Analyse (siehe 2.2) | systematische Negatives basierend auf was NICHT auf der LP ist |
| **L5** | `queries_by_stage.awareness[]` case-by-case | wenn die LP rein transaktional ist, sind viele Awareness-Queries Negatives — prüf jede einzeln |

Pflicht im Output: pro Negative Keyword das Layer-Tag (L1 / L2 / L3 / L4 / L5)
und die Begründung mitführen, damit der Audit-Trail steht (siehe Kapitel 10).

### 2.2 LP-Gap-Analyse (Layer 4)

Systematische Negatives basierend auf was die LP **NICHT** anbietet. Pflicht-
Check pro Kategorie:

| Kategorie | Logik | Beispiel-Negatives |
|---|---|---|
| **Informational Intent** | LP ist transaktional → Lern-/Info-Queries blocken | „was ist", „wie funktioniert", „erklärung", „tutorial", „rezept", „wikipedia" |
| **Price Mismatch (zu billig)** | `product_price_anchor` deutet auf Premium → Discount-Signale blocken | „kostenlos", „gratis", „free", „billig", „günstig", „discounter", „2 für 1" |
| **Retail / Drogerie** | LP verkauft direkt (DTC) → Retail-Suchen blocken sofern nicht strategisch gewollt | „dm", „rossmann", „lidl", „aldi", „rewe", „müller", „edeka" |
| **Competitor-Brands** | aus `landing_page_analysis.competitors[]` — alle als Negatives (NO-COMPETITOR-POLICY) | exakte Konkurrenz-Markennamen, klein geschrieben |
| **Job-Intent** | LP ist kein Stellen-Portal | „jobs", „stellenangebote", „karriere", „praktikum", „ausbildung", „gehalt" |
| **DIY / Selbst-Herstellen** | LP verkauft Fertig-Produkt | „selber machen", „selbst herstellen", „rezept", „anleitung" |
| **Audience Mismatch** | LP zielt auf bestimmte Persona → benachbarte Audiences ausschließen | aus `target_audience[]` ableiten — z. B. „kinder" wenn LP auf Erwachsene zielt |
| **Geo Mismatch** | nur relevant wenn `geography[]` lokal/regional | irrelevante Länder/Regionen blocken |

Pro Kategorie 3–8 Negatives generieren — bei klar nicht zutreffender Kategorie
(z. B. kein Premium-Pricing → keine Discount-Negs nötig) den ganzen Block
weglassen UND im Kapitel-10-Summary erwähnen warum.

### 2.3 Match-Type für Negatives

| Negative-Match-Type | Wann | Beispiele |
|---|---|---|
| **BROAD-Negativ** | generische irrelevante Tokens die nie auftauchen sollen | „kostenlos", „jobs", „rezept" |
| **PHRASE-Negativ** | Intent-Patterns die in Variationen vorkommen | „was ist", „wie funktioniert", „dm", „selber machen" |
| **EXACT-Negativ** | Wettbewerber-Brand-Namen, sehr spezifische einzelne Phrasen | „myprotein", „foodspring", konkrete URL-Tokens |

> TODO: Industry-spezifische Negative-Listen pro Vertical sammeln (Sport-Nutrition,
> Beauty, SaaS …) — die typischen Branchen-Streuverluste, die immer wiederkehren.

---

## Kapitel 3 — NO-COMPETITOR-POLICY (Pflicht zur Strategy-Linie)

Wettbewerbernamen tauchen in deinem Output **NUR als Negatives** auf — niemals
als positive Keywords in irgendeiner Ad-Group. Diese Linie kommt aus dem
Strategy-Skill (Kapitel 5) und ist hier zur Sicherheit nochmal hart gemacht:

**Verboten:**
- Keywords wie `myprotein alternative`, `alternative zu foodspring`,
  `besser als esn` — gehören weder in Brand- noch in Generic-Ad-Groups.
- Ad-Group-Namen mit `vs <Wettbewerber>` — die Strategy darf solche Namen
  gar nicht erst produzieren. Solltest du eine solche Ad-Group im Strategy-
  Input sehen, melde es im `cluster_rationale` als Konsistenz-Fehler und
  lasse den Cluster leer.
- Wettbewerber-Brand-Suchen + Produkt-Kategorie (z. B. `foodspring protein
  kaffee`) als positives Keyword — wäre Conquesting durch die Hintertür.

**Pflicht:**
- ALLE Wettbewerbernamen aus `landing_page_analysis.competitors` MÜSSEN in
  jeder Generic-Ad-Group als `ad_group_negatives` stehen (zusätzlich zum
  Campaign-Level-Set, das die Strategy schon mitgibt). Das ist die einzige
  zulässige Berührung mit Wettbewerbernamen.
- Im Output `cluster_rationale` einer Generic-Ad-Group kurz erwähnen, dass
  Wettbewerber-Brands als Negs laufen: „Wettbewerber-Brands (MyProtein,
  Foodspring) als Ad-Group-Negs – wir kaufen kein Conquesting-Traffic."

**Begründung in Kurzform** (für Audits/Erklärung an den User): hohe CPCs auf
Konkurrenz-Brand-Suchen, schwacher Conversion-Pfad (Vergleichs-Modus),
markenrechtliche Risiken in der Copy, und in der Praxis defensive Headlines.
Mehr dazu im `strategy_skill.md` Kapitel 5.

---

## Kapitel 4 — Two-Token-Mindest-Spezifität (Generic-Cluster)

Ein-Token-Generics (`protein shake`, `whey`, `kaffee`, `supplements`) sind
in Generic-Ad-Groups **verboten**. Sie matchen alles und konvertieren nichts:

- `protein shake` matcht `protein shake selber machen`, `protein shake abnehmen`,
  `protein shaker dm`, `protein shake vor oder nach training` — alles **NICHT**
  unsere Käufer.
- `whey` matcht `whey isolat`, `whey vegan`, `was ist whey`, `whey im test` —
  ähnlich diffus.

**Mindest-Spezifität: zwei Themen-Tokens** im Keyword. Beispiele:

| ❌ Verboten | ✅ OK |
|---|---|
| `protein shake` | `whey protein shake kaffee` |
| `whey` | `whey kaffee karamell` |
| `kaffee` | `protein kaffee dm` |
| `supplements` | `supplements muskelaufbau` |

**Ausnahmen:**
- **Brand-Pure-Cluster** dürfen `[esn]` als EXACT enthalten — Markenname ist
  spezifisch genug.
- **Hochspezifische Produktnamen** dürfen alleinstehen (z. B. `[flexpresso]`,
  `[milkyccino]`) — der Produktname ist ein Token, aber semantisch eindeutig.

---

## Kapitel 5 — Headline-Anchor vs Bidding-Only (`use_in_copy`-Trennung)

Nicht jedes Keyword, auf das wir bieten, soll wörtlich (oder semantisch eng)
in der Anzeige auftauchen. Wer „flexpresso dm" sucht, will das Produkt im
Drogeriemarkt finden — eine Headline „Flexpresso bei DM" wäre **irreführend**,
weil wir den Klick auf esn.com leiten. Wer „flexpresso erfahrungen" sucht,
ist im Research-Modus — eine harte Kauf-Headline passt nicht zur Such-Phase.

**Lösung:** pro Keyword ein boolesches Flag `use_in_copy`. Der Builder bucht
trotzdem ALLE Keywords (Traffic-Capture), aber nur die `true`-markierten
treiben die Copywriter-Headlines.

### Klassifikations-Kriterien

**`use_in_copy: true`** (3–7 Keywords pro Ad-Group, Headline-Material):
- Reine Brand-Terms („esn", „esn flexpresso")
- Spec-Modifier ohne Mehrdeutigkeit („flexpresso 300g", „flexpresso caramel")
- Klare Produktnamen-Varianten („cold brew protein", „whey coffee")
- Money-Modifier ohne Retail-Bias („protein kaffee kaufen", „flexpresso bestellen")

**`use_in_copy: false`** (Bidding-Only, kein Headline-Material):
- **Retail-Modifier** („flexpresso dm", „protein kaffee aldi", „flexpresso rossmann", „flexpresso lidl") — wir leiten zu esn.com, „bei DM"-Headlines wären irreführend und könnten Disapproval auslösen
- **Research-/Test-Tails** („testsieger", „vergleich", „erfahrungen", „test", „bewertung") — User recherchiert, Hard-Sell-Headline unpassend zur Such-Phase
- **Long-Tail-Discovery mit Annahmen die wir nicht erfüllen** („protein kaffee vegan" wenn LP nicht-vegan ist, „iced coffee ohne koffein" wenn Produkt koffeinhaltig ist) — Headlines würden falsch versprechen
- **Sehr lange Frage-Suchen** („wie zubereiten", „wann einnehmen") — für RSA-Mischung zu spezifisch
- **Stiftung-Warentest-/Wikipedia-Tails** — informational, niedrige Kaufabsicht

### Pflicht-Verteilung pro Ad-Group

- **3–7 Keywords mit `use_in_copy: true`** — das ist Material für die
  Copywriter-Säule 1 (Keyword-Relevanz). Weniger als 3 macht die Säule mager,
  mehr als 7 zersplittert die thematische Klarheit.
- Die restlichen Keywords (5–17, je nach Cluster-Größe) sind `false` — sie
  laufen als Bidding-Only mit, ohne die Copy zu verwässern.
- **Bei Brand-Pure-Ad-Groups** (3–7 Keywords total) sind meist ALLE Keywords
  Headline-Anchors → alle `use_in_copy: true`. Das ist die Ausnahme.

### Beispiel — Generic Ad-Group „Protein Coffee"

```jsonc
"keywords": [
  // Headline-Anchors (5 Keywords mit use_in_copy: true)
  {"keyword": "protein kaffee", "match_type": "PHRASE", "use_in_copy": true},
  {"keyword": "protein kaffee kaufen", "match_type": "PHRASE", "use_in_copy": true},
  {"keyword": "flexpresso", "match_type": "EXACT", "use_in_copy": true},
  {"keyword": "flexpresso kaufen", "match_type": "EXACT", "use_in_copy": true},
  {"keyword": "protein coffee", "match_type": "PHRASE", "use_in_copy": true},
  // Bidding-Only Retail-Capture (5 Keywords mit use_in_copy: false)
  {"keyword": "protein kaffee dm", "match_type": "EXACT", "use_in_copy": false},
  {"keyword": "protein kaffee aldi", "match_type": "PHRASE", "use_in_copy": false},
  {"keyword": "protein kaffee rossmann", "match_type": "PHRASE", "use_in_copy": false},
  {"keyword": "protein kaffee lidl", "match_type": "PHRASE", "use_in_copy": false},
  {"keyword": "protein kaffee testsieger", "match_type": "PHRASE", "use_in_copy": false}
]
```

Der Copywriter generiert Säule-1-Headlines aus den ersten 5 Keywords
(„Protein Kaffee", „Flexpresso", „Protein Coffee kaufen", …), und die anderen
5 laufen als Bidding-Only mit, um Retail-Sucher und Test-/Vergleichs-Sucher
abzugreifen ohne ihnen unpassende Headlines zu zeigen.

---

## Kapitel 6 — Daten-Flow & Pflicht-Input-Quellen (Field-by-Field)

Du erhältst drei strukturierte JSON-Blöcke vom Team Lead. Pipeline-Position:
`Team Lead → landing_page_agent → strategy_agent → search_intent_agent → DU`.
Du **fetched keine URLs**, **rufst kein Autocomplete auf**, **klassifizierst
keine Search-Intents** — das alles ist schon erledigt. Deine Aufgabe: die drei
Outputs in den finalen Ad-Group-Keyword-Plan plus Negative-Liste übersetzen.

Wenn einer der drei Blöcke fehlt → STOPP und beim Team Lead nachfordern.

### Aus `landing_page_analysis` (`type: "landing_page_analysis"`)

Felder die du AKTIV nutzt:
- `lp_keywords[]` → **Pflicht-Seeds**: mindestens ein Keyword pro Ad-Group MUSS aus dieser Liste stammen oder davon abgeleitet sein
- `product_usps[]` → Score-Dimension „Thematic Fit" (siehe Kapitel 1.1) UND positiver Anker für `use_in_copy: true`
- `brand_usps[]` → Vertrauenssignale, primär relevant für Brand-Pure-Cluster
- `product_pain_points[]` → Generic-Ad-Group-Achse (Use-Case-Cluster, siehe Kapitel 8)
- `product_price_anchor` → Score-Dimension „Price Fit" (Premium-Pricing → Discount-Negs, etc.)
- `product_offers[]` → kann Money-Modifier-Keywords legitimieren (z. B. „erstbesteller-rabatt")
- `target_audience[].persona` + `target_audience[].intent_stage` → Score-Dimension „Audience Fit"
- `competitors[]` → MÜSSEN als Negatives auftauchen (NO-COMPETITOR-POLICY)
- `language` → Markt-Sprache aller Keywords (NIE UI-Sprache)
- `geography[]` → kontextualisierte Match-Type-Wahl (z. B. „dm" nur in DE-Markt)

Felder die du nutzt um zu erkennen was **NICHT** auf der LP ist:
- alles was in `product_usps` / `lp_keywords` **fehlt**, aber von Wettbewerbern oder Adjacent-Produkten beworben wird → Layer-4-Negative (LP-Gap, siehe Kapitel 2.2)

### Aus `strategy` (`type: "strategy"`)

Felder die du AKTIV nutzt:
- `campaigns[].name` und `ad_groups[].name` → **1:1 übernehmen**, NIE umbenennen; auch das Schicht-Präfix (`Brand Pure – …`, `Brand+Produkt – …`, `Generic – …`) bleibt unverändert
- `campaigns[].purpose` → "Brand" vs "Generic"; bestimmt das Cross-Negative-Set (Kapitel 2 + 8)
- `campaigns[].bid_strategy` → bestätigt ob Smart Bidding läuft (entscheidend für BROAD-Erlaubnis, siehe Kapitel 7)
- `ad_groups[].keyword_seed_clusters[]` → **Pflicht-Themen-Vorgabe** für jede Ad-Group; jeder Cluster MUSS abgedeckt sein
- `ad_groups[].voice_pool` → "brand" vs "product"; Brand-Pure zieht aus Markennamen-Varianten, alle anderen aus Produkt-/Kategorie-Termen
- `ad_groups[].intent_stage` → Match-Type-Bias (siehe Kapitel 1.2)
- `recommended_negative_keywords[]` → **Layer-1-Negatives**, 1:1 übernehmen + erweitern, NIE ersetzen

### Aus `search_intent` (`type: "search_intent"`, falls vorhanden)

Felder die du AKTIV nutzt:
- `queries_by_stage.decision[]` → **Pflicht-Quelle für Money-Queries**, → EXACT-Kandidaten
- `queries_by_stage.consideration[]` → PHRASE-Kandidaten
- `queries_by_stage.awareness[]` → vorsichtig prüfen, oft **Layer-5-Negatives**
- `negative_query_signals[]` → 1:1 ins Negative-Set als **Layer-2**, mit `reason` als Begründung; Match-Type nach Spezifität (Kapitel 2.3)
- `recommended_ad_group_mapping[]` → Baseline für Query-zu-Ad-Group-Zuordnung; nur abweichen wenn klarer Relevanz-Grund
- `raw_autocomplete[seed]` → Validierungs-Quelle für Generic-/Brand-Keywords (Wettbewerber-Seeds tauchen unter NO-COMPETITOR-POLICY ohnehin nicht als positive Keywords auf)
- `top_modifiers[]` → Inspirations-Quelle für Long-Tail-Erweiterungen

**Pflicht-Quote**: mindestens 50 % deiner positiven Keywords pro Ad-Group
MÜSSEN aus `queries_by_stage.decision` oder `.consideration` stammen — sonst
halluzinierst du statt zu extrahieren.

### Aus `account_briefing` (durchgereicht über Team Lead)

- `account_phase` → Match-Type-Restriktion (Kapitel 7)
- `existing_layers[]` → bestimmt welche Schichten skipped sind (Kapitel 8)

**Konfliktregel**: Bei Widerspruch zwischen Strategy und Search-Intent (z. B.
Strategy hat „Whey Coffee" als Cluster, Search-Intent zeigt aber kaum Volumen)
→ kleinere Cluster-Größe als Antwort, dokumentiert im `cluster_rationale`.
NIEMALS Strategy-Ad-Group-Namen umbenennen, immer dazwischen vermitteln.

---

## Kapitel 7 — Phase-Anpassungen (vom Conversion-Count getrieben)

Aus dem `account_briefing` kommt `account_phase`. Das beeinflusst Match-Type-Mix:

| Phase | Conv./30d | Match-Type-Linie | BROAD erlaubt? |
|---|---|---|---|
| **new** | 0 | 50–60 % EXACT, 40–50 % PHRASE, KEIN BROAD | ❌ Nein |
| **ramping** | 1–29 | 70–80 % PHRASE, 15–25 % EXACT, KEIN BROAD | ❌ Nein |
| **mature** | 30+ | 50–70 % PHRASE, 20–30 % EXACT, 10–20 % BROAD (nur mit tROAS) | ✅ Ja, mit Smart Bidding |

**Begründung**: BROAD braucht Smart Bidding (tROAS/tCPA) damit der Algorithmus
die richtigen Auctions wählt. Bei `new` / `ramping` läuft die Bid-Strategie auf
„Klicks maximieren" oder „Conversions maximieren" — da würde BROAD nur
unqualifizierte Auslieferung erzeugen. Erst bei `mature` mit aktivem tROAS
darfst du BROAD einsetzen, und auch dann sparsam (max. 20 %).

> TODO: Wenn du noch eigene Faustregeln zur Keyword-Anzahl pro Ad-Group nach
> Phase hast (z. B. „in Phase new max. 5 Keywords pro Ad-Group damit der
> Algorithmus schnell lernen kann"), hier ergänzen.

---

## Kapitel 8 — Drei-Schicht-Ad-Group-Logik (Marke → Produkt → Lösung)

Die Strategy liefert Default drei Kampagnen-Schichten (siehe Strategy-Skill
Kapitel 1). Pro Schicht gelten unterschiedliche Keyword-Regeln, die deine
zentrale Aufgabe als Keyword-Agent sind — damit sich die Schichten **nicht
kannibalisieren**.

### Schicht 1 — Brand Pure (`purpose: "Brand"`, `voice_pool: "brand"`)

**Pflicht-Inhalt:** ausschließlich reine **Marken-Token**, kein Produkt-Token.

| ✅ Erlaubt | ❌ Verboten |
|---|---|
| `esn` (EXACT) | `esn flexpresso` (gehört in Brand+Produkt) |
| `esn supplements` (EXACT) | `esn whey laktose` (gehört in Brand+Produkt) |
| `esn shop` (PHRASE) | `whey protein` (gehört in Generic) |

**Match-Type-Mix:** EXACT-dominant (70–90 %), Rest PHRASE.

**Pflicht-Negatives in Brand-Pure-Ad-Groups (`ad_group_negatives`):**
- Alle prominenten Produkt-Token aus den Brand+Produkt-Ad-Groups (z. B.
  „flexpresso", „one whey", „whey laktase") — sonst überlappt sich Brand Pure
  mit Brand+Produkt und schaltet generische Homepage-Anzeigen auf
  produktspezifische Suchen.
- Generic-Kern-Token (z. B. „protein kaffee", „cold brew", „whey coffee").
- Research-Tails („test", „erfahrungen", „vergleich").

**Keyword-Anzahl:** 3–7 (bewusst klein, hohe CR, niedriger CPC).

### Schicht 2 — Brand + Produkt (`purpose: "Brand"`, `voice_pool: "product"`)

**Pflicht-Inhalt:** Keywords mit **Brand-Token PLUS Produkt-Token**.
Mindestens ein Brand-Token (z. B. „evo", „esn") UND mindestens ein
Produkt-Token (z. B. „one whey", „flexpresso") müssen vorkommen.

| ✅ Erlaubt | ❌ Verboten |
|---|---|
| `evo one whey` (EXACT) | `evo sports fuel` (nur Brand → Brand Pure) |
| `esn flexpresso` (EXACT) | `evo` (nur Brand → Brand Pure) |
| `evo whey laktose` (PHRASE) | `whey laktase` (nur Produkt → Generic) |
| `evo one whey kaufen` (EXACT) | `protein kaffee` (nur Kategorie → Generic) |

**Match-Type-Mix:** EXACT-dominant (60–80 %), Rest PHRASE. Decision-Stage.

**Pflicht-Negatives in Brand+Produkt-Ad-Groups (`ad_group_negatives`):**
- Alle reinen Brand-Token allein (z. B. „evo", „evo sports fuel", „esn",
  „esn shop"). Diese Suchen gehören in die Brand-Pure-Schicht.
- Wettbewerber-Namen (NO-COMPETITOR-POLICY, Kapitel 3).
- Research-Tails („test", „erfahrungen", „vergleich").

**`cluster_rationale`-Pflichtsatz:**
> „Brand+Produkt-Schicht: nur Brand-Token + Produkt-Token-Kombis, reine
> Brand-Token sind als Negatives gesetzt (gehören in Brand Pure)."

### Schicht 3 — Generic / Non-Brand (`purpose: "Generic"`, `voice_pool: "product"`)

**Pflicht-Inhalt:** Kategorie- und Lösungs-Suchen **ohne Markennamen**,
sortiert nach **Use-Case** (Achse c, siehe Strategy-Skill Kapitel 3).

| ✅ Erlaubt | ❌ Verboten |
|---|---|
| `whey protein mit laktase` (PHRASE) | `evo whey laktase` (gehört in Brand+Produkt) |
| `laktosefreies proteinpulver` (PHRASE) | `evo` (gehört in Brand Pure) |
| `protein kaffee kaufen` (PHRASE) | `myprotein protein kaffee` (Wettbewerber → Negativ) |

**Match-Type-Mix:** PHRASE-dominant (60–80 %), EXACT für Money-Modifier.
Bei `account_phase: "mature"` mit tROAS auch 10–20 % BROAD zulässig.

**Pflicht-Negatives in Generic-Ad-Groups (`ad_group_negatives`):**
- Eigener Markenname und Marken-Varianten (z. B. „esn", „evo", „esn supplements").
- ALLE Brand+Produkt-Kombis aus deinen eigenen Brand+Produkt-Ad-Groups
  (z. B. „flexpresso", „one whey") — sonst überlappt Generic mit Brand+Produkt.
- ALLE Wettbewerbernamen aus `landing_page_analysis.competitors`.

### `existing_layers`-Verhalten

Wenn der Strategy-Output bestimmte Schichten skipped (weil
`account_briefing.existing_layers` sie als bereits laufend markiert), dann
findest du in `campaigns` einfach weniger Schichten — die Cross-Negative-Regeln
für die existierende Schicht gelten trotzdem analog. Beispiel:
`existing_layers: ["brand_pure"]` → du baust Keywords für Brand+Produkt und
Generic, die Brand-Pure-Negatives gelten aber weiterhin als wären sie sichtbar,
weil der Kunde Brand Pure ja real betreibt.

### Brand-Coverage-Hinweis (in Prosa-Sektion 5, weiterhin)

Wenn `existing_layers` `"brand_pure"` enthält: Sammle aus
`search_intent.queries_by_stage.decision` Queries die den Markennamen
enthalten aber NICHT zu deinen Brand+Produkt-Ad-Groups passen (z. B.
„evo sports fuel rabattcode", „evo shop") — die sollten in der bestehenden
Brand-Pure-Kampagne abgedeckt sein. Liste sie als Coverage-Check-Hinweis,
ohne sie selbst zu bauen.

---

## Kapitel 9 — Anti-Patterns

Was du **bewusst NICHT** machst:

- **SKAGs (Single-Keyword-Ad-Groups)**: zu granular, blockiert Smart Bidding.
- **Alle Match-Types pro Keyword anlegen** (gleiches Keyword als EXACT + PHRASE
  + BROAD): zersplittert Daten statt zu konsolidieren.
- **Mehr als 20 Keywords pro Ad-Group**: zu unfokussiert. Hard-Range 3–20, Soft
  5–15, jede Abweichung im `cluster_rationale` begründen.
- **Wettbewerber-Brand-Names als positive Keywords irgendwo**: Conquesting ist
  per NO-COMPETITOR-POLICY deaktiviert. Wettbewerbernamen NUR als Negatives
  (siehe Kapitel 2 und 3).
- **Mischen von Sprach-Markt-Varianten in einem Keyword**: z. B.
  „high protein coffee" als Keyword im DE-Markt — entweder voll DE
  („hochwertiger Protein-Kaffee") oder, wenn der Begriff fest in Anglizismus
  („high protein coffee" steht so auch auf deutschen LPs), als Ausnahme
  zulässig. Im Zweifel: deutsch.
- **Keyword-Decoration in `keyword`-Feld**: schreib NIE `[esn]` oder `"esn"` als
  Wert in `keyword` — das Feld trägt nur den reinen Keyword-Text. Der Match-Type
  steht im separaten Feld `match_type`.
- **Tippfehler / Marken-Verstümmelungen** als „Long-Tail-Hack": z. B.
  „flexpreso" (mit einem s) — Google Ads korrigiert das nicht, das sind
  echte verlorene Keywords.

> TODO: Wenn dir noch konkrete Anti-Patterns einfallen die du in Audits
> immer wieder findest, hier ergänzen.

---

## Kapitel 10 — Output-Summary & Audit-Trail (zusätzlich zum JSON-Output)

Das harte JSON-Output liefert der Code (`KEYWORDS_OUTPUT_SCHEMA`). Zusätzlich
schreibst du am Ende deiner Prosa-Antwort eine **Summary-Sektion** für den
Team Lead, damit er den Lauf in einem Blick scannen kann. Format:

```
## Summary für Team Lead

Kunde: <customer aus landing_page_analysis>
Produkt: <product aus landing_page_analysis>

Schichten gebaut: <n von 3>  (übersprungen wegen existing_layers: <liste>)
Kampagnen bearbeitet: <n>
Anzeigengruppen befüllt: <n>

Keywords pro Anzeigengruppe:
- <Ad-Group-Name>: <n> Keywords (<n> EXACT, <n> PHRASE, <n> BROAD) — davon <n> mit use_in_copy: true
- <Ad-Group-Name>: …

Negative Keywords gesamt: <n>
- L1 (Strategy Starter): <n>
- L2 (Search-Intent Signals): <n>
- L3 (Score 1–4 ausgeschlossen): <n>
- L4 (LP-Gap-Analyse): <n>
- L5 (Awareness): <n>

LP-Gap-Kategorien angewendet: <Liste der genutzten Kategorien>
LP-Gap-Kategorien übersprungen: <Liste mit kurzer Begründung — z. B. „Geo-Mismatch: irrelevant, da geography DE/AT/CH komplett">

QS-Risiken:
- <n> Keywords mit Score 5–7 (im cluster_rationale als „Risiko-Note" markiert)
- <n> Queries ausgeschlossen (Score 1–4 → Negative L3)

Handlungsempfehlung: <1–2 Sätze, was als nächstes passieren sollte>
```

Diese Summary ist die letzte Sektion deiner Antwort, **vor** dem
```json-Codeblock mit dem `keywords`-Output. Sie ersetzt keinen Output —
sie ist Audit-Trail.

### Broad-Match-Hinweis (conditional)

Wenn dein Output BROAD-Keywords enthält, hänge VOR dem JSON-Block einen
dieser zwei Sätze an, je nach `strategy.bid_strategy`:

**Wenn Smart Bidding (tROAS/tCPA) UND `account_phase: "mature"` bestätigt:**
> **Broad Match Hinweis:** Smart Bidding (tROAS) mit ausreichend Conversion-
> Volumen ist aktiv — Broad Match ist unter diesen Bedingungen vertretbar.
> Trotzdem: tägliche Search-Term-Überprüfung empfohlen, besonders in den
> ersten 14 Tagen. Neue Negatives wöchentlich nachziehen.

**Wenn Smart Bidding NICHT bestätigt oder Phase ≠ mature:**
> **Broad Match nicht eingesetzt:** Smart Bidding ist nicht aktiv oder
> `account_phase` ist `new`/`ramping` — Broad-Kandidaten wurden auf PHRASE
> umgestuft. Re-Evaluierung sobald 30+ Conversions/30 Tage stabil erreicht.

Wenn dein Output gar keine BROAD-Keywords enthält → Hinweis weglassen.

### Übersprungene LP-Gap-Kategorien explizit dokumentieren

Wenn du in Kapitel 2.2 eine LP-Gap-Kategorie weggelassen hast (z. B. weil
`product_price_anchor` mid-market ist und Premium-Discount-Negs unnötig
wären), erwähnst du das **in der Summary**. Das schützt vor späteren Fragen
„warum kein ‚kostenlos' in den Negs?".

---

## Anhang — Output-Beispiel-Snippets (siehe Schema im Code für den vollen Output)

**Beispiel für sauberes Cross-Negative-Setup:**

```jsonc
{
  "name": "Brand Search – ESN",
  "ad_groups": [
    {
      "name": "Brand Pure",
      "keywords": [
        {"keyword": "esn", "match_type": "EXACT"},
        {"keyword": "esn flexpresso", "match_type": "EXACT"}
      ],
      "ad_group_negatives": [
        "protein kaffee", "cold brew", "whey coffee",
        "myprotein", "foodspring", "more nutrition",
        "test", "erfahrungen", "vergleich"
      ]
    }
  ]
}
```

**Beispiel — Wettbewerber als Negatives in einer Generic-Ad-Group:**

```jsonc
{
  "name": "Protein Coffee",
  "cluster_rationale": "Generic Consideration-Cluster für Protein-Kaffee-Suchen. Wettbewerber-Brands (MyProtein, Foodspring) als Ad-Group-Negs – wir kaufen kein Conquesting-Traffic (NO-COMPETITOR-POLICY).",
  "keywords": [
    {"keyword": "protein kaffee", "match_type": "PHRASE", "use_in_copy": true},
    {"keyword": "protein kaffee kaufen", "match_type": "PHRASE", "use_in_copy": true},
    {"keyword": "flexpresso", "match_type": "EXACT", "use_in_copy": true}
  ],
  "ad_group_negatives": ["esn",  "myprotein", "foodspring", "more nutrition", "test", "erfahrungen", "rezept"]
}
```

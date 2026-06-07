# Strategy Skill — SEA E-Commerce Playbook

Domain knowledge that the `strategy_agent` always consults before formulating
recommendations. Edit this file freely — the loader picks up changes on each
backend restart. The output schema (field shape, prose structure, END-CHECK)
lives in `STRATEGY_OUTPUT_SCHEMA` in code and stays there; this playbook is
purely about *how* the strategy is reasoned out.

---

## Kapitel 1 — Universelle Grundstruktur: Marke → Produkt → Lösung

Wir bauen **immer drei Kampagnen**, kein mehr und kein weniger. Diese drei
Schichten bilden den Conversion-Funnel sauber ab — vom heißesten Brand-Lead
bis zum kalten Problem-Sucher — und sind die DNA unseres Setups.

| # | Kampagne | User-Intent | Final-URL | voice_pool | Match-Type-Default | Bid-Strategie-Default |
|---|---|---|---|---|---|---|
| 1 | **Brand Pure** (Marke) | Nutzer kennt die Marke und sucht sie direkt (z. B. „esn", „evo sports fuel") | **Homepage / Shop** | `brand` | EXACT-dominant | "Klicks maximieren" (Defense) |
| 2 | **Brand + Produkt** | Nutzer kennt Marke UND hat sich für ein konkretes Produkt entschieden (z. B. „esn flexpresso", „evo one whey") | **Produkt-LP** | `product` | EXACT-dominant | aggressivere Smart-Bidding-Stufe (tROAS, höheres Target als Generic) |
| 3 | **Generic / Non-Brand** (Lösung) | Nutzer hat ein Problem/Bedürfnis, kennt die Marke aber nicht (z. B. „proteinpulver laktosefrei", „melatonin fruchtgummis") | **Produkt-LP** | `product` | PHRASE-dominant | Smart Bidding (tROAS / tCPA), Phase-abhängig |

### Warum genau diese drei (und nicht mehr)

Ältere Frameworks haben oft 4–5 Säulen (Brand-Defense + Generic + Hero +
Competitor + Promo). Wir haben Hero in Brand+Produkt aufgelöst (Bestseller
sind dort eigene Ad-Groups, nicht eigene Kampagnen — Smart Bidding braucht
Datenkonsolidierung) und Competitor komplett gestrichen (siehe Kapitel 5
NO-COMPETITOR-POLICY). Das ist die Essenz nach radikalem Refactoring.

### Saubere Trennung der Schichten (Pflicht)

Jede Schicht braucht **eigene Kampagnen-/Ad-Group-Negatives**, sonst
kannibalisieren sich die hohen Brand-CRs und der ROAS der Generic-Kampagne
sieht „künstlich gut" aus, während du dort in Wahrheit Neukunden unprofitabel
einkaufst.

- **Brand Pure**: Produkt-Token (z. B. „flexpresso", „one whey") und
  Generic-Kern-Token als `ad_group_negatives`.
- **Brand + Produkt**: Brand-Pure-Token allein („esn" pur, „evo" pur) als
  `ad_group_negatives` — die gehören in Brand Pure, nicht hier.
- **Generic**: Brand-Token UND alle Brand+Produkt-Kombis als
  `ad_group_negatives`.
- **Alle Kampagnen**: Wettbewerbernamen aus `landing_page_analysis.competitors`
  als `recommended_negative_keywords` (NO-COMPETITOR-POLICY, Kapitel 5).

### Budget-Verteilungs-Heuristik (Greenfield, alle drei werden gebaut)

- **Brand Pure: 10–15 %** (hohe CR, niedriger CPC — wenig Budget reicht)
- **Brand + Produkt: 15–25 %** (CR-stark, aber Volumen begrenzt)
- **Generic / Non-Brand: 60–75 %** (Hauptwachstumshebel)

---

## Kapitel 1b — `existing_layers`-Logik: welche Schicht wird übersprungen?

`account_briefing.existing_layers` ist eine Liste mit Werten aus
`["brand_pure", "brand_product", "generic"]` und sagt dem Strategy-Agent
welche Schichten der Kunde **schon selbst betreibt** und die du daher NICHT
neu bauen sollst. Die leere Liste `[]` ist Greenfield — du baust alle drei.

**Skip-Regeln pro Layer:**

| Wert in `existing_layers` | Du baust diese Kampagne | Du baust sie NICHT | Du schreibst einen Advisory-Satz an den Nutzer (Pflicht) |
|---|---|---|---|
| `"brand_pure"` | Brand+Produkt, Generic | Brand Pure | „Hinweis zur bestehenden Brand-Pure-Kampagne: Bitte ergänze dort die Produkt-Token (z. B. ‚<token>') als Negatives, damit Brand+Produkt-Traffic in der neuen Kampagne landet." |
| `"brand_product"` | Brand Pure, Generic | Brand+Produkt | „Hinweis zur bestehenden Brand+Produkt-Kampagne: Bitte überprüfe dass deine bestehende Brand-Pure-Kampagne die Produkt-Token sauber als Negatives gesetzt hat, sonst überlappen sich beide Schichten." |
| `"generic"` | Brand Pure, Brand+Produkt | Generic | „Hinweis zur bestehenden Generic-Kampagne: Bitte stelle sicher, dass dort die eigenen Markennamen UND die Wettbewerber-Brands als Ad-Group-Negatives stehen, sonst überlappt Generic mit Brand-Pure und kauft Konkurrenz-Brand-Traffic." |

**Budget-Verteilung bei Skipping:** das frei gewordene Budget der übersprungenen
Schicht wird auf die verbleibenden anteilig hochskaliert, **mit Tilt
Richtung Generic** (Generic ist immer der größte Wachstumshebel). Beispiele:

- `existing_layers: ["brand_pure"]` → Brand+Produkt ~15–20 %, Generic ~80–85 %.
- `existing_layers: ["brand_pure", "brand_product"]` → Generic = 100 %.
- `existing_layers: ["generic"]` → Brand Pure ~30 %, Brand+Produkt ~70 % (alle frei werdenden Generic-Anteile in Brand+Produkt, da dort die nächstgrößere CR-Stärke).

**Edge-Case `existing_layers: ["brand_pure","brand_product","generic"]`:** der
Strategy-Agent erkennt, dass nichts mehr zu bauen ist, und schreibt im
`summary`: „Alle drei Schichten laufen laut Briefing bereits. Empfehlung: keine
neue Strategie, sondern Optimierung der bestehenden Kampagnen (Bid-Tuning,
Negative-Audit, RSA-Refresh)." `campaigns` bleibt leer.

---

## Kapitel 2 — Phase-1-Anpassungen (Konten ohne ausreichende Conversion-Daten)

> TODO: Hier kommt die Phase-1-Logik rein. Smart Bidding (tROAS, tCPA, Maximize
> Conversions) braucht ~30–50 Conversions / 30 Tage Mindestdatenbasis, sonst
> lernt der Algorithmus nicht. Definiere:
>
> - **Wann ist ein Konto in Phase 1?** (Vorschlag: < 20 Conversions / 30 Tage
>   ODER neu aufgesetztes Konto < 4 Wochen alt)
> - **Welche Bid-Strategien sind in Phase 1 erlaubt?** (Vorschlag: Brand Pure →
>   Klicks maximieren; Brand+Produkt → Klicks maximieren oder Conversions
>   maximieren; Generic → Conversions maximieren ohne Target)
> - **Wann migriert man zu Schicht-Standard-Bidding?** (Vorschlag: nach
>   30 Conversions / 30 Tage stabil → Schritt 1: tCPA mit Budget-CPA-Range
>   als Target; Schritt 2: tROAS nach weiteren 30 Conversions)
> - **Match-Type-Anpassung in Phase 1**: ohne tROAS ist BROAD gefährlich, weil
>   ohne lernfähiges Bidding die Anzeigen-Auslieferung auf alle möglichen
>   Suchen geht. Phase-1-Empfehlung: PHRASE-dominant in Generic, EXACT-dominant
>   in Brand Pure und Brand+Produkt. BROAD nur ab `mature` mit aktivem tROAS.

---

## Kapitel 3 — Ad-Group-Logik pro Schicht (Pflicht)

Auf Kampagnen-Ebene sind wir fest auf drei Schichten. Auf Ad-Group-Ebene
gelten klare Regeln pro Schicht, damit Smart Bidding stabile Datenpools
bekommt und der Excel-Export/Builder die Schicht aus dem Namen lesen kann.

### Naming-Konvention (hart, gilt für `name` im JSON)

Jede Kampagne und Ad-Group MUSS ein Schicht-Präfix tragen:

- Kampagne `Brand Pure – <Marke>` → Ad-Group(s) `Brand Pure – <Sub-Brand|Marke>`
- Kampagne `Brand+Produkt – <Produktname>` → Ad-Group `Brand+Produkt – <Produktname>`
- Kampagne `Generic – <Use-Case oder Kategorie>` → Ad-Group `Generic – <Use-Case oder Kategorie>`

Beispiele: `Brand Pure – ESN`, `Brand+Produkt – Flexpresso`,
`Generic – Whey mit Laktase`, `Generic – Cold Brew Protein Coffee`.

Kein Schicht-Präfix → der Excel-Export filtert nicht sauber und der
Kampagnen-Builder kann die Schicht nicht ableiten. Disqualifikation.

### Brand Pure — meist 1 Ad-Group

- **Single-Brand-Konto** (Standard): genau 1 Ad-Group, Name `Brand Pure – <Marke>`.
- **Multi-Brand-Konto** (Holding mit mehreren DTC-Brands): 1 Ad-Group pro
  Sub-Brand, jeweils mit eigenem Brand-Token. Selten.
- `keyword_seed_clusters`: nur reine Markennamen-Varianten (z. B.
  „ESN", „ESN Supplements", „ESN Shop"). KEINE Produkt-Token.

### Brand + Produkt — eine Ad-Group pro Produktlinie

- **Pro klar identifizierbarem Produkt eine eigene Ad-Group**, jeweils
  gemappt auf die zugehörige Produkt-LP.
- **Geschmacksrichtungen/Varianten gehören NICHT in eigene Ad-Groups** —
  sie sind Keywords im selben Cluster (z. B. „evo whey vanille",
  „evo whey schoko" als EXACT-Keywords in der Ad-Group „Brand+Produkt –
  EVO ONE Whey"). Smart Bidding würde sonst zersplittern, und RSA-Asset-
  Kombinationen decken den Geschmacks-Layer dynamisch ab.
- **Harte Obergrenze: maximal 3 Brand+Produkt-Ad-Groups pro Lauf.** Bei
  Brands mit vielen SKUs wählt der Strategy-Agent die 3 prominentesten
  aus der LP (Hero-Sektion, mehrfach erwähnte Produkte) und vermerkt im
  Output, dass die restlichen Produkte in späteren Iterationen ausgegliedert
  werden können. Mehr als 3 Ad-Groups zerstören den Smart-Bidding-Datenpool.
- **Same-URL-Scope-Pflicht**: alle Brand+Produkt-Ad-Groups eines Laufs
  MÜSSEN auf Produkt-LPs unter derselben Domain/dem im Briefing analysierten
  URL-Scope einzahlen. Wenn die analysierte LP nur ein Produkt zeigt, gibt es
  nur eine Brand+Produkt-Ad-Group — der Agent darf KEINE Produkte aus dem
  Rest-Sortiment „dazu erfinden", die nicht auf der konkreten LP stehen.

### Generic / Non-Brand — Use-Case primär, Kategorie nur als Fallback

Default-Achse: **Achse (c) Use-Case / Problem**. Eine Ad-Group pro Pain-Point
oder spitzer Lösung, jeweils auf dieselbe Produkt-LP gemappt. Beispiele für
EVO ONE Whey: „Generic – Whey mit Laktase", „Generic – Laktosefreies
Proteinpulver", „Generic – Muskelaufbau bei Laktoseintoleranz".

**Ableitungs-Pipeline für Use-Cases:**

1. **Primär**: `landing_page_analysis.product_pain_points` → jede Pain-Point-
   Formulierung wird zu einer Ad-Group, sofern semantisch unterscheidbar
   (nicht 5x dieselbe Sache anders gesagt).
2. **Sekundär**: `lp_keywords` → wenn Pain-Points nicht reichen, ergänze
   prominente LP-Keywords als Use-Case-Cluster.
3. **Fallback Achse (b) Kategorie**: wenn die LP keine spitzen Pain-Points
   liefert (z. B. ein „normaler" Proteinriegel ohne Problem-Lösungs-Pitch),
   bauen wir Ad-Groups nach Produkt-Kategorie. Im `cluster_rationale` der
   Ad-Group MUSS dann stehen: „Fallback auf Produktkategorie, da die
   Landingpage keine klaren Pain-Points liefert — als CRO-Hinweis: Pain-Points
   auf der LP schärfen würde diese Schicht spitzer machen."
4. Achse (a) Intent-Stage (awareness/consideration/decision) ist KEINE
   primäre Ad-Group-Achse — Intent setzen wir auf Keyword-Ebene innerhalb der
   Use-Case-Ad-Group.

**Ad-Group-Anzahl Generic:** 2–4 pro Lauf. Weniger als 2 → der Agent hat zu
wenig differenziert. Mehr als 4 → zu granular, Smart Bidding zersplittert.

---

## Kapitel 4 — Match-Type-Policy

> TODO: Wir haben aktuell eine offene Reibung mit dem `keyword_agent`. Dieses
> Kapitel klärt die finale Linie, damit Strategy und Keyword nicht widersprechen.
>
> Vorschlag: **Bid-Strategie diktiert Match-Type-Linie.**
>
> | Bid-Strategie | Empfohlene Match-Types |
> |---|---|
> | Klicks maximieren | PHRASE-dominant, EXACT für Money-/Brand-Terms |
> | Maximize Conversions (ohne Target) | PHRASE-dominant + EXACT |
> | tCPA / tROAS | BROAD-dominant + PHRASE für Long-Tail |
> | Manuelle CPC | EXACT only — voller Kontrollanspruch |
>
> Konsequenz: Sobald der Strategy-Agent eine tROAS-Bid-Strategie empfiehlt,
> *muss* der Keyword-Agent in dieser Kampagne BROAD-dominant aufstellen — und
> umgekehrt: bei "Klicks maximieren" gibt's PHRASE-Mehrheit. Damit ist die
> Inkonsistenz aufgelöst.

---

## Kapitel 5 — NO-COMPETITOR-POLICY (Default-Linie)

**Wir empfehlen grundsätzlich KEINE eigene Competitor-/Conquesting-Säule.**
Dedizierte „vs <Wettbewerber>"-Kampagnen sind in unserer Default-Strategie
deaktiviert.

**Begründung (warum wir die Säule rauslassen):**

1. **Hohe CPCs, schwacher Conversion-Pfad.** Wettbewerber-Brand-Suchen sind
   teuer (der Konkurrent bietet auf seinen eigenen Namen) und der User ist im
   Vergleichs-Modus, nicht im Kaufmodus. Klassisches Profitabilitäts-Problem.
2. **Markenrechtliche Risiken in der Copy.** Headlines, die den Wettbewerber
   nennen („Alternative zu X", „Statt X", „Besser als X"), bewegen sich am
   Rand der Google-Ads-Trademark-Policy und der Wettbewerbsrecht-Grauzone in
   DE. Disapprovals und Beschwerden sind realistisch.
3. **Defensive, schwache Headlines in der Praxis.** „Premium-Alternative aus
   DE", „Deutsche Sport-Nutrition statt UK-Import" usw. wirken in der
   Such-Ergebnisliste defensiv-vergleichend statt selbstbewusst. Die eigene
   Marken-Stärke kommuniziert besser.
4. **Skipped Search-Volume**: das Volumen ist meistens kleiner als gedacht,
   weil Wettbewerber-Brand-Suchen entweder a) generischer Such-Pull sind,
   den wir schon über Generic bedienen, oder b) wirklich Brand-Käufer
   bedeuten – die kaufen ohnehin beim Wettbewerber.

**Was wir stattdessen mit den Wettbewerbern machen:**

Wettbewerbernamen aus `landing_page_analysis.competitors` werden HART als
**Negative Keywords** in alle Nicht-Brand-Kampagnen gesetzt. Das verhindert,
dass Broad-/Phrase-Match-Keywords ungewollt auf Konkurrenz-Brand-Suchen
auslösen und unprofitabel Klicks einsammeln. Konkret:

- `recommended_negative_keywords` enthält alle Wettbewerbernamen aus der LP
- Generic-Kampagnen erweitern das Set ggf. um Wettbewerber-Produkt-Brands
- Brand-Kampagnen brauchen die Wettbewerber-Negs nicht (EXACT-Match-Brand
  isoliert ohnehin)

**Skipped-Eintrag (Pflicht, wenn LP Wettbewerber listet):**

```jsonc
{
  "type": "Competitor",
  "reason": "Per Default deaktiviert (NO-COMPETITOR-POLICY) – Wettbewerbernamen <Liste> laufen als Negatives in Generic, das gewonnene Budget liegt auf Brand+Generic."
}
```

**Ausnahme-Verfahren (nicht im Default):** wenn der Nutzer explizit eine
Competitor-Kampagne anfordert, weicht der Strategy-Agent von dieser
Default-Policy ab und dokumentiert das im `summary` als bewusste Abweichung
vom Standard. Der Default bleibt aber: keine Competitor-Säule.

---

## Kapitel 6 — Anti-Patterns (was wir bewusst NICHT empfehlen)

> TODO: Liste konkreter Patterns, vor denen der Agent warnt / die er aktiv
> ausschließt. Mögliche Einträge:
>
> - **SKAGs** (Single-Keyword-Ad-Groups): zu granular, blockiert Smart Bidding
> - **All-Match-Types-pro-Keyword**: legt jedes Keyword in 3 Match-Type-Versionen
>   an → Daten zersplittern statt konsolidieren
> - **Performance Max ab Tag 1**: PMax braucht Conversion-Volumen ähnlich tROAS
>   → erst nach ~30 Conv./30 Tage Suchkampagne empfehlen
> - **Display & Search in einer Kampagne**: zerstört die Auswertbarkeit
> - **Standortzielgruppe „Interesse"** statt „Anwesenheit": liefert irrelevanten
>   Traffic aus dem Ausland
> - **Tagesbudget < 5 €/Kampagne**: Algorithmus bekommt nicht genug Auslieferung
>   um zu lernen → unter dieser Schwelle Kampagnen zusammenlegen

---

## Kapitel 7 — Branchen-Playbooks

> TODO: Pro Vertical eine kurze Sektion mit Defaults und Erwartungswerten,
> damit der Agent industry-aware empfiehlt. Mögliche Verticals:
>
> - **DTC Mode / Bekleidung**: hohe Brand-Affinität, starke Saisonalität,
>   Shopping-Pflicht, Default-Split 25/55/20
> - **Beauty & Kosmetik**: hohe Wiederkaufrate, Influencer-Effekt, Generic-stark
> - **Sport-Nutrition / Supplements**: research-heavy (test/erfahrungen),
>   Compliance-Risiko bei Gesundheitsversprechen, Default 15/65/20
> - **B2B-SaaS / Lead-Gen**: längere Cycles, Lead statt Sale als Conversion,
>   Cold-Audience-Targeting via Lookalike-/Custom-Intent
> - **Local Services / Service-E-Com**: Geo-Targeting kritisch, Call-Extensions
>   Pflicht, andere Bid-Logik (tCPA statt tROAS)

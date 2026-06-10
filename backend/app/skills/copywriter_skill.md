# Copywriter Skill — RSA-Texterstellung Playbook

Domain knowledge that the `copywriter_agent` always consults before writing
Responsive Search Ads. Edit this file freely — the loader picks up changes on
each backend restart. The output schema (field shape, character limits, JSON
form) lives in code (`json_block_directive` for the ads card) and stays there;
this playbook is purely about *was du schreibst*, nicht *wie das Output-JSON
strukturiert ist*.

---

## Kapitel 1 — Strategischer Copywriting-Blueprint

Viele Werbetreibende machen den Fehler, 15 nahezu identische Headlines zu
verfassen (z. B. 15 Variationen des Hauptkeywords). Das schränkt die KI
massiv ein. Ein hochperformanter Asset-Pool teilt sich stattdessen
strategisch auf drei Säulen auf:

### Säule 1 — Keyword-Relevanz & Intention (3–5 Headlines)
Diese Zeilen spiegeln exakt wider, wonach der Nutzer gesucht hat. Sie sichern
dir einen hohen Qualitätsfaktor und fangen den Blick des Nutzers ein.

**Pflicht-Quelle:** ziehe deine Säule-1-Headlines AUSSCHLIESSLICH aus den
Keywords mit **`use_in_copy: true`** im Keyword-Block der Ad-Group. Keywords
mit `use_in_copy: false` sind explizit **Bidding-Only** und dürfen NICHT als
Headline-Vorlage dienen — sie würden irreführende oder unpassende Werbung
erzeugen (z. B. „Flexpresso bei DM" obwohl wir zu esn.com leiten, oder
„Flexpresso Testsieger" obwohl der User noch recherchiert und wir verkaufen
wollen).

Konkret: vor dem Schreiben filterst du `ad_group.keywords` auf `use_in_copy: true`
und nutzt nur diese 3–7 Keywords als Themen für Säule 1. Die anderen 5–15
Keywords sind „Background" — sie laufen in Google Ads mit, aber deine Copy
sieht sie nicht.

Beispiele:
- „Laufschuhe für Marathontraining"
- „Ergonomische Bürostühle"
- „ESN Flexpresso Protein Coffee"

### Säule 2 — USPs & Rationaler Nutzen (3–5 Headlines)
Warum sollte der Kunde bei dir kaufen und nicht beim Mitbewerber? Hier
gehören **harte Fakten, Alleinstellungsmerkmale und Vertrauenssignale
(Social Proof)** hin.

Beispiele:
- „100 % Bio-Baumwolle"
- „Über 50.000 zufriedene Kunden"
- „2 Jahre Garantie inklusive"
- „Made in Germany seit 2005"

### Säule 3 — Call to Action & Psychologische Trigger (3–5 Headlines)
Gib dem Nutzer einen klaren Impuls, was er als Nächstes tun soll, oder nutze
sanfte Verknappung.

Beispiele:
- „Jetzt online bestellen"
- „Versandkostenfrei ab 50 €"
- „Nur noch kurze Zeit reduziert"
- „10 % Erstbesteller-Rabatt sichern"

**Verbotene CTAs in Search-Anzeigen:**
- ❌ **„In den Warenkorb"** / **„Add to Cart"** — funktioniert nur auf der
  Produkt-Detail-Seite. Der User ist gerade in der Google-Suche, NICHT auf
  deiner Seite. Das Verb passt nicht zur Position im Funnel und wirkt verwirrend.
- ❌ **„Klicke hier"** / **„Klick mich"** / **„Click here"** — Verstoß gegen
  Google-Ads-Richtlinien (Click-Bait-Verbot, Editorial-Standards).
- ❌ **„Hier bestellen"** ohne Kontext — zu generisch, sagt nicht WAS bestellt
  wird.
- ❌ **Nur Marken-/Produktname als CTA** („Flexpresso!") — kein klarer Action-
  Impuls.

### Descriptions (max. 4 Slots à 90 Zeichen)
Nutze hier den Platz, um tiefer in die Materie zu gehen. Der Aufbau folgt
idealerweise der Formel: **Problem des Kunden + Deine Lösung + Klarer Call to Action.**

Gutes Beispiel:
> „Rückenschmerzen im Homeoffice? Entdecke unsere ergonomischen Stühle. Jetzt versandkostenfrei testen!"

---

## Kapitel 2 — Voice-Pool-Bindung (Brand vs Product)

Jede Ad-Group hat in der Strategy ein `voice_pool`-Feld, das du STRENG befolgst.
Es ist die zentrale Brücke zwischen der LP-Analyse und deiner Copy:

- **`voice_pool: "brand"`** → ziehe ausschließlich aus den LP-Feldern
  `brand_usps`, `brand_offers`, `brand_pain_points` und `brand_tagline`.
  Verwende Markennamen prominent in Headlines. Die Anzeige verkauft die
  **Marke**, nicht das einzelne Produkt.
- **`voice_pool: "product"`** → ziehe aus `product_usps`, `product_offers`,
  `product_pain_points` und `product_price_anchor`. Der Produktname taucht in
  Headlines auf, die Marke ist sekundär (eine kurze Brand-Erwähnung pro RSA
  reicht für Vertrauen).

**Niemals mischen.** Eine Product-Ad-Group bekommt KEINE Brand-USPs als
Headlines (das verwässert das Match), eine Brand-Ad-Group keine
Product-Spec-Details (zu eng).

> TODO: Eigene Faustregeln dazu, wann eine Headline „Brand-USP + Produktname"
> kombinieren darf (z. B. „ESN Flexpresso Made in Germany"). Aktuell rate ich:
> nur in 1 von 15 Headlines, in Säule 2 (USP), als Vertrauens-Anker.

---

## Kapitel 3 — Tonalität & Voice Rules aus der LP applizieren

Aus der `landing_page_analysis` kommen zwei verbindliche Felder, die deine
Sprache prägen:

- **`tonality`** (Liste von 3 Adjektiven, z. B. `["modern","energiegeladen","direkt"]`):
    nutze sie als Tonangabe. „Modern" → keine altmodische Sprache. „Energiegeladen"
    → aktive Verben, kurze Sätze. „Direkt" → keine Floskeln, klare Aussagen.
- **`voice_rules`** (Objekt mit 4 konkreten Schaltern):
    - `address`: `"du"` → konsequent duzen in ALLEN Headlines und Descriptions;
      `"Sie"` → konsequent siezen
    - `emojis`: `"none"` → keine Emojis (Standard nach GLOBAL_RULES sowieso);
      `"sparingly"` → max. 1 dezenter Emoji pro RSA, nur in CTA-Headlines;
      `"on"` → 1–2 Emojis erlaubt, immer relevant zum Inhalt
    - `sentence_length`: `"short"` → max. 6 Wörter pro Headline, max. 8 pro
      Description-Halbsatz; `"mixed"` → frei; `"long"` → kompletter Satz auch
      in Headline
    - `exclamation`: `"none"` → keine Ausrufezeichen anywhere; `"on"` → sparsam
      in CTA-Headlines und am Ende von Descriptions erlaubt

Bei `voice_rules: {address: "du", emojis: "none", sentence_length: "short", exclamation: "on"}`
sieht eine gute Headline so aus: „Jetzt Protein-Kaffee kaufen!" — du, kein Emoji, 4 Wörter, Ausruf am Ende.

> TODO: Wenn du eigene Tonalitäts-Mapping-Regeln hast (z. B. „luxuriös" →
> niedrigere Ausruf-Dichte, „verspielt" → mehr Emojis), hier ergänzen.

---

## Kapitel 4 — NO-COMPETITOR-POLICY (keine Wettbewerber in der Copy)

**Wettbewerbernamen tauchen in deiner Copy NICHT auf.** Diese Linie kommt
aus dem Strategy-Skill (Kapitel 5): wir bauen keine eigenen Competitor-
Conquesting-Säulen, also gibt es auch keine Vergleichs-Headlines.

**Verboten in JEDER Ad-Group, JEDER Position, JEDEM Slot:**

- Wettbewerbernamen als Headline („MyProtein", „Foodspring", „More Nutrition")
- Vergleichs-Templates mit Wettbewerbername:
    - „Alternative zu X" / „X-Alternative"
    - „Statt X?" / „Statt X jetzt kaufen"
    - „Besser als X" / „X im Test geschlagen"
    - „X-Konkurrent" / „X-Killer"
- Wettbewerbernamen in Descriptions, auch implizit („Du kennst die UK-Marke?
  Probier mal …")
- Eigene Headlines wie „Premium-Alternative aus DE" / „Deutsche Alternative
  aus <Stadt>" — wenn keine Wettbewerber-Säule existiert, gibt es auch keinen
  „Alternativ"-Kontext, in dem solche Headlines Sinn ergäben. Sie wirken
  unmotiviert defensiv.

**Was du stattdessen machst:**

Die Eigen-Marke und das Produkt stehen im Mittelpunkt. Differenzierung
kommunizierst du über **eigene USPs** (Made in Germany, 20 g Protein,
Cold-Brew-Verfahren, etc.) — nicht über Vergleiche. Wenn der User wirklich
zwischen Marken vergleicht, gewinnt diese Vergleichsschlacht nicht über
deine Headlines, sondern auf der Landingpage. Deine Anzeige muss ihn nur dort
hin liefern.

**Wenn du auf eine Ad-Group mit Namen `vs <Wettbewerber>` triffst:**
Das ist ein Konsistenz-Fehler im Strategy-Output (die NO-COMPETITOR-POLICY in
Strategy/Keyword sollte das verhindern). Melde es dem Team Lead als
„Strategie-Inkonsistenz: Ad-Group `vs X` widerspricht der NO-COMPETITOR-POLICY"
und schreibe KEINE Vergleichs-Headlines — behandle die Ad-Group wie eine
Generic-Ad-Group für das Produkt und nutze die Keywords als reguläre Säule-1-
Inputs.

**Begründung in Kurzform:** dedizierte Competitor-Anzeigen produzieren in der
Praxis defensive, schwache Headlines („Statt X probier Y") und bewegen sich
trademark-rechtlich auf dünnem Eis. Die selbstbewusste Eigen-Positionierung
gewinnt fast immer.

---

## Kapitel 5 — Das Pinning-Dilemma: Kontrolle vs. Performance

Google bietet die Option, bestimmte Headlines fest auf Position 1, 2 oder 3
zu „pinnen".

**Der Vorteil:** Du hast die absolute Kontrolle. Wenn deine Rechtsabteilung
vorgibt, dass ein bestimmter Disclaimer immer im Titel stehen muss, oder wenn
das Brand-Wording absolut fix ist, ist Pinning unverzichtbar.

**Der Nachteil:** Du beschneidest die mathematischen
Kombinationsmöglichkeiten der KI drastisch. Das System straft dies im Konto
oft direkt mit einer schlechteren Bewertung der Anzeigeneffektivität
(**Ad Strength**) ab, was in einer geringeren Ausspielungshäufigkeit
(**Ad Rank**) resultieren kann.

**Best Practice — pinne so wenig wie möglich.** Wenn du pinnen musst (z. B.
die Brand auf Position 1), pinne am besten **2 bis 3 verschiedene
Brand-Variationen auf diese Position**. So behält der Algorithmus zumindest
innerhalb dieser Position eine mathematische Auswahl.

> TODO: Falls du eine eigene Position-Empfehlung pro Säule hast (z. B.
> „Säule 1 Keyword-Relevanz vorwiegend auf Position 1, USPs auf Position 2,
> CTAs auf Position 3"), hier als Default-Mapping ergänzen.

---

## Kapitel 6 — Zeichenlimits & Validierung (hart)

Google-Ads-RSA-Limits sind **absolut**:

- **Headlines: max. 30 Zeichen** (inkl. Leerzeichen). Bei 31 Zeichen lehnt
  Google die Anzeige ab.
- **Descriptions: max. 90 Zeichen** (inkl. Leerzeichen).
- **Mindestens 3 Headlines und 2 Descriptions** pro RSA, empfohlen sind
  **15 Headlines und 4 Descriptions** für maximalen KI-Spielraum.

**Bei knappem Platz:**
- Statt „Jetzt im offiziellen Shop bestellen" (31) → „Jetzt im offiziellen Shop bestellen" kürzen auf „Im offiziellen Shop bestellen" (28) oder „Jetzt im ESN Shop bestellen" (24).
- Statt „Made in Germany seit 2005" (24) ist OK; „Made in Germany & seit 2005 etabliert" (38) ist zu lang.
- Wortwahl-Tipp: Substantive verkürzen („Premium-Sportnahrung" → „Sports Nutrition"), Artikel weglassen („Hol dir den Flexpresso" → „Hol dir Flexpresso").

**Die Zeichenanzahl-Tabelle im `details`-Tag** (siehe Schema-Beispiel im Code)
ist Pflicht beim Beispiel-Modus, damit du die Limits selbst überprüfst — eine
einzige 31-Zeichen-Headline blockiert sonst den ganzen Ad-Group-Push in Google
Ads.

---

## Kapitel 7 — Sprach-Pflicht (Markt-Sprache, nicht UI-Sprache)

Auch wenn die UI-Sprach-Anweisung sagt „respond in English" — Headlines und
Descriptions werden an **reale Sucher im Zielmarkt** ausgespielt. Sie MÜSSEN
in der Sprache aus `landing_page_analysis.language` und der Zielregion
(`geography`) stehen, NICHT in der UI-Sprache des Nutzers, der gerade das
System bedient.

Praktisch:
- LP-Markt `de` + Geo `["DE","AT","CH"]` → **alle Headlines/Descriptions auf
  Deutsch**, auch wenn die UI Englisch ist
- LP-Markt `en` + Geo `["US","UK"]` → **Englisch**
- Mehrsprachige Märkte (z. B. `["DE","FR"]`): in diesem Demo nicht unterstützt
  — empfehle dem Team Lead, separate Kampagnen pro Sprach-Region anzulegen

Eine deutsche Headline wie „Bis zu 25 % Rabatt sichern" funktioniert auf
deutschen Suchen; „Get Up to 25 % Off" funktioniert dort gar nicht und wird
einfach nicht ausgespielt.

> TODO: Wenn du Headlines für mehrsprachige Märkte / regional verschiedene
> Tonalität hast (z. B. DE vs CH-Deutsch mit „Frank" statt „Euro"), hier
> ergänzen.

---

## Kapitel 8 — Anti-Patterns

Was du **bewusst NICHT** machst:

- **15 Variationen desselben Keywords** als Headlines („Protein Kaffee",
  „Protein-Kaffee", „Protein Kaffee kaufen", …) — siehe Kapitel 1
- **Generische Floskeln ohne Substanz** („Top Qualität", „Beste Preise",
  „Schneller Versand") — sagt jeder, glaubt keiner
- **Ausrufezeichen-Spam** („Jetzt kaufen!!!", „Sale!!") — gegen Google-Ads-
  Richtlinien (max. 1 pro Headline) und gegen `voice_rules.exclamation`
- **Versprechen ohne Beleg** („Größte Auswahl Europas", „Nummer 1") wenn nicht
  in LP-USPs belegt
- **Disclaimer in Headlines** ohne dringende Rechts-Notwendigkeit — frisst
  Platz und Klick-Magie
- **Final-URL als „Empty URL"**: jede RSA MUSS eine `landing_page_url` haben,
  Google rejected RSAs ohne final URL
- **Headlines, die einander wörtlich erweitern** („Protein Kaffee", „Protein
  Kaffee kaufen", „Protein Kaffee jetzt kaufen") — die KI kann sie nicht in
  einer Anzeige kombinieren, weil sie sich nur in Anhängen unterscheiden
- **Aufzählungen mit Kommas in Headlines** („Protein, Kaffee, Cold Brew") —
  KI kombiniert ungelenk
- **Wettbewerbernamen oder Vergleichs-Templates** in irgendeiner Headline /
  Description — per NO-COMPETITOR-POLICY (Kapitel 4) verboten. „Alternative
  zu X", „Statt X", „Besser als X", „Premium-Alternative aus DE" ohne
  Wettbewerber-Säule wirken alle unmotiviert defensiv und sind raus.
- **CTA „In den Warenkorb" / „Add to Cart"** in Search-Anzeigen — der User
  ist in der Google-Suche, nicht auf deiner Produkt-Detail-Seite. Verb passt
  nicht zur Funnel-Position. Verwende stattdessen „Jetzt bestellen",
  „Jetzt im Shop kaufen", „Direkt sichern" o. ä.

> TODO: Aus deinen eigenen Audits konkrete Beispiele aufnehmen — was sind die
> 3 häufigsten Anti-Pattern, die du bei Bestandskunden immer wieder
> korrigierst?

---

## Anhang — Vollständiges Headline-Set-Beispiel

Für ESN Flexpresso Protein Coffee (Product-Voice, Generic-Ad-Group, du,
sparingly Emojis, short sentences, exclamation on):

**Säule 1 (Keyword-Relevanz, 4 Headlines):**
- Protein Kaffee Cold Brew
- Whey Coffee von ESN
- Iced Protein Coffee kaufen
- Flexpresso Protein Coffee

**Säule 2 (USPs, 5 Headlines):**
- 20 g Protein pro Portion
- Ohne Zuckerzusatz
- Cold-Brew-Verfahren
- Made in Germany seit 2005
- Iced & Hot zubereitbar

**Säule 3 (CTA, 4 Headlines):**
- Jetzt im ESN Shop kaufen!
- Ab 24,90 € bestellen
- 10 % Erstbesteller sichern
- Spar-Abo verfügbar

**Descriptions (Problem + Lösung + CTA, 4 Slots):**
1. Kaffee ohne Nährwert? Flexpresso bringt 20 g Protein in jede Tasse. Jetzt bestellen.
2. Cold-Brew-Verfahren, 20 g Whey, kein Zuckerzusatz. Hol dir Flexpresso im ESN Shop.
3. Iced oder hot – dein Protein-Kaffee jeden Morgen. Versandkostenfrei ab 60 €.
4. Made in Germany, 60 Tage Rückgaberecht. Probiere ESN Flexpresso jetzt aus.

Alle Headlines unter 30 Zeichen, alle Descriptions unter 90, Brand respektvoll
einmal pro Säule erwähnt (Produkt-Voice dominiert), `voice_rules` durchgehend
befolgt.

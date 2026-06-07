import type { Msg } from './messageTypes';
import type { Lang } from './i18n';

// Scripted end-to-end campaign for esn.com/products/flexpresso-protein-coffee.
// Lets the full pipeline (memory check via MongoDB MCP, LP analysis, strategy,
// search intent, keywords, copy + builder) play through without any
// backend calls — every agent text embeds the same ```json blocks the real
// agents emit, so the rendered cards are identical to a live run. Available
// in both UI languages so the demo matches the language switcher.
//
// DEMO_DOWNLOAD points at a real file in the backend's data/exports/ so the
// download button at the end actually works.
export const DEMO_DOWNLOAD = 'kampagne_esn.xlsx';

const T = '21:24';
const DEMO_URL = 'esn.com/products/flexpresso-protein-coffee';
const MONGO_URI_LABEL = 'sea_team_lead';
const FIND_FILTER_LABEL = `customer_profiles (url: ${DEMO_URL})`;

// Prose + embedded JSON cards per language. JSON values are translated where
// they're user-visible (titles, rationale text); structural identifiers stay
// English so the schema is identical across languages.
const CONTENT: Record<Lang, {
  user: string;
  leadIntro: string;
  leadNoMemory: string;
  landing: string;
  strategy: string;
  searchIntent: string;
  keywords: string;
  copy: string;
  builderAsk: string;
  pickedAccount: string;
  builderNames: string;
  namedNames: string;
  builderConfirm: string;
  confirmYes: string;
  builder: string;
}> = {
  de: {
    user: 'Erstelle eine komplette Google-Ads-Kampagne für https://esn.com/products/flexpresso-protein-coffee',
    leadIntro: 'Klar — ich prüfe zuerst im Customer-Memory ob für diese URL schon Artefakte existieren, dann starte ich den Workflow: LP-Analyse → Strategie → Search-Intent → Keywords → Anzeigentexte. Optional am Ende ein Push in Google Ads.',
    leadNoMemory: 'Kein Eintrag für **esn.com/products/flexpresso-protein-coffee** im Memory. Ich starte mit der Landingpage-Analyse.',
    landing: `# LP-Analyse von esn.com/products/flexpresso-protein-coffee

### 1. Marke & Positionierung
ESN ist ein deutscher Premium-Hersteller für Sport-Nutrition mit Sitz in Elmshorn und positioniert sich seit 2005 als Qualitätsmarke im DACH-Raum. Beworben wird die spezifische Produktseite zu Flexpresso Protein Coffee unter dem Markenclaim „Premium Sports Nutrition – made in Germany".

### 2. Brand-Profil
Zentrale Brand-USPs sind Made in Germany, eigene Produktion und über 1 Mio. Kunden. Markenweite Offers im Checkout: Versand frei ab 60 €, 60 Tage Rückgaberecht. ESN adressiert damit den branchenweiten Schmerz, dass Qualität bei Supplements für Endkunden schwer einzuschätzen ist.

### 3. Produkt-Highlight
Flexpresso Protein Coffee ist ein Cold-Brew-basiertes Protein-Getränk mit 20 g Whey pro Portion, ohne Zuckerzusatz. Produkt-Offers: 10 % Erstbesteller-Rabatt und ein Spar-Abo. Preis-Anker „ab 24,90 €". Löst das Problem, dass Kaffee keinen Nährwert hat und gängige Proteindrinks künstlich schmecken.

### 4. Zielgruppen
Junge Fitness-Enthusiasten (Consideration) suchen einen Protein-Boost im Alltag. Berufstätige Kaffeetrinker (Awareness) wollen Energie und Muskelaufbau in einem Produkt. Bestandskunden (Decision) testen die neue Produktlinie aus dem Sortiment.

### 5. Tonalität & Voice
Modern, energiegeladen, direkt. Anrede: du. Emojis: sparsam. Sätze: kurz. Ausrufe als gezielte Akzente. Dominanter Call-to-Action: „Jetzt kaufen".

### 6. SEA-Hebel
Conversion-Goals: Produktkauf + Newsletter-Anmeldung im DACH-Raum (DE/AT/CH). Top-LP-Keywords: Protein-Kaffee, Flexpresso, Whey-Coffee, Cold Brew Protein. Erkennbare Wettbewerber: MyProtein, Foodspring, More Nutrition.

\`\`\`json
{"type":"landing_page_analysis","customer":"ESN","product":"Flexpresso Protein Coffee","landing_page_url":"esn.com/products/flexpresso-protein-coffee","domain":"esn.com","industry":"Sport-Nutrition E-Commerce","language":"de","geography":["DE","AT","CH"],"brand_usps":["Made in Germany","Seit 2005","Über 1 Mio. Kunden","Eigenes Labor"],"brand_offers":["Versandkostenfrei ab 60 €","60 Tage Rückgaberecht"],"brand_pain_points":["Unsichere Qualität bei Supplements","Intransparente Zusammensetzung"],"brand_tagline":"Premium Sports Nutrition – made in Germany","product_usps":["20 g Protein pro Portion","Ohne Zuckerzusatz","Cold-Brew-Verfahren","Iced & Hot zubereitbar"],"product_offers":["10 % Erstbesteller-Rabatt","Spar-Abo verfügbar"],"product_pain_points":["Kaffee ohne Nährwert","Proteindrinks schmecken künstlich"],"product_price_anchor":"ab 24,90 €","target_audience":[{"persona":"Junge Fitness-Enthusiasten","needs":"Protein-Boost im Alltag, leckerer Kaffee","intent_stage":"consideration"},{"persona":"Berufstätige Kaffeetrinker","needs":"Energie und Muskelaufbau in einem","intent_stage":"awareness"}],"tonality":["modern","energiegeladen","direkt"],"voice_rules":{"address":"du","emojis":"sparingly","sentence_length":"short","exclamation":"on"},"cta":"Jetzt kaufen","conversion_goals":["Produktkauf","Newsletter-Anmeldung"],"lp_keywords":["Protein-Kaffee","Flexpresso","Whey-Coffee","Cold Brew Protein","Iced Coffee Protein"],"competitors":["MyProtein","Foodspring","More Nutrition"]}
\`\`\``,
    strategy: `# Strategie zu ESN

### 1. Strategie-Zusammenfassung
Für ESN Flexpresso Protein Coffee empfehlen wir ein zweigliedriges Suchnetzwerk-Setup im DACH-Raum: eine Brand-Kampagne schützt die starke Marke, eine generische Produktkampagne skaliert die Cold-Brew-Differenzierung. Hauptziel: Produktkauf im offiziellen Shop.

### 2. Kampagnenstruktur
Brand Search – ESN (Markenschutz) und Generic – Flexpresso (produktnahe Suchen rund um Protein-Kaffee, Cold Brew, Whey-Coffee). Eine separate Competitor-Kampagne entfällt mangels harter Wettbewerbs-Suchen zu Flexpresso direkt.

### 3. Budget-Verteilung
Tagesbudget 100 €: 20 % Brand (20 €), 80 % Generic (80 €). Brand bekommt wenig, weil die Suchen ohnehin sehr conversion-nah sind; Generic kriegt das Maximum für Neukundengewinnung.

### 4. Bid-Strategien & Conversion-Goals
Brand: Klicks maximieren (kosteneffiziente Sichtbarkeit). Generic: Conversions maximieren mit Ziel Produktkauf. Beide Kampagnen mit primärem Conversion-Goal Produktkauf.

### 5. Negative Keywords (Starter-Set)
kostenlos, gratis, jobs, gebraucht, ebay, amazon, rezept, selber machen, testbericht, studie. Der Keyword-Agent erweitert das Set später.

### 6. Empfehlung & Ausschluss
Performance Max empfohlen als zweiter Schritt sobald 30 Conversions in 30 Tagen erreicht sind — nicht Teil dieses Setups. Shopping ausgelassen, weil kein Produktfeed/Merchant Center auf der LP erkennbar.

\`\`\`json
{"type":"strategy","summary":"Zweigliedriges Suchnetzwerk-Setup für ESN Flexpresso Protein Coffee im DACH-Raum, Fokus auf Cold-Brew-Differenzierung und Produktkauf.","total_daily_budget_eur":100,"geo_targeting":["DE","AT","CH"],"language_targeting":"de","campaigns":[{"name":"Brand Search – ESN","campaign_type":"Search","purpose":"Brand","daily_budget_eur":20,"budget_share_percent":20,"bid_strategy":"Klicks maximieren","primary_conversion_goal":"Produktkauf","rationale":"Sichert hochkonvertierenden Brand-Traffic ab und schützt vor Mitbewerbsgeboten.","ad_groups":[{"name":"Brand Pure","intent_stage":"decision","voice_pool":"brand","keyword_seed_clusters":["Brand"]}]},{"name":"Generic – Flexpresso","campaign_type":"Search","purpose":"Generic","daily_budget_eur":80,"budget_share_percent":80,"bid_strategy":"Conversions maximieren","primary_conversion_goal":"Produktkauf","rationale":"Größter Wachstumshebel — Cold-Brew-USP differenziert klar gegenüber Standard-Whey.","ad_groups":[{"name":"Protein Coffee","intent_stage":"consideration","voice_pool":"product","keyword_seed_clusters":["Protein-Kaffee","Flexpresso"]},{"name":"Whey Coffee","intent_stage":"consideration","voice_pool":"product","keyword_seed_clusters":["Whey-Coffee","Cold Brew Protein"]}]}],"recommended_negative_keywords":["kostenlos","gratis","jobs","gebraucht","ebay","amazon","rezept","selber machen","testbericht","studie"],"pmax_recommendation":"Empfohlen als zweiter Schritt sobald 30 Conversions in 30 Tagen erreicht sind — nicht Teil dieses Setups.","skipped_campaign_types":[{"type":"Competitor","reason":"LP nennt keine konkreten Wettbewerber – generische Competitor-Cluster wären für den Keyword-Agent unbrauchbar."},{"type":"Shopping","reason":"Kein Produktfeed/Merchant Center auf der LP erkennbar."}]}
\`\`\``,
    searchIntent: `# Search-Intent zu ESN

### 1. Recherche-Überblick
4 Seeds aus der Strategy abgefragt, 18 unique Queries aus Google Autocomplete extrahiert. Markt liegt im Consideration-Stage (61 %) — viele Spec-/Vergleichs-Suchen, deutlich weniger Awareness, stabile Decision-Money-Suchen.

### 2. Queries nach Intent
**Decision**: esn flexpresso kaufen, flexpresso protein coffee online. **Consideration**: protein kaffee testsieger, whey coffee vergleich, cold brew protein erfahrungen. **Awareness**: protein kaffee selber machen — als negative klassifiziert.

### 3. Auffällige Modifier & Patterns
Dominante Modifier: „kaufen", „testsieger", „erfahrungen", „dm", „vergleich". Drogerie-Retail (DM, Rossmann) taucht stark auf — Konkurrenzdruck durch nicht-DTC-Anbieter. „Selber machen" zeigt DIY-Intent.

### 4. Negative Query Signals
„testbericht", „selber machen", „rezept" → Informational-Intent, niedrige Kaufabsicht. Werden in **campaign_negatives** ergänzt.

### 5. Empfehlungen für den Keyword-Agent
Decision-Queries direkt in „Brand Pure" als EXACT. Consideration-Queries split in „Protein Coffee" (Hauptthema) und „Whey Coffee" (Whey-Variante) als PHRASE. Awareness sparsam, nur als BROAD-Discovery.

\`\`\`json
{"type":"search_intent","summary":"18 unique Queries aus 4 Seeds. Markt im Consideration-Stage (61 %) mit klaren Decision-Money-Signalen rund um Brand + Produktname.","seeds_used":["esn flexpresso","protein kaffee","whey coffee","cold brew protein"],"raw_autocomplete":{"esn flexpresso":["esn flexpresso","esn flexpresso kaufen","esn flexpresso protein coffee","esn flexpresso erfahrungen","esn flexpresso test"],"protein kaffee":["protein kaffee","protein kaffee dm","protein kaffee testsieger","protein kaffee selber machen","protein kaffee vegan"],"whey coffee":["whey coffee kaufen","whey coffee vergleich","whey coffee esn","whey coffee erfahrungen"],"cold brew protein":["cold brew protein kaufen","cold brew protein test","cold brew protein vergleich","cold brew protein erfahrungen"]},"queries_by_stage":{"awareness":[{"query":"protein kaffee vegan","format":"Variante","source_seed":"protein kaffee"}],"consideration":[{"query":"protein kaffee testsieger","format":"Superlativ","source_seed":"protein kaffee"},{"query":"protein kaffee dm","format":"Retail","source_seed":"protein kaffee"},{"query":"whey coffee vergleich","format":"Vergleich","source_seed":"whey coffee"},{"query":"whey coffee erfahrungen","format":"Recherche","source_seed":"whey coffee"},{"query":"cold brew protein test","format":"Test","source_seed":"cold brew protein"},{"query":"cold brew protein vergleich","format":"Vergleich","source_seed":"cold brew protein"},{"query":"cold brew protein erfahrungen","format":"Recherche","source_seed":"cold brew protein"},{"query":"esn flexpresso erfahrungen","format":"Recherche","source_seed":"esn flexpresso"},{"query":"esn flexpresso test","format":"Test","source_seed":"esn flexpresso"},{"query":"esn flexpresso protein coffee","format":"Brand+Produkt","source_seed":"esn flexpresso"},{"query":"whey coffee esn","format":"Brand+Produkt","source_seed":"whey coffee"}],"decision":[{"query":"esn flexpresso kaufen","format":"Brand+Money","source_seed":"esn flexpresso"},{"query":"whey coffee kaufen","format":"Money","source_seed":"whey coffee"},{"query":"cold brew protein kaufen","format":"Money","source_seed":"cold brew protein"}]},"negative_query_signals":[{"query":"protein kaffee selber machen","reason":"DIY-Intent, kein Käufer-Match"},{"query":"protein kaffee testbericht","reason":"Informational, Reviews-Sucher"},{"query":"esn flexpresso test","reason":"Recherche statt Kauf"}],"top_modifiers":["kaufen","testsieger","erfahrungen","dm","vergleich","cold brew","whey"],"recommended_ad_group_mapping":[{"query_stage":"decision","target_ad_group":"Brand Pure","rationale":"Brand-Money-Queries passen 1:1 auf den Brand-Cluster"},{"query_stage":"consideration","target_ad_group":"Protein Coffee","rationale":"Generic-Spec- und Vergleichs-Queries treffen den Hauptthemen-Cluster"},{"query_stage":"consideration","target_ad_group":"Whey Coffee","rationale":"Whey-spezifische Recherche-Queries gehören in den Whey-Variant-Cluster"}]}
\`\`\``,
    keywords: `# Keyword-Recherche zu ESN

### 1. Keyword-Strategie-Überblick
22 Keywords über zwei Kampagnen und drei Anzeigengruppen. Match-Type-Mix: 35 % EXACT (Money- und Brand-Terms), 55 % PHRASE (Long-Tail-Kombinationen), 10 % BROAD (sparsam für Discovery). Über 60 % der Keywords stammen direkt aus echten Autocomplete-Daten.

### 2. Cluster pro Kampagne
**Brand Search – ESN**: „Brand Pure" mit 5 Keywords (EXACT-dominiert). **Generic – Flexpresso**: „Protein Coffee" mit 10 Keywords (PHRASE-dominiert), „Whey Coffee" mit 7 Keywords (PHRASE + 1 BROAD).

### 3. Match-Type-Verteilung
Brand-Cluster bewusst EXACT-lastig (Brand-Suchen sind hochkonvertierend, PHRASE-Streuung kostet). Generic-Cluster auf PHRASE für Wortreihenfolge-Sensitive Suchen. BROAD nur für eine Awareness-Discovery-Variante.

### 4. Negative Keywords
Kampagnenweite Negatives in beiden Kampagnen: Strategy-Starter-Set + „selber machen", „testbericht" aus dem Search-Intent. Cross-Negatives: Brand negt „protein kaffee", „cold brew", „whey coffee"; Generic negt „esn", „esn supplements".

### 5. Erweiterungs-Empfehlungen
Phase 2: ein eigener Cluster für „protein kaffee dm/rossmann/aldi" als Retail-Conquesting, sowie saisonale Awareness-Welle für Herbst/Winter („vitamin-coffee", „energie-boost morgens").

\`\`\`json
{"type":"keywords","summary":"22 Keywords über zwei Kampagnen und drei Ad-Groups. Match-Type-Mix 35/55/10 (EXACT/PHRASE/BROAD). Mehrheit aus echten Autocomplete-Daten gespeist.","campaigns":[{"name":"Brand Search – ESN","campaign_negatives":["kostenlos","gratis","jobs","gebraucht","ebay","amazon","rezept","selber machen","testbericht","studie"],"ad_groups":[{"name":"Brand Pure","intent_stage":"decision","voice_pool":"brand","cluster_rationale":"Brand-Cluster mit Money-Modifier aus Autocomplete. Bewusst klein und EXACT-lastig.","keywords":[{"keyword":"esn","match_type":"EXACT"},{"keyword":"esn flexpresso","match_type":"EXACT"},{"keyword":"esn flexpresso kaufen","match_type":"EXACT"},{"keyword":"esn flexpresso protein coffee","match_type":"PHRASE"},{"keyword":"esn shop","match_type":"PHRASE"}],"ad_group_negatives":["protein kaffee","cold brew","whey coffee","vergleich","testsieger"]}]},{"name":"Generic – Flexpresso","campaign_negatives":["kostenlos","gratis","jobs","gebraucht","ebay","amazon","rezept","selber machen","testbericht","studie"],"ad_groups":[{"name":"Protein Coffee","intent_stage":"consideration","voice_pool":"product","cluster_rationale":"Generic-Hauptcluster aus Autocomplete-Suggestions zu „protein kaffee" + Money-/Vergleichs-Modifier.","keywords":[{"keyword":"protein kaffee","match_type":"PHRASE"},{"keyword":"protein kaffee kaufen","match_type":"PHRASE"},{"keyword":"protein kaffee testsieger","match_type":"PHRASE"},{"keyword":"protein kaffee online","match_type":"PHRASE"},{"keyword":"protein coffee","match_type":"PHRASE"},{"keyword":"flexpresso","match_type":"EXACT"},{"keyword":"flexpresso kaufen","match_type":"EXACT"},{"keyword":"protein kaffee vegan","match_type":"BROAD"},{"keyword":"protein kaffee mit milch","match_type":"PHRASE"},{"keyword":"protein kaffee dm alternative","match_type":"PHRASE"}],"ad_group_negatives":["esn","esn supplements","selber machen","rezept"]},{"name":"Whey Coffee","intent_stage":"consideration","voice_pool":"product","cluster_rationale":"Whey-Variant-Cluster aus Autocomplete zu „whey coffee" + „cold brew protein"; Vergleichs- und Recherche-Modifier.","keywords":[{"keyword":"whey coffee","match_type":"PHRASE"},{"keyword":"whey coffee kaufen","match_type":"EXACT"},{"keyword":"whey coffee vergleich","match_type":"PHRASE"},{"keyword":"cold brew protein","match_type":"PHRASE"},{"keyword":"cold brew protein kaufen","match_type":"EXACT"},{"keyword":"cold brew whey","match_type":"PHRASE"},{"keyword":"iced coffee protein","match_type":"PHRASE"}],"ad_group_negatives":["esn","esn supplements","tropfen","baby"]}]}]}
\`\`\``,
    copy: `RSA-Entwürfe für alle drei Ad-Groups, basierend auf Brand- und Product-Voice-Pool aus der LP:

\`\`\`json
{"type":"ads","ad_groups":[{"name":"Brand Pure","url":"www.esn.com/flexpresso","positions":[{"label":"Produkt / Keyword","headlines":["ESN Flexpresso offiziell","ESN Original Shop"]},{"label":"USP / Nutzen","headlines":["Made in Germany seit 2005","Über 1 Mio. Kunden vertrauen ESN"]},{"label":"Call-to-Action","headlines":["Jetzt im ESN Shop kaufen"]}],"descriptions":["Hol dir Flexpresso direkt im offiziellen ESN Shop. Versand frei ab 60 €.","Premium Sports Nutrition – made in Germany. 60 Tage Rückgaberecht."]},{"name":"Protein Coffee","url":"www.esn.com/flexpresso","positions":[{"label":"Produkt / Keyword","headlines":["Flexpresso Protein Coffee","Protein Kaffee Cold Brew"]},{"label":"USP / Nutzen","headlines":["20 g Protein pro Portion","Ohne Zuckerzusatz, voller Geschmack"]},{"label":"Call-to-Action","headlines":["Jetzt 10% Erstbesteller-Rabatt sichern","Flexpresso ab 24,90 € heute bestellen"]}],"descriptions":["Cold Brew Verfahren, 20 g Whey-Protein pro Portion. Made in Germany.","Iced oder hot – dein Protein-Kaffee für jeden Tag. Jetzt im Shop."]},{"name":"Whey Coffee","url":"www.esn.com/flexpresso","positions":[{"label":"Produkt / Keyword","headlines":["Whey Coffee von ESN","Cold Brew Whey Protein"]},{"label":"USP / Nutzen","headlines":["20 g Whey + Kaffee in einem","Made in Germany"]},{"label":"Call-to-Action","headlines":["Jetzt bestellen ab 24,90 €"]}],"descriptions":["Whey-Protein trifft Cold Brew Kaffee. Ohne Zuckerzusatz, echter Geschmack.","ESN Flexpresso – dein Protein-Boost am Morgen. Versandkostenfrei ab 60 €."]}]}
\`\`\``,
    builderAsk: `In welches Google Ads Konto soll die Kampagne aufgesetzt werden?

\`\`\`json
{"type":"account_picker","accounts":[{"id":"123-456-7890","name":"Acme Marketing GmbH"},{"id":"234-567-8901","name":"ESN Webshop"},{"id":"345-678-9012","name":"DAK Gesundheit"}],"selected":"234-567-8901"}
\`\`\``,
    pickedAccount: 'Zielkonto: ESN Webshop · 234-567-8901',
    builderNames: `Bevor ich aufsetze: Magst du die Namen der Kampagnen und Anzeigengruppen anpassen?

\`\`\`json
{"type":"name_editor","campaigns":[{"name":"Brand Search – ESN","ad_groups":["Brand Pure"]},{"name":"Generic – Flexpresso","ad_groups":["Protein Coffee","Whey Coffee"]}]}
\`\`\``,
    namedNames: `Namen anpassen:

Kampagnenname: "Brand Search – ESN" → "ESN Brand Search DE"
- Anzeigengruppe: "Brand Pure" → "Brand Pure"

Kampagnenname: "Generic – Flexpresso" → "ESN Flexpresso Generic DE"
- Anzeigengruppe: "Protein Coffee" → "Protein Coffee"
- Anzeigengruppe: "Whey Coffee" → "Whey Coffee"

Bitte verwende diese Namen beim Anlegen der Kampagne.`,
    builderConfirm: `Ich setze im Konto **ESN Webshop (234-567-8901)** zwei Suchkampagnen auf: **ESN Brand Search DE** (1 Ad-Group, Klicks maximieren) und **ESN Flexpresso Generic DE** (2 Ad-Groups, Conversions maximieren), inkl. Keywords, Cross-Negatives und je eine RSA pro Ad-Group. Alles wird **PAUSED** mit **1 € Tagesbudget** angelegt — ausschließlich Suchkampagnen. Wirklich in diesem Konto aufsetzen?

\`\`\`json
{"type":"confirm"}
\`\`\``,
    confirmYes: 'Ja, aufsetzen',
    builder: `Suchkampagnen im Konto **ESN Webshop (234-567-8901)** aufgesetzt — alles **pausiert**, festes Tagesbudget **1 €**:

- **ESN Brand Search DE** angelegt (Typ SEARCH, Status PAUSED, Bid: Klicks maximieren)
- **ESN Flexpresso Generic DE** angelegt (Typ SEARCH, Status PAUSED, Bid: Conversions maximieren)
- 3 Anzeigengruppen total: Brand Pure, Protein Coffee, Whey Coffee
- 22 Keywords + Cross-Negatives + je eine Responsive Search Ad pro Ad-Group
- Customer-Memory in MongoDB aktualisiert — beim nächsten Aufruf der URL kannst du die Kampagne direkt wiederverwenden

Sicherheitsregeln: nur SEARCH-Kampagnen, Performance Max wurde übersprungen (Empfehlung steht im Strategie-Output), Budget auf 1 €/Tag begrenzt, alles bleibt PAUSED bis zur manuellen Freigabe.`,
  },
  en: {
    user: 'Create a complete Google Ads campaign for https://esn.com/products/flexpresso-protein-coffee',
    leadIntro: 'Got it — first I check the customer memory for any existing artefacts for this URL, then I run the workflow: LP analysis → strategy → search intent → keywords → ad copy. Optional push to Google Ads at the end.',
    leadNoMemory: 'No entry for **esn.com/products/flexpresso-protein-coffee** in memory. Starting fresh with the landing page analysis.',
    landing: `# LP analysis of esn.com/products/flexpresso-protein-coffee

### 1. Brand & positioning
ESN is a German premium sports-nutrition manufacturer based in Elmshorn, positioned as a quality brand in the DACH region since 2005. The specific product page being advertised is Flexpresso Protein Coffee, under the brand claim "Premium Sports Nutrition – made in Germany".

### 2. Brand profile
Core brand USPs: Made in Germany, in-house production, 1M+ customers. Brand-wide offers at checkout: free shipping from €60, 60-day return policy. ESN thereby addresses the industry-wide pain that supplement quality is hard to assess for consumers.

### 3. Product highlight
Flexpresso Protein Coffee is a cold-brew-based protein drink with 20 g of whey per serving, no added sugar. Product offers: 10% first-order discount and a subscribe-and-save option. Price anchor "from €24.90". Solves the problem that coffee has no nutritional value and standard protein drinks taste artificial.

### 4. Audience
Young fitness enthusiasts (consideration) want a protein boost in their daily routine. Working coffee drinkers (awareness) want energy and muscle building in one. Existing customers (decision) try the new product line within the range.

### 5. Tonality & voice
Modern, energetic, direct. Address: informal "du". Emojis: sparingly. Sentences: short. Exclamations as deliberate accents. Dominant CTA: "Jetzt kaufen" / "Buy now".

### 6. SEA hooks
Conversion goals: product purchase + newsletter signup in DACH (DE/AT/CH). Top LP keywords: Protein-Kaffee, Flexpresso, Whey-Coffee, Cold Brew Protein. Identifiable competitors: MyProtein, Foodspring, More Nutrition.

\`\`\`json
{"type":"landing_page_analysis","customer":"ESN","product":"Flexpresso Protein Coffee","landing_page_url":"esn.com/products/flexpresso-protein-coffee","domain":"esn.com","industry":"Sport-Nutrition E-Commerce","language":"de","geography":["DE","AT","CH"],"brand_usps":["Made in Germany","Since 2005","Over 1 million customers","In-house lab"],"brand_offers":["Free shipping over €60","60-day return policy"],"brand_pain_points":["Uncertain supplement quality","Opaque ingredient lists"],"brand_tagline":"Premium Sports Nutrition – made in Germany","product_usps":["20 g protein per serving","No added sugar","Cold-brew process","Iced or hot ready"],"product_offers":["10% first-order discount","Subscribe-and-save available"],"product_pain_points":["Coffee with no nutritional value","Artificial-tasting protein drinks"],"product_price_anchor":"from €24.90","target_audience":[{"persona":"Young fitness enthusiasts","needs":"Protein boost in daily routine, tasty coffee","intent_stage":"consideration"},{"persona":"Working coffee drinkers","needs":"Energy and muscle building in one","intent_stage":"awareness"}],"tonality":["modern","energetic","direct"],"voice_rules":{"address":"du","emojis":"sparingly","sentence_length":"short","exclamation":"on"},"cta":"Jetzt kaufen","conversion_goals":["Product purchase","Newsletter signup"],"lp_keywords":["Protein-Kaffee","Flexpresso","Whey-Coffee","Cold Brew Protein","Iced Coffee Protein"],"competitors":["MyProtein","Foodspring","More Nutrition"]}
\`\`\``,
    strategy: `# Strategy for ESN

### 1. Strategy summary
For ESN Flexpresso Protein Coffee we recommend a two-campaign search setup for DACH: a brand campaign protects the strong brand, a generic product campaign scales the cold-brew differentiator. Main goal: product purchase in the official shop.

### 2. Campaign structure
Brand Search – ESN (brand protection) and Generic – Flexpresso (product-near searches around protein coffee, cold brew, whey coffee). A separate competitor campaign is skipped because no hard competitor searches around Flexpresso surface directly.

### 3. Budget split
Daily budget €100: 20% brand (€20), 80% generic (€80). Brand gets little because the searches already convert highly; generic gets the maximum for new-customer acquisition.

### 4. Bid strategies & conversion goals
Brand: Maximize Clicks (cost-efficient visibility). Generic: Maximize Conversions targeting product purchase. Both campaigns primary conversion goal: product purchase.

### 5. Negative keywords (starter set)
kostenlos, gratis, jobs, gebraucht, ebay, amazon, rezept, selber machen, testbericht, studie. The keyword agent will expand the set later.

### 6. Recommendation & exclusion
Performance Max recommended as a second step once 30 conversions in 30 days are hit — not part of this setup. Shopping skipped because no product feed/Merchant Center is detectable on the LP.

\`\`\`json
{"type":"strategy","summary":"Two-campaign search setup for ESN Flexpresso Protein Coffee in DACH, focused on cold-brew differentiation and product purchase.","total_daily_budget_eur":100,"geo_targeting":["DE","AT","CH"],"language_targeting":"de","campaigns":[{"name":"Brand Search – ESN","campaign_type":"Search","purpose":"Brand","daily_budget_eur":20,"budget_share_percent":20,"bid_strategy":"Maximize Clicks","primary_conversion_goal":"Product purchase","rationale":"Secures highly converting brand traffic and protects against competitor bids.","ad_groups":[{"name":"Brand Pure","intent_stage":"decision","voice_pool":"brand","keyword_seed_clusters":["Brand"]}]},{"name":"Generic – Flexpresso","campaign_type":"Search","purpose":"Generic","daily_budget_eur":80,"budget_share_percent":80,"bid_strategy":"Maximize Conversions","primary_conversion_goal":"Product purchase","rationale":"Largest growth lever — cold-brew USP differentiates clearly from standard whey.","ad_groups":[{"name":"Protein Coffee","intent_stage":"consideration","voice_pool":"product","keyword_seed_clusters":["Protein-Kaffee","Flexpresso"]},{"name":"Whey Coffee","intent_stage":"consideration","voice_pool":"product","keyword_seed_clusters":["Whey-Coffee","Cold Brew Protein"]}]}],"recommended_negative_keywords":["kostenlos","gratis","jobs","gebraucht","ebay","amazon","rezept","selber machen","testbericht","studie"],"pmax_recommendation":"Recommended as a second step once 30 conversions in 30 days are reached — not part of this setup.","skipped_campaign_types":[{"type":"Competitor","reason":"LP names no concrete competitors — generic competitor clusters would be useless for the keyword agent."},{"type":"Shopping","reason":"No product feed/Merchant Center detectable on the LP."}]}
\`\`\``,
    searchIntent: `# Search intent for ESN

### 1. Research overview
4 seeds from the strategy queried, 18 unique queries extracted from Google Autocomplete. The market sits in the consideration stage (61%) — many spec/comparison searches, less awareness, stable decision-money searches.

### 2. Queries by intent
**Decision**: esn flexpresso kaufen, flexpresso protein coffee online. **Consideration**: protein kaffee testsieger, whey coffee vergleich, cold brew protein erfahrungen. **Awareness**: protein kaffee selber machen — classified as negative.

### 3. Notable modifiers & patterns
Dominant modifiers: "kaufen", "testsieger", "erfahrungen", "dm", "vergleich". Drugstore retail (DM, Rossmann) shows up strongly — competitive pressure from non-DTC retailers. "Selber machen" reveals DIY intent.

### 4. Negative query signals
"testbericht", "selber machen", "rezept" → informational intent, low purchase signal. Added to campaign_negatives.

### 5. Recommendations for the keyword agent
Decision queries straight into "Brand Pure" as EXACT. Consideration queries split between "Protein Coffee" (main topic) and "Whey Coffee" (whey variant) as PHRASE. Awareness sparingly, only as BROAD discovery.

\`\`\`json
{"type":"search_intent","summary":"18 unique queries from 4 seeds. Market in consideration stage (61%) with clear decision-money signals around brand + product name.","seeds_used":["esn flexpresso","protein kaffee","whey coffee","cold brew protein"],"raw_autocomplete":{"esn flexpresso":["esn flexpresso","esn flexpresso kaufen","esn flexpresso protein coffee","esn flexpresso erfahrungen","esn flexpresso test"],"protein kaffee":["protein kaffee","protein kaffee dm","protein kaffee testsieger","protein kaffee selber machen","protein kaffee vegan"],"whey coffee":["whey coffee kaufen","whey coffee vergleich","whey coffee esn","whey coffee erfahrungen"],"cold brew protein":["cold brew protein kaufen","cold brew protein test","cold brew protein vergleich","cold brew protein erfahrungen"]},"queries_by_stage":{"awareness":[{"query":"protein kaffee vegan","format":"Variante","source_seed":"protein kaffee"}],"consideration":[{"query":"protein kaffee testsieger","format":"Superlativ","source_seed":"protein kaffee"},{"query":"protein kaffee dm","format":"Retail","source_seed":"protein kaffee"},{"query":"whey coffee vergleich","format":"Vergleich","source_seed":"whey coffee"},{"query":"whey coffee erfahrungen","format":"Recherche","source_seed":"whey coffee"},{"query":"cold brew protein test","format":"Test","source_seed":"cold brew protein"},{"query":"cold brew protein vergleich","format":"Vergleich","source_seed":"cold brew protein"},{"query":"cold brew protein erfahrungen","format":"Recherche","source_seed":"cold brew protein"},{"query":"esn flexpresso erfahrungen","format":"Recherche","source_seed":"esn flexpresso"},{"query":"esn flexpresso test","format":"Test","source_seed":"esn flexpresso"},{"query":"esn flexpresso protein coffee","format":"Brand+Produkt","source_seed":"esn flexpresso"},{"query":"whey coffee esn","format":"Brand+Produkt","source_seed":"whey coffee"}],"decision":[{"query":"esn flexpresso kaufen","format":"Brand+Money","source_seed":"esn flexpresso"},{"query":"whey coffee kaufen","format":"Money","source_seed":"whey coffee"},{"query":"cold brew protein kaufen","format":"Money","source_seed":"cold brew protein"}]},"negative_query_signals":[{"query":"protein kaffee selber machen","reason":"DIY intent, no buyer match"},{"query":"protein kaffee testbericht","reason":"Informational, review searchers"},{"query":"esn flexpresso test","reason":"Research instead of purchase"}],"top_modifiers":["kaufen","testsieger","erfahrungen","dm","vergleich","cold brew","whey"],"recommended_ad_group_mapping":[{"query_stage":"decision","target_ad_group":"Brand Pure","rationale":"Brand+money queries fit 1:1 into the brand cluster"},{"query_stage":"consideration","target_ad_group":"Protein Coffee","rationale":"Generic spec and comparison queries hit the main topic cluster"},{"query_stage":"consideration","target_ad_group":"Whey Coffee","rationale":"Whey-specific research queries belong in the whey variant cluster"}]}
\`\`\``,
    keywords: `# Keyword research for ESN

### 1. Keyword strategy overview
22 keywords across two campaigns and three ad groups. Match-type mix: 35% EXACT (money and brand terms), 55% PHRASE (long-tail combinations), 10% BROAD (sparingly for discovery). Over 60% of keywords come straight from real autocomplete data.

### 2. Clusters per campaign
**Brand Search – ESN**: "Brand Pure" with 5 keywords (EXACT-dominated). **Generic – Flexpresso**: "Protein Coffee" with 10 keywords (PHRASE-dominated), "Whey Coffee" with 7 keywords (PHRASE + 1 BROAD).

### 3. Match-type split
Brand cluster intentionally EXACT-heavy (brand searches convert highly, PHRASE spillover costs). Generic clusters on PHRASE for word-order-sensitive searches. BROAD only for one awareness-discovery variant.

### 4. Negative keywords
Campaign-wide negatives in both campaigns: strategy starter set + "selber machen", "testbericht" from search intent. Cross-negatives: brand negates "protein kaffee", "cold brew", "whey coffee"; generic negates "esn", "esn supplements".

### 5. Expansion ideas
Phase 2: a dedicated cluster for "protein kaffee dm/rossmann/aldi" as retail conquesting, plus a seasonal awareness wave for fall/winter ("vitamin-coffee", "morning energy boost").

\`\`\`json
{"type":"keywords","summary":"22 keywords across two campaigns and three ad groups. Match-type mix 35/55/10 (EXACT/PHRASE/BROAD). Majority sourced from real autocomplete data.","campaigns":[{"name":"Brand Search – ESN","campaign_negatives":["kostenlos","gratis","jobs","gebraucht","ebay","amazon","rezept","selber machen","testbericht","studie"],"ad_groups":[{"name":"Brand Pure","intent_stage":"decision","voice_pool":"brand","cluster_rationale":"Brand cluster with money modifier from autocomplete. Intentionally small and EXACT-heavy.","keywords":[{"keyword":"esn","match_type":"EXACT"},{"keyword":"esn flexpresso","match_type":"EXACT"},{"keyword":"esn flexpresso kaufen","match_type":"EXACT"},{"keyword":"esn flexpresso protein coffee","match_type":"PHRASE"},{"keyword":"esn shop","match_type":"PHRASE"}],"ad_group_negatives":["protein kaffee","cold brew","whey coffee","vergleich","testsieger"]}]},{"name":"Generic – Flexpresso","campaign_negatives":["kostenlos","gratis","jobs","gebraucht","ebay","amazon","rezept","selber machen","testbericht","studie"],"ad_groups":[{"name":"Protein Coffee","intent_stage":"consideration","voice_pool":"product","cluster_rationale":"Generic main cluster from autocomplete suggestions around 'protein kaffee' + money/comparison modifiers.","keywords":[{"keyword":"protein kaffee","match_type":"PHRASE"},{"keyword":"protein kaffee kaufen","match_type":"PHRASE"},{"keyword":"protein kaffee testsieger","match_type":"PHRASE"},{"keyword":"protein kaffee online","match_type":"PHRASE"},{"keyword":"protein coffee","match_type":"PHRASE"},{"keyword":"flexpresso","match_type":"EXACT"},{"keyword":"flexpresso kaufen","match_type":"EXACT"},{"keyword":"protein kaffee vegan","match_type":"BROAD"},{"keyword":"protein kaffee mit milch","match_type":"PHRASE"},{"keyword":"protein kaffee dm alternative","match_type":"PHRASE"}],"ad_group_negatives":["esn","esn supplements","selber machen","rezept"]},{"name":"Whey Coffee","intent_stage":"consideration","voice_pool":"product","cluster_rationale":"Whey variant cluster from autocomplete around 'whey coffee' + 'cold brew protein'; comparison and research modifiers.","keywords":[{"keyword":"whey coffee","match_type":"PHRASE"},{"keyword":"whey coffee kaufen","match_type":"EXACT"},{"keyword":"whey coffee vergleich","match_type":"PHRASE"},{"keyword":"cold brew protein","match_type":"PHRASE"},{"keyword":"cold brew protein kaufen","match_type":"EXACT"},{"keyword":"cold brew whey","match_type":"PHRASE"},{"keyword":"iced coffee protein","match_type":"PHRASE"}],"ad_group_negatives":["esn","esn supplements","tropfen","baby"]}]}]}
\`\`\``,
    copy: `RSA drafts for all three ad groups, based on the brand and product voice pools from the LP:

\`\`\`json
{"type":"ads","ad_groups":[{"name":"Brand Pure","url":"www.esn.com/flexpresso","positions":[{"label":"Product / Keyword","headlines":["ESN Flexpresso Official","ESN Original Shop"]},{"label":"USP / Benefit","headlines":["Made in Germany since 2005","Over 1M customers trust ESN"]},{"label":"Call-to-Action","headlines":["Buy now in the ESN Shop"]}],"descriptions":["Get Flexpresso directly from the official ESN shop. Free shipping over €60.","Premium Sports Nutrition – made in Germany. 60-day return policy."]},{"name":"Protein Coffee","url":"www.esn.com/flexpresso","positions":[{"label":"Product / Keyword","headlines":["Flexpresso Protein Coffee","Protein Coffee Cold Brew"]},{"label":"USP / Benefit","headlines":["20 g protein per serving","No added sugar, full flavour"]},{"label":"Call-to-Action","headlines":["Get 10% first-order discount","Order Flexpresso from €24.90 today"]}],"descriptions":["Cold-brew process, 20 g whey protein per serving. Made in Germany.","Iced or hot – your protein coffee for every day. Order now in the shop."]},{"name":"Whey Coffee","url":"www.esn.com/flexpresso","positions":[{"label":"Product / Keyword","headlines":["Whey Coffee from ESN","Cold Brew Whey Protein"]},{"label":"USP / Benefit","headlines":["20 g whey + coffee in one","Made in Germany"]},{"label":"Call-to-Action","headlines":["Order now from €24.90"]}],"descriptions":["Whey protein meets cold-brew coffee. No added sugar, real flavour.","ESN Flexpresso – your morning protein boost. Free shipping over €60."]}]}
\`\`\``,
    builderAsk: `Which Google Ads account should the campaign be set up in?

\`\`\`json
{"type":"account_picker","accounts":[{"id":"123-456-7890","name":"Acme Marketing GmbH"},{"id":"234-567-8901","name":"ESN Webshop"},{"id":"345-678-9012","name":"DAK Gesundheit"}],"selected":"234-567-8901"}
\`\`\``,
    pickedAccount: 'Target account: ESN Webshop · 234-567-8901',
    builderNames: `Before I push: would you like to adjust the campaign and ad group names?

\`\`\`json
{"type":"name_editor","campaigns":[{"name":"Brand Search – ESN","ad_groups":["Brand Pure"]},{"name":"Generic – Flexpresso","ad_groups":["Protein Coffee","Whey Coffee"]}]}
\`\`\``,
    namedNames: `Adjust names:

Campaign name: "Brand Search – ESN" → "ESN Brand Search DE"
- Ad group: "Brand Pure" → "Brand Pure"

Campaign name: "Generic – Flexpresso" → "ESN Flexpresso Generic DE"
- Ad group: "Protein Coffee" → "Protein Coffee"
- Ad group: "Whey Coffee" → "Whey Coffee"

Please use these names when creating the campaign.`,
    builderConfirm: `I'll set up two search campaigns in account **ESN Webshop (234-567-8901)**: **ESN Brand Search DE** (1 ad group, Maximize Clicks) and **ESN Flexpresso Generic DE** (2 ad groups, Maximize Conversions), incl. keywords, cross-negatives and one RSA per ad group. Everything is created **PAUSED** with a **€1 daily budget** — search campaigns only. Really set up in this account?

\`\`\`json
{"type":"confirm"}
\`\`\``,
    confirmYes: 'Yes, set it up',
    builder: `Search campaigns set up in account **ESN Webshop (234-567-8901)** — everything **paused**, fixed daily budget of **€1**:

- **ESN Brand Search DE** created (type SEARCH, status PAUSED, bid: Maximize Clicks)
- **ESN Flexpresso Generic DE** created (type SEARCH, status PAUSED, bid: Maximize Conversions)
- 3 ad groups total: Brand Pure, Protein Coffee, Whey Coffee
- 22 keywords + cross-negatives + one Responsive Search Ad per ad group
- Customer memory in MongoDB updated — next time you call this URL you can reuse the campaign directly

Safety rules: search campaigns only, Performance Max skipped (recommendation lives in the strategy output), budget capped at €1/day, everything stays PAUSED until manual activation.`,
  },
};

export function buildDemo(lang: Lang): Msg[] {
  const c = CONTENT[lang];
  let n = 0;
  const id = () => `demo-${++n}`;
  const user = (text: string): Msg => ({ id: id(), role: 'user', text, time: T });
  const handoff = (target: string): Msg => ({ id: id(), role: 'handoff', target, time: T });
  const agent = (author: string, text: string): Msg => ({
    id: id(), role: 'agent', key: `demo:${author}`, author, text, streaming: false, time: T,
  });
  // MongoDB MCP tool-use chip. Same shape the real ChatArea SSE processing
  // emits when the live agent calls `connect` / `find` / `update-many`; the
  // demo just synthesizes them so the audience sees the MCP integration in
  // action without an actual backend round-trip.
  const mongo = (tool: string, label: string): Msg => ({
    id: id(), role: 'tool', provider: 'mongodb', tool, label, time: T,
  });

  return [
    user(c.user),
    // Team Lead opens the workflow and runs the memory-check via MongoDB MCP
    // before delegating — the green tool chips make the MCP touchpoint visible.
    agent('sea_team_lead', c.leadIntro),
    mongo('connect', MONGO_URI_LABEL),
    mongo('find', FIND_FILTER_LABEL),
    agent('sea_team_lead', c.leadNoMemory),
    // 1. Landing-page analysis (scrape + structured analysis JSON + persist).
    handoff('landing_page_agent'),
    agent('landing_page_agent', c.landing),
    mongo('insert-many', 'customer_profiles (analysis)'),
    // 2. Strategy.
    handoff('strategy_agent'),
    agent('strategy_agent', c.strategy),
    mongo('update-many', 'customer_profiles (strategy)'),
    // 3. Search Intent — live Google Autocomplete + intent classification.
    handoff('search_intent_agent'),
    agent('search_intent_agent', c.searchIntent),
    mongo('update-many', 'customer_profiles (search_intent)'),
    // 4. Keyword research informed by all three blocks above.
    handoff('keyword_agent'),
    agent('keyword_agent', c.keywords),
    mongo('update-many', 'customer_profiles (keywords)'),
    // 5. Copywriter RSA drafts.
    handoff('copywriter_agent'),
    agent('copywriter_agent', c.copy),
    mongo('update-many', 'customer_profiles (ads)'),
    // 6. Campaign Builder — three-step interactive flow.
    handoff('campaign_builder_agent'),
    agent('campaign_builder_agent', c.builderAsk),
    user(c.pickedAccount),
    agent('campaign_builder_agent', c.builderNames),
    user(c.namedNames),
    agent('campaign_builder_agent', c.builderConfirm),
    user(c.confirmYes),
    agent('campaign_builder_agent', c.builder),
    mongo('update-many', 'customer_profiles (campaign_build)'),
  ];
}

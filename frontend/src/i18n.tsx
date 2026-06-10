import React from 'react';

// Lightweight in-house i18n (no extra dependency). English is the primary
// language; German is offered via the header switcher. The choice persists in
// localStorage. UI chrome is translated here; the live agent responses are made
// language-aware separately by prefixing the /run_sse message with
// agentLanguageDirective(lang).

export type Lang = 'en' | 'de';

const STORAGE_KEY = 'ui.lang';

// Every translatable UI string. Keep keys grouped by surface. Values are plain
// strings — compose with surrounding markup in JSX instead of interpolating.
const DICT = {
  'login.subtitle': {
    en: 'Sign in to start your campaign workflows and save your history.',
    de: 'Melde dich an, um deine Kampagnen-Workflows zu starten und deinen Verlauf zu speichern.',
  },
  'login.button': { en: 'Sign in with Google', de: 'Mit Google anmelden' },
  'login.disclaimer': {
    en: 'By signing in you agree to your requests being processed by the multi-agent workflow.',
    de: 'Mit der Anmeldung stimmst du der Verarbeitung deiner Anfragen durch den Multi-Agent-Workflow zu.',
  },

  'header.online': { en: 'Online', de: 'Online' },
  'header.signOut': { en: 'Sign out', de: 'Abmelden' },
  'header.account': { en: 'Account', de: 'Konto' },
  'header.language': { en: 'Language', de: 'Sprache' },

  'sidebar.newChat': { en: 'New chat', de: 'Neuer Chat' },
  'sidebar.search': { en: 'Search', de: 'Suche' },
  'sidebar.searchPlaceholder': { en: 'Search conversations…', de: 'Konversationen durchsuchen…' },
  'sidebar.automations': { en: 'Automations', de: 'Automatisierungen' },
  'sidebar.recentChats': { en: 'Recent chats', de: 'Letzte Chats' },
  'sidebar.emptyTitle': { en: 'No conversations yet.', de: 'Noch keine Unterhaltungen.' },
  'sidebar.emptySubtitle': { en: 'Start a chat.', de: 'Starte einen Chat.' },
  'sidebar.delete': { en: 'Delete', de: 'Löschen' },

  'time.yesterday': { en: 'Yesterday', de: 'Gestern' },

  'chat.working': { en: 'working…', de: 'arbeitet…' },
  'chat.handoffTo': { en: 'Handing off to', de: 'Übergabe an' },
  'chat.emptyTitle': { en: 'Multi-Agent Workflow', de: 'Multi-Agent Workflow' },
  'chat.emptySubtitle': {
    en: "Send a message to start the specialized agents' coordinated campaign workflow.",
    de: 'Schick eine Nachricht, um den koordinierten Kampagnen-Workflow der spezialisierten Agenten zu starten.',
  },
  'chat.playDemo': { en: 'Play demo campaign', de: 'Demo-Kampagne abspielen' },
  'chat.orRealRequest': { en: 'or a real request', de: 'oder echte Anfrage' },
  'chat.connecting': { en: 'Connecting to the agent…', de: 'Verbinde mit dem Agenten…' },
  'chat.inputPlaceholder': {
    en: 'Ask the Team Lead to start a new workflow…',
    de: 'Bitte den Team Lead, einen neuen Workflow zu starten…',
  },
  'chat.downloadExcel': { en: 'Download Excel', de: 'Excel herunterladen' },
  'chat.error': { en: 'Error', de: 'Fehler' },
  'chat.unknownError': { en: 'Unknown error', de: 'Unbekannter Fehler' },
  'chat.disclaimer': {
    en: 'AI can make mistakes. Please double-check important information.',
    de: 'KI kann Fehler machen. Bitte überprüfe wichtige Informationen.',
  },
  'chat.inputHints': {
    en: 'Shift + Enter for newline · type / for commands · @ to mention · ↑/↓ for history',
    de: 'Shift + Enter für Zeilenumbruch · / für Befehle · @ für Erwähnung · ↑/↓ für Verlauf',
  },
  'chat.continueWith': { en: 'Continue with', de: 'Weiter mit' },
  'chat.quickBuildLabel': { en: 'Build campaign', de: 'Kampagne aufsetzen' },
  'chat.quickOptimizeLabel': { en: 'Optimize', de: 'Optimieren' },
  'chat.quickAnalyzeLabel': { en: 'Analyze LP', de: 'LP analysieren' },
  'chat.slashLpDesc': { en: 'Analyze a landing page URL', de: 'Landingpage analysieren' },
  'chat.slashBuildDesc': { en: 'Push the campaign live to Google Ads', de: 'Kampagne in Google Ads aufsetzen' },
  'chat.slashOptimizeDesc': { en: 'Optimize a running campaign', de: 'Laufende Kampagne optimieren' },
  'chat.slashStrategyDesc': { en: 'Draft a campaign strategy', de: 'Strategie entwerfen' },
  'chat.slashKeywordsDesc': { en: 'Research keywords for a topic', de: 'Keywords recherchieren' },
  'chat.slashCopyDesc': { en: 'Write ad copy (RSA)', de: 'Anzeigentexte schreiben (RSA)' },
  'cards.intentAwareness': { en: 'Awareness', de: 'Awareness' },
  'cards.intentConsideration': { en: 'Consideration', de: 'Consideration' },
  'cards.intentDecision': { en: 'Decision', de: 'Decision' },
  'cards.intentNegative': { en: 'Negative', de: 'Negativ' },
  'cards.demandDistribution': { en: 'Demand distribution', de: 'Demand-Verteilung' },
  'cards.negativeSignals': { en: 'Negative signals', de: 'Negativ-Signale' },
  'cards.adGroupMapping': { en: 'Ad-group mapping', de: 'Ad-Group-Mapping' },
  'cards.topModifiers': { en: 'Top modifiers', de: 'Top-Modifier' },
  'cards.realFromGoogle': { en: 'Live from Google Autocomplete', de: 'Live aus Google Autocomplete' },
  'chat.conversationFallback': { en: 'Conversation', de: 'Konversation' },
  'chat.you': { en: 'You', de: 'Du' },
  'chat.targetAccount': { en: 'Target account', de: 'Zielkonto' },
  'chat.confirmSetup': { en: 'Yes, set it up', de: 'Ja, aufsetzen' },

  'cards.type': { en: 'Type', de: 'Typ' },
  'cards.budget': { en: 'Budget', de: 'Budget' },
  'cards.bidStrategy': { en: 'Bid strategy', de: 'Gebotsstrategie' },
  'cards.targeting': { en: 'Targeting', de: 'Targeting' },
  'cards.ad': { en: 'Ad', de: 'Anzeige' },
  'cards.position': { en: 'Position', de: 'Position' },
  'cards.headlines': { en: 'Headlines', de: 'Headlines' },
  'cards.descriptions': { en: 'Descriptions', de: 'Descriptions' },
  'cards.headlineFallback': { en: 'Headline', de: 'Headline' },
  'cards.charCheck': { en: 'Check character counts', de: 'Zeichenanzahl prüfen' },
  'chat.mentionHint': { en: 'Mention an agent', de: 'Agent erwähnen' },
  'cards.chooseAccount': { en: 'Choose an account…', de: 'Konto wählen…' },
  'cards.select': { en: 'Select account', de: 'Konto auswählen' },
  'cards.confirm': { en: 'Confirm', de: 'Bestätigen' },
  'cards.cancel': { en: 'Cancel', de: 'Abbrechen' },
  'cards.nameEditorTitle': { en: 'Adjust names', de: 'Namen anpassen' },
  'cards.campaignName': { en: 'Campaign name', de: 'Kampagnenname' },
  'cards.adGroupName': { en: 'Ad group', de: 'Anzeigengruppe' },
  'cards.nameEditorSubmit': { en: 'Apply names', de: 'Namen übernehmen' },
  'cards.nameEditorFooter': {
    en: 'Please use these names when creating the campaign.',
    de: 'Bitte verwende diese Namen beim Anlegen der Kampagne.',
  },

  'settings.open': { en: 'Google Ads settings', de: 'Google Ads Einstellungen' },
  'settings.title': { en: 'Google Ads connection', de: 'Google Ads Verbindung' },
  'settings.subtitle': {
    en: 'Enter the credentials and IDs, then test the connection.',
    de: 'Zugangsdaten und IDs eintragen, dann die Verbindung testen.',
  },
  'settings.developerToken': { en: 'Developer token', de: 'Developer-Token' },
  'settings.clientId': { en: 'OAuth Client ID', de: 'OAuth Client-ID' },
  'settings.clientSecret': { en: 'OAuth Client Secret', de: 'OAuth Client-Secret' },
  'settings.refreshToken': { en: 'Refresh token', de: 'Refresh-Token' },
  'settings.loginCustomerId': {
    en: 'Manager account ID (login-customer-id)',
    de: 'Manager-Konto-ID (login-customer-id)',
  },
  'settings.customerId': {
    en: 'Default target account ID (optional)',
    de: 'Standard-Zielkonto-ID (optional)',
  },
  'settings.secretSet': {
    en: '•••••••• saved — leave blank to keep',
    de: '•••••••• gespeichert — leer lassen zum Behalten',
  },
  'settings.save': { en: 'Save', de: 'Speichern' },
  'settings.saved': { en: 'Saved', de: 'Gespeichert' },
  'settings.test': { en: 'Test connection', de: 'Verbindung testen' },
  'settings.testing': { en: 'Testing…', de: 'Teste…' },
  'settings.connected': { en: 'Connected', de: 'Verbunden' },
  'settings.failed': { en: 'Connection failed', de: 'Verbindung fehlgeschlagen' },
  'settings.accountsFound': { en: 'accounts found', de: 'Konten gefunden' },
  'settings.securityNote': {
    en: 'Secrets are stored server-side and never shown again. For production deployments use Secret Manager instead.',
    de: 'Geheimnisse werden serverseitig gespeichert und nicht erneut angezeigt. Für Produktion stattdessen Secret Manager verwenden.',
  },
  'settings.pageTitle': { en: 'Settings', de: 'Einstellungen' },
  'settings.backToChat': { en: 'Back to chat', de: 'Zurück zum Chat' },
  'settings.statusUnconfigured': { en: 'Not connected', de: 'Nicht verbunden' },
  'settings.googleAds': { en: 'Google Ads API', de: 'Google Ads API' },
  'settings.googleAdsDesc': {
    en: 'Create & manage search campaigns (always paused, €1/day).',
    de: 'Suchkampagnen anlegen & verwalten (immer pausiert, 1 €/Tag).',
  },
  'settings.googleSheets': { en: 'Google Sheets API', de: 'Google Sheets API' },
  'settings.googleSheetsDesc': {
    en: 'Export agent outputs to Google Sheets for quick sharing.',
    de: 'Agenten-Ausgaben zu Google Sheets exportieren zum schnellen Teilen.',
  },
  'settings.sheetsSharedNote': {
    en: 'Uses the same Google connection as Google Ads (with Drive access). Connect your Google account in the Google Ads section above to enable it.',
    de: 'Nutzt dieselbe Google-Verbindung wie Google Ads (mit Drive-Zugriff). Verbinde dein Google-Konto oben im Google-Ads-Abschnitt, um es zu aktivieren.',
  },
  'settings.connect': { en: 'Connect with Google', de: 'Mit Google verbinden' },
  'settings.connections': { en: 'Connections', de: 'Verbindungen' },
  'settings.configuration': { en: 'Configuration', de: 'Konfiguration' },
  'settings.mongoDb': { en: 'MongoDB Atlas', de: 'MongoDB Atlas' },
  'settings.mongoDbDesc': {
    en: 'Customer memory & cross-session artefacts via MCP.',
    de: 'Customer-Memory & sessionsübergreifende Artefakte via MCP.',
  },
  'settings.serverConfigured': { en: 'Server-side configured', de: 'Serverseitig konfiguriert' },
  'settings.notConfigured': { en: 'Not configured', de: 'Nicht konfiguriert' },
  'settings.openConfig': { en: 'Open configuration', de: 'Konfiguration öffnen' },
  'settings.disconnect': { en: 'Disconnect', de: 'Trennen' },
  'settings.disconnecting': { en: 'Disconnecting…', de: 'Trenne…' },
  'settings.disconnectConfirm': {
    en: 'Disconnect Google account? The OAuth grant will be revoked at Google and the refresh token wiped locally. Google Sheets export will stop working until you reconnect.',
    de: 'Google-Konto trennen? Der OAuth-Grant wird bei Google widerrufen und der Refresh-Token lokal gelöscht. Der Google-Sheets-Export funktioniert dann nicht mehr, bis du dich erneut verbindest.',
  },
  'settings.sheetsDisconnectHint': {
    en: 'Disconnect Google Sheets via the Google Ads section above — both share the same OAuth grant.',
    de: 'Google Sheets trennst du im Google-Ads-Bereich oben — beide nutzen denselben OAuth-Grant.',
  },
  'settings.connectIntro': {
    en: 'Easiest: save Client ID + Secret, then connect — the refresh token is fetched automatically.',
    de: 'Am einfachsten: Client-ID + Secret speichern, dann verbinden — der Refresh-Token wird automatisch geholt.',
  },
  'settings.redirectHint': {
    en: 'Add this redirect URI to your OAuth client first:',
    de: 'Diese Redirect-URI vorher im OAuth-Client eintragen:',
  },

  'chat.copy': { en: 'Copy', de: 'Kopieren' },
  'chat.copied': { en: 'Copied', de: 'Kopiert' },
  'chat.exportSheets': { en: 'Export to Sheets', de: 'In Sheets exportieren' },
  'chat.exporting': { en: 'Exporting…', de: 'Exportiere…' },
  'chat.openInSheets': { en: 'Open in Google Sheets', de: 'In Google Sheets öffnen' },

  'settings.oauthUrlError': {
    en: 'Could not create sign-in URL (Client ID saved?).',
    de: 'Anmelde-URL konnte nicht erstellt werden (Client-ID gespeichert?).',
  },
  'settings.googleAuth': { en: 'Google Authentication', de: 'Google Authentifizierung' },
  'settings.googleAuthDesc': {
    en: 'Connect your Google account for Ads API access and Sheets export.',
    de: 'Google-Konto verbinden für Ads-API-Zugriff und Sheets-Export.',
  },
  'settings.googleAuthConnectedDesc': {
    en: 'Google account connected — Ads API and Sheets export are active.',
    de: 'Google-Konto verbunden — Ads-API und Sheets-Export sind aktiv.',
  },
  'settings.sheetsEnabled': { en: 'Google Sheets export enabled', de: 'Google-Sheets-Export aktiviert' },
  'settings.sheetsDisabled': { en: 'Google Sheets export requires a connected account', de: 'Google-Sheets-Export erfordert ein verbundenes Konto' },
  'settings.settingsSubtitle': {
    en: 'Manage your integrations and connections.',
    de: 'Verwalte deine Integrationen und Verbindungen.',
  },

  'cards.campaign': { en: 'Campaign', de: 'Kampagne' },
  'cards.keyword': { en: 'Keyword', de: 'Keyword' },
  'cards.matchType': { en: 'Match Type', de: 'Match Type' },
  'cards.anchor': { en: 'Anchor', de: 'Anchor' },
  'cards.anchorTooltip': {
    en: 'Headline Anchor: keyword used by the Copywriter as pillar-1 material',
    de: 'Headline-Anchor: Keyword wird vom Copywriter als Säule-1-Material verwendet',
  },
  'cards.anchorCopyTooltip': {
    en: 'Headline Anchor — the Copywriter pulls pillar-1 headlines from this keyword',
    de: 'Headline-Anchor — der Copywriter zieht Säule-1-Headlines aus diesem Keyword',
  },
  'cards.bidOnlyTooltip': {
    en: 'Bidding only — keyword is booked but not used for headlines',
    de: 'Bidding-Only — Keyword wird gebucht, aber nicht für Headlines verwendet',
  },
  'cards.bidOnly': { en: 'Bid only', de: 'Bid only' },
  'cards.campaignNegatives': { en: 'Campaign Negatives', de: 'Kampagnen-Negatives' },
  'cards.adGroupNegatives': { en: 'Ad-Group Negatives', de: 'Ad-Group-Negatives' },
  'cards.intentNegativeLabel': { en: 'Negative', de: 'Negativ' },

  'search.title': { en: 'Search', de: 'Suche' },
  'search.subtitle': {
    en: 'Search across all your conversations and campaign data.',
    de: 'Durchsuche alle deine Konversationen und Kampagnendaten.',
  },
  'search.placeholder': { en: 'Search conversations…', de: 'Konversationen durchsuchen…' },
  'search.noResults': { en: 'No results found.', de: 'Keine Ergebnisse gefunden.' },
  'search.hint': { en: 'Search for keywords, campaign names, or agent responses.', de: 'Suche nach Keywords, Kampagnennamen oder Agenten-Antworten.' },

  'automations.title': { en: 'Automations', de: 'Automatisierungen' },
  'automations.subtitle': {
    en: 'Set up automated workflows for your Google Ads campaigns.',
    de: 'Richte automatisierte Workflows für deine Google Ads Kampagnen ein.',
  },
  'automations.comingSoon': { en: 'Coming soon', de: 'Demnächst verfügbar' },
  'automations.comingSoonDesc': {
    en: 'Automated bid adjustments, scheduled reports, and alert rules — all managed by the agent team.',
    de: 'Automatische Gebotsanpassungen, geplante Berichte und Alert-Regeln — alles vom Agenten-Team gesteuert.',
  },

  'settings.mongoDbNote': {
    en: 'MongoDB Atlas is configured server-side via the environment variable <code>MDB_MCP_CONNECTION_STRING</code>. You can see live activity in the chat as green MongoDB MCP chips (connect / find / update-many).',
    de: 'MongoDB Atlas wird serverseitig über die Umgebungsvariable <code>MDB_MCP_CONNECTION_STRING</code> konfiguriert. Live-Aktivität siehst du im Chat als grüne MongoDB-MCP-Chips (connect / find / update-many).',
  },
} as const;

export type TKey = keyof typeof DICT;

function readInitialLang(): Lang {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'de' || stored === 'en') return stored;
  }
  return 'en'; // primary language
}

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey) => string;
}

const I18nContext = React.createContext<I18nState | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>(readInitialLang);

  const setLang = React.useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // localStorage unavailable (private mode) — keep in-memory only
    }
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = React.useCallback((key: TKey) => DICT[key][lang], [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}

// Prepended to the /run_sse user message so the multi-agent backend (whose
// instructions default to German) answers in the selected language. Carries
// a hard carve-out: chat-facing prose is in UI language, but values that get
// loaded into Google Ads as data (targeting codes, negative keywords, seeds,
// ad creatives) stay in the market's language — otherwise English negatives
// would never filter German searches and the German market would never see
// the English ads. The displayed/persisted user message keeps the original
// text — this directive is for the model only.
export function agentLanguageDirective(lang: Lang): string {
  if (lang === 'de') {
    return (
      'Sprach-Anweisung: Antworte dem Nutzer vollständig auf Deutsch. ' +
      'Prosa-Sektionen, Überschriften, `summary`, `rationale`, `notes` und ' +
      'alle erklärenden Texte gehen auf Deutsch raus.\n\n' +
      'AUSNAHME — Markt-Sprache schlägt UI-Sprache: Die folgenden Felder werden ' +
      '1:1 als technische Werte in Google Ads geladen oder funktionieren als ' +
      'wörtliche User-Suchen/-Anzeigen und MÜSSEN in der Sprache des ' +
      'Markts stehen (`landing_page_analysis.language` und Zielregion), NICHT in ' +
      'der UI-Sprache: `language_targeting` (ISO-Code des Such-Markts), ' +
      '`recommended_negative_keywords`, `campaign_negatives`, `ad_group_negatives`, ' +
      '`keyword_seed_clusters`, `keywords[].keyword`, `lp_keywords`, ' +
      'alle RSA-Headlines und Descriptions sowie `landing_page_url`/`domain` ' +
      '(URLs bleiben unverändert). Begründung: englische Negatives filtern ' +
      'keine deutschen Suchen, deutsche Headlines werden englischen Suchern nicht ' +
      'ausgespielt — das wäre für den Zielmarkt wertlos.\n\n'
    );
  }
  return (
    'Language instruction: Respond to the user entirely in English. ' +
    'Prose sections, headings, `summary`, `rationale`, `notes` and all ' +
    'explanatory text are in English. This overrides any default to German.\n\n' +
    'EXCEPTION — market language overrides UI language: The following fields are ' +
    'loaded into Google Ads as technical values or function as literal user ' +
    'searches / served ads, and MUST be in the market language ' +
    '(`landing_page_analysis.language` + targeted region), NOT the UI language: ' +
    '`language_targeting` (ISO code of the search market), ' +
    '`recommended_negative_keywords`, `campaign_negatives`, `ad_group_negatives`, ' +
    '`keyword_seed_clusters`, `keywords[].keyword`, `lp_keywords`, all RSA ' +
    'headlines and descriptions, and `landing_page_url`/`domain` (URLs stay ' +
    'unchanged). Reasoning: English negatives never filter German searches, ' +
    'German headlines never get served to English searchers — using the wrong ' +
    'language here makes the campaign useless for the target market.\n\n'
  );
}

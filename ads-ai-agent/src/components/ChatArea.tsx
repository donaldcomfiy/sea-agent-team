import React from 'react';
import { ArrowUp, Users, FileDown, ArrowRight, Loader2, Play, Copy, Check, FileSpreadsheet, Rocket, Gauge, LayoutTemplate, Search, PenTool, Target, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { agentMeta } from '../agents';
import { MessageContent, messageHasVisual, messageCustomerLabel } from './Cards';
import { createSession, exportUrl, runSSE, saveConversation, exportFileToSheets, exportTextToSheets } from '../api';
import type { AdkEvent } from '../api';
import type { Msg } from '../messageTypes';
import { buildDemo, DEMO_DOWNLOAD } from '../demo';
import { useAuth } from '../auth';
import { useI18n, agentLanguageDirective, type Lang } from '../i18n';

let _seq = 0;
const uid = () => `m${++_seq}-${Math.random().toString(36).slice(2, 7)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const basename = (p: string) => p.split(/[\\/]/).pop() || p;
const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const SUGGESTIONS: Record<Lang, string[]> = {
  en: [
    'Create a complete Google Ads campaign for https://esn.com',
    'Analyze the landing page https://www.dak.de and derive USPs',
    'Optimize my campaign: CTR 0.8%, Quality Score 4/10, high CPA',
  ],
  de: [
    'Erstelle eine komplette Google-Ads-Kampagne für https://esn.com',
    'Analysiere die Landingpage https://www.dak.de und leite USPs ab',
    'Optimiere meine Kampagne: CTR 0,8 %, Quality Score 4/10, hohe CPA',
  ],
};

// Agents addressable via @mention. handle is a language-neutral single token so
// parsing stays stable regardless of UI language; the display name comes from
// agentMeta. sea_team_lead is the root (no delegation needed for it).
const MENTION_AGENTS: { key: string; handle: string }[] = [
  { key: 'sea_team_lead', handle: 'TeamLead' },
  { key: 'landing_page_agent', handle: 'LandingPage' },
  { key: 'strategy_agent', handle: 'Strategy' },
  { key: 'search_intent_agent', handle: 'SearchIntent' },
  { key: 'keyword_agent', handle: 'Keywords' },
  { key: 'copywriter_agent', handle: 'Copywriter' },
  { key: 'translator_agent', handle: 'Translation' },
  { key: 'optimizer_team_lead', handle: 'Optimizer' },
  { key: 'excel_exporter_agent', handle: 'Output' },
  { key: 'campaign_builder_agent', handle: 'CampaignBuilder' },
];

// Slash commands that expand into a full prompt for the team lead. Each entry
// has a typed handle (lowercase), a short description label key, an icon and
// an expansion function. The expansion can end with a trailing space when the
// user is expected to add an argument (e.g. URL after /lp).
type SlashCommand = {
  handle: string;
  Icon: LucideIcon;
  descKey: 'chat.slashLpDesc' | 'chat.slashBuildDesc' | 'chat.slashOptimizeDesc' | 'chat.slashStrategyDesc' | 'chat.slashKeywordsDesc' | 'chat.slashCopyDesc';
  expand: (lang: Lang) => string;
  argsHint?: string;
};

const SLASH_COMMANDS: SlashCommand[] = [
  { handle: 'lp',       Icon: LayoutTemplate, descKey: 'chat.slashLpDesc',       argsHint: '<url>', expand: (l) => (l === 'de' ? 'Analysiere die Landingpage ' : 'Analyze the landing page ') },
  { handle: 'build',    Icon: Rocket,         descKey: 'chat.slashBuildDesc',    expand: (l) => (l === 'de' ? '@CampaignBuilder Setze die Kampagne in Google Ads auf.' : '@CampaignBuilder Set up the campaign in Google Ads.') },
  { handle: 'optimize', Icon: Gauge,          descKey: 'chat.slashOptimizeDesc', expand: (l) => (l === 'de' ? '@Optimizer Optimiere meine Kampagne: ' : '@Optimizer Optimize my campaign: ') },
  { handle: 'strategy', Icon: Target,         descKey: 'chat.slashStrategyDesc', expand: (l) => (l === 'de' ? '@Strategy Entwirf eine Kampagnenstrategie für ' : '@Strategy Draft a campaign strategy for ') },
  { handle: 'keywords', Icon: Search,         descKey: 'chat.slashKeywordsDesc', expand: (l) => (l === 'de' ? '@Keywords Recherchiere Keywords für ' : '@Keywords Research keywords for ') },
  { handle: 'copy',     Icon: PenTool,        descKey: 'chat.slashCopyDesc',     expand: (l) => (l === 'de' ? '@Copywriter Schreibe Anzeigentexte (RSA).' : '@Copywriter Write ad copy (RSA).') },
];

// Quick-action chips shown above the input when it is empty. Each chip simply
// pre-fills the input with a slash expansion — the user can still review/edit
// before sending. Subset of the slash commands by design.
const QUICK_ACTIONS: { Icon: LucideIcon; labelKey: 'chat.quickBuildLabel' | 'chat.quickOptimizeLabel' | 'chat.quickAnalyzeLabel'; slash: string }[] = [
  { Icon: Rocket,         labelKey: 'chat.quickBuildLabel',    slash: 'build' },
  { Icon: Gauge,          labelKey: 'chat.quickOptimizeLabel', slash: 'optimize' },
  { Icon: LayoutTemplate, labelKey: 'chat.quickAnalyzeLabel',  slash: 'lp' },
];

// Pipeline order: which agent naturally follows which. After the last message
// of a "step" agent we render a one-click button to invoke the next step via
// the team lead (using the existing @mention routing).
const NEXT_STEP: Record<string, { nextKey: string; nextHandle: string; promptDe: string; promptEn: string }> = {
  landing_page_agent: {
    nextKey: 'strategy_agent',
    nextHandle: 'Strategy',
    promptDe: '@Strategy entwirf jetzt die Kampagnenstrategie basierend auf der Landingpage-Analyse.',
    promptEn: '@Strategy now design the campaign strategy based on the landing page analysis.',
  },
  strategy_agent: {
    nextKey: 'search_intent_agent',
    nextHandle: 'SearchIntent',
    promptDe: '@SearchIntent hole jetzt live Google-Autocomplete-Daten für die Seeds aus der Strategie und kategorisiere sie nach Intent-Stage.',
    promptEn: '@SearchIntent now pull live Google Autocomplete data for the strategy seeds and classify them by intent stage.',
  },
  search_intent_agent: {
    nextKey: 'keyword_agent',
    nextHandle: 'Keywords',
    promptDe: '@Keywords erstelle jetzt die Keyword-Recherche basierend auf Strategie und Search-Intent.',
    promptEn: '@Keywords now build the keyword research based on the strategy and search intent.',
  },
  keyword_agent: {
    nextKey: 'copywriter_agent',
    nextHandle: 'Copywriter',
    promptDe: '@Copywriter schreibe jetzt die Anzeigentexte basierend auf den Keyword-Clustern.',
    promptEn: '@Copywriter now write the ad copy based on the keyword clusters.',
  },
  copywriter_agent: {
    nextKey: 'campaign_builder_agent',
    nextHandle: 'CampaignBuilder',
    promptDe: '@CampaignBuilder setze die Kampagne jetzt in Google Ads auf.',
    promptEn: '@CampaignBuilder now set up the campaign in Google Ads.',
  },
};

// Function-call names emitted by the MongoDB MCP server. Used to recognise
// MCP tool use and render a chip inline so the user (and the demo audience)
// sees every Mongo touch the landing_page_agent does. Names cover both the
// dash and camelCase variants in case the server changes them.
const MCP_TOOL_NAMES = new Set<string>([
  'connect',
  'find',
  'insert-many', 'insertMany',
  'insert-one',  'insertOne',
  'update-many', 'updateMany',
  'update-one',  'updateOne',
  'delete-many', 'deleteMany',
  'delete-one',  'deleteOne',
  'aggregate',
  'count',
  'list-databases',  'listDatabases',
  'list-collections', 'listCollections',
]);

// Human-readable summary for an MCP tool call so the chip in the chat says
// "find customer_profiles (domain: esn.com)" instead of just "find".
function mcpToolLabel(tool: string, args: Record<string, unknown> | undefined): string {
  const a = args || {};
  const collection = typeof a.collection === 'string' ? a.collection : '';
  if (tool === 'connect') return 'sea_team_lead';
  if (tool === 'find' || tool === 'count' || tool === 'aggregate') {
    const filter = a.filter as Record<string, unknown> | undefined;
    const filterKey = filter ? Object.keys(filter)[0] : '';
    const filterVal = filterKey && filter ? String(filter[filterKey]) : '';
    const filterStr = filterKey ? ` (${filterKey}: ${filterVal})` : '';
    return collection ? `${collection}${filterStr}` : 'query';
  }
  if (tool.startsWith('insert')) {
    const docs = Array.isArray(a.documents) ? a.documents : [];
    return collection ? `${collection} (${docs.length || 1})` : 'insert';
  }
  if (tool.startsWith('update') || tool.startsWith('delete')) {
    return collection || tool;
  }
  return collection || '';
}

// Turn @mentions in the user text into a routing instruction for the Team Lead
// (ADK always enters via the root, so we tell it to delegate). Returns "" if no
// non-root agent is mentioned. The original text stays visible in the chat.
function buildMentionDirective(text: string): string {
  const found = new Set<string>();
  const re = /@(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const agent = MENTION_AGENTS.find((a) => a.handle.toLowerCase() === m![1].toLowerCase());
    if (agent) found.add(agent.key);
  }
  const targets = [...found].filter((k) => k !== 'sea_team_lead');
  if (!targets.length) return '';
  return (
    `[System: Der Nutzer richtet sich gezielt an folgende Sub-Agenten: ${targets.join(', ')}. ` +
    `Delegiere die Aufgabe direkt an diese und beantworte sie ueber sie, ohne Rueckfrage zur Zustaendigkeit.]\n\n`
  );
}

// Render text with recognized @mentions AND URLs highlighted inline. Used both
// for the live input overlay and the sent user bubbles. Each span changes ONLY
// colour/background (no padding/weight) so it never shifts the input layout.
//   - @mention → agent's accent colour
//   - https?:// or www. URL → soft blue (matches the design system)
const TOKEN_RE = /(@\w+)|(https?:\/\/[^\s)]+|www\.[a-z0-9-]+\.[a-z]{2,}[^\s)]*)/gi;

function highlightTokens(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  // Reset state on each call (the regex is module-level with /g).
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      // @mention
      const handle = m[1].slice(1);
      const agent = MENTION_AGENTS.find((a) => a.handle.toLowerCase() === handle.toLowerCase());
      if (agent) {
        out.push(
          <span key={`mh-${k++}`} className={`${agentMeta(agent.key).nameColorClass} bg-white/10 rounded`}>
            {m[0]}
          </span>,
        );
      } else {
        out.push(m[0]);
      }
    } else if (m[2]) {
      // URL
      out.push(
        <span key={`url-${k++}`} className="text-[#60A5FA] bg-[#60A5FA]/10 rounded">
          {m[0]}
        </span>,
      );
    }
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

function AgentBubble({ author, time, streaming, text, onAction, variant = 'all' }: { id?: string; author: string; time: string; streaming: boolean; text: string; onAction?: (msg: string) => void; variant?: 'all' | 'prose' | 'visual' }) {
  const { lang } = useI18n();
  const meta = agentMeta(author);
  const Icon = meta.Icon;
  const [copied, setCopied] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const url = await exportTextToSheets(text, `STL-Export-${meta.name[lang]}`);
      window.open(url, '_blank');
    } catch (e) {
      alert(String(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex gap-4">
      {meta.avatarUrl ? (
        <img src={meta.avatarUrl} alt={meta.name[lang]} className={`w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5 border shadow-sm ${meta.borderColorClass}`} />
      ) : (
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border shadow-sm ${meta.colorClass}`}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
      )}
      <div className="flex flex-col gap-1 w-full max-w-[800px]">
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className={`font-semibold text-[13px] ${meta.nameColorClass}`}>{meta.name[lang]}</span>
          <span className="text-[11px] text-[#71717A]">{time}</span>
        </div>
        <div className="bg-[#111111] border border-[#27272A] rounded-2xl p-6 text-[14.5px] text-[#D4D4D8] shadow-sm leading-relaxed relative group">
          <MessageContent text={text} onAction={onAction} show={variant} />
          {streaming && (
            <span className="inline-block w-[7px] h-[15px] ml-0.5 align-text-bottom bg-[#A78BFA] animate-pulse rounded-[1px]" />
          )}

          {/* Action buttons (Copy and Export to Sheets) — not on the visual-only bubble */}
          {variant !== 'visual' && (
          <div className="flex gap-2 mt-4 pt-3 border-t border-[#27272A] opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#27272A] bg-[#18181A] hover:bg-[#27272A] hover:text-[#FAFAFA] text-[12px] text-[#A1A1AA] transition-colors"
            >
              {copied ? <Check size={13} className="text-[#34D399]" /> : <Copy size={13} />}
              <span>{copied ? 'Kopiert' : 'Kopieren'}</span>
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || streaming}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#27272A] bg-[#18181A] hover:bg-[#27272A] hover:text-[#FAFAFA] text-[12px] text-[#A1A1AA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={13} />
              <span>{exporting ? 'Exportiere...' : 'In Sheets exportieren'}</span>
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

// A delegation/handoff line, always attributed to the Team Lead, showing which
// sub-agent the work was forwarded to.
function HandoffMessage({ target, time }: { target: string; time: string }) {
  const { lang, t } = useI18n();
  const lead = agentMeta('sea_team_lead');
  const LeadIcon = lead.Icon;
  const tgt = agentMeta(target);
  const TargetIcon = tgt.Icon;
  return (
    <div className="flex gap-4">
      {lead.avatarUrl ? (
        <img src={lead.avatarUrl} alt={lead.name[lang]} className={`w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5 border shadow-sm ${lead.borderColorClass}`} />
      ) : (
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border shadow-sm ${lead.colorClass}`}>
          <LeadIcon size={18} strokeWidth={2.5} />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className={`font-semibold text-[13px] ${lead.nameColorClass}`}>{lead.name[lang]}</span>
          <span className="text-[11px] text-[#71717A]">{time}</span>
        </div>
        <div className="inline-flex items-center gap-2 bg-[#111111] border border-[#27272A] rounded-full px-4 py-2 text-[13px] text-[#A1A1AA] self-start">
          <ArrowRight size={14} className="text-[#71717A]" />
          <span>{t('chat.handoffTo')}</span>
          <span className={`inline-flex items-center gap-1.5 font-medium ${tgt.nameColorClass}`}>
            <TargetIcon size={13} strokeWidth={2.5} />
            {tgt.name[lang]}
          </span>
        </div>
      </div>
    </div>
  );
}

// One-click CTA that picks up the natural next step in the agent pipeline.
// Rendered once, immediately below the last agent message whose author has a
// defined successor (LP -> Strategy -> Keywords -> Copy -> Output). Clicking
// sends a prompt via the team lead's @mention routing.
function NextStepButton({ currentAuthor, onClick }: { currentAuthor: string; onClick: () => void }) {
  const { lang, t } = useI18n();
  const step = NEXT_STEP[currentAuthor];
  if (!step) return null;
  const meta = agentMeta(step.nextKey);
  const NextIcon = meta.Icon;
  return (
    <div className="flex gap-4">
      <div className="w-8 flex-shrink-0" />
      <button
        onClick={onClick}
        className="inline-flex items-center gap-2 text-[13px] text-[#D4D4D8] bg-[#111111] border border-[#27272A] rounded-full px-4 py-2 hover:border-[#3F3F46] hover:text-[#FAFAFA] transition-colors self-start"
      >
        <span>{t('chat.continueWith')}</span>
        <span className={`inline-flex items-center gap-1.5 font-medium ${meta.nameColorClass}`}>
          <NextIcon size={13} strokeWidth={2.5} />
          {meta.name[lang]}
        </span>
        <ChevronRight size={13} className="text-[#71717A]" />
      </button>
    </div>
  );
}

// Inline tool-use trace. Used today for the MongoDB MCP so the user sees every
// connect / find / insert that the landing_page_agent fires (and judges can
// see the MongoDB integration in action in the demo). One chip per tool call.
function ToolMessage({ tool, label, time }: { tool: string; label: string; time: string }) {
  return (
    <div className="flex gap-4">
      <img src="/mongo.jpg" alt="MongoDB MCP" className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5 border border-[#34D399] shadow-sm" />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="font-semibold text-[13px] text-[#34D399]">MongoDB MCP</span>
          <span className="text-[11px] text-[#71717A]">{time}</span>
        </div>
        <div className="inline-flex items-center gap-2 bg-[#072014] border border-[#0d4a2f] rounded-full px-3.5 py-1.5 text-[12.5px] text-[#86EFAC] self-start">
          <span className="font-mono text-[#34D399]">{tool}</span>
          <span className="text-[#52525B]">·</span>
          <span className="text-[#A1A1AA]">{label}</span>
        </div>
      </div>
    </div>
  );
}

// Shown while the agents are working but no text is actively streaming
// (waiting for the first token, tool calls, handoffs between agents).
function ThinkingIndicator({ author }: { author: string | null }) {
  const { lang, t } = useI18n();
  const meta = agentMeta(author || 'sea_team_lead');
  const Icon = meta.Icon;
  // Pull the hex out of nameColorClass ("text-[#60A5FA]") so the radar pulse
  // takes on the agent's accent color without needing a separate Tailwind
  // class (which the JIT scanner wouldn't pick up from interpolation).
  const accent = meta.nameColorClass.match(/#[0-9A-Fa-f]{6}/)?.[0] || '#A1A1AA';
  return (
    <div className="flex gap-4">
      {meta.avatarUrl ? (
        <img src={meta.avatarUrl} alt={meta.name[lang]} className={`w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5 border shadow-sm ${meta.borderColorClass}`} />
      ) : (
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border shadow-sm ${meta.colorClass}`}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className={`font-semibold text-[13px] ${meta.nameColorClass}`}>{meta.name[lang]}</span>
        </div>
        <div className="flex items-center gap-3 bg-[#111111] border border-[#27272A] rounded-2xl px-5 py-4 self-start">
          {/* Radar pulse in the agent's accent color */}
          <span className="relative inline-flex w-2 h-2 flex-shrink-0">
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-60"
              style={{ backgroundColor: accent }}
            />
            <span
              className="relative inline-flex w-2 h-2 rounded-full"
              style={{ backgroundColor: accent }}
            />
          </span>
          <span className="text-[13px] text-[#D4D4D8] animate-soft-pulse">{t('chat.working')}</span>
        </div>
      </div>
    </div>
  );
}

export default function ChatArea({
  userId,
  initialMessages = [],
  initialConvId = null,
  initialDownload = null,
  onSaved,
}: {
  userId: string;
  initialMessages?: Msg[];
  initialConvId?: string | null;
  initialDownload?: string | null;
  onSaved?: (convId: string, title: string) => void;
}) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Msg[]>(initialMessages);
  const [busy, setBusy] = React.useState(false);
  const [download, setDownload] = React.useState<string | null>(initialDownload);
  const [error, setError] = React.useState<string | null>(null);
  const [exportingFile, setExportingFile] = React.useState(false);
  const [input, setInput] = React.useState('');
  // @mention autocomplete state.
  const [mentionOpen, setMentionOpen] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState('');
  const [mentionIndex, setMentionIndex] = React.useState(0);
  // / slash-command autocomplete state. Open when the input starts with a "/".
  const [slashOpen, setSlashOpen] = React.useState(false);
  const [slashQuery, setSlashQuery] = React.useState('');
  const [slashIndex, setSlashIndex] = React.useState(0);
  // History navigation (↑/↓ when the input is empty). null = not browsing.
  const [historyIndex, setHistoryIndex] = React.useState<number | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  // Which agent is currently working — drives the loading indicator's identity.
  const [activeAgent, setActiveAgent] = React.useState<string | null>(null);
  // True while the canned demo plays: its interactive cards (account picker,
  // confirm) must NOT fire real backend calls, so onAction is withheld.
  const [isDemo, setIsDemo] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const sessionInit = React.useRef(false);
  const alive = React.useRef(true);
  // Storage id for this conversation (Mongo doc), distinct from the ADK
  // sessionId (recreated fresh on every mount). null for a new chat until the
  // first save adopts the sessionId; preset to the existing id for a reloaded
  // chat so subsequent saves update the same document.
  const convIdRef = React.useRef<string | null>(initialConvId);
  const downloadRef = React.useRef<string | null>(initialDownload);
  // Latest committed transcript, kept in a ref so persist() can read it without
  // relying on setMessages updater timing (the updater is not synchronous).
  const messagesRef = React.useRef<Msg[]>(initialMessages);
  // send() sets this true so the busy->false effect persists; loadDemo leaves it
  // false so the canned demo is never written to history.
  const wantPersist = React.useRef(false);
  const wasBusy = React.useRef(false);

  React.useEffect(() => {
    if (sessionInit.current) return; // guard against StrictMode double-run
    sessionInit.current = true;
    createSession(userId).then(setSessionId).catch((e) => setError(String(e)));
  }, [userId]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  // Auto-grow the textarea so the input box matches its content height (a la
  // Claude/ChatGPT) instead of clipping with an internal scrollbar. Reset to
  // 'auto' first so the box can shrink when content is deleted. The CSS
  // max-h-[400px] caps unbounded growth — beyond that it scrolls internally.
  React.useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  React.useEffect(() => {
    downloadRef.current = download;
  }, [download]);

  // Declared before the persist-trigger effect so messagesRef is refreshed first
  // when a render commits both new messages and busy=false.
  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Persist the rendered transcript to the backend (MongoDB). Best-effort: the
  // chat keeps working if it fails. Uses convIdRef (stable storage id) and
  // adopts the ADK sessionId for a brand-new conversation.
  async function persist(msgs: Msg[], dl: string | null) {
    if (!msgs.some((m) => m.role === 'user')) return;
    const id = convIdRef.current ?? sessionId;
    if (!id) return;
    // Prefer "Customer · Product" once the landing_page_agent has emitted a
    // customer_label card — that gives the sidebar a stable, recognisable title
    // for the chat. Falls back to the first user message until the label exists.
    let title = '';
    for (const m of msgs) {
      if (m.role !== 'agent') continue;
      const label = messageCustomerLabel((m as Extract<Msg, { role: 'agent' }>).text);
      if (label) {
        const parts = [label.customer, label.product].filter(Boolean);
        if (parts.length) {
          title = parts.join(' · ');
          break;
        }
      }
    }
    if (!title) {
      const firstUser = msgs.find((m) => m.role === 'user');
      title = (firstUser && 'text' in firstUser ? firstUser.text : t('chat.conversationFallback'));
    }
    title = title.slice(0, 80);
    try {
      await saveConversation(userId, id, title, msgs, dl);
      if (!convIdRef.current) convIdRef.current = id;
      onSaved?.(id, title);
    } catch {
      // ignore — history persistence must never block the chat
    }
  }

  // Fire persist exactly once per finished turn (busy true -> false), reading
  // the committed transcript from the ref. Skipped for the demo.
  React.useEffect(() => {
    if (wasBusy.current && !busy && wantPersist.current) {
      wantPersist.current = false;
      void persist(messagesRef.current, downloadRef.current);
    }
    wasBusy.current = busy;
  }, [busy]);

  // Set true on (re)mount, false on unmount. Important under StrictMode, which
  // mounts -> unmounts -> remounts: a cleanup-only version would leave `alive`
  // stuck false and freeze loadDemo's loop (busy spinner never clears).
  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Plays the canned demo conversation with staggered timing (no backend calls).
  async function loadDemo() {
    if (busy) return;
    setError(null);
    setDownload(null);
    setMessages([]);
    setIsDemo(true);
    setBusy(true);
    for (const step of buildDemo(lang)) {
      await sleep(step.role === 'handoff' ? 450 : 850);
      if (!alive.current) return;
      if (step.role === 'handoff') setActiveAgent(step.target);
      else if (step.role === 'agent') setActiveAgent(step.author);
      else setActiveAgent('sea_team_lead');
      setMessages((prev) => [...prev, step]);
    }
    setDownload(DEMO_DOWNLOAD);
    setBusy(false);
  }

  const handleFileExport = async () => {
    if (!download) return;
    setExportingFile(true);
    setError(null);
    try {
      const url = await exportFileToSheets(download);
      window.open(url, '_blank');
    } catch (e) {
      setError(String(e));
    } finally {
      setExportingFile(false);
    }
  };

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy || !sessionId) return;
    setIsDemo(false); // a real send re-enables interactive cards
    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { id: uid(), role: 'user', text, time: nowTime() }]);
    setBusy(true);
    wantPersist.current = true;
    setActiveAgent('sea_team_lead'); // the Team Lead receives the request first

    let foundDownload: string | null = null;
    const seenTransfers = new Set<string>();
    const seenMcpCalls = new Set<string>();

    const process = (ev: AdkEvent) => {
      const author = ev.author || 'agent';
      const key = `${ev.invocationId || '0'}:${author}`;
      const parts = ev.content?.parts ?? [];
      if (ev.author) setActiveAgent(ev.author);

      for (const part of parts) {
        const fc = part.functionCall;
        if (fc?.name === 'transfer_to_agent') {
          const target = (fc.args?.agent_name ?? fc.args?.agentName) as string | undefined;
          if (target) setActiveAgent(target); // the agent the work is handed to is next
          const tkey = `${ev.invocationId || '0'}:${target}`;
          // One handoff line per (invocation, target); skip transfers back to
          // the coordinator. Deduped here (process runs once per event), then
          // appended via a pure updater.
          if (target && target !== 'sea_team_lead' && !seenTransfers.has(tkey)) {
            seenTransfers.add(tkey);
            const item: Msg = { id: uid(), role: 'handoff', target, time: nowTime() };
            setMessages((prev) => [...prev, item]);
          }
        }
        if (part.functionResponse) {
          const r = part.functionResponse.response;
          const s = typeof r === 'string' ? r : JSON.stringify(r ?? '');
          const m = s.match(/([A-Za-z0-9_\-.]+\.xlsx)/);
          if (m) foundDownload = m[1];
        }
        // MongoDB MCP tool use → render a small green chip in the chat. One
        // chip per (invocation, tool, args) so StrictMode's double-process
        // doesn't duplicate them.
        if (fc && MCP_TOOL_NAMES.has(fc.name)) {
          const dedupKey = `${ev.invocationId || '0'}:${fc.name}:${JSON.stringify(fc.args || {})}`;
          if (!seenMcpCalls.has(dedupKey)) {
            seenMcpCalls.add(dedupKey);
            const label = mcpToolLabel(fc.name, fc.args);
            const item: Msg = { id: uid(), role: 'tool', provider: 'mongodb', tool: fc.name, label, time: nowTime() };
            setMessages((prev) => [...prev, item]);
          }
        }
      }

      const msgText = parts.filter((p) => typeof p.text === 'string').map((p) => p.text as string).join('');
      if (msgText && !ev.partial) {
        const m = msgText.match(/([A-Za-z0-9_\-.]+\.xlsx)/);
        if (m) foundDownload = m[1];
      }
      if (!msgText) return;

      // Pure updater: find this turn's bubble by key; partial chunks append
      // (idempotent under StrictMode), final non-partial replaces.
      setMessages((prev) => {
        const idx = prev.findIndex((it) => it.role === 'agent' && it.key === key);
        if (idx === -1) {
          return [...prev, { id: uid(), role: 'agent', key, author, text: msgText, streaming: !!ev.partial, time: nowTime() }];
        }
        const cur = prev[idx] as Extract<Msg, { role: 'agent' }>;
        const copy = prev.slice();
        copy[idx] = { ...cur, text: ev.partial ? cur.text + msgText : msgText, streaming: !!ev.partial };
        return copy;
      });
    };

    try {
      // Display/persist the original text; the model receives a language
      // directive + any @mention routing directive as a prefix (the German-by-
      // default agents answer in the chosen language incl. the ```json values).
      const modelText = agentLanguageDirective(lang) + buildMentionDirective(text) + text;
      for await (const ev of runSSE({ userId, sessionId, text: modelText })) {
        if (ev.error || ev.errorMessage) {
          setError(ev.error || ev.errorMessage || t('chat.unknownError'));
          continue;
        }
        process(ev);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setMessages((prev) => prev.map((it) => (it.role === 'agent' ? { ...it, streaming: false } : it)));
      if (foundDownload) setDownload(basename(foundDownload));
      setBusy(false);
    }
  }

  // Detect an active "@token" or a "/slash" prefix at the start of the input
  // and open the matching picker. Slash commands are anchored at the start
  // (only whitespace allowed before the leading "/") so they don't conflict
  // with paths or fractions further in the text.
  function onInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);
    setHistoryIndex(null); // any keystroke leaves history-browse mode
    const before = val.slice(0, e.target.selectionStart ?? val.length);

    const slashMatch = before.match(/^\s*\/(\w*)$/);
    if (slashMatch) {
      setSlashQuery(slashMatch[1]);
      setSlashOpen(true);
      setSlashIndex(0);
      setMentionOpen(false);
      return;
    }
    setSlashOpen(false);

    const m = before.match(/@(\w*)$/);
    if (m) {
      setMentionQuery(m[1]);
      setMentionOpen(true);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
    }
  }

  // Replace the active "@token" with the chosen handle and close the picker.
  function selectMention(handle: string) {
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? input.length;
    const before = input.slice(0, cursor).replace(/@(\w*)$/, `@${handle} `);
    const next = before + input.slice(cursor);
    setInput(next);
    setMentionOpen(false);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(before.length, before.length);
    });
  }

  // Expand a slash command. Replaces the entire input with the expansion and
  // places the caret at the end so the user can type any required argument.
  function selectSlash(cmd: SlashCommand) {
    const expanded = cmd.expand(lang);
    setInput(expanded);
    setSlashOpen(false);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      el?.focus();
      el?.setSelectionRange(expanded.length, expanded.length);
    });
  }

  // Prefill the input with a quick-action expansion (no auto-send). The user
  // can review/edit, then press Enter to send.
  function applyQuickAction(slash: string) {
    const cmd = SLASH_COMMANDS.find((c) => c.handle === slash);
    if (cmd) selectSlash(cmd);
  }

  const mentionMatches = mentionOpen
    ? MENTION_AGENTS.filter((a) => {
        const q = mentionQuery.toLowerCase();
        return !q || a.handle.toLowerCase().includes(q) || agentMeta(a.key).name[lang].toLowerCase().includes(q);
      })
    : [];

  const slashMatches = slashOpen
    ? SLASH_COMMANDS.filter((c) => {
        const q = slashQuery.toLowerCase();
        return !q || c.handle.toLowerCase().startsWith(q);
      })
    : [];

  // Past user messages (most recent last). Used by ↑/↓ to scroll through the
  // user's own history when the input is empty.
  const userHistory = React.useMemo(
    () => messages.filter((m) => m.role === 'user').map((m) => (m as Extract<Msg, { role: 'user' }>).text),
    [messages],
  );

  const userName = user?.displayName || user?.email || t('chat.you');
  const userAvatar =
    user?.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=3F3F46&color=fff&size=150`;

  const isEmpty = messages.length === 0;
  const lastMsg = messages[messages.length - 1];
  const showThinking = busy && !(lastMsg && lastMsg.role === 'agent' && lastMsg.streaming);
  // Once a handoff card is the last message, the next worker is unambiguously
  // its target — derive the loading indicator from that instead of `activeAgent`,
  // which can briefly retag back to the Team Lead between his transfer events.
  const thinkingAuthor = lastMsg?.role === 'handoff' ? lastMsg.target : activeAgent;

  return (
    <div className="flex flex-col h-full relative w-full">
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-5xl mx-auto px-4 py-6 pb-56 font-sans w-full">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center mt-[18vh] px-2">
              <div className="w-16 h-16 bg-[#18181A] border border-[#27272A] rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                <Users size={32} className="text-[#FAFAFA]" />
              </div>
              <h2 className="text-2xl font-semibold mb-2 text-[#FAFAFA] tracking-tight">{t('chat.emptyTitle')}</h2>
              <p className="text-[#A1A1AA] text-center max-w-md text-[15px] leading-relaxed mb-8">
                {t('chat.emptySubtitle')}
              </p>
              <button
                onClick={loadDemo}
                disabled={busy}
                className="flex items-center justify-center gap-2 w-full max-w-md text-[14px] font-semibold text-black bg-white rounded-xl px-4 py-3 hover:bg-gray-100 disabled:opacity-50 transition-colors mb-4"
              >
                <Play size={16} fill="currentColor" /> {t('chat.playDemo')}
              </button>
              <div className="text-[11px] text-[#71717A] mb-4 uppercase tracking-wider">{t('chat.orRealRequest')}</div>
              <div className="flex flex-col gap-2 w-full max-w-md">
                {SUGGESTIONS[lang].map((s) => (
                  <button
                    key={s}
                    disabled={!sessionId}
                    onClick={() => send(s)}
                    className="text-left text-[14px] text-[#D4D4D8] bg-[#111111] border border-[#27272A] rounded-xl px-4 py-3 hover:border-[#3F3F46] disabled:opacity-50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
              {!sessionId && <p className="text-[#71717A] text-[13px] mt-6">{t('chat.connecting')}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-8 px-2 pb-8">
              {messages.map((m) => {
                if (m.role === 'handoff') return <HandoffMessage key={m.id} target={m.target} time={m.time} />;
                if (m.role === 'tool') return <ToolMessage key={m.id} tool={m.tool} label={m.label} time={m.time} />;
                if (m.role === 'user') {
                  return (
                    <div key={m.id} className="flex flex-col items-end gap-1.5 ml-auto">
                      <div className="flex gap-3">
                        <div className="bg-[#18181A] border border-[#27272A] text-[#FAFAFA] px-4 py-3 rounded-2xl rounded-tr-sm text-[15px] max-w-[500px] shadow-sm leading-relaxed whitespace-pre-wrap">
                          {highlightTokens(m.text)}
                        </div>
                        <div className="w-10 h-10 rounded-full overflow-hidden mt-0.5 shadow-sm bg-[#3F3F46] flex-shrink-0">
                          <img src={userAvatar} alt={userName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[#71717A] mr-11">{m.time}</div>
                    </div>
                  );
                }
                // Agent message: if it carries a visual card (strategy / RSA),
                // split into two bubbles — first the prose, then the visual.
                // Otherwise render as one bubble.
                const oa = isDemo ? undefined : send;
                if (messageHasVisual(m.text)) {
                  return (
                    <React.Fragment key={m.id}>
                      <AgentBubble author={m.author} time={m.time} streaming={m.streaming} text={m.text} onAction={oa} variant="prose" />
                      {/* Soft entrance so the visual bubble doesn't pop into existence
                          the moment the JSON block lands at the end of the stream. */}
                      <div className="animate-fade-in-up">
                        <AgentBubble author={m.author} time={m.time} streaming={false} text={m.text} onAction={oa} variant="visual" />
                      </div>
                    </React.Fragment>
                  );
                }
                return <AgentBubble key={m.id} author={m.author} time={m.time} streaming={m.streaming} text={m.text} onAction={oa} variant="all" />;
              })}

              {/* Next-step CTA: anchored under the last agent message in the
                  chain if its author has a defined successor (LP -> Strategy ->
                  Keywords -> Copywriter -> Output). Hidden during streaming. */}
              {!busy && !isDemo && (() => {
                const last = [...messages].reverse().find((mm) => mm.role === 'agent') as
                  | Extract<Msg, { role: 'agent' }>
                  | undefined;
                if (!last || !NEXT_STEP[last.author]) return null;
                const step = NEXT_STEP[last.author];
                const prompt = lang === 'de' ? step.promptDe : step.promptEn;
                return <NextStepButton currentAuthor={last.author} onClick={() => send(prompt)} />;
              })()}

              {showThinking && <ThinkingIndicator author={thinkingAuthor} />}

              {download && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border bg-[#111111] border-[#27272A] text-[#A78BFA] shadow-sm">
                    <FileDown size={18} strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href={exportUrl(download)}
                      download
                      className="flex items-center gap-2 px-5 py-3 rounded-lg bg-white text-black font-semibold hover:bg-gray-100 transition-colors text-[14px] shadow-sm self-start"
                    >
                      <FileDown size={18} /> {t('chat.downloadExcel')} · {download}
                    </a>
                    <button
                      onClick={handleFileExport}
                      disabled={exportingFile}
                      className="flex items-center gap-2 px-5 py-3 rounded-lg bg-[#105a30] hover:bg-[#1f6f3f] text-white font-semibold transition-colors text-[14px] shadow-sm self-start disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileSpreadsheet size={18} /> {exportingFile ? 'Exportiere...' : 'In Google Sheets öffnen'}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="self-center text-[13px] text-[#FCA5A5] bg-[#2d1417] border border-[#6e2b30] rounded-lg px-4 py-2">
                  {t('chat.error')}: {error}
                </div>
              )}

              <div ref={bottomRef} className="h-4" />
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] via-70% to-transparent pt-16 pb-6 w-full">
        <div className="max-w-5xl mx-auto w-full px-6 pointer-events-auto">

          {/* Quick-action chips — shown only when the input is empty and the
              chat already has messages (the initial empty state already has
              the SUGGESTIONS hero). Pre-fills the slash expansion. */}
          {!input && !isEmpty && (
            <div className="flex flex-wrap gap-2 mb-3 justify-center">
              {QUICK_ACTIONS.map((qa) => {
                const QAIcon = qa.Icon;
                return (
                  <button
                    key={qa.slash}
                    onClick={() => applyQuickAction(qa.slash)}
                    disabled={busy || !sessionId}
                    className="inline-flex items-center gap-1.5 text-[12.5px] text-[#D4D4D8] bg-[#111111] border border-[#27272A] rounded-full px-3 py-1.5 hover:border-[#3F3F46] hover:text-[#FAFAFA] disabled:opacity-50 transition-colors"
                  >
                    <QAIcon size={13} strokeWidth={2.3} />
                    {t(qa.labelKey)}
                  </button>
                );
              })}
            </div>
          )}

          <div className="relative bg-[#111111] border border-[#27272A] rounded-3xl p-1.5 flex flex-col shadow-2xl focus-within:border-[#3F3F46] hover:border-[#3F3F46] transition-colors z-10 w-full min-w-0">
            {mentionOpen && mentionMatches.length > 0 && (
              <div className="absolute bottom-full mb-2 left-2 w-72 max-h-64 overflow-y-auto bg-[#18181A] border border-[#27272A] rounded-xl shadow-2xl z-30 py-1">
                {mentionMatches.map((a, i) => {
                  const meta = agentMeta(a.key);
                  const Icon = meta.Icon;
                  return (
                    <button
                      key={a.key}
                      onMouseDown={(e) => { e.preventDefault(); selectMention(a.handle); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${i === mentionIndex ? 'bg-[#27272A]' : 'hover:bg-[#1F1F1F]'}`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center border flex-shrink-0 ${meta.colorClass}`}>
                        <Icon size={11} strokeWidth={2.5} />
                      </span>
                      <span className="text-[13px] text-[#FAFAFA]">{meta.name[lang]}</span>
                      <span className="text-[11px] text-[#71717A] ml-auto">@{a.handle}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {slashOpen && slashMatches.length > 0 && (
              <div className="absolute bottom-full mb-2 left-2 w-80 max-h-64 overflow-y-auto bg-[#18181A] border border-[#27272A] rounded-xl shadow-2xl z-30 py-1">
                {slashMatches.map((c, i) => {
                  const SIcon = c.Icon;
                  return (
                    <button
                      key={c.handle}
                      onMouseDown={(e) => { e.preventDefault(); selectSlash(c); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${i === slashIndex ? 'bg-[#27272A]' : 'hover:bg-[#1F1F1F]'}`}
                    >
                      <span className="w-5 h-5 rounded-full flex items-center justify-center border border-[#27272A] bg-[#111111] text-[#A1A1AA] flex-shrink-0">
                        <SIcon size={11} strokeWidth={2.5} />
                      </span>
                      <span className="text-[13px] text-[#FAFAFA] font-mono">
                        /{c.handle}{c.argsHint ? <span className="text-[#71717A]"> {c.argsHint}</span> : null}
                      </span>
                      <span className="text-[11px] text-[#71717A] ml-auto truncate">{t(c.descKey)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="relative w-full min-w-0">
              {/* Plain textarea — no backdrop overlay. The earlier live @mention
                  / URL colouring was rendered via a transparent textarea + a
                  colour div behind it; that pattern is fragile because long
                  unwrapped strings and internal scroll desync the two layers.
                  Mentions get colour in the sent user bubbles and through the
                  autocomplete popover; that's enough discovery without the
                  alignment problems. */}
              <textarea
                ref={inputRef}
                value={input}
                onChange={onInputChange}
                onKeyDown={(e) => {
                  // Slash autocomplete takes priority over @mention.
                  if (slashOpen && slashMatches.length) {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex((i) => (i + 1) % slashMatches.length); return; }
                    if (e.key === 'ArrowUp')   { e.preventDefault(); setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length); return; }
                    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectSlash(slashMatches[slashIndex]); return; }
                    if (e.key === 'Escape')    { e.preventDefault(); setSlashOpen(false); return; }
                  }
                  if (mentionOpen && mentionMatches.length) {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex((i) => (i + 1) % mentionMatches.length); return; }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length); return; }
                    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectMention(mentionMatches[mentionIndex].handle); return; }
                    if (e.key === 'Escape') { e.preventDefault(); setMentionOpen(false); return; }
                  }
                  // History nav — only when the input is empty (no autocomplete
                  // open) so it never fights with normal cursor navigation.
                  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && userHistory.length > 0 && !input) {
                    e.preventDefault();
                    if (e.key === 'ArrowUp') {
                      const next = historyIndex === null ? userHistory.length - 1 : Math.max(0, historyIndex - 1);
                      setHistoryIndex(next);
                      setInput(userHistory[next]);
                    } else {
                      // ArrowDown — only meaningful while already browsing.
                      if (historyIndex !== null) {
                        if (historyIndex >= userHistory.length - 1) {
                          setHistoryIndex(null);
                          setInput('');
                        } else {
                          const next = historyIndex + 1;
                          setHistoryIndex(next);
                          setInput(userHistory[next]);
                        }
                      }
                    }
                    return;
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder={sessionId ? t('chat.inputPlaceholder') : t('chat.connecting')}
                disabled={!sessionId}
                className="relative block w-full min-w-0 resize-none outline-none bg-transparent text-[#FAFAFA] placeholder-[#71717A] text-[15px] leading-6 px-4 py-3.5 min-h-[50px] max-h-[400px] overflow-y-auto disabled:opacity-60"
                style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                rows={1}
              />
            </div>
            <div className="flex justify-end items-center px-2 pb-1.5 pt-1">
              <button
                onClick={() => send(input)}
                disabled={busy || !sessionId || !input.trim()}
                className="p-2 bg-white text-black hover:bg-gray-200 rounded-full transition-colors w-8 h-8 flex items-center justify-center disabled:opacity-40"
                title={busy ? t('chat.working') : undefined}
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.5} />}
              </button>
            </div>
          </div>

          <div className="text-center mt-3 text-[11px] text-[#71717A] pointer-events-auto">
            {t('chat.inputHints')}
          </div>
          <div className="text-center mt-1 text-[10px] text-[#52525B] pointer-events-auto">
            {t('chat.disclaimer')}
          </div>
        </div>
      </div>
    </div>
  );
}

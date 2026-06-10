import { useState } from 'react';
import { ChevronRight, Search, Zap, Image as ImageIcon, Video, Target, Wallet, Crosshair, Ban, ArrowRight, Anchor } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Markdown } from './Markdown';
import { parseContent } from '../blocks';
import { useI18n } from '../i18n';

// Map campaign type strings to an icon + accent colour so each strategy card
// gets a visual identifier instead of looking like a label/value table.
function campaignTypeStyle(rawType: string): { Icon: LucideIcon; accent: string; bg: string } {
  const t = (rawType || '').toLowerCase();
  if (t.includes('performance')) return { Icon: Zap, accent: '#FB923C', bg: '#2a1a0a' };
  if (t.includes('display')) return { Icon: ImageIcon, accent: '#A78BFA', bg: '#1c1530' };
  if (t.includes('video') || t.includes('youtube')) return { Icon: Video, accent: '#F472B6', bg: '#2a1426' };
  if (t.includes('shop')) return { Icon: Wallet, accent: '#FBBF24', bg: '#2a200a' };
  return { Icon: Search, accent: '#60A5FA', bg: '#0d1a2e' }; // default: Search
}

// Strategy: tabular view. One row per campaign with the fields a marketer
// scans first — name, channel, budget, bid strategy, targeting. Handles both
// the new schema (daily_budget_eur + budget_share_percent + geo_targeting list)
// and the legacy strings (budget / targeting) so old chats still render.
function StrategyCard({ data }: { data: any }) {
  const { t } = useI18n();
  const campaigns: any[] = data.campaigns || [];
  if (campaigns.length === 0) return null;

  const fmtBudget = (c: any): string => {
    if (typeof c.daily_budget_eur === 'number') {
      const share = typeof c.budget_share_percent === 'number' ? ` · ${c.budget_share_percent}%` : '';
      return `${c.daily_budget_eur} €/Tag${share}`;
    }
    return String(c.budget || '');
  };

  const fmtTargeting = (c: any): string => {
    if (Array.isArray(c.geo_targeting) && c.geo_targeting.length) return c.geo_targeting.join(', ');
    if (Array.isArray(data.geo_targeting) && data.geo_targeting.length && c.geo_targeting === undefined) {
      return data.geo_targeting.join(', ');
    }
    return String(c.targeting || '');
  };

  return (
    <div className="mt-3 bg-[#0A0A0A] border border-[#27272A] rounded-xl overflow-hidden">
      <table className="w-full text-[13px] text-left">
        <thead className="bg-[#111111] border-b border-[#27272A]">
          <tr>
            <th className="px-4 py-2.5 font-semibold text-[#A1A1AA] uppercase text-[10px] tracking-wider">{t('cards.campaign')}</th>
            <th className="px-4 py-2.5 font-semibold text-[#A1A1AA] uppercase text-[10px] tracking-wider w-[110px]">{t('cards.type')}</th>
            <th className="px-4 py-2.5 font-semibold text-[#A1A1AA] uppercase text-[10px] tracking-wider w-[150px]">{t('cards.budget')}</th>
            <th className="px-4 py-2.5 font-semibold text-[#A1A1AA] uppercase text-[10px] tracking-wider">{t('cards.bidStrategy')}</th>
            <th className="px-4 py-2.5 font-semibold text-[#A1A1AA] uppercase text-[10px] tracking-wider w-[120px]">{t('cards.targeting')}</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c, i) => {
            const { Icon, accent } = campaignTypeStyle(c.campaign_type || '');
            return (
              <tr key={i} className="border-t border-[#1F1F1F]">
                <td className="px-4 py-2.5 text-[#FAFAFA] font-medium">{c.name}</td>
                <td className="px-4 py-2.5">
                  {c.campaign_type ? (
                    <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: accent }}>
                      <Icon size={12} strokeWidth={2.3} />
                      {c.campaign_type}
                    </span>
                  ) : (
                    <span className="text-[#52525B]">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[#D4D4D8]">{fmtBudget(c) || <span className="text-[#52525B]">—</span>}</td>
                <td className="px-4 py-2.5 text-[#D4D4D8]">{c.bid_strategy || <span className="text-[#52525B]">—</span>}</td>
                <td className="px-4 py-2.5 text-[#D4D4D8]">{fmtTargeting(c) || <span className="text-[#52525B]">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CharRow({ text, limit }: { text: string; limit: number }) {
  const len = text.length;
  const ok = len <= limit;
  return (
    <div className="flex items-center justify-between gap-3 text-[13px] bg-[#0A0A0A] border border-[#27272A] rounded-lg px-3 py-2">
      <span className="text-[#D4D4D8] truncate">{text}</span>
      <span className={`flex-shrink-0 text-[12px] font-semibold ${ok ? 'text-[#34D399]' : 'text-[#F87171]'}`}>
        {len}/{limit}
      </span>
    </div>
  );
}

// One ad group: SERP preview (always visible) + a collapsible character-count
// validation table. The preview shows ONE headline per RSA position (Pos 1/2/3),
// not the first three headlines of position 1.
function AdGroupBlock({ g }: { g: any }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  // Headlines may be grouped by RSA position (positions:[{label,headlines[]}])
  // or a flat headlines[] array (fallback).
  const hasPositions = Array.isArray(g.positions) && g.positions.length > 0;
  const positions: any[] = hasPositions ? g.positions : [];
  const headlines: string[] = hasPositions ? positions.flatMap((p) => p.headlines || []) : g.headlines || [];
  const descriptions: string[] = g.descriptions || [];

  // Preview: first headline of each of the first three positions (one per
  // position). Flat fallback: first three headlines.
  const previewHeadlines = hasPositions
    ? positions.slice(0, 3).map((p) => (p.headlines && p.headlines[0]) || '').filter(Boolean)
    : headlines.slice(0, 3);

  return (
    <div>
      <div className="text-[12px] text-[#71717A] uppercase tracking-wider font-semibold mb-2">{g.name}</div>
      <div className="p-5 bg-white border border-[#E4E4E7] rounded-xl shadow-sm">
        <div className="text-[#006621] text-[14px] mb-1 font-medium">{t('cards.ad')} · {g.url || 'www.example.com'}</div>
        <div className="text-[#1A0DAB] text-[18px] mb-2 font-medium leading-snug">
          {previewHeadlines.join(' | ') || t('cards.headlineFallback')}
        </div>
        <div className="text-[#4D5156] text-[14px] leading-relaxed">{descriptions.slice(0, 2).join(' ')}</div>
      </div>

      {(headlines.length > 0 || descriptions.length > 0) && (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
          >
            <ChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
            {t('cards.charCheck')} · {headlines.length} {t('cards.headlines')}, {descriptions.length} {t('cards.descriptions')}
          </button>

          {open && (
            <div className="mt-2">
              {hasPositions
                ? positions.map((pos, pi) =>
                    pos.headlines && pos.headlines.length ? (
                      <div key={pi} className="mt-3">
                        <div className="text-[11px] text-[#A1A1AA] uppercase tracking-wider font-semibold mb-1.5">
                          {t('cards.position')} {pi + 1}
                          {pos.label ? ` · ${pos.label}` : ''}
                        </div>
                        <div className="space-y-1.5">
                          {pos.headlines.map((h: string, j: number) => <CharRow key={j} text={h} limit={30} />)}
                        </div>
                      </div>
                    ) : null,
                  )
                : headlines.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[11px] text-[#A1A1AA] uppercase tracking-wider font-semibold mb-1.5">{t('cards.headlines')}</div>
                      <div className="space-y-1.5">
                        {headlines.map((h, j) => <CharRow key={j} text={h} limit={30} />)}
                      </div>
                    </div>
                  )}

              {descriptions.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] text-[#A1A1AA] uppercase tracking-wider font-semibold mb-1.5">{t('cards.descriptions')}</div>
                  <div className="space-y-1.5">
                    {descriptions.map((d, j) => <CharRow key={j} text={d} limit={90} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Ad copy: one block per ad group (SERP preview + collapsible 30/90 validation).
function AdsCard({ data }: { data: any }) {
  const groups: any[] = data.ad_groups || [];
  return (
    <div className="mt-3 space-y-6">
      {groups.map((g, i) => (
        <AdGroupBlock key={i} g={g} />
      ))}
    </div>
  );
}

// Interactive account picker: the campaign_builder_agent emits
// {type:"account_picker", accounts:[{id,name}]} and we render a dropdown. The
// choice is sent back as the next user message via onAction.
function AccountPickerCard({ data, onAction }: { data: any; onAction?: (msg: string) => void }) {
  const { t } = useI18n();
  const accounts: any[] = data.accounts || [];
  // data.selected pre-fills the dropdown (used by the scripted demo); real runs
  // start empty.
  const [sel, setSel] = useState(data.selected || '');
  const [done, setDone] = useState(false);

  if (accounts.length === 0) return null;

  const pick = () => {
    const acc = accounts.find((a) => a.id === sel);
    if (!acc || !onAction) return;
    setDone(true);
    onAction(`${t('chat.targetAccount')}: ${acc.name} · ${acc.id}`);
  };

  return (
    <div className="mt-3 flex flex-col gap-2 max-w-md">
      <select
        value={sel}
        onChange={(e) => setSel(e.target.value)}
        disabled={done || !onAction}
        className="bg-[#0A0A0A] border border-[#27272A] rounded-lg px-3 py-2.5 text-[14px] text-[#FAFAFA] outline-none focus:border-[#3F3F46] disabled:opacity-60"
      >
        <option value="">{t('cards.chooseAccount')}</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {a.id}
          </option>
        ))}
      </select>
      <button
        onClick={pick}
        disabled={!sel || done || !onAction}
        className="self-start text-[14px] font-semibold text-black bg-white rounded-lg px-4 py-2 hover:bg-gray-100 disabled:opacity-40 transition-colors"
      >
        {t('cards.select')}
      </button>
    </div>
  );
}

// Interactive name editor: {type:"name_editor", campaigns:[{name, ad_groups:[…]}]}.
// Renders an input per campaign + per ad group; on Apply, sends a clear rename
// list back as the next user message so the agent uses the chosen names when
// calling create_search_campaigns.
function NameEditorCard({ data, onAction }: { data: any; onAction?: (msg: string) => void }) {
  const { t } = useI18n();
  const initial: { name: string; ad_groups: string[] }[] = (data.campaigns || []).map((c: any) => ({
    name: String(c.name || ''),
    ad_groups: Array.isArray(c.ad_groups) ? c.ad_groups.map((g: any) => String(g)) : [],
  }));
  const [campaigns, setCampaigns] = useState(initial);
  const [done, setDone] = useState(false);

  if (campaigns.length === 0) return null;

  const setCampName = (ci: number, name: string) =>
    setCampaigns((cs) => cs.map((c, i) => (i === ci ? { ...c, name } : c)));
  const setAgName = (ci: number, gi: number, name: string) =>
    setCampaigns((cs) =>
      cs.map((c, i) => (i === ci ? { ...c, ad_groups: c.ad_groups.map((g, j) => (j === gi ? name : g)) } : c)),
    );

  const submit = () => {
    if (!onAction) return;
    const lines: string[] = [`${t('cards.nameEditorTitle')}:`, ''];
    initial.forEach((orig, i) => {
      const cur = campaigns[i];
      lines.push(`${t('cards.campaignName')}: "${orig.name}" → "${cur.name}"`);
      orig.ad_groups.forEach((agOrig, j) => {
        lines.push(`- ${t('cards.adGroupName')}: "${agOrig}" → "${cur.ad_groups[j] ?? agOrig}"`);
      });
      lines.push('');
    });
    lines.push(t('cards.nameEditorFooter'));
    setDone(true);
    onAction(lines.join('\n').trim());
  };

  return (
    <div className="mt-3 flex flex-col gap-3 max-w-md">
      {campaigns.map((c, ci) => (
        <div key={ci} className="bg-[#0A0A0A] border border-[#27272A] rounded-lg p-3 flex flex-col gap-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-[#A1A1AA] uppercase tracking-wider font-semibold">{t('cards.campaignName')}</span>
            <input
              type="text"
              value={c.name}
              onChange={(e) => setCampName(ci, e.target.value)}
              disabled={done || !onAction}
              className="bg-[#0A0A0A] border border-[#27272A] rounded px-2.5 py-1.5 text-[13.5px] text-[#FAFAFA] outline-none focus:border-[#3F3F46] disabled:opacity-60"
            />
          </label>
          {c.ad_groups.length > 0 && (
            <div className="ml-3 flex flex-col gap-1.5 border-l-2 border-[#27272A] pl-3">
              {c.ad_groups.map((g, gi) => (
                <label key={gi} className="flex flex-col gap-1">
                  <span className="text-[11px] text-[#71717A]">{t('cards.adGroupName')}</span>
                  <input
                    type="text"
                    value={g}
                    onChange={(e) => setAgName(ci, gi, e.target.value)}
                    disabled={done || !onAction}
                    className="bg-[#0A0A0A] border border-[#27272A] rounded px-2.5 py-1.5 text-[13.5px] text-[#FAFAFA] outline-none focus:border-[#3F3F46] disabled:opacity-60"
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
      <button
        onClick={submit}
        disabled={done || !onAction}
        className="self-start text-[14px] font-semibold text-black bg-white rounded-lg px-4 py-2 hover:bg-gray-100 disabled:opacity-40 transition-colors"
      >
        {t('cards.nameEditorSubmit')}
      </button>
    </div>
  );
}

// Interactive confirmation: {type:"confirm"} -> two buttons. The chosen answer
// is sent back as the next user message; the agent already knows the account.
function ConfirmCard({ onAction }: { onAction?: (msg: string) => void }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  const answer = (msg: string) => {
    if (!onAction) return;
    setDone(true);
    onAction(msg);
  };
  return (
    <div className="mt-3 flex gap-2">
      <button
        onClick={() => answer(t('chat.confirmSetup'))}
        disabled={done || !onAction}
        className="text-[14px] font-semibold text-black bg-white rounded-lg px-4 py-2 hover:bg-gray-100 disabled:opacity-40 transition-colors"
      >
        {t('cards.confirm')}
      </button>
      <button
        onClick={() => answer(t('cards.cancel'))}
        disabled={done || !onAction}
        className="text-[14px] font-medium text-[#D4D4D8] bg-[#18181A] border border-[#27272A] rounded-lg px-4 py-2 hover:bg-[#27272A] disabled:opacity-40 transition-colors"
      >
        {t('cards.cancel')}
      </button>
    </div>
  );
}

// Match-type colour mapping. Same logic as the keyword agent's match-type
// hierarchy: EXACT is highest ROI (green), PHRASE is mid (blue), BROAD is
// discovery (amber).
function matchTypeStyle(mt: string): { bg: string; text: string; border: string } {
  switch ((mt || '').toUpperCase()) {
    case 'EXACT':
      return { bg: 'bg-[#052e16]', text: 'text-[#34D399]', border: 'border-[#0d4a2f]' };
    case 'PHRASE':
      return { bg: 'bg-[#0d1a2e]', text: 'text-[#60A5FA]', border: 'border-[#1e3a5f]' };
    case 'BROAD':
      return { bg: 'bg-[#2a200a]', text: 'text-[#FBBF24]', border: 'border-[#3f3015]' };
    default:
      return { bg: 'bg-[#18181A]', text: 'text-[#A1A1AA]', border: 'border-[#27272A]' };
  }
}

// Flatten the nested keywords payload into one row per keyword. Handles both
// the new shape ({campaigns:[{name, ad_groups:[{name, keywords}]}]}) and the
// legacy flat shape ({clusters:[{name, keywords}]}) for older chats. The
// "Kampagne" column always carries the most user-meaningful label: for the new
// shape "Campaign · Ad-Group", for the legacy shape the cluster name alone.
type KwRow = { campaign: string; keyword: string; match_type: string; use_in_copy: boolean };

function flattenKeywords(data: any): { rows: KwRow[]; campaignNegatives: { campaign: string; negs: string[] }[]; adGroupNegatives: { label: string; negs: string[] }[] } {
  const rows: KwRow[] = [];
  const campaignNegatives: { campaign: string; negs: string[] }[] = [];
  const adGroupNegatives: { label: string; negs: string[] }[] = [];

  if (Array.isArray(data.campaigns)) {
    for (const c of data.campaigns) {
      const cName = String(c.name || '');
      if (Array.isArray(c.campaign_negatives) && c.campaign_negatives.length) {
        campaignNegatives.push({ campaign: cName, negs: c.campaign_negatives.map(String) });
      }
      for (const ag of c.ad_groups || []) {
        const agName = String(ag.name || '');
        const label = cName && agName ? `${cName} · ${agName}` : cName || agName;
        for (const kw of ag.keywords || []) {
          const text = typeof kw === 'string' ? kw : String(kw.keyword || '');
          const mt = typeof kw === 'string' ? '' : String(kw.match_type || '');
          // headline-anchor flag: true if the agent explicitly marked the
          // keyword as Säule-1 material for the copywriter. Legacy keyword
          // strings (no object) default to false.
          const uic = typeof kw === 'object' && kw !== null ? kw.use_in_copy === true : false;
          if (text) rows.push({ campaign: label, keyword: text, match_type: mt, use_in_copy: uic });
        }
        if (Array.isArray(ag.ad_group_negatives) && ag.ad_group_negatives.length) {
          adGroupNegatives.push({ label, negs: ag.ad_group_negatives.map(String) });
        }
      }
    }
  } else if (Array.isArray(data.clusters)) {
    for (const cl of data.clusters) {
      const name = String(cl.name || '');
      for (const kw of cl.keywords || []) {
        const text = typeof kw === 'string' ? kw : String(kw.keyword || '');
        const mt = typeof kw === 'string' ? '' : String(kw.match_type || '');
        const uic = typeof kw === 'object' && kw !== null ? kw.use_in_copy === true : false;
        if (text) rows.push({ campaign: name, keyword: text, match_type: mt, use_in_copy: uic });
      }
    }
  }
  return { rows, campaignNegatives, adGroupNegatives };
}

// Keywords card — table view: Kampagne / Keyword / Match Type. Each row is one
// keyword. The campaign column is visually grouped (label shown on first row
// of each group only) so the table reads naturally without rowspan hacks.
// Negatives are rendered below the table as separate compact sections.
function KeywordCard({ data }: { data: any }) {
  const { t } = useI18n();
  const { rows, campaignNegatives, adGroupNegatives } = flattenKeywords(data);
  if (rows.length === 0) return null;

  return (
    <div className="mt-3 bg-[#0A0A0A] border border-[#27272A] rounded-xl overflow-hidden">
      <table className="w-full text-[13px] text-left">
        <thead className="bg-[#111111] border-b border-[#27272A]">
          <tr>
            <th className="px-4 py-2.5 font-semibold text-[#A1A1AA] uppercase text-[10px] tracking-wider">{t('cards.campaign')}</th>
            <th className="px-4 py-2.5 font-semibold text-[#A1A1AA] uppercase text-[10px] tracking-wider">{t('cards.keyword')}</th>
            <th className="px-4 py-2.5 font-semibold text-[#A1A1AA] uppercase text-[10px] tracking-wider w-[100px]">{t('cards.matchType')}</th>
            <th className="px-4 py-2.5 font-semibold text-[#A1A1AA] uppercase text-[10px] tracking-wider w-[80px]" title={t('cards.anchorTooltip')}>{t('cards.anchor')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const sameAsPrev = i > 0 && rows[i - 1].campaign === r.campaign;
            const s = matchTypeStyle(r.match_type);
            return (
              <tr key={i} className="border-t border-[#1F1F1F]">
                <td className={`px-4 py-2 align-top ${sameAsPrev ? 'text-[#52525B]' : 'text-[#FAFAFA] font-medium'}`}>
                  {sameAsPrev ? '↳' : r.campaign}
                </td>
                <td className="px-4 py-2 text-[#D4D4D8]">{r.keyword}</td>
                <td className="px-4 py-2">
                  {r.match_type ? (
                    <span className={`inline-flex items-center text-[11px] font-semibold rounded px-2 py-0.5 border ${s.bg} ${s.text} ${s.border}`}>
                      {r.match_type.toUpperCase()}
                    </span>
                  ) : (
                    <span className="text-[#52525B]">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {r.use_in_copy ? (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold rounded px-1.5 py-0.5 border bg-[#1f1428] text-[#A78BFA] border-[#2e1f3a]"
                      title={t('cards.anchorCopyTooltip')}
                    >
                      <Anchor size={10} strokeWidth={2.5} />
                      Copy
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#52525B]" title={t('cards.bidOnlyTooltip')}>{t('cards.bidOnly')}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {(adGroupNegatives.length > 0 || campaignNegatives.length > 0) && (
        <div className="border-t border-[#27272A] p-4 space-y-3">
          {adGroupNegatives.map((g, i) => (
            <div key={`ag-${i}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Ban size={11} className="text-[#F87171]" />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#A1A1AA]">{g.label} — {t('cards.adGroupNegatives')}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {g.negs.map((n, j) => (
                  <span key={j} className="text-[11px] text-[#FCA5A5] bg-[#2d1417] border border-[#6e2b30]/40 rounded px-1.5 py-0.5">{n}</span>
                ))}
              </div>
            </div>
          ))}
          {campaignNegatives.map((g, i) => (
            <div key={`c-${i}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Ban size={11} className="text-[#F87171]" />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#A1A1AA]">{g.campaign} — {t('cards.campaignNegatives')}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {g.negs.map((n, j) => (
                  <span key={j} className="text-[11px] text-[#FCA5A5] bg-[#2d1417] border border-[#6e2b30]/40 rounded px-1.5 py-0.5">{n}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Intent-stage colour mapping used by the SearchIntentCard. Mirrors the
// match-type colour vocabulary so the user reads the page as one consistent
// taxonomy across all visual cards: green = high-intent / money, blue =
// mid / research, amber = low-intent / discovery, red = negative.
function intentStageStyle(stage: string): { bg: string; text: string; border: string; label: string } {
  switch (stage) {
    case 'decision':
      return { bg: 'bg-[#052e16]', text: 'text-[#34D399]', border: 'border-[#0d4a2f]', label: 'Decision' };
    case 'consideration':
      return { bg: 'bg-[#0d1a2e]', text: 'text-[#60A5FA]', border: 'border-[#1e3a5f]', label: 'Consideration' };
    case 'awareness':
      return { bg: 'bg-[#2a200a]', text: 'text-[#FBBF24]', border: 'border-[#3f3015]', label: 'Awareness' };
    case 'negative':
      return { bg: 'bg-[#2d1417]', text: 'text-[#F87171]', border: 'border-[#6e2b30]', label: 'Negative' };
    default:
      return { bg: 'bg-[#18181A]', text: 'text-[#A1A1AA]', border: 'border-[#27272A]', label: '' };
  }
}

// Search-Intent card — visually a stack of Google-style "search bar" mocks,
// one per seed, with the real autocomplete suggestions listed underneath as
// dropdown items. Each suggestion gets a small intent-stage badge so the
// user can scan the demand split at a glance. Followed by a demand bar
// chart, top-modifier chips, negative-signal chips and the recommended
// ad-group mapping.
//
// The component derives the stage badge per suggestion by JOINing the raw
// autocomplete entries against `queries_by_stage` and `negative_query_signals`
// — that way every visible row carries both its source seed AND its
// classification without the agent having to nest the structure itself.
function SearchIntentCard({ data }: { data: any }) {
  const { t } = useI18n();
  const raw: Record<string, string[]> = (data.raw_autocomplete && typeof data.raw_autocomplete === 'object') ? data.raw_autocomplete : {};
  const stages: Record<string, { query: string; format?: string; source_seed?: string }[]> = data.queries_by_stage || {};
  const negatives: { query: string; reason?: string }[] = Array.isArray(data.negative_query_signals) ? data.negative_query_signals : [];
  const modifiers: string[] = Array.isArray(data.top_modifiers) ? data.top_modifiers : [];
  const mapping: { query_stage?: string; target_ad_group?: string; rationale?: string }[] =
    Array.isArray(data.recommended_ad_group_mapping) ? data.recommended_ad_group_mapping : [];

  // query (lowercased) -> stage / format. Used to badge each suggestion.
  const classifyMap = new Map<string, { stage: string; format?: string }>();
  for (const stageKey of ['awareness', 'consideration', 'decision'] as const) {
    for (const q of stages[stageKey] || []) {
      if (q && typeof q.query === 'string') {
        classifyMap.set(q.query.toLowerCase(), { stage: stageKey, format: q.format });
      }
    }
  }
  for (const n of negatives) {
    if (n && typeof n.query === 'string' && !classifyMap.has(n.query.toLowerCase())) {
      classifyMap.set(n.query.toLowerCase(), { stage: 'negative' });
    }
  }

  // Demand distribution per stage. Computed from queries_by_stage so it
  // reflects the agent's own classification, not the raw suggestion counts.
  const stageCounts = {
    awareness: (stages.awareness || []).length,
    consideration: (stages.consideration || []).length,
    decision: (stages.decision || []).length,
  };
  const total = stageCounts.awareness + stageCounts.consideration + stageCounts.decision;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const seedKeys = Object.keys(raw);

  return (
    <div className="mt-3 bg-[#0A0A0A] border border-[#27272A] rounded-xl overflow-hidden">
      {/* Header strip — the "live from Google" claim is part of the value
          proposition; explicit so the user reads it as real data. */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#111111] border-b border-[#27272A]">
        <div className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF] animate-pulse" />
        <span className="text-[11px] uppercase tracking-wider font-semibold text-[#2DD4BF]">{t('cards.realFromGoogle')}</span>
      </div>

      {/* Search-bar mocks per seed */}
      <div className="p-4 space-y-4">
        {seedKeys.length === 0 && (
          <div className="text-[12px] text-[#71717A]">Keine Autocomplete-Daten vorhanden.</div>
        )}
        {seedKeys.map((seed) => {
          const suggestions = Array.isArray(raw[seed]) ? raw[seed] : [];
          return (
            <div key={seed} className="bg-[#111111] border border-[#27272A] rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-3 py-2 border-b border-[#27272A]">
                <Search size={14} className="text-[#A1A1AA] flex-shrink-0" />
                <span className="text-[13.5px] text-[#FAFAFA] truncate flex-1">{seed}</span>
                <span className="text-[10px] text-[#71717A]">{suggestions.length} Suggestions</span>
              </div>
              {suggestions.length === 0 ? (
                <div className="px-3 py-2 text-[11.5px] text-[#71717A]">Keine Suggestions.</div>
              ) : (
                <div className="divide-y divide-[#1F1F1F]">
                  {suggestions.map((sug, i) => {
                    const cls = classifyMap.get(sug.toLowerCase());
                    const s = cls ? intentStageStyle(cls.stage) : intentStageStyle('');
                    return (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#161616] transition-colors">
                        <Search size={11} className="text-[#52525B] flex-shrink-0" />
                        <span className="text-[12.5px] text-[#D4D4D8] flex-1 truncate">{sug}</span>
                        {cls && (
                          <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border ${s.bg} ${s.text} ${s.border}`}>
                            {cls.format || s.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Demand distribution bar */}
      {total > 0 && (
        <div className="px-4 py-3 border-t border-[#1F1F1F]">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#A1A1AA] mb-2">{t('cards.demandDistribution')}</div>
          <div className="space-y-1.5">
            {([
              ['awareness', stageCounts.awareness, '#FBBF24'],
              ['consideration', stageCounts.consideration, '#60A5FA'],
              ['decision', stageCounts.decision, '#34D399'],
            ] as const).map(([key, count, color]) => (
              <div key={key} className="flex items-center gap-3 text-[12px]">
                <span className="w-28 text-[#A1A1AA] capitalize">{key}</span>
                <div className="flex-1 bg-[#27272A] h-1.5 rounded-full overflow-hidden">
                  <div className="h-full transition-all" style={{ width: `${pct(count)}%`, backgroundColor: color }} />
                </div>
                <span className="w-16 text-right font-mono text-[#D4D4D8]">{pct(count)}% · {count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top modifiers */}
      {modifiers.length > 0 && (
        <div className="px-4 py-3 border-t border-[#1F1F1F]">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#A1A1AA] mb-1.5">{t('cards.topModifiers')}</div>
          <div className="flex flex-wrap gap-1">
            {modifiers.map((m, i) => (
              <span key={i} className="text-[11px] text-[#D4D4D8] bg-[#18181A] border border-[#27272A] rounded px-1.5 py-0.5">{m}</span>
            ))}
          </div>
        </div>
      )}

      {/* Negative signals */}
      {negatives.length > 0 && (
        <div className="px-4 py-3 border-t border-[#1F1F1F]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Ban size={11} className="text-[#F87171]" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[#A1A1AA]">{t('cards.negativeSignals')}</span>
          </div>
          <div className="space-y-1">
            {negatives.map((n, i) => (
              <div key={i} className="flex items-start gap-2 text-[11.5px]">
                <span className="text-[#FCA5A5] bg-[#2d1417] border border-[#6e2b30]/40 rounded px-1.5 py-0.5 font-mono whitespace-nowrap flex-shrink-0">{n.query}</span>
                {n.reason && <span className="text-[#71717A] leading-snug">{n.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ad-group mapping */}
      {mapping.length > 0 && (
        <div className="px-4 py-3 border-t border-[#1F1F1F]">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#A1A1AA] mb-1.5">{t('cards.adGroupMapping')}</div>
          <div className="space-y-1.5">
            {mapping.map((m, i) => {
              const s = intentStageStyle((m.query_stage || '').toLowerCase());
              return (
                <div key={i} className="flex items-start gap-2 text-[12px]">
                  {m.query_stage && (
                    <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border whitespace-nowrap flex-shrink-0 ${s.bg} ${s.text} ${s.border}`}>
                      {m.query_stage}
                    </span>
                  )}
                  <ArrowRight size={11} className="text-[#52525B] mt-1 flex-shrink-0" />
                  <span className="text-[#FAFAFA] font-medium whitespace-nowrap flex-shrink-0">{m.target_ad_group}</span>
                  {m.rationale && <span className="text-[#71717A] leading-snug">— {m.rationale}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CardRenderer({ card, onAction }: { card: any; onAction?: (msg: string) => void }) {
  switch (card.type) {
    case 'strategy':
      return <StrategyCard data={card} />;
    case 'keywords':
      return <KeywordCard data={card} />;
    case 'search_intent':
      return <SearchIntentCard data={card} />;
    case 'ads':
      return <AdsCard data={card} />;
    case 'account_picker':
      return <AccountPickerCard data={card} onAction={onAction} />;
    case 'name_editor':
      return <NameEditorCard data={card} onAction={onAction} />;
    case 'confirm':
      return <ConfirmCard onAction={onAction} />;
    default:
      return null;
  }
}

// Card types rendered as the standalone "visual" bubble (so a message can be
// split: text on the left, visual artefacts on the right). Add new visual
// types here.
const VISUAL_CARD_TYPES = new Set(['ads', 'strategy', 'keywords', 'search_intent']);

// Renders an agent message: prose as Markdown + any embedded structured cards.
// onAction lets interactive cards (account picker, confirm) send a follow-up
// user message. `show` lets the caller split a message into a text bubble and a
// visual bubble:
//   - 'prose'  = markdown + non-visual cards (interactive pickers etc.)
//   - 'visual' = only the visual cards (strategy/ads) — no prose
//   - 'all'    = everything (default)
export function MessageContent({
  text,
  onAction,
  show = 'all',
}: {
  text: string;
  onAction?: (msg: string) => void;
  show?: 'all' | 'prose' | 'visual';
}) {
  const { markdown, cards } = parseContent(text);
  const visibleCards = cards.filter((c: any) =>
    show === 'all' ? true : show === 'visual' ? VISUAL_CARD_TYPES.has(c.type) : !VISUAL_CARD_TYPES.has(c.type),
  );
  return (
    <>
      {show !== 'visual' && markdown && <Markdown text={markdown} />}
      {visibleCards.map((c, i) => (
        <CardRenderer key={i} card={c} onAction={onAction} />
      ))}
    </>
  );
}

// Exported for ChatArea: which message texts contain a visual-bubble card?
// Used to decide whether to render an agent message as one or two bubbles.
export function messageHasVisual(text: string): boolean {
  return parseContent(text).cards.some((c: any) => VISUAL_CARD_TYPES.has(c.type));
}

// Pull a customer/product label out of an agent message. The landing_page_agent
// emits a "landing_page_analysis" card with customer/product at the top level
// (and other fields used downstream). Falls back to the older "customer_label"
// type for any old conversations still in MongoDB. Used to set the chat title.
export function messageCustomerLabel(text: string): { customer: string; product: string } | null {
  const cards = parseContent(text).cards;
  const card = cards.find((c: any) => c.type === 'landing_page_analysis') ||
               cards.find((c: any) => c.type === 'customer_label');
  if (!card) return null;
  const customer = String(card.customer || '').trim();
  const product = String(card.product || '').trim();
  if (!customer && !product) return null;
  return { customer, product };
}

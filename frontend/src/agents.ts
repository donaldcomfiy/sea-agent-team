import {
  Users,
  LayoutTemplate,
  Target,
  Search,
  PenTool,
  Languages,
  Gauge,
  CheckCircle,
  Rocket,
  Compass,
  Bot,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Lang } from './i18n';

// Display name per language. Most agent names are identical in EN/DE; only a
// few are actually translated (LP Analysis, Strategy, Translation, Search Terms).
type LocalizedName = Record<Lang, string>;

export interface AgentMeta {
  name: LocalizedName;
  Icon: LucideIcon;
  // Tailwind classes for the avatar circle and the agent name. Written as full
  // literal strings (NOT built via interpolation) so Tailwind's scanner detects
  // every arbitrary color value.
  colorClass: string;
  nameColorClass: string;
  // Border color class used for the avatar img — matches the agent's text
  // accent color. Kept as a separate literal field so Tailwind picks it up.
  borderColorClass: string;
  // Optional avatar image (e.g. '/team_lead.jpg' from public/). When set, the
  // bubble renders the image instead of the lucide Icon.
  avatarUrl?: string;
}

const REGISTRY: Record<string, AgentMeta> = {
  sea_team_lead: { name: { en: 'Team Lead', de: 'Team Lead' }, Icon: Users, colorClass: 'bg-white text-black border-transparent', nameColorClass: 'text-[#FAFAFA]', borderColorClass: 'border-[#27272A]', avatarUrl: '/team_lead.jpg' },
  landing_page_agent: { name: { en: 'LP Analysis', de: 'LP Analyse' }, Icon: LayoutTemplate, colorClass: 'bg-[#111111] border-[#27272A] text-[#60A5FA]', nameColorClass: 'text-[#60A5FA]', borderColorClass: 'border-[#60A5FA]', avatarUrl: '/lp_analyse.jpg' },
  strategy_agent: { name: { en: 'Strategy', de: 'Strategie' }, Icon: Target, colorClass: 'bg-[#111111] border-[#27272A] text-[#34D399]', nameColorClass: 'text-[#34D399]', borderColorClass: 'border-[#34D399]', avatarUrl: '/strategie.jpg' },
  search_intent_agent: { name: { en: 'Search Intent', de: 'Suchverhalten' }, Icon: Compass, colorClass: 'bg-[#111111] border-[#27272A] text-[#2DD4BF]', nameColorClass: 'text-[#2DD4BF]', borderColorClass: 'border-[#2DD4BF]', avatarUrl: '/searchintent.jpg' },
  keyword_agent: { name: { en: 'Keyword', de: 'Keyword' }, Icon: Search, colorClass: 'bg-[#111111] border-[#27272A] text-[#FBBF24]', nameColorClass: 'text-[#FBBF24]', borderColorClass: 'border-[#FBBF24]', avatarUrl: '/keyword.jpg' },
  copywriter_agent: { name: { en: 'Copywriter', de: 'Copywriter' }, Icon: PenTool, colorClass: 'bg-[#111111] border-[#27272A] text-[#F472B6]', nameColorClass: 'text-[#F472B6]', borderColorClass: 'border-[#F472B6]', avatarUrl: '/copywri.jpg' },
  translator_agent: { name: { en: 'Translation', de: 'Übersetzung' }, Icon: Languages, colorClass: 'bg-[#111111] border-[#27272A] text-[#38BDF8]', nameColorClass: 'text-[#38BDF8]', borderColorClass: 'border-[#38BDF8]' },
  optimizer_team_lead: { name: { en: 'Optimizer Lead', de: 'Optimizer Lead' }, Icon: Gauge, colorClass: 'bg-[#111111] border-[#27272A] text-[#A78BFA]', nameColorClass: 'text-[#A78BFA]', borderColorClass: 'border-[#A78BFA]' },
  quality_score_optimizer: { name: { en: 'Quality Score', de: 'Quality Score' }, Icon: Gauge, colorClass: 'bg-[#111111] border-[#27272A] text-[#34D399]', nameColorClass: 'text-[#34D399]', borderColorClass: 'border-[#34D399]' },
  ctr_booster_optimizer: { name: { en: 'CTR Booster', de: 'CTR Booster' }, Icon: Gauge, colorClass: 'bg-[#111111] border-[#27272A] text-[#FBBF24]', nameColorClass: 'text-[#FBBF24]', borderColorClass: 'border-[#FBBF24]' },
  conversion_optimizer: { name: { en: 'Conversion', de: 'Conversion' }, Icon: Gauge, colorClass: 'bg-[#111111] border-[#27272A] text-[#F472B6]', nameColorClass: 'text-[#F472B6]', borderColorClass: 'border-[#F472B6]' },
  optimizer_keyword_agent: { name: { en: 'Keyword Opt', de: 'Keyword-Opt' }, Icon: Search, colorClass: 'bg-[#111111] border-[#27272A] text-[#60A5FA]', nameColorClass: 'text-[#60A5FA]', borderColorClass: 'border-[#60A5FA]' },
  optimizer_searchterms_agent: { name: { en: 'Search Terms', de: 'Suchbegriffe' }, Icon: Search, colorClass: 'bg-[#111111] border-[#27272A] text-[#38BDF8]', nameColorClass: 'text-[#38BDF8]', borderColorClass: 'border-[#38BDF8]' },
  excel_exporter_agent: { name: { en: 'Output', de: 'Output' }, Icon: CheckCircle, colorClass: 'bg-[#111111] border-[#27272A] text-[#A78BFA]', nameColorClass: 'text-[#A78BFA]', borderColorClass: 'border-[#A78BFA]' },
  campaign_builder_agent: { name: { en: 'Campaign Builder', de: 'Kampagnen-Setup' }, Icon: Rocket, colorClass: 'bg-[#111111] border-[#27272A] text-[#FB923C]', nameColorClass: 'text-[#FB923C]', borderColorClass: 'border-[#FB923C]', avatarUrl: '/campagin_setup.jpg' },
};

export function agentMeta(author: string | undefined): AgentMeta {
  if (author && REGISTRY[author]) return REGISTRY[author];
  const fallback = author || 'Agent';
  return { name: { en: fallback, de: fallback }, Icon: Bot, colorClass: 'bg-[#111111] border-[#27272A] text-[#A1A1AA]', nameColorClass: 'text-[#A1A1AA]', borderColorClass: 'border-[#A1A1AA]' };
}

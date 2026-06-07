import React from 'react';
import { HelpCircle, Bell, LogOut, Globe, Check, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../auth';
import { useI18n, type Lang } from '../i18n';
import { agentMeta } from '../agents';

const HEADER_AGENT_KEYS = [
  'landing_page_agent',
  'strategy_agent',
  'keyword_agent',
  'copywriter_agent',
  'translator_agent',
  'optimizer_team_lead',
  'campaign_builder_agent',
  'excel_exporter_agent',
];

function AgentStack() {
  const { lang } = useI18n();
  return (
    <div className="flex items-center -space-x-1.5">
      {HEADER_AGENT_KEYS.map((key) => {
        const meta = agentMeta(key);
        const Icon = meta.Icon;
        return (
          <div key={key} className="relative group">
            <div
              className={`w-6 h-6 rounded-full border flex items-center justify-center ring-2 ring-[#0A0A0A] transition-transform hover:scale-110 hover:z-10 ${meta.colorClass}`}
            >
              <Icon size={11} strokeWidth={2.2} />
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-[#111111] border border-[#27272A] rounded-md text-[11px] text-[#FAFAFA] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
              {meta.name[lang]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
];

function LanguageMenu() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={t('header.language')}
        aria-label={t('header.language')}
        className="text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors flex items-center gap-1.5 border border-[#27272A] h-8 px-2.5 rounded-full bg-[#111111] hover:bg-[#18181A] text-[12px] font-medium"
      >
        <Globe size={15} />
        <span className="uppercase tracking-wide">{lang}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-[#111111] border border-[#27272A] rounded-xl shadow-2xl z-50 overflow-hidden py-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2 text-[13px] text-[#D4D4D8] hover:bg-[#18181A] transition-colors"
            >
              <span>{l.label}</span>
              {lang === l.code && <Check size={14} className="text-[#4ADE80]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, signOutUser } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const name = user?.displayName || user?.email || t('header.account');
  const email = user?.email || '';
  const avatar =
    user?.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3F3F46&color=fff&size=150`;

  return (
    <div className="relative ml-1" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-[30px] h-[30px] rounded-full overflow-hidden ring-offset-2 ring-offset-[#0A0A0A] hover:ring-2 hover:ring-[#3F3F46] transition-all"
      >
        <img src={avatar} alt={name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 bg-[#111111] border border-[#27272A] rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center gap-3 p-3 border-b border-[#1F1F1F]">
            <img src={avatar} alt={name} referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-[#FAFAFA] truncate">{name}</div>
              {email && <div className="text-[11px] text-[#A1A1AA] truncate">{email}</div>}
            </div>
          </div>
          <button
            onClick={() => { setOpen(false); void signOutUser(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-[#D4D4D8] hover:bg-[#18181A] transition-colors"
          >
            <LogOut size={15} className="text-[#A1A1AA]" />
            {t('header.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { t } = useI18n();
  return (
    <header className="h-[72px] flex items-center justify-between px-6 bg-[#0A0A0A] flex-shrink-0 relative z-10">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-4 border-r border-[#27272A] pr-4">
           <span className="font-semibold text-[#FAFAFA] text-[15px]">Google Ads Agents</span>
        </div>
        <AgentStack />
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#052e16] text-[#4ADE80] text-[11px] font-medium ml-1">
          <div className="w-[5px] h-[5px] rounded-full bg-[#4ADE80]"></div>
          {t('header.online')}
        </div>
      </div>

      <div className="flex items-center gap-5">
        <LanguageMenu />
        <button
          onClick={() => onOpenSettings?.()}
          title={t('settings.open')}
          aria-label={t('settings.open')}
          className="text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors flex items-center justify-center border border-[#27272A] w-8 h-8 rounded-full bg-[#111111] hover:bg-[#18181A]"
        >
          <SettingsIcon size={16} />
        </button>
        <button className="text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors flex items-center justify-center border border-[#27272A] w-8 h-8 rounded-full bg-[#111111] hover:bg-[#18181A]">
          <HelpCircle size={16} />
        </button>
        <button className="text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors relative">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#EF4444] rounded-full text-[8px] flex items-center justify-center font-bold text-white border-2 border-[#0A0A0A]">3</span>
        </button>
        <UserMenu />
      </div>
    </header>
  );
}

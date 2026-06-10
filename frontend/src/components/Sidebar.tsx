import React from 'react';
import { Plus, Command, Trash2, MessageSquare, Search, Zap, Bot, Globe, Check, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { listConversations, deleteConversation, type ConversationSummary } from '../api';
import { useAuth } from '../auth';
import { useI18n, type Lang } from '../i18n';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function formatTime(iso: string | null, lang: Lang, yesterdayLabel: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const locale = lang === 'de' ? 'de-DE' : 'en-US';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === yesterday.toDateString()) return yesterdayLabel;
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}

const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
];

function LanguageMenu() {
  const { lang, setLang, t } = useI18n();
  const currentLanguage = LANGUAGES.find((l) => l.code === lang)?.label ?? lang;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full h-9 justify-between px-2.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Globe size={15} />
            <span>{t('header.language')}</span>
          </span>
          <span className="text-[12px] text-muted-foreground truncate">{currentLanguage}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-52">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code)}
            className="flex items-center justify-between text-[13px]"
          >
            <span>{l.label}</span>
            {lang === l.code && <Check size={14} className="text-[#4ADE80]" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user, signOutUser } = useAuth();
  const { t } = useI18n();

  const name = user?.displayName || user?.email || t('header.account');
  const email = user?.email || '';
  const avatar =
    user?.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3F3F46&color=fff&size=150`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full w-8 h-8 p-0 flex-shrink-0">
          <Avatar className="w-8 h-8">
            <AvatarImage src={avatar} alt={name} referrerPolicy="no-referrer" />
            <AvatarFallback className="text-xs">{name.charAt(0)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3">
            <Avatar className="w-9 h-9">
              <AvatarImage src={avatar} alt={name} referrerPolicy="no-referrer" />
              <AvatarFallback>{name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[13px] font-medium truncate">{name}</p>
              {email && <p className="text-[11px] text-muted-foreground truncate">{email}</p>}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOutUser()} className="text-[13px]">
          <LogOut size={15} className="mr-2 text-muted-foreground" />
          {t('header.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface SidebarProps {
  userId: string;
  activeConvId: string | null;
  refreshKey: number;
  onNewChat: () => void;
  onSelectChat: (convId: string) => void;
  onOpenAgents?: () => void;
  onOpenAutomations?: () => void;
  onOpenSettings?: () => void;
  activeView?: 'chat' | 'agents' | 'automations' | 'settings';
}

export default function Sidebar({ userId, activeConvId, refreshKey, onNewChat, onSelectChat, onOpenAgents, onOpenAutomations, onOpenSettings, activeView = 'chat' }: SidebarProps) {
  const { t, lang } = useI18n();
  const { user, signOutUser } = useAuth();
  const [chats, setChats] = React.useState<ConversationSummary[]>([]);
  const [chatQuery, setChatQuery] = React.useState('');

  const name = user?.displayName || user?.email || t('header.account');
  const email = user?.email || '';
  const avatar =
    user?.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3F3F46&color=fff&size=150`;

  React.useEffect(() => {
    if (userId === 'guest') return;
    let alive = true;
    listConversations(userId)
      .then((list) => {
        if (alive) setChats(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, refreshKey]);

  async function handleDelete(e: React.MouseEvent, convId: string) {
    e.stopPropagation();
    setChats((prev) => prev.filter((c) => c.conv_id !== convId));
    try {
      await deleteConversation(userId, convId);
    } catch {
      // optimistic; reload list on next refresh if it failed
    }
    if (convId === activeConvId) onNewChat();
  }

  const filteredChats = React.useMemo(() => {
    const q = chatQuery.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((chat) => chat.title.toLowerCase().includes(q));
  }, [chats, chatQuery]);

  return (
    <div className="w-[260px] h-full flex flex-col bg-background border-r border-border flex-shrink-0 z-20 relative overflow-hidden">

      {/* Brand Header */}
      <div className="p-5 pb-4 flex items-center gap-3 mt-1">
        <img src="/logo.webp" alt="Logo" width={32} height={32} />
        <span className="font-semibold text-[17px] tracking-tight hover:text-foreground/90 cursor-pointer">SEA - AGENTS</span>
      </div>

      <div className="px-3 pb-4">
        <Button onClick={onNewChat} className="w-full justify-between text-[13px] font-semibold h-9">
          <div className="flex items-center gap-2">
            <Plus size={16} strokeWidth={2.5} />
            <span>{t('sidebar.newChat')}</span>
          </div>
          <kbd className="flex items-center gap-1 text-primary-foreground/50 bg-primary-foreground/10 px-1.5 py-0.5 rounded text-[10px] font-bold">
            <Command size={10} strokeWidth={3} />
            <span>K</span>
          </kbd>
        </Button>
      </div>

      {/* Navigation items */}
      <div className="px-3 pb-2 flex flex-col gap-0.5">
        <div className="w-full h-9 px-2.5 rounded-lg flex items-center gap-2.5 text-[13px] text-muted-foreground hover:text-foreground focus-within:text-foreground focus-within:bg-muted/50 transition-colors">
          <Search size={15} strokeWidth={2} />
          <input
            type="search"
            value={chatQuery}
            onChange={(e) => setChatQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setChatQuery('');
            }}
            placeholder={t('sidebar.search')}
            className="min-w-0 flex-1 bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-search-cancel-button]:appearance-none"
          />
        </div>
        <Button
          variant="ghost"
          onClick={onOpenAgents}
          className={`w-full justify-start gap-2.5 text-[13px] h-9 ${
            activeView === 'agents'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bot size={15} strokeWidth={2} />
          <span>{t('sidebar.agents')}</span>
        </Button>
        <Button
          variant="ghost"
          onClick={onOpenAutomations}
          className={`w-full justify-start gap-2.5 text-[13px] h-9 ${
            activeView === 'automations'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Zap size={15} strokeWidth={2} />
          <span>{t('sidebar.automations')}</span>
        </Button>
      </div>

      <div className="px-5"><Separator /></div>

      {/* Recent chats (live from backend) */}
      <ScrollArea className="flex-1 px-3 py-2 overflow-hidden">
        <div className="px-3 pb-3 flex items-center justify-between">
          <span className="text-[13px] font-medium text-foreground">{t('sidebar.recentChats')}</span>
        </div>

        {chats.length === 0 ? (
          <div className="px-3 py-6 flex flex-col items-center text-center gap-2 text-muted-foreground">
            <MessageSquare size={20} className="opacity-60" />
            <span className="text-[12px] leading-relaxed">{t('sidebar.emptyTitle')}<br />{t('sidebar.emptySubtitle')}</span>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="px-3 py-6 flex flex-col items-center text-center gap-2 text-muted-foreground">
            <Search size={20} className="opacity-60" />
            <span className="text-[12px] leading-relaxed">{t('search.noResults')}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 overflow-hidden">
            {filteredChats.map((chat) => {
              const active = chat.conv_id === activeConvId;
              return (
                <button
                  key={chat.conv_id}
                  onClick={() => onSelectChat(chat.conv_id)}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-[13px] transition-colors overflow-hidden group ${
                    active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground/80'
                  }`}
                >
                  <span className="truncate min-w-0 flex-1 text-left mr-2">{chat.title}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 group-hover:hidden">{formatTime(chat.updated_at, lang, t('time.yesterday'))}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        role="button"
                        onClick={(e) => handleDelete(e, chat.conv_id)}
                        className="hidden group-hover:flex items-center justify-center flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={13} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-[11px]">
                      {t('sidebar.delete')}
                    </TooltipContent>
                  </Tooltip>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="px-3 py-3 border-t border-border flex flex-col gap-1">
        <div className="flex items-center gap-3 px-2.5 py-2 rounded-lg bg-card/50 border border-border/60">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarImage src={avatar} alt={name} referrerPolicy="no-referrer" />
            <AvatarFallback className="text-xs">{name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground truncate">{name}</p>
            {email && <p className="text-[11px] text-muted-foreground truncate">{email}</p>}
          </div>
        </div>

        <Button
          variant="ghost"
          onClick={() => onOpenSettings?.()}
          className={`w-full h-9 justify-start gap-2.5 px-2.5 text-[13px] ${
            activeView === 'settings'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <SettingsIcon size={15} />
          <span>{t('settings.pageTitle')}</span>
        </Button>

        <LanguageMenu />

        <Button
          variant="ghost"
          onClick={() => void signOutUser()}
          className="w-full h-9 justify-start gap-2.5 px-2.5 text-[13px] text-muted-foreground hover:text-destructive"
        >
          <LogOut size={15} />
          <span>{t('header.signOut')}</span>
        </Button>
      </div>
    </div>
  );
}

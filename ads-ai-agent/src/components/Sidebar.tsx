import React from 'react';
import { Plus, Command, Trash2, MessageSquare, Search, Zap } from 'lucide-react';
import { listConversations, deleteConversation, type ConversationSummary } from '../api';
import { useI18n, type Lang } from '../i18n';

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

interface SidebarProps {
  userId: string;
  activeConvId: string | null;
  refreshKey: number;
  onNewChat: () => void;
  onSelectChat: (convId: string) => void;
  onOpenSearch?: () => void;
  onOpenAutomations?: () => void;
  activeView?: 'chat' | 'search' | 'automations' | 'settings';
}

export default function Sidebar({ userId, activeConvId, refreshKey, onNewChat, onSelectChat, onOpenSearch, onOpenAutomations, activeView = 'chat' }: SidebarProps) {
  const { t, lang } = useI18n();
  const [chats, setChats] = React.useState<ConversationSummary[]>([]);

  React.useEffect(() => {
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

  return (
    <div className="w-[260px] h-full flex flex-col bg-[#0A0A0A] border-r border-[#1F1F1F] flex-shrink-0 z-20 relative">

      {/* Brand Header */}
      <div className="p-5 pb-4 flex items-center gap-3 mt-1">
        <img src="/logo.webp" alt="Logo" width={32} height={32} className="rounded-[7px] cursor-pointer hover:opacity-90 transition-opacity" />
        <span className="font-semibold text-[17px] tracking-tight hover:text-white/90 cursor-pointer">ADAGENTS</span>
      </div>

      <div className="px-3 pb-4">
        <button onClick={onNewChat} className="w-full flex items-center justify-between text-[13px] bg-white text-black font-semibold py-2 px-3 rounded-lg hover:bg-gray-100 transition-colors">
          <div className="flex items-center gap-2">
            <Plus size={16} strokeWidth={2.5} />
            <span>{t('sidebar.newChat')}</span>
          </div>
          <div className="flex items-center gap-1 text-gray-500 bg-gray-200/80 px-1.5 py-0.5 rounded text-[10px] font-bold">
            <Command size={10} strokeWidth={3} />
            <span>K</span>
          </div>
        </button>
      </div>

      {/* Navigation items */}
      <div className="px-3 pb-2 flex flex-col gap-0.5">
        <button
          onClick={onOpenSearch}
          className={`w-full flex items-center gap-2.5 text-[13px] py-2 px-3 rounded-lg transition-colors ${
            activeView === 'search'
              ? 'bg-[#18181A] text-[#FAFAFA]'
              : 'text-[#A1A1AA] hover:bg-[#111111] hover:text-[#E4E4E7]'
          }`}
        >
          <Search size={15} strokeWidth={2} />
          <span>{t('sidebar.search')}</span>
        </button>
        <button
          onClick={onOpenAutomations}
          className={`w-full flex items-center gap-2.5 text-[13px] py-2 px-3 rounded-lg transition-colors ${
            activeView === 'automations'
              ? 'bg-[#18181A] text-[#FAFAFA]'
              : 'text-[#A1A1AA] hover:bg-[#111111] hover:text-[#E4E4E7]'
          }`}
        >
          <Zap size={15} strokeWidth={2} />
          <span>{t('sidebar.automations')}</span>
        </button>
      </div>

      <div className="mx-5 border-t border-[#1F1F1F]" />

      {/* Recent chats (live from backend) */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">
        <div className="px-3 pb-3 flex items-center justify-between">
          <span className="text-[13px] font-medium text-[#FAFAFA]">{t('sidebar.recentChats')}</span>
        </div>

        {chats.length === 0 ? (
          <div className="px-3 py-6 flex flex-col items-center text-center gap-2 text-[#71717A]">
            <MessageSquare size={20} className="opacity-60" />
            <span className="text-[12px] leading-relaxed">{t('sidebar.emptyTitle')}<br />{t('sidebar.emptySubtitle')}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {chats.map((chat) => {
              const active = chat.conv_id === activeConvId;
              return (
                <button
                  key={chat.conv_id}
                  onClick={() => onSelectChat(chat.conv_id)}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-[13px] transition-colors overflow-hidden group ${
                    active ? 'bg-[#18181A] text-[#FAFAFA]' : 'text-[#A1A1AA] hover:bg-[#111111] hover:text-[#E4E4E7]'
                  }`}
                >
                  <span className="truncate flex-1 text-left mr-2">{chat.title}</span>
                  <span className="text-[10px] text-[#71717A] flex-shrink-0 group-hover:hidden">{formatTime(chat.updated_at, lang, t('time.yesterday'))}</span>
                  <span
                    onClick={(e) => handleDelete(e, chat.conv_id)}
                    className="hidden group-hover:flex items-center justify-center flex-shrink-0 text-[#71717A] hover:text-[#F87171] transition-colors"
                    title={t('sidebar.delete')}
                  >
                    <Trash2 size={13} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

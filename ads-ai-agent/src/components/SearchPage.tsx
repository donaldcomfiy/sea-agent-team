import React from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { listConversations, getConversation, type ConversationSummary } from '../api';
import { useI18n } from '../i18n';

interface SearchPageProps {
  userId: string;
  onBack: () => void;
  onSelectChat: (convId: string) => void;
}

interface SearchResult {
  conv_id: string;
  title: string;
  snippet: string;
  updated_at: string | null;
}

export default function SearchPage({ userId, onBack, onSelectChat }: SearchPageProps) {
  const { t, lang } = useI18n();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Load all conversations on mount for client-side search
  React.useEffect(() => {
    listConversations(userId).then(setConversations).catch(() => {});
    // Auto-focus the search input
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [userId]);

  async function handleSearch(searchQuery: string) {
    setQuery(searchQuery);
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setSearching(true);
    setHasSearched(true);

    const q = searchQuery.toLowerCase();
    const matched: SearchResult[] = [];

    // Search through conversation titles first (fast)
    const titleMatches = conversations.filter((c) =>
      c.title.toLowerCase().includes(q)
    );

    // For title matches, use the title as snippet
    for (const c of titleMatches) {
      matched.push({
        conv_id: c.conv_id,
        title: c.title,
        snippet: c.title,
        updated_at: c.updated_at,
      });
    }

    // Search through conversation content (load on demand)
    for (const c of conversations) {
      if (matched.some((m) => m.conv_id === c.conv_id)) continue;
      try {
        const full = await getConversation(userId, c.conv_id);
        if (!full?.messages) continue;
        const allText = full.messages
          .map((m) => ('text' in m ? m.text : '') || '')
          .join(' ')
          .toLowerCase();
        if (allText.includes(q)) {
          // Extract a snippet around the match
          const idx = allText.indexOf(q);
          const start = Math.max(0, idx - 60);
          const end = Math.min(allText.length, idx + q.length + 60);
          const snippet = (start > 0 ? '…' : '') + allText.slice(start, end).trim() + (end < allText.length ? '…' : '');
          matched.push({
            conv_id: c.conv_id,
            title: c.title,
            snippet,
            updated_at: c.updated_at,
          });
        }
      } catch {
        // skip conversations that fail to load
      }
    }

    setResults(matched);
    setSearching(false);
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const locale = lang === 'de' ? 'de-DE' : 'en-US';
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] text-[#71717A] hover:text-[#FAFAFA] transition-colors mb-6"
      >
        <ArrowLeft size={15} />
        <span>{t('settings.backToChat')}</span>
      </button>

      <h1 className="text-[22px] font-semibold mb-1">{t('search.title')}</h1>
      <p className="text-[14px] text-[#71717A] mb-6">{t('search.subtitle')}</p>

      {/* Search input */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t('search.placeholder')}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#18181A] border border-[#27272A] text-[14px] text-[#FAFAFA] placeholder-[#52525B] focus:outline-none focus:border-[#3F3F46] transition-colors"
        />
      </div>

      {/* Results */}
      {searching && (
        <div className="text-center py-8 text-[#71717A] text-[13px]">
          <div className="inline-block w-4 h-4 border-2 border-[#3F3F46] border-t-[#A1A1AA] rounded-full animate-spin mr-2" />
          {lang === 'de' ? 'Suche…' : 'Searching…'}
        </div>
      )}

      {!searching && hasSearched && results.length === 0 && (
        <div className="text-center py-12 text-[#71717A]">
          <Search size={24} className="mx-auto mb-3 opacity-40" />
          <p className="text-[13px]">{t('search.noResults')}</p>
        </div>
      )}

      {!searching && results.length > 0 && (
        <div className="flex flex-col gap-1">
          {results.map((r) => (
            <button
              key={r.conv_id}
              onClick={() => onSelectChat(r.conv_id)}
              className="w-full text-left p-3 rounded-lg hover:bg-[#18181A] transition-colors group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-medium text-[#FAFAFA] group-hover:text-white truncate">
                  {r.title}
                </span>
                <span className="text-[11px] text-[#52525B] flex-shrink-0 ml-2">
                  {formatDate(r.updated_at)}
                </span>
              </div>
              <p className="text-[12px] text-[#71717A] line-clamp-2 leading-relaxed">
                {r.snippet}
              </p>
            </button>
          ))}
        </div>
      )}

      {!searching && !hasSearched && (
        <div className="text-center py-12 text-[#52525B]">
          <Search size={24} className="mx-auto mb-3 opacity-30" />
          <p className="text-[12px]">{t('search.hint')}</p>
        </div>
      )}
    </div>
  );
}

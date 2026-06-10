/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import SettingsPage from './components/SettingsPage';
import SearchPage from './components/SearchPage';
import AutomationsPage from './components/AutomationsPage';
import { useAuth } from './auth';
import { getConversation } from './api';
import type { Msg } from './messageTypes';

export default function App() {
  const { user, loading, signIn, error } = useAuth();

  const [activeConvId, setActiveConvId] = React.useState<string | null>(null);
  const [initialMessages, setInitialMessages] = React.useState<Msg[]>([]);
  const [initialDownload, setInitialDownload] = React.useState<string | null>(null);
  const [chatNonce, setChatNonce] = React.useState(0);
  const [sidebarRefresh, setSidebarRefresh] = React.useState(0);
  const [view, setView] = React.useState<'chat' | 'settings' | 'search' | 'automations'>('chat');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0A0A0A] text-[#71717A]">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  const userId = user?.uid ?? 'guest';

  function newChat() {
    setView('chat');
    setActiveConvId(null);
    setInitialMessages([]);
    setInitialDownload(null);
    setChatNonce((k) => k + 1);
  }

  async function selectChat(convId: string) {
    if (!user) return;
    setView('chat');
    const conv = await getConversation(userId, convId);
    setActiveConvId(convId);
    setInitialMessages(conv?.messages ?? []);
    setInitialDownload(conv?.download ?? null);
    setChatNonce((k) => k + 1);
  }

  function handleSaved(convId: string) {
    setActiveConvId(convId);
    setSidebarRefresh((k) => k + 1);
  }

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-white selection:bg-[#3F3F46] selection:text-white font-sans overflow-hidden">
      <Sidebar
        userId={userId}
        activeConvId={activeConvId}
        refreshKey={sidebarRefresh}
        onNewChat={newChat}
        onSelectChat={selectChat}
        onOpenSearch={() => setView('search')}
        onOpenAutomations={() => setView('automations')}
        activeView={view}
      />
      <div className="flex flex-col flex-1 min-w-0 bg-[#0A0A0A] relative">
        <Header onOpenSettings={() => setView('settings')} />
        <main className="flex-1 relative overflow-hidden">
          <ChatArea
            key={chatNonce}
            userId={userId}
            initialMessages={initialMessages}
            initialConvId={activeConvId}
            initialDownload={initialDownload}
            onSaved={handleSaved}
          />
          {view === 'settings' && (
            <div className="absolute inset-0 bg-[#0A0A0A] z-30 overflow-y-auto">
              <SettingsPage onBack={() => setView('chat')} />
            </div>
          )}
          {view === 'search' && (
            <div className="absolute inset-0 bg-[#0A0A0A] z-30 overflow-y-auto">
              <SearchPage userId={userId} onBack={() => setView('chat')} onSelectChat={(convId) => { selectChat(convId); }} />
            </div>
          )}
          {view === 'automations' && (
            <div className="absolute inset-0 bg-[#0A0A0A] z-30 overflow-y-auto">
              <AutomationsPage onBack={() => setView('chat')} />
            </div>
          )}
        </main>
      </div>

      {/* Login overlay — app is visible behind, interaction requires sign-in */}
      {!user && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 bg-[#111113] border border-[#27272A] rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl">
            <img src="/logo.webp" alt="SEA - AGENTS" className="w-14 h-14 mb-6" />
            <h2 className="text-xl font-semibold tracking-tight mb-2 text-[#FAFAFA]">SEA - AGENTS</h2>
            <p className="text-[#A1A1AA] text-[14px] leading-relaxed mb-6">
              Sign in to start building Google Ads campaigns with AI-powered agents.
            </p>
            <button
              onClick={signIn}
              className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold text-[14px] rounded-xl px-4 py-3 hover:bg-gray-100 transition-colors shadow-sm"
            >
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Sign in with Google
            </button>
            {error && (
              <div className="mt-4 text-[13px] text-[#FCA5A5] bg-[#2d1417] border border-[#6e2b30] rounded-lg px-4 py-2 w-full">
                {error}
              </div>
            )}
            <p className="text-[11px] text-[#52525B] mt-6 leading-relaxed">
              Your data stays private. We only access your Google Ads account with your explicit permission.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

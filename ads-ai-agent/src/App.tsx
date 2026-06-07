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
import Login from './components/Login';
import { useAuth } from './auth';
import { getConversation } from './api';
import type { Msg } from './messageTypes';

export default function App() {
  const { user, loading } = useAuth();

  // The conversation currently shown. activeConvId drives the sidebar highlight;
  // chatNonce is the ChatArea mount identity (bumped on new/select to remount it
  // with fresh initial data). After a save, only activeConvId changes -> the
  // sidebar updates without remounting the live chat.
  const [activeConvId, setActiveConvId] = React.useState<string | null>(null);
  const [initialMessages, setInitialMessages] = React.useState<Msg[]>([]);
  const [initialDownload, setInitialDownload] = React.useState<string | null>(null);
  const [chatNonce, setChatNonce] = React.useState(0);
  const [sidebarRefresh, setSidebarRefresh] = React.useState(0);
  // 'chat' | 'settings' — settings renders as an overlay so the live ChatArea
  // stays mounted underneath (conversation isn't lost when opening settings).
  const [view, setView] = React.useState<'chat' | 'settings'>('chat');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0A0A0A] text-[#71717A]">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (!user) return <Login />;
  const userId = user.uid;

  function newChat() {
    setView('chat');
    setActiveConvId(null);
    setInitialMessages([]);
    setInitialDownload(null);
    setChatNonce((k) => k + 1);
  }

  async function selectChat(convId: string) {
    setView('chat');
    const conv = await getConversation(userId, convId);
    setActiveConvId(convId);
    setInitialMessages(conv?.messages ?? []);
    setInitialDownload(conv?.download ?? null);
    setChatNonce((k) => k + 1);
  }

  // ChatArea calls this after persisting a turn: highlight + refresh the list.
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
        </main>
      </div>
    </div>
  );
}

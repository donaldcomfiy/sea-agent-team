/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsPage from './components/SettingsPage';
import AgentsPage from './components/AgentsPage';
import AutomationsPage from './components/AutomationsPage';
import { useAuth } from './auth';
import { getConversation } from './api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Msg } from './messageTypes';

export default function App() {
  const { user, loading, signIn, error } = useAuth();

  const [activeConvId, setActiveConvId] = React.useState<string | null>(null);
  const [initialMessages, setInitialMessages] = React.useState<Msg[]>([]);
  const [initialDownload, setInitialDownload] = React.useState<string | null>(null);
  const [chatNonce, setChatNonce] = React.useState(0);
  const [sidebarRefresh, setSidebarRefresh] = React.useState(0);
  const [view, setView] = React.useState<'chat' | 'settings' | 'agents' | 'automations'>('chat');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-muted-foreground">
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
    <div className="flex h-screen bg-background text-foreground selection:bg-ring selection:text-foreground font-sans overflow-hidden">
      <Sidebar
        userId={userId}
        activeConvId={activeConvId}
        refreshKey={sidebarRefresh}
        onNewChat={newChat}
        onSelectChat={selectChat}
        onOpenAgents={() => setView('agents')}
        onOpenAutomations={() => setView('automations')}
        onOpenSettings={() => setView('settings')}
        activeView={view}
      />
      <div className="flex flex-col flex-1 min-w-0 bg-background relative">
        <div className="h-[72px] flex-shrink-0" />
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
            <div className="absolute inset-0 bg-background z-30 overflow-y-auto">
              <SettingsPage onBack={() => setView('chat')} />
            </div>
          )}

          {view === 'agents' && (
            <div className="absolute inset-0 bg-background z-30 overflow-y-auto">
              <AgentsPage onBack={() => setView('chat')} />
            </div>
          )}

          {view === 'automations' && (
            <div className="absolute inset-0 bg-background z-30 overflow-y-auto">
              <AutomationsPage onBack={() => setView('chat')} />
            </div>
          )}
        </main>
      </div>

      {/* Login overlay — app is visible behind, interaction requires sign-in */}
      {!user && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-sm mx-4 rounded-2xl shadow-2xl">
            <CardContent className="p-8 flex flex-col items-center text-center">
              <img src="/logo.webp" alt="SEA - AGENTS" className="w-14 h-14 mb-6" />
              <h2 className="text-xl font-semibold tracking-tight mb-2 text-foreground">SEA - AGENTS</h2>
              <p className="text-muted-foreground text-[14px] leading-relaxed mb-6">
                Sign in to start building Google Ads campaigns with AI-powered agents.
              </p>
              <Button
                onClick={signIn}
                size="lg"
                className="w-full text-[14px] font-semibold gap-3"
              >
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                Sign in with Google
              </Button>
              {error && (
                <div className="mt-4 text-[13px] text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2 w-full">
                  {error}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground/60 mt-6 leading-relaxed">
                Your data stays private. We only access your Google Ads account with your explicit permission.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

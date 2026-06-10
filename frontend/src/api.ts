// Talks to the ADK FastAPI backend (proxied by Vite, see vite.config.ts).
import type { Msg } from './messageTypes';
import { auth } from './firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function apiUrl(path: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

async function getAuthenticatedUser(): Promise<User | null> {
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      resolve(auth.currentUser);
    }, 2000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(user);
    });
  });
}

async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  try {
    const user = await getAuthenticatedUser();
    if (user) {
      const token = await user.getIdToken();
      headers.set('Authorization', `Bearer ${token}`);
    }
  } catch {
    // Firebase not configured or user not logged in — proceed without token
  }
  return fetch(apiUrl(url), { ...init, headers });
}

export interface Part {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response?: unknown };
}

export interface AdkEvent {
  author?: string;
  invocationId?: string;
  partial?: boolean;
  error?: string;
  errorMessage?: string;
  content?: { role?: string; parts?: Part[] };
}

// The agent app is loaded from the backend's `app/` directory -> app_name "app".
const APP_NAME = 'app';

export async function createSession(userId: string): Promise<string> {
  const res = await authFetch(`/apps/${APP_NAME}/users/${userId}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`Could not create session (${res.status})`);
  const data = await res.json();
  return data.id as string;
}

export interface RunParams {
  userId: string;
  sessionId: string;
  text: string;
}

// Streams ADK events from /run_sse (SSE framed as `data: {json}\n\n`). EventSource
// only supports GET, so we read the fetch body stream manually.
export async function* runSSE(p: RunParams): AsyncGenerator<AdkEvent> {
  const res = await authFetch('/run_sse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_name: APP_NAME,
      user_id: p.userId,
      session_id: p.sessionId,
      new_message: { role: 'user', parts: [{ text: p.text }] },
      streaming: true,
    }),
  });
  if (!res.ok || !res.body) throw new Error(`Agent request failed (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const json = dataLine.slice(5).trim();
      if (!json) continue;
      try {
        yield JSON.parse(json) as AdkEvent;
      } catch {
        // ignore keepalive / non-JSON frames
      }
    }
  }
}

export function exportUrl(filename: string): string {
  return apiUrl(`/exports/${encodeURIComponent(filename)}`);
}

// --- Conversation history (persisted in MongoDB Atlas via the backend) ---

export interface ConversationSummary {
  conv_id: string;
  title: string;
  updated_at: string | null;
  message_count?: number;
}

export interface ConversationDoc {
  conv_id: string;
  title: string;
  messages: Msg[];
  download?: string | null;
  updated_at?: string | null;
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const res = await authFetch(`/conversations?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.conversations ?? []) as ConversationSummary[];
}

export async function getConversation(userId: string, convId: string): Promise<ConversationDoc | null> {
  const res = await authFetch(
    `/conversations/${encodeURIComponent(convId)}?user_id=${encodeURIComponent(userId)}`,
  );
  if (!res.ok) return null;
  return (await res.json()) as ConversationDoc;
}

export async function saveConversation(
  userId: string,
  convId: string,
  title: string,
  messages: Msg[],
  download: string | null,
): Promise<void> {
  await authFetch(`/conversations/${encodeURIComponent(convId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, title, messages, download }),
  });
}

export async function deleteConversation(userId: string, convId: string): Promise<void> {
  await authFetch(
    `/conversations/${encodeURIComponent(convId)}?user_id=${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
}

// --- Connection-dashboard status (Settings page top strip) ---
// At-a-glance state for each backend integration. No live ping — the values
// reflect whether the credentials/env are present, not whether the remote
// system actually answers. The Google Ads section's own /google-ads/test
// endpoint does the round-trip check.

export interface IntegrationsStatus {
  google_ads: { configured: boolean; detail: string };
  google_sheets: { configured: boolean; detail: string };
  mongodb: { configured: boolean; detail: string };
}

export async function getIntegrationsStatus(): Promise<IntegrationsStatus | null> {
  try {
    const res = await authFetch('/integrations/status');
    if (!res.ok) return null;
    return (await res.json()) as IntegrationsStatus;
  } catch {
    return null;
  }
}

// --- Google Ads connection settings ---
// Secrets are write-only: GET returns '<field>_set' booleans, never the values.

export interface GoogleAdsSettings {
  client_id: string;
  login_customer_id: string;
  customer_id: string;
  developer_token_set: boolean;
  client_secret_set: boolean;
  refresh_token_set: boolean;
}

export interface GoogleAdsSettingsInput {
  developer_token?: string;
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
  login_customer_id?: string;
  customer_id?: string;
}

export interface GoogleAdsAccount {
  id: string;
  name: string;
}

export async function disconnectGoogleAds(): Promise<GoogleAdsSettings | null> {
  try {
    const res = await authFetch('/google-ads/disconnect', { method: 'POST' });
    if (!res.ok) return null;
    const body = (await res.json()) as { settings?: GoogleAdsSettings };
    return body.settings || null;
  } catch {
    return null;
  }
}

export interface GoogleAdsTestResult {
  ok: boolean;
  mode?: string;
  count?: number;
  accounts?: GoogleAdsAccount[];
  error?: string;
}

export async function getGoogleAdsSettings(): Promise<GoogleAdsSettings | null> {
  const res = await authFetch('/google-ads/settings');
  if (!res.ok) return null;
  return (await res.json()) as GoogleAdsSettings;
}

export async function saveGoogleAdsSettings(
  input: GoogleAdsSettingsInput,
): Promise<GoogleAdsSettings | null> {
  const res = await authFetch('/google-ads/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) return null;
  return (await res.json()) as GoogleAdsSettings;
}

export async function testGoogleAdsConnection(): Promise<GoogleAdsTestResult> {
  const res = await authFetch('/google-ads/test', { method: 'POST' });
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  return (await res.json()) as GoogleAdsTestResult;
}

// Starts the server-side "Connect with Google" OAuth flow; returns the consent
// URL to open in a popup. The backend callback stores the refresh token.
export async function startGoogleAdsOAuth(): Promise<{ auth_url: string } | null> {
  const res = await authFetch('/google-ads/oauth/start');
  if (!res.ok) return null;
  return (await res.json()) as { auth_url: string };
}

export async function exportFileToSheets(filename: string): Promise<string> {
  const res = await authFetch('/google-sheets/export-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '' }));
    throw new Error(err.detail || `Export fehlgeschlagen (${res.status})`);
  }
  const data = await res.json();
  return data.url;
}

export async function exportTextToSheets(text: string, title?: string): Promise<string> {
  const res = await authFetch('/google-sheets/export-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, title }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '' }));
    throw new Error(err.detail || `Export fehlgeschlagen (${res.status})`);
  }
  const data = await res.json();
  return data.url;
}

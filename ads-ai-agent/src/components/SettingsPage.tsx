import React from 'react';
import { ChevronRight, ArrowLeft, Loader2, CheckCircle2, AlertCircle, Database, LogOut } from 'lucide-react';
import { useI18n, type TKey } from '../i18n';
import {
  getGoogleAdsSettings,
  saveGoogleAdsSettings,
  testGoogleAdsConnection,
  startGoogleAdsOAuth,
  disconnectGoogleAds,
  getIntegrationsStatus,
  type GoogleAdsSettings,
  type GoogleAdsTestResult,
  type IntegrationsStatus,
} from '../api';

type Status = 'unconfigured' | 'testing' | 'connected' | 'error';

const EMPTY = {
  developer_token: '',
  client_id: '',
  client_secret: '',
  refresh_token: '',
  login_customer_id: '',
  customer_id: '',
};

function StatusBadge({ status }: { status: Status }) {
  const { t } = useI18n();
  if (status === 'testing')
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-[#A1A1AA]">
        <Loader2 size={12} className="animate-spin" /> {t('settings.testing')}
      </span>
    );
  if (status === 'connected')
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#4ADE80]">
        <span className="w-2 h-2 rounded-full bg-[#4ADE80]" /> {t('settings.connected')}
      </span>
    );
  if (status === 'error')
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#F87171]">
        <span className="w-2 h-2 rounded-full bg-[#F87171]" /> {t('settings.failed')}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[#71717A]">
      <span className="w-2 h-2 rounded-full bg-[#52525B]" /> {t('settings.statusUnconfigured')}
    </span>
  );
}

// Collapsible integration row. Visually a card with a left-side brand accent,
// the integration's logo, a title + dynamic subtitle (e.g. the connected
// account when available), and a status pill on the right. Closed by default.
function Section({
  title,
  subtitle,
  status,
  icon,
  accent,
  iconBg,
  children,
}: {
  title: string;
  subtitle?: string;
  status: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
  iconBg?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const hasBody = !!children;
  return (
    <div className="relative border border-[#27272A] rounded-xl bg-[#111111] overflow-hidden">
      {accent && <div className="absolute top-0 bottom-0 left-0 w-[3px]" style={{ backgroundColor: accent }} />}
      <button
        onClick={() => hasBody && setOpen((o) => !o)}
        disabled={!hasBody}
        className={`w-full flex items-center gap-3 px-4 py-4 text-left ${hasBody ? 'hover:bg-[#161616] transition-colors cursor-pointer' : 'cursor-default'}`}
      >
        {icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: iconBg || '#18181A', color: accent }}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold text-[#FAFAFA]">{title}</div>
          {subtitle && <div className="text-[12px] text-[#A1A1AA] truncate mt-0.5">{subtitle}</div>}
        </div>
        <div className="flex-shrink-0 flex items-center gap-3">
          {status}
          {hasBody && (
            <ChevronRight size={16} className={`text-[#52525B] transition-transform ${open ? 'rotate-90' : ''}`} />
          )}
        </div>
      </button>
      {open && hasBody && (
        <div className="px-4 pb-4 pt-3 border-t border-[#1F1F1F]">{children}</div>
      )}
    </div>
  );
}

// Three-color SVG of Google Ads, reused as the row icon in the list.
function GoogleAdsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M11.59 2.6c-.63-1.09-2.04-1.46-3.13-.83L3.13 4.84c-1.09.63-1.46 2.04-.83 3.13l5.33 9.23c.63 1.09 2.04 1.46 3.13.83l5.33-3.07c1.09-.63 1.46-2.04.83-3.13L11.59 2.6z" fill="#FABB05" />
      <path d="M11.6 2.6L6.27 11.83c-.63 1.09-.26 2.5.83 3.13l5.33 3.07c1.09.63 2.5.26 3.13-.83l5.33-9.23c.63-1.09.26-2.5-.83-3.13L14.73 1.77c-1.09-.63-2.5-.26-3.13.83z" fill="#4285F4" />
      <path d="M4.67 17.5A3.17 3.17 0 114.67 11a3.17 3.17 0 010 6.5z" fill="#34A853" />
    </svg>
  );
}

function GoogleSheetsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" fill="#0F9D58" />
      <path d="M14 2v6h6l-6-6z" fill="#0a7c46" />
      <rect x="7" y="11" width="10" height="1.5" fill="#FAFAFA" />
      <rect x="7" y="14" width="10" height="1.5" fill="#FAFAFA" />
      <rect x="7" y="17" width="10" height="1.5" fill="#FAFAFA" />
      <rect x="11" y="11" width="1.5" height="8" fill="#0F9D58" />
    </svg>
  );
}

export default function SettingsPage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [pub, setPub] = React.useState<GoogleAdsSettings | null>(null);
  const [form, setForm] = React.useState({ ...EMPTY });
  const [saving, setSaving] = React.useState(false);
  const [savedTick, setSavedTick] = React.useState(false);
  const [adsStatus, setAdsStatus] = React.useState<Status>('unconfigured');
  const [adsResult, setAdsResult] = React.useState<GoogleAdsTestResult | null>(null);
  const [integrations, setIntegrations] = React.useState<IntegrationsStatus | null>(null);
  const [disconnecting, setDisconnecting] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const [p, s] = await Promise.all([getGoogleAdsSettings(), getIntegrationsStatus()]);
    if (p) {
      setPub(p);
      setForm((f) => ({ ...f, client_id: p.client_id || '', login_customer_id: p.login_customer_id || '', customer_id: p.customer_id || '' }));
    }
    if (s) setIntegrations(s);
    return p;
  }, []);

  const runAdsTest = React.useCallback(async () => {
    setAdsStatus('testing');
    const r = await testGoogleAdsConnection();
    setAdsResult(r);
    setAdsStatus(r.ok ? 'connected' : r.mode === 'mock' ? 'unconfigured' : 'error');
  }, []);

  // Load settings on mount; auto-test if it already looks configured.
  React.useEffect(() => {
    (async () => {
      const p = await refresh();
      if (p && p.developer_token_set && p.client_secret_set && p.refresh_token_set && p.client_id) {
        void runAdsTest();
      }
    })();
  }, [refresh, runAdsTest]);

  // OAuth popup -> refresh settings + re-test.
  React.useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      if (!e.data || e.data.type !== 'google-ads-oauth') return;
      await refresh();
      if (e.data.ok) void runAdsTest();
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [refresh, runAdsTest]);

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const clearSecrets = () => setForm((f) => ({ ...f, developer_token: '', client_secret: '', refresh_token: '' }));

  const save = async () => {
    setSaving(true);
    setSavedTick(false);
    const p = await saveGoogleAdsSettings(form);
    setSaving(false);
    if (p) {
      setPub(p);
      setSavedTick(true);
      clearSecrets();
    }
  };

  const disconnect = async () => {
    // Browser confirm is sufficient for a destructive single-click action in
    // the hackathon scope; revoke-at-Google happens server-side.
    if (!window.confirm(t('settings.disconnectConfirm'))) return;
    setDisconnecting(true);
    const p = await disconnectGoogleAds();
    if (p) setPub(p);
    // Clear locally so the form/test result reflects the new state immediately
    // — we don't wait for refresh() because the user just performed the action.
    setAdsResult(null);
    setAdsStatus('unconfigured');
    await refresh();
    setDisconnecting(false);
  };

  const connect = async () => {
    // Open popup synchronously (keep the user gesture), then point it at the URL.
    const popup = window.open('', 'google-ads-oauth', 'width=520,height=680');
    await saveGoogleAdsSettings(form);
    const r = await startGoogleAdsOAuth();
    if (r?.auth_url && popup) {
      popup.location.href = r.auth_url;
    } else {
      popup?.close();
      setAdsResult({ ok: false, error: 'Anmelde-URL konnte nicht erstellt werden (Client-ID gespeichert?).' });
      setAdsStatus('error');
    }
  };

  const redirectUri = `${window.location.origin}/google-ads/oauth/callback`;
  const googleConnected = !!pub?.refresh_token_set;
  const sheetsStatus: Status = googleConnected ? 'connected' : 'unconfigured';

  const field = (
    key: keyof typeof EMPTY,
    labelKey: TKey,
    opts: { secret?: boolean; secretSet?: boolean } = {},
  ) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-[#A1A1AA]">{t(labelKey)}</span>
      <input
        type={opts.secret ? 'password' : 'text'}
        value={form[key]}
        onChange={set(key)}
        autoComplete="off"
        placeholder={opts.secret && opts.secretSet ? t('settings.secretSet') : ''}
        className="bg-[#0A0A0A] border border-[#27272A] rounded-lg px-3 py-2.5 text-[14px] text-[#FAFAFA] outline-none focus:border-[#3F3F46] placeholder-[#52525B]"
      />
    </label>
  );

  // Subtitle for the Google Ads row: when the live test succeeded we show the
  // first connected account (most informative); fall back to the description.
  const adsSubtitle =
    adsResult?.ok && adsResult.accounts?.[0]
      ? `${adsResult.accounts[0].name} · ${adsResult.accounts[0].id}`
      : t('settings.googleAdsDesc');
  const sheetsSubtitle = integrations?.google_sheets.configured
    ? integrations.google_sheets.detail || t('settings.googleSheetsDesc')
    : t('settings.googleSheetsDesc');
  const mongoSubtitle = integrations?.mongodb.detail || t('settings.mongoDbDesc');
  const mongoStatus: Status = integrations?.mongodb.configured ? 'connected' : 'unconfigured';

  return (
    <div className="min-h-full">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-[13px] text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors mb-6">
          <ArrowLeft size={15} /> {t('settings.backToChat')}
        </button>
        <h1 className="text-[22px] font-semibold text-[#FAFAFA] mb-1">{t('settings.pageTitle')}</h1>
        <p className="text-[13px] text-[#71717A] mb-6">{t('settings.subtitle')}</p>

        <div className="flex flex-col gap-3">
          {/* Google Ads API */}
          <Section
            title={t('settings.googleAds')}
            subtitle={adsSubtitle}
            status={<StatusBadge status={adsStatus} />}
            icon={<GoogleAdsIcon size={20} />}
            accent="#4285F4"
            iconBg="#0d1a2e"
          >
            <div className="flex flex-col gap-3.5">
              {field('developer_token', 'settings.developerToken', { secret: true, secretSet: pub?.developer_token_set })}
              {field('client_id', 'settings.clientId')}
              {field('client_secret', 'settings.clientSecret', { secret: true, secretSet: pub?.client_secret_set })}
              {field('refresh_token', 'settings.refreshToken', { secret: true, secretSet: pub?.refresh_token_set })}
              {field('login_customer_id', 'settings.loginCustomerId')}
              {field('customer_id', 'settings.customerId')}

              <div className="rounded-lg border border-[#27272A] bg-[#0A0A0A] p-3.5 flex flex-col gap-2.5">
                <p className="text-[12px] text-[#A1A1AA] leading-relaxed">{t('settings.connectIntro')}</p>
                <button
                  onClick={connect}
                  className="self-start flex items-center gap-2 text-[13px] font-semibold text-black bg-white rounded-lg px-4 py-2 hover:bg-gray-100 transition-colors"
                >
                  {t('settings.connect')}
                </button>
                <p className="text-[11px] text-[#71717A] leading-relaxed">
                  {t('settings.redirectHint')}
                  <br />
                  <code className="text-[#A1A1AA] break-all">{redirectUri}</code>
                </p>
              </div>

              <p className="text-[11px] text-[#71717A] leading-relaxed">{t('settings.securityNote')}</p>

              {adsResult && (
                <div
                  className={`flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-[13px] border ${
                    adsResult.ok ? 'bg-[#052e16] border-[#14532d] text-[#86efac]' : 'bg-[#2d1417] border-[#6e2b30] text-[#FCA5A5]'
                  }`}
                >
                  {adsResult.ok ? <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    {adsResult.ok ? (
                      <>
                        <div className="font-medium">
                          {t('settings.connected')} · {adsResult.count ?? adsResult.accounts?.length ?? 0} {t('settings.accountsFound')}
                        </div>
                        {adsResult.accounts && adsResult.accounts.length > 0 && (
                          <div className="mt-1 text-[12px] text-[#A1A1AA] space-y-0.5">
                            {adsResult.accounts.slice(0, 8).map((a) => (
                              <div key={a.id} className="truncate">
                                {a.name} · {a.id}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="font-medium">{t('settings.failed')}</div>
                        {adsResult.error && <div className="mt-1 text-[12px] break-words">{adsResult.error}</div>}
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap">
                {/* Disconnect lives on the LEFT so it's visually separated from
                    the constructive Save/Test actions on the right. Only shown
                    when we actually have a refresh token to revoke. */}
                {googleConnected ? (
                  <button
                    onClick={disconnect}
                    disabled={disconnecting}
                    className="inline-flex items-center gap-2 text-[12.5px] font-medium text-[#F87171] hover:text-[#FCA5A5] hover:bg-[#2d1417] border border-[#6e2b30]/40 hover:border-[#6e2b30] rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors"
                  >
                    {disconnecting ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                    {disconnecting ? t('settings.disconnecting') : t('settings.disconnect')}
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-2 text-[13px] font-medium text-[#D4D4D8] bg-[#18181A] border border-[#27272A] rounded-lg px-4 py-2 hover:bg-[#27272A] disabled:opacity-50 transition-colors"
                  >
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    {savedTick && !saving ? t('settings.saved') : t('settings.save')}
                  </button>
                  <button
                    onClick={runAdsTest}
                    disabled={adsStatus === 'testing'}
                    className="flex items-center gap-2 text-[13px] font-semibold text-black bg-white rounded-lg px-4 py-2 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                  >
                    {adsStatus === 'testing' && <Loader2 size={14} className="animate-spin" />}
                    {adsStatus === 'testing' ? t('settings.testing') : t('settings.test')}
                  </button>
                </div>
              </div>
            </div>
          </Section>

          {/* Google Sheets API (shares the Google Ads OAuth connection) */}
          <Section
            title={t('settings.googleSheets')}
            subtitle={sheetsSubtitle}
            status={<StatusBadge status={sheetsStatus} />}
            icon={<GoogleSheetsIcon size={20} />}
            accent="#0F9D58"
            iconBg="#0a2a1c"
          >
            <p className="text-[12px] text-[#A1A1AA] leading-relaxed">{t('settings.sheetsSharedNote')}</p>
            {!googleConnected ? (
              <button
                onClick={connect}
                className="mt-3 self-start flex items-center gap-2 text-[13px] font-semibold text-black bg-white rounded-lg px-4 py-2 hover:bg-gray-100 transition-colors"
              >
                {t('settings.connect')}
              </button>
            ) : (
              <p className="mt-3 text-[11.5px] text-[#71717A] leading-relaxed">{t('settings.sheetsDisconnectHint')}</p>
            )}
          </Section>

          {/* MongoDB Atlas — read-only row, configured server-side via
              MDB_MCP_CONNECTION_STRING. We show the cluster host (creds
              stripped by the backend) and a short explainer in the body. */}
          <Section
            title={t('settings.mongoDb')}
            subtitle={mongoSubtitle}
            status={<StatusBadge status={mongoStatus} />}
            icon={<Database size={20} strokeWidth={2.3} />}
            accent="#00684A"
            iconBg="#072a1f"
          >
            <p className="text-[12px] text-[#A1A1AA] leading-relaxed">
              MongoDB Atlas wird serverseitig über die Umgebungsvariable <code className="text-[#D4D4D8]">MDB_MCP_CONNECTION_STRING</code> konfiguriert. Live-Aktivität siehst du im Chat als grüne MongoDB-MCP-Chips (connect / find / update-many).
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

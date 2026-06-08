import React from 'react';
import { ChevronRight, ArrowLeft, Loader2, CheckCircle2, AlertCircle, Database, LogOut, Shield } from 'lucide-react';
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

function Section({
  title,
  subtitle,
  status,
  icon,
  accent,
  iconBg,
  children,
  defaultOpen,
}: {
  title: string;
  subtitle?: string;
  status: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
  iconBg?: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen ?? false);
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

function GoogleAdsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M11.59 2.6c-.63-1.09-2.04-1.46-3.13-.83L3.13 4.84c-1.09.63-1.46 2.04-.83 3.13l5.33 9.23c.63 1.09 2.04 1.46 3.13.83l5.33-3.07c1.09-.63 1.46-2.04.83-3.13L11.59 2.6z" fill="#FABB05" />
      <path d="M11.6 2.6L6.27 11.83c-.63 1.09-.26 2.5.83 3.13l5.33 3.07c1.09.63 2.5.26 3.13-.83l5.33-9.23c.63-1.09.26-2.5-.83-3.13L14.73 1.77c-1.09-.63-2.5-.26-3.13.83z" fill="#4285F4" />
      <path d="M4.67 17.5A3.17 3.17 0 114.67 11a3.17 3.17 0 010 6.5z" fill="#34A853" />
    </svg>
  );
}

function GoogleAuthIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
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

  React.useEffect(() => {
    (async () => {
      const p = await refresh();
      if (p && p.developer_token_set && p.client_secret_set && p.refresh_token_set && p.client_id) {
        void runAdsTest();
      }
    })();
  }, [refresh, runAdsTest]);

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
    if (!window.confirm(t('settings.disconnectConfirm'))) return;
    setDisconnecting(true);
    const p = await disconnectGoogleAds();
    if (p) setPub(p);
    setAdsResult(null);
    setAdsStatus('unconfigured');
    await refresh();
    setDisconnecting(false);
  };

  const connect = async () => {
    const popup = window.open('', 'google-ads-oauth', 'width=520,height=680');
    await saveGoogleAdsSettings(form);
    const r = await startGoogleAdsOAuth();
    if (r?.auth_url && popup) {
      popup.location.href = r.auth_url;
    } else {
      popup?.close();
      setAdsResult({ ok: false, error: t('settings.oauthUrlError') });
      setAdsStatus('error');
    }
  };

  const apiBase = (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/$/, '');
  const redirectUri = `${apiBase}/google-ads/oauth/callback`;
  const googleConnected = !!pub?.refresh_token_set;
  const authStatus: Status = googleConnected ? 'connected' : 'unconfigured';
  const mongoSubtitle = integrations?.mongodb.detail || t('settings.mongoDbDesc');
  const mongoStatus: Status = integrations?.mongodb.configured ? 'connected' : 'unconfigured';

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

  const adsSubtitle =
    adsResult?.ok && adsResult.accounts?.[0]
      ? `${adsResult.accounts[0].name} · ${adsResult.accounts[0].id}`
      : t('settings.googleAdsDesc');

  return (
    <div className="min-h-full">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-[13px] text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors mb-6">
          <ArrowLeft size={15} /> {t('settings.backToChat')}
        </button>
        <h1 className="text-[22px] font-semibold text-[#FAFAFA] mb-1">{t('settings.pageTitle')}</h1>
        <p className="text-[13px] text-[#71717A] mb-6">{t('settings.settingsSubtitle')}</p>

        <div className="flex flex-col gap-3">

          {/* ── 1. Google Ads — credentials only ── */}
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
              {field('login_customer_id', 'settings.loginCustomerId')}
              {field('customer_id', 'settings.customerId')}

              {/* Test result */}
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

              {/* Save + Test buttons */}
              <div className="flex items-center justify-end gap-2">
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
          </Section>

          {/* ── 2. Google Auth — OAuth connect/disconnect ── */}
          <Section
            title={t('settings.googleAuth')}
            subtitle={googleConnected ? t('settings.googleAuthConnectedDesc') : t('settings.googleAuthDesc')}
            status={<StatusBadge status={authStatus} />}
            icon={<GoogleAuthIcon size={20} />}
            accent="#34A853"
            iconBg="#0a2a1c"
          >
            <div className="flex flex-col gap-3.5">
              {field('client_id', 'settings.clientId')}
              {field('client_secret', 'settings.clientSecret', { secret: true, secretSet: pub?.client_secret_set })}
              {field('refresh_token', 'settings.refreshToken', { secret: true, secretSet: pub?.refresh_token_set })}

              {!googleConnected ? (
                <>
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
                </>
              ) : (
                <>
                  {/* Connected state with status chips */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[12.5px]">
                      <CheckCircle2 size={14} className="text-[#4ADE80]" />
                      <span className="text-[#D4D4D8]">Google Ads API</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12.5px]">
                      <CheckCircle2 size={14} className="text-[#4ADE80]" />
                      <span className="text-[#D4D4D8]">{t('settings.sheetsEnabled')}</span>
                    </div>
                  </div>

                  {/* Disconnect button */}
                  <button
                    onClick={disconnect}
                    disabled={disconnecting}
                    className="self-start inline-flex items-center gap-2 text-[12.5px] font-medium text-[#F87171] hover:text-[#FCA5A5] hover:bg-[#2d1417] border border-[#6e2b30]/40 hover:border-[#6e2b30] rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors"
                  >
                    {disconnecting ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                    {disconnecting ? t('settings.disconnecting') : t('settings.disconnect')}
                  </button>
                </>
              )}

              <p className="text-[11px] text-[#71717A] leading-relaxed">{t('settings.securityNote')}</p>

              {/* Save button for auth credentials */}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-2 text-[13px] font-medium text-[#D4D4D8] bg-[#18181A] border border-[#27272A] rounded-lg px-4 py-2 hover:bg-[#27272A] disabled:opacity-50 transition-colors"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {savedTick && !saving ? t('settings.saved') : t('settings.save')}
                </button>
              </div>
            </div>
          </Section>

          {/* ── 3. MongoDB MCP — status only ── */}
          <Section
            title={t('settings.mongoDb')}
            subtitle={mongoSubtitle}
            status={<StatusBadge status={mongoStatus} />}
            icon={<Database size={20} strokeWidth={2.3} />}
            accent="#00684A"
            iconBg="#072a1f"
          >
            <p className="text-[12px] text-[#A1A1AA] leading-relaxed" dangerouslySetInnerHTML={{ __html: t('settings.mongoDbNote') }} />
          </Section>

        </div>
      </div>
    </div>
  );
}

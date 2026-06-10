import { Sparkles } from 'lucide-react';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';

// Google "G" mark for the sign-in button.
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function Login() {
  const { signIn, error } = useAuth();
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0A0A0A] text-white px-6 font-sans">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-white text-black flex items-center justify-center mb-6 shadow-lg">
          <Sparkles size={26} fill="currentColor" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2 text-[#FAFAFA]">SEA - AGENTS</h1>
        <p className="text-[#A1A1AA] text-[15px] leading-relaxed mb-8">
          {t('login.subtitle')}
        </p>

        <button
          onClick={signIn}
          className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold text-[14px] rounded-xl px-4 py-3 hover:bg-gray-100 transition-colors shadow-sm"
        >
          <GoogleG />
          {t('login.button')}
        </button>

        {error && (
          <div className="mt-5 text-[13px] text-[#FCA5A5] bg-[#2d1417] border border-[#6e2b30] rounded-lg px-4 py-2 w-full">
            {error}
          </div>
        )}

        <p className="text-[11px] text-[#71717A] mt-8 leading-relaxed">
          {t('login.disclaimer')}
        </p>
      </div>
    </div>
  );
}

import { ArrowLeft, Zap, Clock, BarChart3, Bell } from 'lucide-react';
import { useI18n } from '../i18n';

interface AutomationsPageProps {
  onBack: () => void;
}

export default function AutomationsPage({ onBack }: AutomationsPageProps) {
  const { t, lang } = useI18n();

  const features = [
    {
      Icon: Clock,
      title: lang === 'de' ? 'Geplante Berichte' : 'Scheduled Reports',
      desc: lang === 'de'
        ? 'Automatische Performance-Reports jeden Montag per E-Mail.'
        : 'Automated performance reports delivered every Monday via email.',
    },
    {
      Icon: BarChart3,
      title: lang === 'de' ? 'Gebotsanpassungen' : 'Bid Adjustments',
      desc: lang === 'de'
        ? 'Der Agent passt Gebote basierend auf CTR- und CPA-Trends an.'
        : 'The agent adjusts bids based on CTR and CPA trends automatically.',
    },
    {
      Icon: Bell,
      title: lang === 'de' ? 'Alert-Regeln' : 'Alert Rules',
      desc: lang === 'de'
        ? 'Benachrichtigungen bei Budget-Überschreitung oder Performance-Drops.'
        : 'Notifications when budget thresholds are hit or performance drops.',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] text-[#71717A] hover:text-[#FAFAFA] transition-colors mb-6"
      >
        <ArrowLeft size={15} />
        <span>{t('settings.backToChat')}</span>
      </button>

      <h1 className="text-[22px] font-semibold mb-1">{t('automations.title')}</h1>
      <p className="text-[14px] text-[#71717A] mb-8">{t('automations.subtitle')}</p>

      {/* Coming soon badge */}
      <div className="rounded-xl border border-[#27272A] bg-[#111113] p-8 text-center mb-8">
        <div className="w-12 h-12 rounded-full bg-[#18181A] border border-[#27272A] flex items-center justify-center mx-auto mb-4">
          <Zap size={22} className="text-[#F59E0B]" />
        </div>
        <span className="inline-block px-3 py-1 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] text-[11px] font-semibold uppercase tracking-wider mb-3">
          {t('automations.comingSoon')}
        </span>
        <p className="text-[13px] text-[#A1A1AA] leading-relaxed max-w-md mx-auto">
          {t('automations.comingSoonDesc')}
        </p>
      </div>

      {/* Feature preview cards */}
      <div className="flex flex-col gap-3">
        {features.map(({ Icon, title, desc }) => (
          <div
            key={title}
            className="flex items-start gap-4 p-4 rounded-xl border border-[#1F1F1F] bg-[#0D0D0F] opacity-60"
          >
            <div className="w-9 h-9 rounded-lg bg-[#18181A] border border-[#27272A] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon size={17} className="text-[#71717A]" />
            </div>
            <div>
              <h3 className="text-[13px] font-medium text-[#FAFAFA] mb-0.5">{title}</h3>
              <p className="text-[12px] text-[#71717A] leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

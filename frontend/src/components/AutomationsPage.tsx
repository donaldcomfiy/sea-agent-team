import { ArrowLeft, Zap, Clock, BarChart3, Bell } from 'lucide-react';
import { useI18n } from '../i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

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
    <div className="max-w-3xl mx-auto px-6 py-8 lg:py-10">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="gap-1.5 text-[13px] text-muted-foreground hover:text-foreground mb-6 -ml-2"
      >
        <ArrowLeft size={15} />
        <span>{t('settings.backToChat')}</span>
      </Button>

      <div className="mb-7">
        <h1 className="text-[24px] font-semibold tracking-tight mb-2 text-foreground">{t('automations.title')}</h1>
        <p className="text-[14px] text-muted-foreground leading-relaxed max-w-xl">{t('automations.subtitle')}</p>
      </div>

      <Card className="mb-6 border-dashed bg-card/80">
        <CardContent className="flex flex-col items-center text-center px-8 py-7">
          <div className="w-10 h-10 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/25 flex items-center justify-center mb-3">
            <Zap size={19} className="text-[#F59E0B]" />
          </div>
          <Badge
            variant="outline"
            className="mb-3 bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30 text-[11px] font-semibold uppercase tracking-wider"
          >
            {t('automations.comingSoon')}
          </Badge>
          <p className="text-[13.5px] text-muted-foreground leading-relaxed max-w-md">
            {t('automations.comingSoonDesc')}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        {features.map(({ Icon, title, desc }) => (
          <Card key={title} className="bg-card/60">
            <CardContent className="p-4">
              <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center mb-3">
                <Icon size={17} className="text-muted-foreground" />
              </div>
              <h3 className="text-[13px] font-medium text-foreground mb-1">{title}</h3>
              <p className="text-[12px] text-muted-foreground leading-relaxed">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

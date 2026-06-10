import { ArrowLeft, AtSign } from 'lucide-react';
import { agentMeta } from '../agents';
import { useI18n } from '../i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface AgentsPageProps {
  onBack: () => void;
}

const AGENTS = [
  {
    key: 'sea_team_lead',
    handle: 'TeamLead',
    desc: {
      en: 'Coordinates the workflow and routes tasks to the specialist agents.',
      de: 'Koordiniert den Workflow und verteilt Aufgaben an die Spezial-Agenten.',
    },
  },
  {
    key: 'landing_page_agent',
    handle: 'LandingPage',
    desc: {
      en: 'Analyzes landing pages, products, benefits, and conversion hooks.',
      de: 'Analysiert Landingpages, Produkte, Benefits und Conversion-Hebel.',
    },
  },
  {
    key: 'strategy_agent',
    handle: 'Strategy',
    desc: {
      en: 'Turns business context into campaign structure and positioning.',
      de: 'Übersetzt Business-Kontext in Kampagnenstruktur und Positionierung.',
    },
  },
  {
    key: 'search_intent_agent',
    handle: 'SearchIntent',
    desc: {
      en: 'Maps real search demand and intent stages from search patterns.',
      de: 'Ordnet Suchnachfrage und Intent-Stufen aus Suchmustern ein.',
    },
  },
  {
    key: 'keyword_agent',
    handle: 'Keywords',
    desc: {
      en: 'Builds keyword sets, match types, anchors, and negatives.',
      de: 'Erstellt Keywords, Match Types, Anchors und Negatives.',
    },
  },
  {
    key: 'copywriter_agent',
    handle: 'Copywriter',
    desc: {
      en: 'Writes RSA headlines and descriptions for the campaign.',
      de: 'Schreibt RSA-Headlines und Descriptions für die Kampagne.',
    },
  },
  {
    key: 'translator_agent',
    handle: 'Translation',
    desc: {
      en: 'Localizes campaign copy while preserving market-specific terms.',
      de: 'Lokalisiert Kampagnentexte und erhält marktspezifische Begriffe.',
    },
  },
  {
    key: 'optimizer_team_lead',
    handle: 'Optimizer',
    desc: {
      en: 'Coordinates optimization tasks for running campaigns.',
      de: 'Koordiniert Optimierungsaufgaben für laufende Kampagnen.',
    },
  },
  {
    key: 'excel_exporter_agent',
    handle: 'Output',
    desc: {
      en: 'Packages campaign output into export-ready tables and files.',
      de: 'Packt Kampagnen-Output in exportfähige Tabellen und Dateien.',
    },
  },
  {
    key: 'campaign_builder_agent',
    handle: 'CampaignBuilder',
    desc: {
      en: 'Creates the paused Google Ads campaign setup from approved outputs.',
      de: 'Erstellt das pausierte Google-Ads-Setup aus freigegebenem Output.',
    },
  },
] as const;

export default function AgentsPage({ onBack }: AgentsPageProps) {
  const { t, lang } = useI18n();

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
        <h1 className="text-[24px] font-semibold tracking-tight mb-2 text-foreground">
          {lang === 'de' ? 'Agenten' : 'Agents'}
        </h1>
        <p className="text-[14px] text-muted-foreground leading-relaxed max-w-2xl">
          {lang === 'de'
            ? 'Alle spezialisierten Google-Ads-Agenten im Workflow. Du kannst sie im Chat direkt per @Mention ansprechen.'
            : 'All specialized Google Ads agents in the workflow. You can address them directly in chat with @mentions.'}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        {AGENTS.map(({ key, handle, desc }) => {
          const meta = agentMeta(key);
          const Icon = meta.Icon;
          return (
            <Card key={key} className="bg-card/70 py-0">
              <CardContent className="px-3 py-2 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 ${meta.colorClass} ${key === 'sea_team_lead' ? 'border-0' : ''}`}>
                  {meta.avatarUrl ? (
                    <img src={meta.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <Icon size={15} strokeWidth={2.3} />
                  )}
                </div>
                <div className="min-w-0 flex-1 grid gap-1.5 sm:grid-cols-[150px_1fr] sm:items-center">
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <h3 className="text-[13px] font-medium text-foreground truncate">{meta.name[lang]}</h3>
                    <Badge variant="outline" className="h-4 w-fit gap-1 px-1.5 text-[9.5px] text-muted-foreground font-normal">
                      <AtSign size={9} />
                      {handle}
                    </Badge>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-snug sm:truncate">{desc[lang]}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

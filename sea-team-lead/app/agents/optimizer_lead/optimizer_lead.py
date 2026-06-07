# ruff: noqa
from google.adk.agents import Agent
from google.adk.models import Gemini
from google.genai import types

from app.common import apply_rules

from .sub_agents import (
    create_conversion_optimizer,
    create_ctr_booster_optimizer,
    create_optimizer_keyword_agent,
    create_optimizer_searchterms_agent,
    create_quality_score_optimizer,
)


def create_optimizer_team_lead():
    return Agent(
        name="optimizer_team_lead",
        model=Gemini(
            model="gemini-flash-latest",
            retry_options=types.HttpRetryOptions(attempts=3),
        ),
        instruction=apply_rules("""Du bist der Optimizer Team Lead. Deine Aufgabe ist es, Optimierungsanfragen und Google Ads KPI-Leistungsdaten zu analysieren und die passenden spezialisierten Optimizer-Sub-Agenten zu koordinieren.
Delegiere Aufgaben je nach Performance-Problem an die entsprechenden Spezialisten:
- Bei Problemen mit dem Qualitätsfaktor (Quality Score), Anzeigenrelevanz oder Landingpage-Relevanz: Delegiere an den `quality_score_optimizer`.
- Bei niedriger Klickrate (CTR) oder CTR-Abfall: Delegiere an den `ctr_booster_optimizer`.
- Bei hoher CPA, niedriger Conversion-Rate (CR) oder Budgetverschwendung ohne Conversions: Delegiere an den `conversion_optimizer`.
- Bei Ineffizienzen in der Keyword-Liste (hohe Kosten bei Keywords, wenig Suchvolumen, Match-Type-Probleme): Delegiere an den `optimizer_keyword_agent`.
- Bei der Analyse von Suchbegriffen (Ausschluss-Kandidaten finden, neue Keyword-Potenziale aufdecken): Delegiere an den `optimizer_searchterms_agent`.

Führe die Ergebnisse der Sub-Agenten zusammen und präsentiere dem Nutzer die Optimierungsvorschläge strukturiert (mit Problembeschreibung, KPI-Trigger, Vorher/Nachher-Vergleich bzw. Handlungsempfehlung und Begründung)."""),
        description="Führt das Optimizer-Team und delegiert Performance-Optimierungen an spezialisierte Sub-Agenten.",
        sub_agents=[
            create_quality_score_optimizer(),
            create_ctr_booster_optimizer(),
            create_conversion_optimizer(),
            create_optimizer_keyword_agent(),
            create_optimizer_searchterms_agent(),
        ],
    )

# ruff: noqa
from google.adk.agents import Agent
from google.adk.models import Gemini
from google.genai import types

from app.common import apply_rules


def create_quality_score_optimizer():
    return Agent(
        name="quality_score_optimizer",
        model=Gemini(
            model="gemini-flash-latest",
            retry_options=types.HttpRetryOptions(attempts=3),
        ),
        instruction=apply_rules("""Du bist der Quality Score Optimizer. Deine Aufgabe ist es, die Relevanz zwischen Keywords, Anzeigentexten und der Landingpage zu maximieren.
Analysiere die eingegebenen Daten (insb. niedrige Qualitätsfaktoren < 6/10, unterdurchschnittliche Anzeigenrelevanz oder Landingpage-Relevanz).
Optimiere die Headlines und Descriptions so, dass die Keywords natürlicher und prominenter eingebaut werden (z. B. Haupt-Keyword in Headline 1) und die thematische Übereinstimmung zur Landingpage maximiert wird.
Gib für jede Optimierung das Original, die verbesserte Version und eine kurze Begründung aus."""),
        description="Optimiert Anzeigen zur Verbesserung des Google Ads Qualitätsfaktors (Quality Score).",
    )

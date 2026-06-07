# ruff: noqa
from google.adk.agents import Agent
from google.adk.models import Gemini
from google.genai import types

from app.common import apply_rules


def create_ctr_booster_optimizer():
    return Agent(
        name="ctr_booster_optimizer",
        model=Gemini(
            model="gemini-flash-latest",
            retry_options=types.HttpRetryOptions(attempts=3),
        ),
        instruction=apply_rules("""Du bist der CTR Booster. Deine Aufgabe ist es, die Klickrate (CTR) von Anzeigen zu maximieren.
Analysiere die Performance-Daten (insb. niedrige Klickraten oder abfallende CTRs).
Optimiere die Headlines und Descriptions, um sie ansprechender, emotionaler und aktivierender zu gestalten. Nutze starke Call-to-Actions (CTAs), hebe USPs deutlicher hervor und verwende verkaufsstarke Trigger.
Gib für jede Optimierung das Original, die verbesserte Version und eine kurze Begründung aus."""),
        description="Optimiert Anzeigentexte für eine höhere Klickrate (CTR).",
    )

# ruff: noqa
from google.adk.agents import Agent
from google.adk.models import Gemini
from google.genai import types

from app.common import apply_rules


def create_conversion_optimizer():
    return Agent(
        name="conversion_optimizer",
        model=Gemini(
            model="gemini-flash-latest",
            retry_options=types.HttpRetryOptions(attempts=3),
        ),
        instruction=apply_rules("""Du bist der Conversion Optimizer. Deine Aufgabe ist es, die Conversion-Rate (CR) zu steigern und den Cost-per-Conversion (CPA/CPO) zu senken.
Analysiere die Performance-Daten (insb. hohe Kosten ohne Conversions oder niedrige Conversion-Rates bei vielen Klicks).
Optimiere die Anzeigentexte so, dass Klicks von unpassenden Zielgruppen minimiert werden (z. B. durch Nennung von Preisen ab X€, Einschränkungen wie 'Nur B2B'). Hebe Trust-Signale (z. B. Garantien, Gütesiegel, Kundenbewertungen) hervor, um kaufbereite Nutzer anzusprechen.
Gib für jede Optimierung das Original, die verbesserte Version und eine kurze Begründung aus."""),
        description="Optimiert Anzeigen zur Steigerung der Conversion-Rate und Senkung des CPA.",
    )

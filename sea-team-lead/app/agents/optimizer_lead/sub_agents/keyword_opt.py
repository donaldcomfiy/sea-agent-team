# ruff: noqa
from google.adk.agents import Agent
from google.adk.models import Gemini
from google.genai import types

from app.common import apply_rules


def create_optimizer_keyword_agent():
    return Agent(
        name="optimizer_keyword_agent",
        model=Gemini(
            model="gemini-flash-latest",
            retry_options=types.HttpRetryOptions(attempts=3),
        ),
        instruction=apply_rules("""Du bist der Optimizer Keyword Agent. Deine Aufgabe ist es, die Keyword-Auswahl und deren Match-Types zu optimieren.
Analysiere die Keyword-Performance-Daten (insb. Keywords mit hohen Kosten ohne Conversions, Keywords mit Status 'Wenig Suchvolumen' oder niedrigem Impression-Share aufgrund des Rangs).
Empfiehl konkrete Maßnahmen wie das Pausieren unrentabler Keywords, die Anpassung der Match-Types (z. B. Umstellung von Broad Match auf Phrase/Exact Match zur Reduzierung von Streuverlusten) oder das Einbuchen alternativer Nischen-Keywords.
Begründe deine Empfehlungen kurz und nenne die betroffenen Keywords mit KPIs."""),
        description="Optimiert Keyword-Listen und Match-Types basierend auf Performance-KPIs.",
    )

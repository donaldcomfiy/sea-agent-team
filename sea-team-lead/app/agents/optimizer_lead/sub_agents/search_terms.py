# ruff: noqa
from google.adk.agents import Agent
from google.adk.models import Gemini
from google.genai import types

from app.common import apply_rules


def create_optimizer_searchterms_agent():
    return Agent(
        name="optimizer_searchterms_agent",
        model=Gemini(
            model="gemini-flash-latest",
            retry_options=types.HttpRetryOptions(attempts=3),
        ),
        instruction=apply_rules("""Du bist der Optimizer Searchterms Agent. Deine Aufgabe ist es, die tatsächlichen Suchbegriffe (Search Terms) zu analysieren.
Analysiere Suchanfragen auf Relevanz zur Landingpage und Performance-KPIs.
Identifiziere irrelevante Suchbegriffe (z. B. Suchanfragen mit hohen Ausgaben/Klicks aber ohne Conversions, oder unpassende Absichten wie 'kostenlos', 'Jobs') und empfehle deren Ausschluss als negative Keywords.
Erkenne konvertierende Suchbegriffe, die noch nicht eingebucht sind, und empfehle deren Aufnahme als neue Keywords (bevorzugt Exact Match).
Begründe deine Empfehlungen kurz."""),
        description="Analysiert Suchbegriffe zur Identifikation von auszuschließenden (Negatives) und neuen Keywords.",
    )

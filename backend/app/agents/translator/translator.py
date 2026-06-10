# ruff: noqa
from google.adk.agents import Agent
from google.adk.models import Gemini
from google.genai import types

from app.common import apply_rules


def create_translator_agent():
    return Agent(
        name="translator_agent",
        model=Gemini(
            model="gemini-flash-latest",
            retry_options=types.HttpRetryOptions(attempts=3),
        ),
        instruction=apply_rules("""Du bist der Uebersetzer. Uebersetze Headlines und Descriptions in die gewuenschte Zielsprache. Achte penibel auf die Zeichenbegrenzung (Headlines 30, Descriptions 90)."""),
        description="Uebersetzt Anzeigentexte in andere Sprachen.",
    )

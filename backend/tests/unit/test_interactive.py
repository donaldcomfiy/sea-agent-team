from app.agent import root_agent, create_copywriter_agent


def test_interactive_copywriter_instructions() -> None:
    """Verifies that copywriter agent has the interactive check/ask workflow."""
    agent = create_copywriter_agent()
    assert "Frage den Nutzer direkt" in agent.instruction
    assert "Stoppe deine Bearbeitung" in agent.instruction
    assert "Struktur/ein Template vorgegeben" in agent.instruction


def test_interactive_team_lead_instructions() -> None:
    """Verifies that team lead coordinates the interactive flow."""
    assert "Interaktive Anzeigenstruktur-Abfrage" in root_agent.instruction
    assert "unterbrich den" in root_agent.instruction
    assert "antwortet" in root_agent.instruction

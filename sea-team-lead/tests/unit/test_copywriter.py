from app.agent import create_copywriter_agent


def test_copywriter_agent_configuration() -> None:
    """Verifies that the copywriter agent has correct instructions and boundaries."""
    agent = create_copywriter_agent()
    assert agent.name == "copywriter_agent"
    assert "Responsive Search Ads" in agent.instruction
    assert "15 Headlines" in agent.instruction
    assert "4 Descriptions" in agent.instruction
    assert "30 Zeichen" in agent.instruction
    assert "90 Zeichen" in agent.instruction

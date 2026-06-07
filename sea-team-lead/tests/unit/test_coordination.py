from app.agent import root_agent


def test_root_agent_coordination_rules() -> None:
    """Verifies that root_agent has the correct workflow coordination instructions."""
    assert root_agent.name == "sea_team_lead"
    assert "Keyword-Cluster" in root_agent.instruction
    assert "copywriter_agent" in root_agent.instruction
    assert "für JEDES" in root_agent.instruction
    assert "Zusammenführung" in root_agent.instruction

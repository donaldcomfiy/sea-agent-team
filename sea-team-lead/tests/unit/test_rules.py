from app.agent import root_agent, apply_rules, GLOBAL_RULES


def test_apply_rules() -> None:
    """Tests that apply_rules appends all global rules correctly."""
    test_instruction = "Du bist ein Test-Agent."
    result = apply_rules(test_instruction)
    assert test_instruction in result
    for rule in GLOBAL_RULES:
        assert rule in result


def test_agents_have_rules() -> None:
    """Tests that all active agents have all global rules applied to their instruction."""
    # Check root agent
    assert root_agent.instruction is not None
    for rule in GLOBAL_RULES:
        assert rule in root_agent.instruction

    # Check sub agents
    assert len(root_agent.sub_agents) > 0
    for sub in root_agent.sub_agents:
        assert sub.instruction is not None
        for rule in GLOBAL_RULES:
            assert rule in sub.instruction

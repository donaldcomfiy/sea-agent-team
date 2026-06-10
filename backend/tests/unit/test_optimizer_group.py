from app.agent import (
    root_agent,
    create_quality_score_optimizer,
    create_ctr_booster_optimizer,
    create_conversion_optimizer,
    create_optimizer_keyword_agent,
    create_optimizer_searchterms_agent,
    create_optimizer_team_lead,
    GLOBAL_RULES,
)


def test_optimizer_agents_exist() -> None:
    """Verifies that all specialized optimizer agents can be instantiated with correct names."""
    qs = create_quality_score_optimizer()
    ctr = create_ctr_booster_optimizer()
    conv = create_conversion_optimizer()
    kw = create_optimizer_keyword_agent()
    st = create_optimizer_searchterms_agent()
    lead = create_optimizer_team_lead()

    assert qs.name == "quality_score_optimizer"
    assert ctr.name == "ctr_booster_optimizer"
    assert conv.name == "conversion_optimizer"
    assert kw.name == "optimizer_keyword_agent"
    assert st.name == "optimizer_searchterms_agent"
    assert lead.name == "optimizer_team_lead"


def test_optimizer_team_lead_sub_agents() -> None:
    """Verifies that the optimizer team lead has registered all the correct sub-agents."""
    lead = create_optimizer_team_lead()
    sub_names = [sub.name for sub in lead.sub_agents]

    assert "quality_score_optimizer" in sub_names
    assert "ctr_booster_optimizer" in sub_names
    assert "conversion_optimizer" in sub_names
    assert "optimizer_keyword_agent" in sub_names
    assert "optimizer_searchterms_agent" in sub_names
    assert len(sub_names) == 5


def test_root_agent_has_optimizer_team_lead() -> None:
    """Verifies that root_agent delegates to optimizer_team_lead instead of optimizer_agent."""
    sub_names = [sub.name for sub in root_agent.sub_agents]

    assert "optimizer_team_lead" in sub_names
    assert "optimizer_agent" not in sub_names
    assert "optimizer_team_lead" in root_agent.instruction


def test_optimizer_agents_have_rules() -> None:
    """Tests that all new optimizer agents have the global rules applied to their instructions."""
    agents = [
        create_quality_score_optimizer(),
        create_ctr_booster_optimizer(),
        create_conversion_optimizer(),
        create_optimizer_keyword_agent(),
        create_optimizer_searchterms_agent(),
        create_optimizer_team_lead(),
    ]

    for agent in agents:
        assert agent.instruction is not None
        for rule in GLOBAL_RULES:
            assert rule in agent.instruction

import json
import os
from app.agent import (
    save_customer_profile,
    load_customer_profile,
    create_landing_page_agent,
    DATA_DIR,
    _get_profile_filepath,
)


def test_customer_profile_persistence_legacy_prose() -> None:
    """Saving a plain prose blob (old format) still works; load returns the new
    JSON-shaped envelope with the prose in `profile_prose` and `analysis: null`."""
    test_domain = "testdomain123.com"
    expected_filepath = _get_profile_filepath(test_domain)

    if os.path.exists(expected_filepath):
        os.remove(expected_filepath)

    # 1. Load when not existing
    res = load_customer_profile(test_domain)
    assert res == "Kein gespeichertes Profil gefunden."

    # 2. Save plain prose (legacy callers)
    test_content = "This is a test landing page analysis for testdomain123.com."
    save_res = save_customer_profile(test_domain, test_content)
    assert "Kundenprofil erfolgreich gespeichert unter" in save_res
    assert os.path.exists(expected_filepath)

    # 3. Load returns the new JSON envelope, prose in `profile_prose`.
    load_res = load_customer_profile(test_domain)
    parsed = json.loads(load_res)
    assert parsed["profile_prose"] == test_content
    assert parsed["analysis"] is None

    if os.path.exists(expected_filepath):
        os.remove(expected_filepath)


def test_customer_profile_persistence_structured() -> None:
    """Saving the new structured shape (`profile_prose` + `analysis`) round-trips
    through load_customer_profile so the LP agent can reuse the cached analysis."""
    test_domain = "structured-roundtrip.com"
    expected_filepath = _get_profile_filepath(test_domain)
    if os.path.exists(expected_filepath):
        os.remove(expected_filepath)

    analysis = {
        "type": "landing_page_analysis",
        "customer": "TestCo",
        "product": "Test Product",
        "domain": test_domain,
        "brand_usps": ["Made in TestLand"],
    }
    payload = json.dumps({"profile_prose": "Some prose summary.", "analysis": analysis})
    save_customer_profile(test_domain, payload)

    loaded = json.loads(load_customer_profile(test_domain))
    assert loaded["profile_prose"] == "Some prose summary."
    assert loaded["analysis"] == analysis

    if os.path.exists(expected_filepath):
        os.remove(expected_filepath)


def test_landing_page_agent_has_persistence_tools() -> None:
    """Verifies that the landing page agent has the new persistence tools registered."""
    agent = create_landing_page_agent()
    
    # Check if McpToolset is present in agent.tools (MongoDB mode)
    if any(t.__class__.__name__ == "McpToolset" for t in agent.tools):
        tool_names = []
        for t in agent.tools:
            if hasattr(t, "__name__"):
                tool_names.append(t.__name__)
            else:
                tool_names.append(t.__class__.__name__)
        assert "fetch_landing_page" in tool_names
        assert "McpToolset" in tool_names
        assert len(tool_names) == 2
    else:
        tool_names = [t.__name__ for t in agent.tools]
        assert "fetch_landing_page" in tool_names
        assert "load_customer_profile" in tool_names
        assert "save_customer_profile" in tool_names
        assert len(tool_names) == 3

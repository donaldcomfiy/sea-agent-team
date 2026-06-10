import os
from app.agent import create_landing_page_agent, mongodb_toolset

def test_mongodb_toolset_initialization() -> None:
    """Verifies that mongodb_toolset is correctly initialized if env var is set."""
    if os.environ.get("MDB_MCP_CONNECTION_STRING"):
        assert mongodb_toolset is not None
        agent = create_landing_page_agent()
        # Verify the toolset is present in tools
        tool_classes = [t.__class__.__name__ for t in agent.tools]
        assert "McpToolset" in tool_classes
    else:
        assert mongodb_toolset is None

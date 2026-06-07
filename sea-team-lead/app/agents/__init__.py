"""Top-level re-exports for every agent factory.

Each agent lives in its own folder under app/agents/<name>/ together with its
own skills/ subfolder (if any). This package re-exports the factories so
imports stay short: `from app.agents import create_strategy_agent`.
"""

from .team_lead import create_team_lead_agent, TEAM_LEAD_MEMORY_CHECK
from .landing_page import create_landing_page_agent
from .strategy import create_strategy_agent
from .search_intent import create_search_intent_agent
from .keyword import create_keyword_agent
from .copywriter import create_copywriter_agent
from .translator import create_translator_agent
from .excel_exporter import create_excel_exporter_agent, save_campaign_as_excel
from .campaign_builder import (
    create_campaign_builder_agent,
    list_google_ads_accounts,
    create_search_campaigns,
)
from .optimizer_lead import (
    create_optimizer_team_lead,
    create_quality_score_optimizer,
    create_ctr_booster_optimizer,
    create_conversion_optimizer,
    create_optimizer_keyword_agent,
    create_optimizer_searchterms_agent,
)

__all__ = [
    "create_team_lead_agent",
    "TEAM_LEAD_MEMORY_CHECK",
    "create_landing_page_agent",
    "create_strategy_agent",
    "create_search_intent_agent",
    "create_keyword_agent",
    "create_copywriter_agent",
    "create_translator_agent",
    "create_excel_exporter_agent",
    "save_campaign_as_excel",
    "create_campaign_builder_agent",
    "list_google_ads_accounts",
    "create_search_campaigns",
    "create_optimizer_team_lead",
    "create_quality_score_optimizer",
    "create_ctr_booster_optimizer",
    "create_conversion_optimizer",
    "create_optimizer_keyword_agent",
    "create_optimizer_searchterms_agent",
]

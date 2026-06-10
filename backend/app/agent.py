# ruff: noqa
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.

"""ADK entry point.

This file used to hold every agent factory in ~2300 lines. After the
agents/<name>/ refactor (Mai 2026) it's a thin assembly layer:

- `app.common` owns env loading, MongoDB MCP toolset, GLOBAL_RULES, directives
- each agent owns its own folder under `app/agents/<name>/` with code +
  optional `skills/` markdown next to it
- this file imports the team-lead factory, builds `root_agent`, exposes `app`

Backwards-compat: a number of unit tests historically import factories,
helpers and constants directly from `app.agent`. The re-export block at the
bottom keeps every old import path working without touching the tests.
"""

from google.adk.apps import App

from app.agents.team_lead import create_team_lead_agent


# --- Root agent ----------------------------------------------------------

root_agent = create_team_lead_agent()

app = App(
    root_agent=root_agent,
    name="app",
)


# --- Backwards-compat re-exports ----------------------------------------
# Tests under tests/unit/*.py import these names from `app.agent`.
# Keep this block so the test suite continues to work without modification.

from app.common import (  # noqa: E402, F401
    GLOBAL_RULES,
    apply_rules,
    cached_skill_from,
    json_block_directive,
    load_dotenv,
    mongodb_persist_directive,
    mongodb_toolset,
    mongodb_uri,
)

from app.agents.team_lead import TEAM_LEAD_MEMORY_CHECK  # noqa: E402, F401
from app.agents.landing_page import create_landing_page_agent  # noqa: E402, F401
from app.agents.landing_page.landing_page import (  # noqa: E402, F401
    DATA_DIR,
    _get_profile_filepath,
    fetch_landing_page,
    load_customer_profile,
    normalize_lp_url,
    save_customer_profile,
    LP_OUTPUT_SCHEMA,
)
from app.agents.strategy import create_strategy_agent  # noqa: E402, F401
from app.agents.strategy.strategy import STRATEGY_OUTPUT_SCHEMA  # noqa: E402, F401
from app.agents.search_intent import create_search_intent_agent  # noqa: E402, F401
from app.agents.search_intent.search_intent import SEARCH_INTENT_OUTPUT_SCHEMA  # noqa: E402, F401
from app.agents.keyword import create_keyword_agent  # noqa: E402, F401
from app.agents.keyword.keyword import KEYWORDS_OUTPUT_SCHEMA  # noqa: E402, F401
from app.agents.copywriter import create_copywriter_agent  # noqa: E402, F401
from app.agents.translator import create_translator_agent  # noqa: E402, F401
from app.agents.excel_exporter import (  # noqa: E402, F401
    create_excel_exporter_agent,
    save_campaign_as_excel,
)
from app.agents.campaign_builder import (  # noqa: E402, F401
    create_campaign_builder_agent,
    list_google_ads_accounts,
    create_search_campaigns,
)
from app.agents.optimizer_lead import (  # noqa: E402, F401
    create_optimizer_team_lead,
    create_quality_score_optimizer,
    create_ctr_booster_optimizer,
    create_conversion_optimizer,
    create_optimizer_keyword_agent,
    create_optimizer_searchterms_agent,
)

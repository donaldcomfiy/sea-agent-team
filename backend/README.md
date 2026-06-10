# SEA Team Lead

Multi-agent system for Google Ads Search campaigns, built on the [Google Agent Development Kit (ADK)](https://adk.dev/) with Gemini Flash. Given a landing page URL, the agents analyze it, build a full campaign strategy, research keywords, write ad copy, and optionally push the result into Google Ads — all in one conversation.

Built for the [Google Cloud Rapid Agent Hackathon](https://devpost.com/) (MongoDB partner track).

## Architecture

A **Team Lead** agent orchestrates ten specialist sub-agents in sequence:

| Agent | What it does |
|---|---|
| **Landing Page** | Scrapes and analyzes the target URL (USPs, audience, tone, conversion goals) |
| **Strategy** | Designs a 3-layer campaign structure (Brand Pure / Brand+Product / Generic) |
| **Search Intent** | Queries Google Autocomplete for real search phrases per strategy seed |
| **Keyword** | Builds keyword clusters with match types from the intent data |
| **Copywriter** | Writes RSA headlines + descriptions per ad group |
| **Translator** | Translates the campaign into other languages |
| **Optimizer Lead** | Reviews a running campaign against KPIs and suggests changes |
| **Excel Exporter** | Exports the plan as a styled Excel file |
| **Campaign Builder** | Pushes the plan into Google Ads via the API (paused, 1 EUR/day budget) |

Each agent persists its output slice into a shared MongoDB document (`customer_profiles`), so the next session can resume without re-running earlier steps.

## Quick Start

### Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python package manager)
- A [Gemini API key](https://aistudio.google.com/apikey)
- Node.js 22+ (only needed if using MongoDB persistence)

### Setup

```bash
cp .env.example .env
# Fill in VITE_GEMINI_API_KEY (required)
# Fill in MDB_MCP_CONNECTION_STRING (optional, enables persistence)

uv sync
```

### Run locally

```bash
# ADK playground (agent chat UI)
uv run adk web

# Or the FastAPI backend directly
uv run uvicorn app.fast_api_app:app --host 0.0.0.0 --port 8002
```

The FastAPI server exposes the ADK agent at `/api/chat` plus helper endpoints for Excel/Sheets export, health checks, and Google Ads OAuth.

### Run tests

```bash
uv run pytest tests/unit
```

## Frontend

The web frontend is a separate Vite/React project in the [`frontend/`](../frontend) directory. In development it runs on port 5180 and proxies API calls to the backend on port 8002. See its own README for setup.

## Docker

```bash
docker build -t sea-team-lead .
docker run -p 8080:8080 --env-file .env sea-team-lead
```

The image includes Node.js 22 and the MongoDB MCP server pre-installed. It does **not** include the frontend — deploy that separately.

## Google Ads Integration

Without Google Ads credentials the Campaign Builder runs in **mock mode** (simulates everything, creates nothing). To enable live mode:

1. Set up OAuth credentials in the Google Cloud Console
2. Add them to `.env` (see `.env.example` for the variable names)
3. Or use the in-app Settings page to complete the OAuth flow

Safety rules enforced in code (not overridable by the LLM):
- Only Search campaigns are created
- Everything is created **paused**
- Fixed daily budget of **1 EUR** per campaign

## Project Structure

```
backend/
├── app/
│   ├── agent.py                 # ADK entry point, root_agent
│   ├── common.py                # Shared infra (env, MongoDB MCP, rules)
│   ├── fast_api_app.py          # FastAPI server with export endpoints
│   ├── google_ads_client.py     # Google Ads API integration
│   └── agents/
│       ├── team_lead/           # Orchestrator agent
│       ├── landing_page/        # URL scraper + analyzer
│       ├── strategy/            # Campaign structure designer
│       ├── search_intent/       # Google Autocomplete researcher
│       ├── keyword/             # Keyword cluster builder
│       ├── copywriter/          # RSA ad text writer
│       ├── translator/          # Multi-language translator
│       ├── optimizer_lead/      # KPI-based campaign optimizer
│       ├── excel_exporter/      # Excel export agent
│       └── campaign_builder/    # Google Ads API push agent
├── data/template/               # Excel export template
├── tests/unit/                  # Unit tests
├── Dockerfile
├── pyproject.toml
└── .env.example
```

## License

Apache 2.0 — see [LICENSE](LICENSE).

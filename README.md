# SEA Team Lead Monorepo

This repository contains the two deployable parts of the project:

- `sea-team-lead/` - Python/FastAPI backend with the Google ADK multi-agent system
- `ads-ai-agent/` - React/Vite frontend for chat, settings, auth, and exports

## Local Development

Backend:

```bash
cd sea-team-lead
cp .env.example .env
uv sync
uv run uvicorn app.fast_api_app:app --host 0.0.0.0 --port 8002
```

Frontend:

```bash
cd ads-ai-agent
npm install
npm run dev
```

## Railway Deployment

Deploy as two separate Railway services from this monorepo:

1. Backend service root: `/sea-team-lead`
2. Frontend service root: `/ads-ai-agent`

Recommended backend environment variables:

- `VITE_GEMINI_API_KEY`
- `MDB_MCP_CONNECTION_STRING`
- `ALLOW_ORIGINS=https://<your-frontend-domain>`
- `FRONTEND_ORIGIN=https://<your-frontend-domain>`
- Firebase `VITE_FIREBASE_*` variables

Recommended frontend environment variables:

- `VITE_API_BASE_URL=https://<your-backend-domain>`
- Firebase `VITE_FIREBASE_*` variables

The frontend is built with Vite and served by `node server.js` in production.

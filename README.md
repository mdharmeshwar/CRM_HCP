# AI-First CRM HCP Module

Assignment-compliant HCP CRM focused on the **Log Interaction Screen** for life-sciences field representatives.

## Stack

- Frontend: React + Vite + Redux Toolkit
- Backend: Python + FastAPI
- Agent Framework: LangGraph
- LLM: Groq `gemma2-9b-it` with fallback-safe heuristics when no API key is configured
- Database: SQLAlchemy with MySQL/Postgres support, SQLite fallback for local demo
- Font: Google Inter

## What is implemented

- Structured HCP interaction logging form
- Conversational chat-assisted logging on the same screen
- LangGraph workflow that routes requests to CRM tools
- Five sales-focused tools:
  - `log_interaction`
  - `edit_interaction`
  - `search_hcp`
  - `generate_followup`
  - `interaction_summary`
- HCP directory, interaction history, follow-up tracking, analytics, and resetable demo seed data

## LangGraph role

The LangGraph agent acts as the orchestration layer for the HCP module. It:

1. Classifies rep intent from natural language.
2. Extracts structured HCP interaction fields.
3. Validates required data before saving.
4. Routes the request to the correct CRM tool.
5. Returns a response that the UI can use for chat feedback and form autofill.

## Setup

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Install backend dependencies

```bash
python -m pip install -r requirements.txt
```

### 3. Configure environment

Create `.env` from `.env.example` and set:

```bash
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=gemma2-9b-it
```

Optional:

- `DATABASE_URL`
- or MySQL variables
- or Postgres variables

If no SQL server is configured, the app uses local SQLite so the demo still runs.

## Run locally

Use two terminals.

### Terminal 1: FastAPI backend

```bash
npm run dev:api
```

Backend URL: `http://127.0.0.1:8000`

### Terminal 2: React frontend

```bash
npm run dev
```

Frontend URL: `http://127.0.0.1:5173`

The Vite dev server proxies `/api/*` to FastAPI automatically.

## Production-style run

Build the frontend:

```bash
npm run build
```

Then start FastAPI:

```bash
npm run start
```

If `dist/` exists, FastAPI serves the built React app.

## Key API routes

- `GET /api/auth/me`
- `GET /api/hcps`
- `POST /api/hcps`
- `GET /api/products`
- `GET /api/interactions`
- `POST /api/interactions`
- `PUT /api/interactions/{id}`
- `GET /api/followups`
- `POST /api/followups/{id}/toggle`
- `GET /api/analytics`
- `GET /api/db-status`
- `POST /api/admin/reset`
- `POST /api/chat`

## Submission notes

- The repo now uses the required FastAPI + LangGraph + Groq architecture.
- `gemma2-9b-it` is the default model.
- The chat workflow and structured form both support the Log Interaction assignment requirement.
- A 10 to 15 minute demo video should show:
  - form-based logging
  - chat-based logging
  - all five LangGraph tools
  - HCP list, history, analytics, and follow-up flow

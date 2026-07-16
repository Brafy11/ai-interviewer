# AI Interviewer

A full-stack AI interview coach built as the technical assessment for a hiring process at a US home-care company. Upload a resume, paste a job description, run an adaptive AI interview grounded in a real gap analysis between the two, and get a structured final report.

**Fastest way to see it work:** [QUICKSTART.md](QUICKSTART.md), about two minutes from clone to a live interview.

## Setup

There are two independent ways to run this app. Pick one; they don't run together and don't depend on each other. Docker packages a prebuilt frontend and the backend into one process on one port; local dev runs the backend and frontend as two separate live processes for iterating on code.

All commands below are run from a terminal at the repo root. Any shell works (PowerShell, Git Bash, Terminal, etc.); none of this is shell-specific.

### Docker (recommended)

Requires Docker Desktop installed and running.

```
cp .env.example .env   # add your Anthropic API key and set AI_MOCK=false
docker build -t ai-interviewer .
docker run -p 8000:8000 --env-file .env ai-interviewer
```

Then open http://localhost:8000, upload any resume, paste any job description (or click "Use example"), and start the interview.

**Live mode vs. mock mode.** With `AI_MOCK=false` and a real API key, the app does the actual work: extracts your uploaded resume and pasted JD into structured profiles, computes a real gap analysis, and asks interview questions grounded in it. This is the mode worth evaluating: a full interview costs a few cents in Haiku tokens (every call's token usage and cost is logged to the database, with a running total printed).

`AI_MOCK=true` (the default) instead serves every AI call from local JSON fixtures: same pipeline, same code paths, same schemas, zero API spend and no key required. It exists because the entire app was developed against it (see [Why mock mode](#why-mock-mode)). In mock mode the fixtures are fixed, so the gap analysis and questions always describe the same caregiver scenario regardless of what you upload; for the fixtures to read coherently, use `samples/maria-delgado-resume.pdf` with the "Use example" job description; that's the pair they were written against.

By default each `docker run` starts from an empty database. To keep session data between runs, use this version of the last command instead (stop the previous one with Ctrl+C first if it's still running):

```
docker run -p 8000:8000 --env-file .env -v ./data:/app/data ai-interviewer
```

### Local dev

Requires [uv](https://docs.astral.sh/uv/) and Node installed locally (no Docker needed). Two terminals: one for the backend, one for the frontend, both stay running while you work.

Backend, from the repo root:

```
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

Frontend, in a second terminal from the repo root:

```
cd frontend
npm install
npm run dev
```

The frontend runs on :3000 and proxies `/api/*` to the backend on :8000 (see `next.config.mjs`). This proxy only exists in dev; in the Docker image, FastAPI serves the built frontend directly, so there's no separate frontend server or proxy in production.

## Architecture

The interview is driven by a four-step pipeline:

1. **Extraction.** The uploaded resume (PDF, DOCX, TXT/MD, or an image of a resume; images go through a vision transcription call first) and the pasted job description are each turned into a structured profile (`ResumeProfile`, `JobProfile`) by an AI call that's told to only use information present in the text and to leave fields empty rather than guess. Extraction is lazy and cached: it runs at session creation, and the result is written back onto the resume/JD row, so reusing the same resume or JD in a later session doesn't pay for extraction again.

2. **Gap analysis.** The two profiles are compared to produce a `GapAnalysis`: strong matches, weak or missing requirements (with priority), and claims worth verifying out loud.

3. **Gap-driven interview.** The interview agent never sees the raw resume or job description text again. It only receives the gap analysis and the conversation so far, and picks the next question from there. This is the core design decision in the project: the interview is grounded in a structured artifact, not a fresh read of the source documents each turn. Termination is a hybrid rule enforced in code, not left to the model: minimum 5 questions, hard maximum 12, and between those bounds the agent's own `should_end` signal is honored.

4. **Report.** Once the interview ends, a final report is generated (once, then cached). Every strength and gap it lists has to trace back to either the gap analysis or something the candidate actually said.

### Why forced tool use

Structured output comes from defining a tool whose `input_schema` is the target Pydantic schema and forcing the model to call it with `tool_choice`, rather than asking the model to "return JSON" in prose. This lives in one place, `backend/app/agent/client.py`, which every agent module calls through. If the response doesn't validate against the schema, the error is fed back to the model for one retry before the call gives up. Anyone who has used Vercel AI SDK's `generateObject` with a Zod schema will recognize the shape: this is the same idea, implemented by hand against the raw Anthropic SDK instead of a library abstraction, since one of the goals here was to make every part of the agent loop visible and readable rather than delegated to a framework.

### Why mock mode

`AI_MOCK=true` (the default) makes every agent call read from a fixture in `backend/app/mocks/` instead of calling the Anthropic API, validated against the same Pydantic schema a real response would have to pass, so a drifted fixture fails loudly. This kept the whole build, and most of development, at zero API spend, while still exercising the full pipeline end to end. `AI_MOCK=false` switches to real calls, logs input/output token counts and cost to the database after every call, and prints the running total.

### State lives in the database, not the browser

A session's id lives in the URL as a query parameter, and `GET /api/sessions/{id}` returns the full session state (gap analysis, turns so far, current question) on every load. Refreshing mid-interview reloads that state from the database rather than losing it, because the frontend never treats its own component state as the source of truth. The backend is stateless between requests: each answer submission rebuilds the interview context from persisted rows, so a server restart mid-interview loses nothing.

## Environment variables

| Variable | Where it's used | Default | Purpose |
|---|---|---|---|
| `APP_ANTHROPIC_API_KEY` | backend | none, required in live mode | Anthropic API key. Deliberately not named `ANTHROPIC_API_KEY`, and read explicitly in `client.py`, so it can't be picked up silently by other tooling. |
| `AI_MOCK` | backend | `true` | `true` serves all AI calls from local fixtures at zero cost. `false` calls the real API and logs cost. |
| `DATA_DIR` | backend | `.` | Directory the SQLite file is written to. Set to `/app/data` in the Docker image; only worth setting yourself if you want the database somewhere other than the working directory. |

## Data is ephemeral by design

The SQLite database lives inside the container's filesystem, so a plain `docker run` starts every session from scratch. That's intentional for a reviewable demo: there's nothing to clean up between runs. If you want data to survive container recreation, mount `/app/data` to a host directory as shown in the setup section above.

## What I'd improve with more time

- Streaming responses instead of waiting for each full AI call to finish.
- Automated tests: the pure logic (the 5/12 termination boundary, history formatting) and route-level tests against FastAPI's TestClient in mock mode, which would cover the session loop and the race-recovery paths in CI at zero API cost.
- A login system, so sessions are tied to a specific user instead of just a session id in the URL. This also enables chat persistence: a candidate who loses their connection can come back and resume exactly where they left off.
- Harden the API surface: proper auth on every endpoint, rate limiting, and the other basics that a code-review-scale project skips.
- An admin-only dashboard summarizing applicants and their answers, with top candidates ranked by score and filtering by job position.
- Bounded retry with backoff for transient API errors (rate limits, 5xx); currently only schema-validation failures are retried.
- Host the database in a managed cloud service instead of local SQLite (Postgres, Firestore, or similar), with real migrations instead of dev-time drop-and-recreate.
- A more general request-handling layer, so the interview flow is one extension of the system rather than the whole thing.
- A voice interview option.
- Better loading states throughout the UI.

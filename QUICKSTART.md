# Quickstart: see it work in ~2 minutes

This is the guided happy path for reviewing the app. The [README](README.md) has the full setup options and architecture explanation.

## 1. Configure

Requires Docker Desktop running.

```
git clone <repo-url>
cd ai-interviewer
cp .env.example .env
```

Edit `.env`:

```
SIGMA_ANTHROPIC_API_KEY=<your Anthropic API key>
AI_MOCK=false
```

Live mode is the mode worth evaluating: the interview actually responds to what you upload and type. A full interview session costs a few cents in Claude Haiku tokens (per-call token usage and cost are logged, with a running total).

## 2. Build and run

```
docker build -t ai-interviewer .
docker run -p 8000:8000 --env-file .env ai-interviewer
```

Open **http://localhost:8000**.

## 3. Run an interview

1. **Upload a resume**: any real resume works (PDF, DOCX, TXT, or even a photo/screenshot of a resume). `samples/maria-delgado-resume.pdf` is included if you'd rather not use a real one; it's a caregiver persona written with deliberate gaps against the example JD.
2. **Paste a job description**, or click **"Use example"** for the Sigma HomeCare caregiver role from the assessment.
3. **Start the session.** You'll first see the gap analysis the system computed: strong matches, weak/missing requirements by priority, and claims to verify. This artifact is what drives the whole interview.
4. **Answer the questions.** Each question targets a specific gap. Give a vague answer on purpose at some point; the interviewer should press with a follow-up. The interview runs 5–12 questions and decides for itself when it has enough signal.
5. **Read the report.** Score, summary, strengths, and gaps, each grounded in the gap analysis or something you actually said.

Worth trying mid-interview: refresh the page. The session resumes at the current question, because all state lives in the database and the backend is stateless between requests.

## No API key handy?

`AI_MOCK=true` (the default if you skip step 1's edit) runs the identical pipeline against local fixtures at zero cost, no key needed. The trade-off: fixtures are fixed, so you'll see the same caregiver gap analysis and questions regardless of what you upload. For the fixtures to read coherently, use `samples/maria-delgado-resume.pdf` with the "Use example" job description; that's the pair they were written against.

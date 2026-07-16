// Typed client for the FastAPI backend.
//
// Every path is relative to `/api`. In production FastAPI serves this static
// export from the same origin, so the browser reaches the API directly. In dev,
// next.config.mjs rewrites `/api/*` to the FastAPI dev server on :8000.

const API = "/api";

// ---- Response shapes (mirror the Pydantic/route return values) --------------

export interface StrongMatch {
  requirement: string;
  evidence_from_resume: string;
}
export interface WeakOrMissing {
  requirement: string;
  why_weak: string;
  priority: "high" | "medium" | "low";
}
export interface ClaimToVerify {
  claim: string;
  why_verify: string;
}
export interface GapAnalysis {
  strong_matches: StrongMatch[];
  weak_or_missing: WeakOrMissing[];
  claims_to_verify: ClaimToVerify[];
}

export interface ResumeSummary {
  id: number;
  filename: string;
}
export interface JobDescriptionSummary {
  id: number;
  preview: string;
}
export interface SessionSummary {
  id: number;
  status: string;
  question_count: number;
  resume_filename: string | null;
  job_title: string | null;
  created_at: string; // ISO timestamp
}

export interface Turn {
  turn_index: number;
  question: string;
  answer: string | null;
  targets: string[];
  is_followup: boolean;
}
export interface Role {
  title: string | null;
  location: string | null;
  shift: string | null;
}
export interface SessionState {
  id: number;
  candidate_name: string | null;
  role: Role | null;
  status: string;
  question_count: number;
  created_at: string; // ISO timestamp
  gap_analysis: GapAnalysis;
  turns: Turn[];
  current_question: string | null;
}

export interface CreateSessionResult {
  id: number;
  gap_analysis: GapAnalysis;
  question: string;
  question_count: number;
}

export interface SubmitAnswerResult {
  done: boolean;
  question?: string;
  targets?: string[];
  is_followup?: boolean;
  question_count: number;
}

export interface Report {
  overall_score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  created_at: string; // ISO timestamp — when the report was generated
}

// ---- Core request helper ----------------------------------------------------

async function Req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) {
    throw new Error(await ErrorDetail(res));
  }
  return (await res.json()) as T;
}

/** Human-readable message from any thrown value (Req throws plain Errors). */
export function MessageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

// FastAPI puts human-readable messages in `detail` (a string for our HTTPExceptions,
// an array for 422 validation errors). Surface the string; fall back gracefully.
async function ErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // non-JSON error body
  }
  return `Request failed (${res.status}).`;
}

// ---- Endpoints --------------------------------------------------------------

export function ListResumes(): Promise<ResumeSummary[]> {
  return Req("/resumes");
}

export function UploadResume(file: File): Promise<ResumeSummary> {
  const form = new FormData();
  form.append("file", file);
  return Req("/resumes", { method: "POST", body: form });
}

export function ListJobDescriptions(): Promise<JobDescriptionSummary[]> {
  return Req("/job-descriptions");
}

export function CreateJobDescription(raw_text: string): Promise<{ id: number }> {
  return Req("/job-descriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_text }),
  });
}

export function ListSessions(): Promise<SessionSummary[]> {
  return Req("/sessions");
}

export function CreateSession(
  resume_id: number,
  jd_id: number,
): Promise<CreateSessionResult> {
  return Req("/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume_id, jd_id }),
  });
}

export function GetSession(id: number): Promise<SessionState> {
  return Req(`/sessions/${id}`);
}

// The response carries the next question (or completion), so the caller can
// update local state directly instead of an extra GetSession round trip —
// that second fetch used to be able to fail independently of the write and
// leave the UI misattributing the next answer to the wrong question.
export function SubmitAnswer(id: number, answer: string): Promise<SubmitAnswerResult> {
  return Req(`/sessions/${id}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer }),
  });
}

export function GetReport(id: number): Promise<Report> {
  return Req(`/sessions/${id}/report`);
}

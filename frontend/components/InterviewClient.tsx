"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Loader2,
  CircleCheck,
  MapPin,
  Clock,
  Lock,
  HelpCircle,
  CornerDownRight,
  AlertCircle,
  TriangleAlert,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { InterviewSkeleton } from "@/components/Skeletons";
import { GetSession, MessageOf, SubmitAnswer, type SessionState, type Turn } from "@/lib/api";
import { TargetLabel } from "@/lib/gaps";

const MAX_QUESTIONS = 12;
// Soft limit: typing past it is allowed so nothing is silently swallowed, but
// submission is blocked until the answer is back under it.
const CHAR_LIMIT = 1000;

// The candidate answering view — one focused question at a time, matching the
// reference. The session id lives in the URL (?id=), so this fetches
// GET /api/sessions/{id} on load and rebuilds from the DB; a refresh resumes at
// the current question. Typed answers are kept as a device-local draft until sent.

export default function InterviewClient() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");
  const id = idParam ? Number(idParam) : NaN;

  const [state, setState] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const Load = useCallback(async () => {
    if (!Number.isInteger(id)) {
      setLoadError("No interview id in the URL.");
      setLoading(false);
      return;
    }
    try {
      setState(await GetSession(id));
    } catch (e) {
      setLoadError(MessageOf(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void Load();
  }, [Load]);

  // Restore any device-local draft for this session.
  useEffect(() => {
    if (Number.isInteger(id) && typeof window !== "undefined") {
      const draft = window.localStorage.getItem(`draft:${id}`);
      if (draft) setAnswer(draft);
    }
  }, [id]);

  function OnAnswerChange(value: string) {
    setAnswer(value);
    if (typeof window !== "undefined") window.localStorage.setItem(`draft:${id}`, value);
  }

  async function OnSubmit() {
    if (!state || !answer.trim() || answer.length > CHAR_LIMIT || submitting) return;
    const submitted = answer.trim();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await SubmitAnswer(id, submitted);
      if (typeof window !== "undefined") window.localStorage.removeItem(`draft:${id}`);
      setAnswer("");
      setState(await GetSession(id));
    } catch (e) {
      setSubmitError(MessageOf(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <div className="min-h-screen">
        <SiteHeader sectionLabel="Candidate Interview" />
        <InterviewSkeleton status="Loading the interview…" />
      </div>
    );
  if (loadError || !state)
    return (
      <div className="min-h-screen">
        <SiteHeader sectionLabel="Candidate Interview" />
        <div className="mx-auto mt-20 max-w-md text-center">
          <p className="text-sm text-base-content/70">{loadError ?? "Interview not found."}</p>
          <Link href="/" className="btn btn-outline mt-6">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </div>
      </div>
    );

  const gap = state.gap_analysis;
  const turns = state.turns;
  const isComplete = state.status === "completed";
  const answeredCount = turns.filter((t) => t.answer !== null).length;
  const pending = turns.find((t) => t.answer === null) ?? null;

  const candidate = state.candidate_name?.trim() || "Candidate";
  const roleTitle = state.role?.title || "Candidate interview";

  // Every turn gets a number — follow-ups count against the same 12-question
  // budget as any other turn, so the index must agree with the header's cap.
  const label = pending
    ? { followup: pending.is_followup, n: pending.turn_index + 1 }
    : { followup: false, n: 0 };

  const topic = pending ? CoversFor(gap, pending) : "";

  return (
    <div className="min-h-screen">
      <SiteHeader sectionLabel="Candidate Interview" right={<CandidateChip name={candidate} />} />
      <div className="w-full px-8 py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-base-content/70 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
      </div>

      {isComplete ? (
        <div className="flex min-h-[70vh] w-full items-center justify-center px-8 pb-24">
          <CompletePanel id={id} />
        </div>
      ) : (
      <div className="grid w-full gap-16 px-8 pb-24 lg:grid-cols-[1fr_360px] lg:gap-10">
        {/* Answering column */}
        <section className="min-w-0 py-6">
          {pending && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="eyebrow text-primary">{roleTitle}</p>
                  <span className="inline-flex items-center gap-2 rounded-md border border-accent/70 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-widest text-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" /> In progress
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-base-content/70">
                  {state.role?.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" /> {state.role.location}
                    </span>
                  )}
                  {state.role?.shift && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-4 w-4" /> {state.role.shift}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-base-content/70">
                  {answeredCount} {answeredCount === 1 ? "response" : "responses"} saved ·
                  adaptive interview, up to {MAX_QUESTIONS} questions
                </p>

                <div className="mt-10 border-t border-base-300 pt-8">
                  <h1 className="font-display text-[2.7rem] font-medium tracking-tight text-base-content sm:text-[3.4rem]">
                    Question {label.n}
                  </h1>
                  <div className="mb-3 mt-4 flex flex-wrap items-center gap-2.5">
                    {topic && <span className="eyebrow text-primary">{topic}</span>}
                    {label.followup && (
                      <span className="inline-flex items-center gap-1 rounded bg-accent/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-accent">
                        <CornerDownRight className="h-3 w-3" /> Follow-up
                      </span>
                    )}
                  </div>
                  <p className="font-display text-[1.7rem] font-medium leading-[1.15] text-base-content sm:text-[2.35rem]">
                    {pending.question}
                  </p>
                </div>

                <div className="mt-8">
                  <textarea
                    className={`w-full rounded-box border bg-base-100 px-5 py-4 text-[1.05rem] leading-relaxed text-base-content shadow-card placeholder:text-base-content/40 focus:outline-none ${
                      answer.length > CHAR_LIMIT
                        ? "border-error focus:border-error"
                        : "border-base-300 focus:border-primary"
                    }`}
                    rows={7}
                    placeholder="Type your answer here…"
                    value={answer}
                    disabled={submitting}
                    aria-invalid={answer.length > CHAR_LIMIT}
                    onChange={(e) => OnAnswerChange(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void OnSubmit();
                    }}
                  />
                  <div className="mt-2 flex items-center justify-between gap-4 text-xs text-base-content/70">
                    <span className="inline-flex items-center gap-1.5">
                      <Bookmark className="h-3.5 w-3.5" />
                      {answer ? "Draft saved on this device" : "⌘↵ to submit"}
                    </span>
                    {answer.length > CHAR_LIMIT ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-error" role="alert">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        Over the limit — {answer.length} / {CHAR_LIMIT} characters
                      </span>
                    ) : answer.length === CHAR_LIMIT ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-warning" role="alert">
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                        Limit reached — {answer.length} / {CHAR_LIMIT} characters
                      </span>
                    ) : (
                      <span>
                        {answer.length} / {CHAR_LIMIT} characters
                      </span>
                    )}
                  </div>
                </div>

                {submitError && (
                  <div className="mt-4 flex items-start gap-2 text-sm text-error">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="mt-6">
                  <button
                    className="btn btn-primary uppercase tracking-widest"
                    onClick={() => void OnSubmit()}
                    disabled={
                      submitting || answer.trim().length === 0 || answer.length > CHAR_LIMIT
                    }
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                      </>
                    ) : (
                      <>
                        Submit answer <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </>
          )}

          <ResponseTrail gap={gap} turns={turns} />
        </section>

        {/* Candidate-facing info rail — the internal gap analysis is not shown here. */}
        <aside className="lg:border-l lg:border-base-300 lg:pl-10">
          <div className="sticky top-24 space-y-6 py-6">
            <InfoItem
              medallion={<CircleCheck className="h-4 w-4 text-secondary" strokeWidth={2} />}
              title="Responses saved"
            >
              Submitted answers are saved with this assessment and shown below the
              current question. They can’t be edited after you submit.
            </InfoItem>
            <div className="border-t border-base-300" />
            <InfoItem
              medallion={<span className="text-sm font-semibold text-base-content/70">1</span>}
              title="One question at a time"
            >
              You’ll see one focused question at a time, so you can answer in your own words.
            </InfoItem>
            <InfoItem
              medallion={<HelpCircle className="h-4 w-4 text-base-content/70" strokeWidth={2} />}
              title="Need help?"
            >
              You can pause and pick up later — your progress is saved on this device.
            </InfoItem>
            <div className="border-t border-base-300" />
            <p className="flex items-start gap-2 text-sm leading-relaxed text-base-content/70">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Your answers are used for this
              application and recruiter review.
            </p>
          </div>
        </aside>
      </div>
      )}
    </div>
  );
}

// Read-only trail of answered turns, newest first, rendered beneath the live
// question. Deliberately recessive: small serif questions, muted ink, clamped
// answers — the current question keeps all the visual weight.
function ResponseTrail({
  gap,
  turns,
}: {
  gap: SessionState["gap_analysis"];
  turns: Turn[];
}) {
  const answered = turns.filter((t) => t.answer !== null).reverse();
  if (answered.length === 0) return null;
  return (
    <div className="mt-16 border-t border-base-300 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">
          Your responses · {answered.length}
        </p>
        <p className="text-xs text-base-content/50">Newest first · read-only</p>
      </div>
      <ol className="mt-1 divide-y divide-base-300">
        {answered.map((t, i) => (
          <PastTurn key={t.turn_index} turn={t} topic={CoversFor(gap, t)} isNewest={i === 0} />
        ))}
      </ol>
    </div>
  );
}

// Past answers beyond this length get a clamp + "Show full answer" toggle.
const CLAMP_CHARS = 220;

function PastTurn({
  turn,
  topic,
  isNewest,
}: {
  turn: Turn;
  topic: string;
  isNewest: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const answer = turn.answer ?? "";
  const clampable = answer.length > CLAMP_CHARS;
  return (
    <li
      className={`grid grid-cols-[3rem_minmax(0,1fr)] py-6 ${isNewest ? "animate-rise" : ""}`}
    >
      {/* Hanging turn number — same sequence the big "Question N" heading counts. */}
      <span className="font-display text-lg font-medium leading-snug text-base-content/40">
        {String(turn.turn_index + 1).padStart(2, "0")}
      </span>
      <div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {topic && (
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-base-content/50">
              {topic}
            </span>
          )}
          {turn.is_followup && (
            <span className="inline-flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-accent/80">
              <CornerDownRight className="h-3 w-3" /> Follow-up
            </span>
          )}
        </div>
        <p className="mt-1 font-display text-[1.15rem] font-medium leading-snug text-base-content/80">
          {turn.question}
        </p>
        <p
          className={`mt-2.5 whitespace-pre-line border-l-2 border-base-300 pl-4 text-[0.95rem] leading-relaxed text-base-content/70 ${
            expanded ? "" : "line-clamp-3"
          }`}
        >
          {answer}
        </p>
        {clampable && (
          <button
            className="mt-1.5 text-xs font-semibold text-primary hover:underline"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Show less" : "Show full answer"}
          </button>
        )}
      </div>
    </li>
  );
}

function InfoItem({
  medallion,
  title,
  children,
}: {
  medallion: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-base-300 bg-base-100">
        {medallion}
      </span>
      <div>
        <p className="text-base font-semibold text-base-content">{title}</p>
        <p className="mt-1 text-[0.95rem] leading-relaxed text-base-content/70">{children}</p>
      </div>
    </div>
  );
}

function CandidateChip({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-content">
        {initials}
      </span>
      <span className="hidden text-sm font-medium text-base-content sm:block">{name}</span>
    </div>
  );
}

function CompletePanel({ id }: { id: number }) {
  return (
    <div className="w-full max-w-xl rounded-box border border-secondary/70 bg-secondary/10 p-10 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-secondary/70 bg-base-100">
        <CircleCheck className="h-6 w-6 text-secondary" strokeWidth={1.75} />
      </span>
      <h2 className="mt-4 font-display text-3xl font-medium text-base-content">Interview complete</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-base-content/70">
        Every gap that needed probing has been covered. The assistant can now score the
        candidate against the role.
      </p>
      <Link href={`/report?id=${id}`} className="btn btn-primary mt-7 uppercase tracking-widest">
        View the report <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function CoversFor(
  gap: SessionState["gap_analysis"],
  turn: Turn,
): string {
  return turn.targets
    .map((tid) => TargetLabel(gap, tid))
    .filter((s): s is string => Boolean(s))
    .join(" · ");
}

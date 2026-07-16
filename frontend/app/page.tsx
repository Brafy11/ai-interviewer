"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { InterviewSkeleton } from "@/components/Skeletons";
import {
  ArrowRight,
  Upload,
  Check,
  Plus,
  Clock,
  CircleCheck,
  Loader2,
  AlertCircle,
  BriefcaseBusiness,
  FileText,
  Lock,
} from "lucide-react";
import {
  CreateJobDescription,
  CreateSession,
  ListJobDescriptions,
  ListResumes,
  ListSessions,
  MessageOf,
  UploadResume,
  type JobDescriptionSummary,
  type ResumeSummary,
  type SessionSummary,
} from "@/lib/api";
import { FormatDate } from "@/lib/format";

// Mirrors MAX_UPLOAD_BYTES in backend/app/routes/resumes.py — checking here
// gives instant feedback instead of a round trip to hit the same backend cap.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Mirrors IMAGE_MEDIA_TYPES + the pdf/docx/txt/md branches in resumes.py. The
// <input accept> attribute only filters what the native file picker *shows* —
// "All files" still lets an unsupported type through — so this is what
// actually catches it before a network round trip.
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp"];
const UPLOAD_HINT = `a PDF, DOCX, TXT, or an image (PNG, JPG, WebP), up to ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`;

const EXAMPLE_JD = `Caregiver (CNA / HHA / PCA / Home Health Aide) — Clearhaven Home Care

Location: Fairview County, OH (in person)
Shift: 12:00 PM-6:00 PM, including weekend and evening shifts as needed
Pay: $15.50-$17.75 per hour, weekly pay

Clearhaven Home Care provides one-on-one care for seniors and adults with disabilities, helping clients remain safe, comfortable, and independent in their own homes.

Responsibilities:
- Assist clients with personal care, grooming, and hygiene
- Provide companionship and emotional support
- Help with meal preparation and light housekeeping
- Assist with mobility and daily activities
- Provide medication reminders
- Accompany clients to appointments and errands as needed
- Maintain accurate care documentation

Qualifications:
- Must be 18 years of age or older
- High school diploma or GED
- Valid driver's license or state-issued ID, and reliable transportation
- Current CPR and First Aid certification
- Current TB test, or willingness to obtain one
- Smartphone with GPS capability
- Compassionate, dependable, and professional attitude
- Bilingual (English/Spanish) a plus
- Previous caregiving experience preferred but not required`;

export default function DashboardPage() {
  const router = useRouter();
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [jds, setJds] = useState<JobDescriptionSummary[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  const [resumeId, setResumeId] = useState<number | null>(null);
  const [jdId, setJdId] = useState<number | null>(null);
  const [jdText, setJdText] = useState("");

  const [uploading, setUploading] = useState(false);
  const [savingJd, setSavingJd] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown locally above the upload button rather than the page-top banner,
  // since that banner is easy to miss once the user has scrolled to this card.
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void RefreshLists();
  }, []);

  async function RefreshLists() {
    try {
      const [r, j, s] = await Promise.all([
        ListResumes(),
        ListJobDescriptions(),
        ListSessions(),
      ]);
      setResumes(r);
      setJds(j);
      setSessions(s);
    } catch (e) {
      setError(MessageOf(e));
    }
  }

  async function OnUpload(file: File) {
    setUploadError(null);

    const dotIndex = file.name.lastIndexOf(".");
    const extension = dotIndex === -1 ? "" : file.name.slice(dotIndex).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setUploadError(`Unsupported file type. Please try again with ${UPLOAD_HINT}.`);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(`File is too large. Please try again with ${UPLOAD_HINT}.`);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const created = await UploadResume(file);
      setResumes((prev) => [...prev, created]);
      setResumeId(created.id);
    } catch (e) {
      setUploadError(`${MessageOf(e)} Please try again with ${UPLOAD_HINT}.`);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function OnSaveJd() {
    setError(null);
    setSavingJd(true);
    try {
      const { id } = await CreateJobDescription(jdText);
      setJds((prev) => [...prev, { id, preview: jdText.slice(0, 80) }]);
      setJdId(id);
      setJdText("");
    } catch (e) {
      setError(MessageOf(e));
    } finally {
      setSavingJd(false);
    }
  }

  async function OnBegin() {
    if (resumeId === null || jdId === null) return;
    setError(null);
    setStarting(true);
    try {
      const { id } = await CreateSession(resumeId, jdId);
      router.push(`/interview?id=${id}`);
    } catch (e) {
      setError(MessageOf(e));
      setStarting(false);
    }
  }

  const canBegin = resumeId !== null && jdId !== null && !starting;
  const orderedSessions = OrderSessions(sessions);
  const jdWords = jdText.trim() ? jdText.trim().split(/\s+/).length : 0;

  // While the backend reads both documents and writes the first question, show
  // the interview page's ghost so the content resolves in place after redirect.
  if (starting)
    return (
      <div className="min-h-screen">
        <SiteHeader sectionLabel="Candidate Interview" />
        <InterviewSkeleton status="Reading the résumé against the role…" />
      </div>
    );

  return (
    <div className="min-h-screen">
      <SiteHeader sectionLabel="Caregiver Assessment" />

      <main className="mx-auto max-w-screen-2xl px-10 pb-32">
        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-box border border-error/70 bg-error/10 px-4 py-3 text-sm text-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-12 pt-[clamp(22px,3vw,50px)] lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.82fr)] lg:items-start lg:gap-[clamp(48px,7vw,112px)]">
          {/* Left column: Hero + Resume card */}
          <div className="max-w-[670px]">
            {/* Hero */}
            <p className="eyebrow text-primary">Résumé-aware interviewing</p>
            <h1 className="mt-3 font-display text-[clamp(3.15rem,6vw,6.45rem)] font-normal leading-[0.93] tracking-[-0.055em] text-base-content">
              The interview starts
              <br />
              <em className="text-primary">where the résumé stops.</em>
            </h1>
            <p className="mt-7 max-w-[630px] text-[clamp(1.05rem,1.4vw,1.25rem)] leading-[1.7] text-base-content/70">
              The assistant reads a résumé and the job posting against each other — what’s
              proven, what’s thin, what’s unverified — then interviews only the difference,
              instead of re-asking what the paper already answers.
            </p>

            {/* Resume card — reference "role-preview" treatment */}
            <section className="mt-10 max-w-[610px] rounded-box border border-base-300 bg-base-100/45 px-6 pb-5 pt-6 sm:px-7">
              <div className="mb-5 flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-secondary text-secondary-content">
                  <FileText className="h-6 w-6" strokeWidth={2} />
                </span>
                <div>
                  <p className="eyebrow !mb-0 text-primary">Step 01 · Required</p>
                  <h2 className="font-display text-[1.7rem] font-medium leading-tight text-base-content">
                    The résumé
                  </h2>
                </div>
              </div>
              <div className="space-y-2 border-t border-base-300 pt-4">
                {resumes.map((r) => (
                  <SelectRow
                    key={r.id}
                    selected={resumeId === r.id}
                    onClick={() => setResumeId(r.id)}
                    primary={r.filename}
                  />
                ))}
                {resumes.length === 0 && <EmptyHint text="No résumés yet — upload one to begin." />}
              </div>
              {uploadError && (
                <div className="mt-4 flex items-start gap-2.5 rounded-box border border-error/70 bg-error/10 px-4 py-3 text-sm text-error">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void OnUpload(file);
                }}
              />
              <button
                type="button"
                className="btn btn-outline mt-5 w-full uppercase tracking-[0.12em]"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Upload a résumé
                  </>
                )}
              </button>
              <p className="mt-3 text-center text-xs text-base-content/45">
                PDF recommended — DOCX, TXT, and screenshots (PNG/JPG) work too. Max{" "}
                {MAX_UPLOAD_BYTES / (1024 * 1024)} MB.
              </p>
            </section>
          </div>

          {/* Right column: JD card + Begin, grouped together */}
          <div>
            <section className="rounded-xl border border-base-300 bg-base-100/80 p-[clamp(28px,3vw,42px)] shadow-soft backdrop-blur-xl">
              <div className="mb-6 flex items-start justify-between gap-5">
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-secondary text-secondary-content">
                    <BriefcaseBusiness className="h-6 w-6" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="eyebrow text-primary">The role</p>
                    <h2 className="font-display text-[clamp(1.7rem,2.5vw,2.35rem)] font-medium leading-[1.08] text-base-content">
                      Prepare the interview
                    </h2>
                  </div>
                </div>
                <span className="font-display text-[1.65rem] text-base-content/45" aria-label="Step 2">
                  02
                </span>
              </div>
              <div className="space-y-2">
                {jds.map((j) => (
                  <SelectRow
                    key={j.id}
                    selected={jdId === j.id}
                    onClick={() => setJdId(j.id)}
                    primary={j.preview || `Job description #${j.id}`}
                  />
                ))}
                {jds.length === 0 && <EmptyHint text="No roles yet — paste one below." />}
              </div>
              <label
                htmlFor="jd-input"
                className="mt-6 flex items-center justify-between text-[0.82rem] font-bold text-base-content"
              >
                Job description
                <span className="text-[0.72rem] font-bold text-primary">Required</span>
              </label>
              <textarea
                id="jd-input"
                className="mt-2 min-h-[285px] w-full resize-y rounded-field border border-base-300 bg-base-100/65 px-[18px] py-4 text-[0.88rem] leading-[1.55] text-base-content transition-[border-color,background,box-shadow] duration-150 placeholder:text-base-content/40 focus:border-secondary focus:bg-base-100 focus:outline-none focus:ring-4 focus:ring-secondary/10"
                placeholder="Paste the job posting…"
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
              />
              <div className="mt-2 flex items-center justify-between text-[0.72rem] text-base-content/70">
                <span>{jdWords} words</span>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[0.75fr_1.25fr]">
                <button
                  type="button"
                  className="btn btn-outline uppercase tracking-[0.12em]"
                  onClick={() => setJdText(EXAMPLE_JD)}
                >
                  Use example
                </button>
                <button
                  type="button"
                  className="btn btn-primary uppercase tracking-[0.12em]"
                  onClick={() => void OnSaveJd()}
                  disabled={savingJd || jdText.trim().length === 0}
                >
                  {savingJd ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> Save role
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* Begin */}
            <div className="mt-8 flex flex-col items-start gap-5 rounded-box border border-secondary/70 bg-secondary/10 p-8 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-base leading-relaxed text-base-content/80">
                {canBegin || starting
                  ? "Both picked. The assistant reads them against each other and surfaces the gaps."
                  : "Pick a résumé and a role to begin."}
              </p>
              <button
                type="button"
                className="btn btn-primary btn-lg w-full shrink-0 uppercase tracking-widest sm:w-auto"
                onClick={() => void OnBegin()}
                disabled={!canBegin}
              >
                {starting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Reading both sides…
                  </>
                ) : (
                  <>
                    Begin assessment <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>

            {/* Trust line */}
            <p className="mt-5 flex items-center gap-2 text-[0.82rem] font-semibold text-secondary">
              <Lock className="h-[18px] w-[18px] shrink-0" />
              AI organizes the evidence. A person makes the decision.
            </p>
          </div>
        </div>

        {/* Case files */}
        <section className="mt-24">
          <div className="mb-6 flex items-baseline gap-3 border-b border-base-300 pb-3">
            <h2 className="eyebrow">Case files</h2>
            <span className="text-xs font-semibold text-base-content/45">
              {String(sessions.length).padStart(2, "0")} on record
            </span>
          </div>
          {sessions.length === 0 ? (
            <EmptyHint text="Every assessment you run is saved here — resume it, or open its report." />
          ) : (
            <div className="divide-y divide-base-300">
              {orderedSessions.map((s, i) => (
                <SessionRow key={s.id} session={s} index={i} router={router} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SelectRow({
  selected,
  onClick,
  primary,
}: {
  selected: boolean;
  onClick: () => void;
  primary: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-field border px-3.5 py-3 text-left text-sm transition-colors ${
        selected
          ? "border-primary bg-primary/10 text-base-content"
          : "border-base-300 text-base-content/70 hover:border-primary/70 hover:text-base-content"
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          selected ? "border-primary bg-primary text-primary-content" : "border-base-300"
        }`}
      >
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="truncate">{primary}</span>
    </button>
  );
}

function SessionRow({
  session,
  index,
  router,
}: {
  session: SessionSummary;
  index: number;
  router: ReturnType<typeof useRouter>;
}) {
  const done = session.status === "completed";
  const href = done ? `/report?id=${session.id}` : `/interview?id=${session.id}`;
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="group flex w-full items-center gap-5 px-2 py-6 text-left transition-colors hover:bg-base-300/25"
    >
      <span className="text-xs font-semibold text-base-content/45">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-xl font-medium leading-tight text-base-content">
          {session.job_title ?? "Untitled role"}
        </p>
        <p className="mt-0.5 truncate text-sm text-base-content/70">
          {session.resume_filename ?? "unknown résumé"} · {session.question_count} questions
        </p>
      </div>
      <span className="hidden shrink-0 text-xs text-base-content/45 sm:block">
        {FormatDate(session.created_at)}
      </span>
      <span
        className={`flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-widest ${
          done ? "bg-secondary/10 text-secondary" : "bg-accent/15 text-accent"
        }`}
      >
        {done ? <CircleCheck className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
        {done ? "Complete" : "In progress"}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-base-content/45 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="rounded-field border border-dashed border-base-300 px-3 py-5 text-center text-sm text-base-content/45">
      {text}
    </p>
  );
}

// Case files ordering: in-progress before complete, then newest first. The
// autoincrement id is monotonic with inserts, so it orders by creation without
// parsing created_at (which migrated rows share anyway).
function OrderSessions(list: SessionSummary[]): SessionSummary[] {
  return [...list].sort((a, b) => {
    const aDone = a.status === "completed" ? 1 : 0;
    const bDone = b.status === "completed" ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return b.id - a.id;
  });
}

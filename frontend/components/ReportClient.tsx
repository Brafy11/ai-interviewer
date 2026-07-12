"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CircleCheck, TriangleAlert, RotateCcw, Sparkles } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { ReportSkeleton } from "@/components/Skeletons";
import GapBoard from "@/components/GapBoard";
import ResponseTrail from "@/components/ResponseTrail";
import { GetReport, GetSession, MessageOf, type Report, type SessionState } from "@/lib/api";
import { CoveredTargets } from "@/lib/gaps";
import { FormatDate } from "@/lib/format";

// Final assessment. Renders the exact report schema (overall_score, summary,
// strengths, gaps) as an editorial verdict, keeping the palette's meanings:
// olive for strength, burgundy for what's still open.

function Verdict(score: number) {
  if (score >= 70) return { label: "Strong fit", text: "text-secondary", bar: "bg-secondary" };
  if (score >= 40) return { label: "Promising, with gaps", text: "text-accent", bar: "bg-accent" };
  return { label: "Not a fit yet", text: "text-error", bar: "bg-error" };
}

export default function ReportClient() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");
  const id = idParam ? Number(idParam) : NaN;

  const [report, setReport] = useState<Report | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(id)) {
      setError("No interview id in the URL.");
      setLoading(false);
      return;
    }
    // The report payload doesn't carry the gap analysis; the session does.
    Promise.all([GetReport(id), GetSession(id)])
      .then(([r, s]) => {
        setReport(r);
        setSession(s);
      })
      .catch((e) => setError(MessageOf(e)))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen">
      <SiteHeader
        sectionLabel="Recruiter Review"
        right={<span className="eyebrow hidden sm:block">Final assessment</span>}
      />
      <main className="mx-auto max-w-screen-2xl px-10 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-base-content/70 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>

        {loading && <ReportSkeleton status="Scoring the interview…" />}

        {error && !loading && (
          <div className="mx-auto mt-20 max-w-md text-center">
            <p className="text-sm text-base-content/70">{error}</p>
            <div className="mt-6 flex justify-center gap-3">
              {Number.isInteger(id) && (
                <Link href={`/interview?id=${id}`} className="btn btn-outline uppercase tracking-widest">
                  Go to interview
                </Link>
              )}
              <Link href="/" className="btn btn-primary uppercase tracking-widest">
                Dashboard
              </Link>
            </div>
          </div>
        )}

        {report && !loading && <ReportBody report={report} session={session} />}
      </main>
    </div>
  );
}

function ReportBody({ report, session }: { report: Report; session: SessionState | null }) {
  const v = Verdict(report.overall_score);
  const pct = Math.max(0, Math.min(100, report.overall_score));

  return (
    <article className="mt-10 animate-rise">
      <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
        <p className="eyebrow !mb-0 text-primary">Final assessment</p>
        <span className="text-xs font-semibold uppercase tracking-widest text-base-content/45">
          {session && <>Interviewed {FormatDate(session.created_at)} · </>}
          Report {FormatDate(report.created_at)}
        </span>
      </div>
      {session?.candidate_name && (
        <p className="mt-3 font-display text-2xl text-base-content/80">
          Assessment of{" "}
          <span className="font-medium text-base-content">{session.candidate_name}</span>
          {session.role?.title && (
            <span className="text-base-content/60"> · {session.role.title}</span>
          )}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <h1 className={`font-display text-6xl font-medium tracking-tight sm:text-7xl ${v.text}`}>
          {v.label}
        </h1>
        <span className="text-2xl text-base-content/70">{report.overall_score} / 100</span>
      </div>

      <div className="mt-9">
        <div className="relative h-2 overflow-hidden rounded-full bg-base-300">
          <div
            className={`h-full rounded-full ${v.bar} transition-[width] duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[0.65rem] font-semibold uppercase tracking-widest text-base-content/45">
          <span>0 · not a fit</span>
          <span>40 · promising</span>
          <span>70 · strong</span>
        </div>
      </div>

      <figure className="mt-12 rounded-box border border-base-300 bg-base-100/60 p-7">
        <figcaption className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" strokeWidth={2} />
          <span className="eyebrow !mb-0 text-primary">AI interviewer insight</span>
        </figcaption>
        <blockquote className="mt-4 border-l-2 border-primary pl-5 font-display text-2xl italic leading-relaxed text-base-content">
          “{report.summary}”
        </blockquote>
        <p className="mt-4 text-xs leading-relaxed text-base-content/70">
          Synthesized from this candidate’s interview answers. A person makes the decision.
        </p>
      </figure>

      <div className="mt-14 grid gap-12 sm:grid-cols-2">
        <FindingList
          title="Strengths"
          items={report.strengths}
          icon={<CircleCheck className="h-4 w-4 text-secondary" strokeWidth={2} />}
          dot="bg-secondary"
        />
        <FindingList
          title="Gaps"
          items={report.gaps}
          icon={<TriangleAlert className="h-4 w-4 text-primary" strokeWidth={2} />}
          dot="bg-primary"
        />
      </div>

      {session && (
        <section className="mt-16 border-t border-base-300 pt-10">
          <p className="eyebrow text-primary">How this interview was targeted</p>
          <h2 className="mt-2 font-display text-3xl font-medium text-base-content">
            Résumé vs. role — the gaps we probed
          </h2>
          <div className="mt-8">
            <GapBoard gap={session.gap_analysis} covered={CoveredTargets(session.turns)} />
          </div>
        </section>
      )}

      {session && (
        <section className="mt-16 border-t border-base-300 pt-10">
          <p className="eyebrow text-primary">In the candidate’s own words</p>
          <h2 className="mt-2 font-display text-3xl font-medium text-base-content">
            The answers behind this assessment
          </h2>
          <ResponseTrail
            gap={session.gap_analysis}
            turns={session.turns}
            label="Candidate responses"
          />
        </section>
      )}

      <div className="mt-16 border-t border-base-300 pt-8">
        <Link href="/" className="btn btn-outline uppercase tracking-widest">
          <RotateCcw className="h-4 w-4" /> Run another assessment
        </Link>
      </div>
    </article>
  );
}

function FindingList({
  title,
  items,
  icon,
  dot,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
  dot: string;
}) {
  return (
    <div>
      <div className="mb-5 flex items-center gap-2.5 border-b border-base-300 pb-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-base-300 bg-base-100">
          {icon}
        </span>
        <h2 className="eyebrow">{title}</h2>
        <span className="ml-auto text-xs font-semibold text-base-content/45">
          {String(items.length).padStart(2, "0")}
        </span>
      </div>
      <ul className="space-y-4">
        {items.map((text, i) => (
          <li key={i} className="flex gap-3 text-[1.05rem] leading-relaxed text-base-content">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

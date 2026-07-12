"use client";

import { CornerDownRight } from "lucide-react";
import { CoversFor } from "@/lib/gaps";
import type { GapAnalysis, Turn } from "@/lib/api";

// Read-only trail of answered turns, newest first. Shared by the interview page
// (rendered beneath the live question) and the report page (the candidate's
// answers of record), so the two views are identical by construction.
//
// Deliberately recessive: small serif questions, muted ink — on the interview
// page the current question keeps the visual weight. Answers show in full.
export default function ResponseTrail({
  gap,
  turns,
  label = "Your responses",
}: {
  gap: GapAnalysis;
  turns: Turn[];
  label?: string;
}) {
  const answered = turns.filter((t) => t.answer !== null).reverse();
  if (answered.length === 0) return null;
  return (
    <div className="mt-16 border-t border-base-300 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">
          {label} · {answered.length}
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

function PastTurn({
  turn,
  topic,
  isNewest,
}: {
  turn: Turn;
  topic: string;
  isNewest: boolean;
}) {
  const answer = turn.answer ?? "";
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
        <p className="mt-2.5 whitespace-pre-line border-l-2 border-base-300 pl-4 text-[0.95rem] leading-relaxed text-base-content/70">
          {answer}
        </p>
      </div>
    </li>
  );
}

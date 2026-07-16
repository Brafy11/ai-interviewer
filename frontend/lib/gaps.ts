// Helpers for reading the gap analysis and the `targets` ids that the interview
// agent attaches to each question (e.g. "weak_or_missing:0", "claims_to_verify:1").

import type { GapAnalysis, Turn } from "./api";

type GapKind = "strong_matches" | "weak_or_missing" | "claims_to_verify";

function ParseTarget(target: string): { kind: GapKind; index: number } | null {
  const [kind, indexStr] = target.split(":");
  const index = Number(indexStr);
  if (
    Number.isInteger(index) &&
    (kind === "strong_matches" ||
      kind === "weak_or_missing" ||
      kind === "claims_to_verify")
  ) {
    return { kind, index };
  }
  return null;
}

/** Resolve a single target id to its human-readable label, or null if unknown. */
export function TargetLabel(gap: GapAnalysis, target: string): string | null {
  const parsed = ParseTarget(target);
  if (!parsed) return null;
  if (parsed.kind === "strong_matches")
    return gap.strong_matches[parsed.index]?.requirement ?? null;
  if (parsed.kind === "weak_or_missing")
    return gap.weak_or_missing[parsed.index]?.requirement ?? null;
  return gap.claims_to_verify[parsed.index]?.claim ?? null;
}

/** Human-readable topic line for a turn: its target labels, joined. */
export function CoversFor(gap: GapAnalysis, turn: Turn): string {
  return turn.targets
    .map((tid) => TargetLabel(gap, tid))
    .filter((s): s is string => Boolean(s))
    .join(" · ");
}

/** Set of target ids that at least one *answered* turn has addressed. */
export function CoveredTargets(
  turns: { answer: string | null; targets: string[] }[],
): Set<string> {
  const covered = new Set<string>();
  for (const turn of turns) {
    if (turn.answer !== null) {
      for (const t of turn.targets) covered.add(t);
    }
  }
  return covered;
}

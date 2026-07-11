import { CircleCheck, TriangleAlert, Search } from "lucide-react";
import type { GapAnalysis, WeakOrMissing } from "@/lib/api";

// The gap-analysis board — our signature, kept intact and recolored to the
// burgundy/cream system. Olive = confirmed/probed, burgundy→amber→taupe = the
// severity of what's still open. On the report it also tracks coverage
// (`covered` stamps a "Probed" badge on the items the interview hit).

const PRIORITY: Record<
  WeakOrMissing["priority"],
  { label: string; bar: string; chip: string }
> = {
  high: { label: "High", bar: "border-primary", chip: "bg-primary/10 text-primary" },
  medium: { label: "Med", bar: "border-accent", chip: "bg-accent/15 text-accent" },
  low: { label: "Low", bar: "border-base-300", chip: "bg-base-200 text-base-content/70" },
};

interface GapBoardProps {
  gap: GapAnalysis;
  covered?: Set<string>;
  activeIds?: string[];
  animate?: boolean;
}

export default function GapBoard({ gap, covered, activeIds, animate }: GapBoardProps) {
  const active = new Set(activeIds ?? []);
  let step = 0;
  const Delay = () => (animate ? { animationDelay: `${step++ * 55}ms` } : undefined);
  const ItemBase = (id: string, bar: string) =>
    [
      "border-l-2 pl-4 py-1",
      bar,
      animate ? "animate-rise" : "",
      active.has(id) ? "bg-base-100" : "",
    ].join(" ");

  return (
    <div className="space-y-8">
      <Section
        icon={<CircleCheck className="h-4 w-4 text-secondary" strokeWidth={2} />}
        label="Confirmed on paper"
        count={gap.strong_matches.length}
      >
        {gap.strong_matches.map((m, i) => (
          <div key={i} className={ItemBase(`strong_matches:${i}`, "border-secondary")} style={Delay()}>
            <p className="text-[0.95rem] font-semibold leading-snug text-base-content">{m.requirement}</p>
            <p className="mt-1 text-sm leading-relaxed text-base-content/70">{m.evidence_from_resume}</p>
          </div>
        ))}
      </Section>

      <Section
        icon={<TriangleAlert className="h-4 w-4 text-primary" strokeWidth={2} />}
        label="Gaps to probe"
        count={gap.weak_or_missing.length}
      >
        {gap.weak_or_missing.map((w, i) => {
          const id = `weak_or_missing:${i}`;
          const p = PRIORITY[w.priority];
          return (
            <div key={i} className={ItemBase(id, p.bar)} style={Delay()}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[0.95rem] font-semibold leading-snug text-base-content">{w.requirement}</p>
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest ${p.chip}`}
                >
                  {p.label}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-base-content/70">{w.why_weak}</p>
              {covered?.has(id) && <Probed />}
            </div>
          );
        })}
      </Section>

      <Section
        icon={<Search className="h-4 w-4 text-accent" strokeWidth={2} />}
        label="Claims to verify"
        count={gap.claims_to_verify.length}
      >
        {gap.claims_to_verify.map((c, i) => {
          const id = `claims_to_verify:${i}`;
          return (
            <div key={i} className={ItemBase(id, "border-accent")} style={Delay()}>
              <p className="text-[0.95rem] font-semibold leading-snug text-base-content">{c.claim}</p>
              <p className="mt-1 text-sm leading-relaxed text-base-content/70">{c.why_verify}</p>
              {covered?.has(id) && <Probed />}
            </div>
          );
        })}
      </Section>
    </div>
  );
}

function Section({
  icon,
  label,
  count,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2.5 border-b border-base-300 pb-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-base-300 bg-base-100">
          {icon}
        </span>
        <h3 className="eyebrow">{label}</h3>
        <span className="ml-auto text-xs font-semibold text-base-content/45">
          {String(count).padStart(2, "0")}
        </span>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Probed() {
  return (
    <p className="mt-2.5 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-widest text-secondary">
      <CircleCheck className="h-3.5 w-3.5" strokeWidth={2.5} /> Probed
    </p>
  );
}

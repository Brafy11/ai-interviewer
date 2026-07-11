import { Loader2 } from "lucide-react";

// Ghost layouts for the two AI-generated waits. Each mirrors the geometry of
// the page it precedes (interview / report) so the content appears to resolve
// in place, and carries one live status line so a 10-second wait never reads
// as frozen.

function StatusLine({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-base-content/70">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> {text}
    </span>
  );
}

export function InterviewSkeleton({ status }: { status: string }) {
  return (
    <>
      <div className="w-full px-8 py-4">
        <StatusLine text={status} />
      </div>
      <div className="grid w-full gap-16 px-8 pb-24 lg:grid-cols-[1fr_360px] lg:gap-10">
        {/* Answering column ghost */}
        <section className="min-w-0 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="skeleton h-3 w-44 rounded-sm" />
            <div className="skeleton h-8 w-32 rounded-md" />
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            <div className="skeleton h-4 w-36 rounded-sm" />
            <div className="skeleton h-4 w-28 rounded-sm" />
          </div>
          <div className="skeleton mt-3 h-4 w-72 rounded-sm" />
          <div className="mt-10 border-t border-base-300 pt-8">
            <div className="skeleton h-12 w-64 rounded-md" />
            <div className="skeleton mb-4 mt-5 h-3 w-40 rounded-sm" />
            <div className="space-y-3">
              <div className="skeleton h-8 w-full max-w-2xl rounded-md" />
              <div className="skeleton h-8 w-3/4 max-w-xl rounded-md" />
            </div>
          </div>
          <div className="skeleton mt-8 h-44 w-full rounded-box" />
          <div className="skeleton mt-6 h-12 w-48 rounded-field" />
        </section>

        {/* Info rail ghost */}
        <aside className="lg:border-l lg:border-base-300 lg:pl-10">
          <div className="space-y-6 py-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3.5">
                <div className="skeleton h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-40 rounded-sm" />
                  <div className="skeleton h-3 w-full rounded-sm" />
                  <div className="skeleton h-3 w-2/3 rounded-sm" />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}

export function ReportSkeleton({ status }: { status: string }) {
  return (
    <div className="mt-10">
      <StatusLine text={status} />
      <div className="skeleton mt-8 h-3 w-36 rounded-sm" />
      <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-3">
        <div className="skeleton h-16 w-full max-w-md rounded-md" />
        <div className="skeleton h-6 w-24 rounded-sm" />
      </div>

      {/* Score bar ghost */}
      <div className="skeleton mt-9 h-2 w-full rounded-full" />
      <div className="mt-3 flex justify-between">
        <div className="skeleton h-2.5 w-16 rounded-sm" />
        <div className="skeleton h-2.5 w-20 rounded-sm" />
        <div className="skeleton h-2.5 w-16 rounded-sm" />
      </div>

      {/* Insight card ghost */}
      <div className="skeleton mt-12 h-44 w-full rounded-box" />

      {/* Strengths / gaps ghost */}
      <div className="mt-14 grid gap-12 sm:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col}>
            <div className="mb-5 flex items-center gap-2.5 border-b border-base-300 pb-2.5">
              <div className="skeleton h-7 w-7 rounded-full" />
              <div className="skeleton h-3 w-24 rounded-sm" />
            </div>
            <div className="space-y-4">
              <div className="skeleton h-4 w-full rounded-sm" />
              <div className="skeleton h-4 w-5/6 rounded-sm" />
              <div className="skeleton h-4 w-3/4 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";

// Masthead: burgundy monogram, wordmark in tracked caps, an optional section
// label, and an optional right slot (the candidate chip on the interview view).
// Always sticky and full-width so every page shares the same topbar.
export default function SiteHeader({
  sectionLabel,
  right,
}: {
  sectionLabel?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-base-300 bg-base-200/90 backdrop-blur-md">
      <div className="flex h-16 w-full items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3" aria-label="Clearhaven Home Care home">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary font-display text-lg italic leading-none text-primary-content">
              C
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-base-content">
              Clearhaven Home Care
            </span>
          </Link>
          {sectionLabel && (
            <>
              <span className="hidden h-5 w-px bg-base-300 sm:block" />
              <span className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-base-content/70 sm:block">
                {sectionLabel}
              </span>
            </>
          )}
        </div>
        {right}
      </div>
    </header>
  );
}

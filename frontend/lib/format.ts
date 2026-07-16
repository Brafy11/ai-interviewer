// Display formatting helpers shared across pages.

/** Format a backend timestamp as a short local date ("Jul 11, 2026"). */
export function FormatDate(iso: string): string {
  // SQLite stores UTC timestamps without an offset marker; treat offset-less
  // strings as UTC so the local calendar date comes out right.
  const normalized = /Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`;
  return new Date(normalized).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

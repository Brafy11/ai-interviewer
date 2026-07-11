/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: `next build` emits plain HTML/JS/CSS into `out/`, which the
  // FastAPI container serves alongside the API (Phase 6). No Node server in prod.
  output: "export",

  // In production the export and the API are served from the same origin, so all
  // fetches use relative `/api/...` paths (see lib/api.ts). During `next dev` those
  // relative paths would hit the Next dev server on :3000 with no API behind them,
  // so we proxy them to the FastAPI dev server on :8000. This rewrite is dev-only:
  // `output: export` ignores rewrites, and returning none in production keeps the
  // build clean (no "rewrites won't work with export" warning).
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      { source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" },
    ];
  },
};

export default nextConfig;

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter carries the body and the tracked-caps eyebrows. The display serif is a
// Palatino-class system stack (set in globals.css) — matching the reference,
// zero web-font download.
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sigma HomeCare — Caregiver Assessment",
  description:
    "Read a résumé against the role, find the gaps, and interview the difference.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="sigma" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}

import { Geist_Mono, Manrope, Young_Serif } from "next/font/google";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Shell } from "@/components/Shell";
import { getPostSummaries } from "@/lib/posts";
import { TOWNSQUARE_ORIGIN, TOWNSQUARE_STYLESHEET } from "@/lib/townsquare";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const serif = Young_Serif({ subsets: ["latin"], variable: "--font-serif", weight: "400" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Kaio Barbosa-Chifan",
  description: "Software engineer building BazaarGhost and Herm TUI.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <head>
        <link rel="preconnect" href={TOWNSQUARE_ORIGIN} crossOrigin="" />
        <link rel="stylesheet" href={TOWNSQUARE_STYLESHEET} />
      </head>
      <body>
        <Shell posts={getPostSummaries()}>{children}</Shell>
        <Analytics />
      </body>
    </html>
  );
}

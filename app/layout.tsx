import { Geist_Mono, Instrument_Serif, Manrope } from "next/font/google";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Shell } from "@/components/Shell";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const serif = Instrument_Serif({ subsets: ["latin"], variable: "--font-serif", weight: "400" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Kaio Barbosa-Chifan",
  description: "Software engineer building BazaarGhost and Herm TUI.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

function posts() {
  const dir = path.join(process.cwd(), "content/posts");
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md") && file !== "sfde-docker-audit.md")
    .map((file) => {
      const meta = matter(fs.readFileSync(path.join(dir, file), "utf8"));
      return {
        slug: file.replace(/\.md$/, ""),
        title: String(meta.data.title || file.replace(/\.md$/, "")),
        date: String(meta.data.date instanceof Date ? meta.data.date.toISOString() : meta.data.date || ""),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <head>
        <link rel="preconnect" href="https://townsquare.cauenapier.com" crossOrigin="" />
        <link rel="stylesheet" href="https://townsquare.cauenapier.com/widget.css" />
      </head>
      <body>
        <Shell posts={posts()}>{children}</Shell>
        <Analytics />
      </body>
    </html>
  );
}

import { Spectral, Geist } from "next/font/google";
import { ViewTransition } from "react";
import "../styles/output.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { cn } from "@/lib/utils";
import { Shell } from "@/components/Shell";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const spectral = Spectral({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-spectral",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KAIO",
  description: "Kaio Barbosa-Chifan — Software Engineer & Creative Technologist",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable, spectral.variable)}>
      <body className={spectral.className}>
        <ViewTransition>
          <Shell>{children}</Shell>
        </ViewTransition>
        <Analytics />
      </body>
    </html>
  );
}

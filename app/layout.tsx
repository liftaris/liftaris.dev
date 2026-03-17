import { Spectral, Geist } from "next/font/google";
import "../styles/output.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const spectral = Spectral({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-spectral",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KAIO",
  description: "Starter for a blog with Next.js.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className={spectral.className}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}

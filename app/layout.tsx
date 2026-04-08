import { Spectral, Geist_Mono, Lora, Poppins } from "next/font/google";
import { ViewTransition } from "react";
import "./globals.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Shell } from "@/components/Shell";
import localFont from "next/font/local";

const fontSans = Poppins({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: "400",
});

const fontSerif = Lora({
  subsets: ["latin"],
  variable: "--font-serif",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const fontSpectral = Spectral({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-spectral",
  display: "swap",
});

const blueScreenFont = localFont({
  src: "../public/fonts/BlueScreenPersonalUseRegular-0W1M9.ttf",
  variable: "--font-bluescreen",
});

export const metadata: Metadata = {
  title: "KAIO",
  description:
    "Kaio Barbosa-Chifan — Software Engineer & Creative Technologist",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} ${fontSpectral.variable} ${blueScreenFont.variable}`}
    >
      <body className="font-sans antialiased">
        <ViewTransition>
          <Shell>{children}</Shell>
        </ViewTransition>
        <Analytics />
      </body>
    </html>
  );
}

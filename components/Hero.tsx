"use client";

import { GridPattern } from "@/components/ui/grid-pattern";
import { TopographicPattern, RadialBurst } from "@/components/ui/flowing-lines";

interface HeroProps {
  title: string;
  subtitle?: string;
}

export default function Hero({ title, subtitle }: HeroProps) {
  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden border-b border-border">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-card" />
      
      {/* Grid pattern background */}
      <GridPattern
        width={60}
        height={60}
        strokeDasharray="4 4"
        className="opacity-30"
        squares={[
          [1, 1],
          [4, 2],
          [2, 4],
          [6, 3],
          [3, 6],
          [8, 5],
        ]}
      />
      
      {/* Topographic flowing lines - right side */}
      <TopographicPattern className="opacity-60" />
      
      {/* Decorative geometric elements */}
      <div className="absolute top-20 left-10 size-32 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" />
      <div className="absolute bottom-32 right-20 size-24 rounded-full border border-primary/30 bg-gradient-to-tl from-primary/10 to-transparent" />
      <div className="absolute top-1/3 right-1/4 size-16 rounded-lg border border-border rotate-12" />
      
      {/* Radial burst at bottom */}
      <RadialBurst className="bottom-0 left-1/4 w-[400px] h-[200px] opacity-40" />
      
      {/* Accent circles */}
      <div className="absolute top-1/4 right-1/3 size-3 rounded-full bg-primary/60" />
      <div className="absolute bottom-1/3 left-1/4 size-2 rounded-full bg-primary/40" />
      <div className="absolute top-1/2 right-1/6 size-4 rounded-full border-2 border-primary/30" />
      
      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 backdrop-blur-sm">
          <div className="size-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm text-muted-foreground">Software Engineer & Creator</span>
        </div>
        
        <h1 className="mb-6 text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          {title}
        </h1>
        
        {subtitle && (
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
            {subtitle}
          </p>
        )}
        
        {/* CTA area */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="#posts"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
          >
            View Posts
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </a>
          <a
            href="/about"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-all hover:border-primary hover:bg-primary/5"
          >
            Learn More
          </a>
        </div>
      </div>
      
      {/* Bottom gradient fade */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}

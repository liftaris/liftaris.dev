"use client";

import Image from "next/image";
import Link from "next/link";
import { Github, Linkedin, Mail, ArrowRight } from "lucide-react";
import ChatWidget from "./ChatWidget";

interface BlogPost {
  frontmatter: {
    title: string;
    date: string;
    hero_image: string;
    [key: string]: unknown;
  };
  markdownBody: string;
  filename: string;
}

interface BentoHeroProps {
  siteTitle: string;
  posts: BlogPost[];
}

function reformatDate(fullDate: string): string {
  const date = new Date(fullDate);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Circle with quadrants component
function CircleQuadrant({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`text-border ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="50" cy="50" r="45" />
      <line x1="50" y1="5" x2="50" y2="95" />
      <line x1="5" y1="50" x2="95" y2="50" />
      <path
        d="M 50 50 L 50 5 A 45 45 0 0 1 95 50 Z"
        fill="currentColor"
        fillOpacity="0.15"
      />
    </svg>
  );
}

// Radial burst SVG component
function RadialBurst() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 200 100"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <g className="text-border" stroke="currentColor" strokeWidth="0.5" fill="none" opacity="0.5">
        {Array.from({ length: 17 }).map((_, i) => {
          const angle = (i / 16) * Math.PI;
          const x2 = 100 + Math.cos(angle) * 120;
          const y2 = 100 - Math.sin(angle) * 100;
          return <line key={i} x1="100" y1="100" x2={x2} y2={y2} />;
        })}
      </g>
    </svg>
  );
}

// Flowing lines SVG for blog panel
function FlowingLines() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 400 700"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g stroke="var(--primary)" fill="none" strokeWidth="1" strokeDasharray="4 8" opacity="0.4">
        <path d="M0 50 Q 100 35, 200 50 T 400 50" />
        <path d="M0 80 Q 100 65, 200 80 T 400 80" />
        <path d="M0 110 Q 100 95, 200 110 T 400 110" />
        <path d="M0 140 Q 100 125, 200 140 T 400 140" />
        <path d="M0 170 Q 100 155, 200 170 T 400 170" />
        <path d="M0 200 Q 100 185, 200 200 T 400 200" />
      </g>
      
      <g stroke="var(--primary)" fill="none" strokeWidth="1" strokeDasharray="3 6" opacity="0.35">
        <ellipse cx="380" cy="580" rx="50" ry="30" />
        <ellipse cx="380" cy="580" rx="90" ry="55" />
        <ellipse cx="380" cy="580" rx="140" ry="85" />
        <ellipse cx="380" cy="580" rx="200" ry="120" />
        <ellipse cx="380" cy="580" rx="270" ry="160" />
        <ellipse cx="380" cy="580" rx="350" ry="205" />
        <ellipse cx="380" cy="580" rx="440" ry="255" />
      </g>
    </svg>
  );
}

// Nav links component
function NavLinks({ className }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-around overflow-hidden rounded-2xl border-2 border-border ${className}`}>
      <RadialBurst />
      <Link
        href="/about"
        className="relative z-10 flex h-full flex-1 items-center justify-center text-base font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        About
      </Link>
      <a
        href="https://github.com/kaiobarb"
        target="_blank"
        rel="noopener noreferrer"
        className="relative z-10 flex h-full flex-1 items-center justify-center text-muted-foreground transition-colors hover:text-primary"
      >
        <Github className="size-6 lg:size-7" />
      </a>
      <a
        href="https://linkedin.com/in/kaio"
        target="_blank"
        rel="noopener noreferrer"
        className="relative z-10 flex h-full flex-1 items-center justify-center text-muted-foreground transition-colors hover:text-primary"
      >
        <Linkedin className="size-6 lg:size-7" />
      </a>
      <a
        href="mailto:contact@kaio.dev"
        className="relative z-10 flex h-full flex-1 items-center justify-center text-muted-foreground transition-colors hover:text-primary"
      >
        <Mail className="size-6 lg:size-7" />
      </a>
    </div>
  );
}

// Blog posts panel component
function BlogPanel({ posts, className }: { posts: BlogPost[]; className?: string }) {
  return (
    <div className={`relative flex flex-col overflow-hidden rounded-3xl border-2 border-border ${className}`}>
      <FlowingLines />
      <div className="relative z-10 flex flex-1 flex-col p-3 lg:p-5">
        <div className="mb-2 flex items-center justify-between lg:mb-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Posts</h2>
          <span className="text-xs text-muted-foreground/50">{posts.length}</span>
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-hidden lg:gap-3">
          {posts.slice(0, 6).map((post) => (
            <Link
              key={post.filename}
              href={`/blog/${post.filename}`}
              className="group relative flex flex-1 overflow-hidden rounded-2xl border-2 border-border/50 transition-all hover:border-primary/50"
            >
              {/* Post image - 50% opacity, fills entire card */}
              <Image
                src={post.frontmatter.hero_image}
                alt={post.frontmatter.title}
                fill
                className="object-cover opacity-50 transition-all duration-300 group-hover:scale-105 group-hover:opacity-60"
              />
              
              {/* Post info overlay */}
              <div className="relative z-10 flex flex-1 flex-col justify-end p-3 lg:p-4">
                <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary lg:text-base">
                  {post.frontmatter.title}
                </h3>
                <time className="mt-1 text-[10px] text-muted-foreground lg:text-xs" dateTime={post.frontmatter.date}>
                  {reformatDate(post.frontmatter.date)}
                </time>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// Decorative stacked boxes
function StackedBoxes({ className }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex-1 rounded-2xl border-2 border-border" />
      <div className="flex-1 rounded-2xl border-2 border-border" />
      <div className="flex-1 rounded-2xl border-2 border-border" />
      <div className="flex-1 rounded-2xl border-2 border-border" />
    </div>
  );
}

export default function BentoHero({ siteTitle, posts }: BentoHeroProps) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-background p-4 lg:p-8">
      
      {/* ==================== PORTRAIT / MOBILE LAYOUT ==================== */}
      {/* 
        Row 1: Name (flex-grow) + Circle
        Row 2: Nav
        Row 3: Large Image
        Row 4: Stacked boxes (1/3) + Posts (2/3)
        Heights: 4 = 3 > 2 ~= 1
      */}
      <div className="flex h-full w-full flex-col gap-4 lg:hidden">
        
        {/* Row 1: Name + Circle */}
        <div className="flex h-16 items-center gap-4">
          <h1 className="flex-1 text-3xl font-black tracking-tighter text-foreground sm:text-4xl">
            {siteTitle.toLowerCase()} <span className="text-muted-foreground">barbosa-chifan</span>
          </h1>
          <CircleQuadrant className="size-14 shrink-0 sm:size-16" />
        </div>

        {/* Row 2: Nav */}
        <NavLinks className="h-14 shrink-0" />

        {/* Row 3: Large Image + Chat */}
        <div className="relative flex-[3] overflow-hidden rounded-3xl border-2 border-border">
          <Image
            src="/bg-optimized.jpg"
            alt="Background"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
          <ChatWidget />
        </div>

        {/* Row 4: Stacked boxes (1/3) + Posts (2/3) */}
        <div className="flex flex-[4] gap-4">
          <StackedBoxes className="flex-1" />
          <BlogPanel posts={posts} className="flex-[2]" />
        </div>
      </div>

      {/* ==================== LANDSCAPE / DESKTOP LAYOUT ==================== */}
      {/* 
        ┌──────────────────────────┬─────┬────────────────────┐
        │                          │     │                    │
        │     Large Image          │ Dec │   Blog Posts       │
        │     (bg.jpg)             │     │   (flowing lines)  │
        │                          ├─────┤                    │
        ├──────────┬───────────────┤     │                    │
        │  Name    │  Nav Bar      │     │                    │
        │          │  (with flare) │     │                    │
        └──────────┴───────────────┴─────┴────────────────────┘
      */}
      <div className="hidden h-full w-full gap-5 lg:flex">
        
        {/* LEFT SECTION (~2/3) */}
        <div className="flex flex-[2] flex-col gap-5">
          
          {/* Top: Large image + Decorative column */}
          <div className="flex flex-1 gap-5">
            
            {/* Large Image + Chat */}
            <div className="relative flex-1 overflow-hidden rounded-3xl border-2 border-border">
              <Image
                src="/bg-optimized.jpg"
                alt="Background"
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
              <ChatWidget />
            </div>

            {/* Decorative column */}
            <div className="flex w-24 flex-col gap-4">
              <StackedBoxes className="flex-1" />
              <CircleQuadrant className="aspect-square w-full" />
            </div>
          </div>

          {/* Bottom: Name + Nav (nav grows to fill) */}
          <div className="flex h-32 gap-5">
            
            {/* Name - shrink to fit content */}
            <div className="flex shrink-0 items-end">
              <h1 className="text-7xl font-black tracking-tighter text-foreground xl:text-8xl">
                {siteTitle.toLowerCase()} <span className="text-muted-foreground">barbosa-chifan</span>
              </h1>
            </div>

            {/* Nav - grows to fill remaining space */}
            <NavLinks className="flex-1" />
          </div>
        </div>

        {/* RIGHT SECTION: Blog (~1/3) */}
        <BlogPanel posts={posts} className="flex-1" />
      </div>
    </div>
  );
}

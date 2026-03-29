"use client";

import Link from "next/link";
import { Github } from "lucide-react";

interface HeaderProps {
  siteTitle?: string;
}

export default function Header({ siteTitle }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8"
        role="navigation"
        aria-label="main navigation"
      >
        {/* Logo / Site Title */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-primary-foreground">K</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
              {siteTitle}
            </span>
            <span className="text-xs text-muted-foreground">
              Barbosa-Chifan
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-6">
          <Link
            href="/about"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            About
          </Link>
          <Link
            href="https://github.com/kaiobarb"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center size-9 rounded-lg border border-border hover:border-primary hover:bg-primary/10 transition-all"
            title="GitHub"
          >
            <Github className="size-4 text-muted-foreground" />
          </Link>
        </div>
      </nav>
    </header>
  );
}

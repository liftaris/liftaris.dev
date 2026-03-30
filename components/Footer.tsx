import Link from "next/link";
import { Github, Linkedin, Mail } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-card/30">
      {/* Gradient accent line at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <Separator />

      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
          {/* Left: Brand / Copyright */}
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-sm font-bold text-primary">K</span>
              </div>
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                KAIO
              </span>
            </Link>
            <p className="text-xs text-muted-foreground">
              &copy; {currentYear} Kaio Barbosa-Chifan
            </p>
          </div>

          {/* Center: Links */}
          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Home
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Link
              href="/about"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              About
            </Link>
          </nav>

          {/* Right: Social links */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              render={<a href="https://github.com/kaiobarb" target="_blank" rel="noopener noreferrer" title="GitHub" />}
            >
              <Github className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              render={<a href="https://linkedin.com/in/kaio" target="_blank" rel="noopener noreferrer" title="LinkedIn" />}
            >
              <Linkedin className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              render={<a href="mailto:contact@kaio.dev" title="Email" />}
            >
              <Mail className="size-4" />
            </Button>
          </div>
        </div>

        {/* Bottom attribution */}
        <Separator className="my-8" />
        <p className="text-center text-xs text-muted-foreground/60">
          Built with Next.js & Tailwind CSS
        </p>
      </div>
    </footer>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWebHaptics } from "web-haptics/react";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/posts", label: "Posts" },
] as const;

interface NavbarProps {
  onToggleSidebar: () => void;
}

export function Navbar({ onToggleSidebar }: NavbarProps) {
  const pathname = usePathname();
  const haptic = useWebHaptics();

  return (
    <header className="flex items-center justify-between px-6 py-3">
      <Link href="/" className="text-lg font-bold tracking-tight text-foreground hover:text-primary transition-colors">
        KAIO
      </Link>

      <nav className="flex items-center gap-6">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <Button variant="ghost" size="icon" onClick={() => { haptic.trigger("light"); onToggleSidebar(); }}>
        <PanelLeft className="size-5" />
      </Button>
    </header>
  );
}

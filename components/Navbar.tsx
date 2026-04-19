"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWebHaptics } from "web-haptics/react";
import { Plus, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatContext } from "@/components/ChatProvider";

const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/work", label: "Work" },
  { href: "/projects", label: "Projects" },
  { href: "/posts", label: "Posts" },
] as const;

interface NavbarProps {
  onToggleSidebar: () => void;
}

export function Navbar({ onToggleSidebar }: NavbarProps) {
  const pathname = usePathname();
  const haptic = useWebHaptics();
  const { startNewSession, messages } = useChatContext();

  return (
    <header className="flex items-center justify-between gap-4 px-5 py-3">
      <Link
        href="/"
        className="font-bluescreen text-lg tracking-wide text-foreground transition-colors hover:text-primary"
      >
        KAIO
      </Link>

      <nav className="flex items-center gap-1">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-muted/60 text-foreground"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-1">
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              haptic.trigger("medium");
              startNewSession();
            }}
            title="New conversation"
          >
            <Plus className="size-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            haptic.trigger("light");
            onToggleSidebar();
          }}
          title="Chat history"
        >
          <History className="size-4" />
        </Button>
      </div>
    </header>
  );
}

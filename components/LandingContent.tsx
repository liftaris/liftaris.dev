"use client";

import { SideColumn } from "@/components/SideColumn";
import { useChatContext } from "@/components/ChatProvider";
import { AsciiField } from "@/components/ui/ascii-field";
import type { TileSpec } from "@/lib/tiles";

const LEFT_FALLBACK: TileSpec[] = [
  { kind: "project", slug: "bazaarghost" },
  { kind: "experience", company: "moderna" },
];

const RIGHT_FALLBACK: TileSpec[] = [
  { kind: "stat", value: "18k+", label: "users on bazaarghost.stream" },
  { kind: "ghactivity" },
  {
    kind: "stack",
    title: "Daily drivers",
    items: ["TypeScript", "Next.js", "Python", "Terraform", "AWS", "Supabase"],
  },
  { kind: "contact" },
];

export function LandingContent() {
  const { messages } = useChatContext();
  const idle = messages.length === 0;

  if (idle) {
    return (
      <div className="pointer-events-none relative flex flex-1 select-none flex-col items-center justify-center lg:col-span-3 lg:col-start-1 lg:row-start-1">
        <AsciiField />
        <div className="relative flex flex-col items-center">
          <h1 className="font-bluescreen text-7xl tracking-tight text-foreground drop-shadow-[0_0_30px_var(--color-secondary)] sm:text-8xl lg:text-9xl">
            K A I O
          </h1>
          <p className="font-bluescreen mt-1 text-sm tracking-[0.5em] text-muted-foreground sm:text-base">
            BARBOSA-CHIFAN
          </p>
          <p className="mt-6 max-w-md text-center font-mono text-[11px] text-muted-foreground/60">
            software engineer · seattle · building for the web and the models
            that run on it
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SideColumn side="left" fallback={LEFT_FALLBACK} />
      <SideColumn side="right" fallback={RIGHT_FALLBACK} />
    </>
  );
}

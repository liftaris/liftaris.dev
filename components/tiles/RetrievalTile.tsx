"use client";

import { Database } from "lucide-react";
import type { RetrievalHit } from "@/lib/tiles";
import { cn } from "@/lib/utils";

export function RetrievalTile({ hits }: { hits: RetrievalHit[] }) {
  const meaningful = hits.filter((h) => h.similarity > 0);
  if (!meaningful.length) return null;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-border/20 bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Database className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          retrieval · pgvector
        </span>
      </div>
      <div className="space-y-1.5">
        {meaningful.slice(0, 4).map((h) => (
          <div key={h.id} className="flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-border/10">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r from-secondary to-chart-2 transition-all",
                )}
                style={{ width: `${Math.min(100, h.similarity * 100)}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground">
              {h.similarity.toFixed(2)}
            </span>
            <span className="w-24 shrink-0 truncate text-[10px] text-foreground/70">
              {h.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

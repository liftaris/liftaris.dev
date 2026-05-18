"use client";

import { cn } from "@/lib/utils";
import { useChatContext } from "@/components/ChatProvider";
import { TileStack } from "@/components/tiles/Tile";
import { RetrievalTile } from "@/components/tiles/RetrievalTile";
import type { TileSpec } from "@/lib/tiles";

interface SideColumnProps {
  side: "left" | "right";
  fallback?: TileSpec[];
  className?: string;
  children?: React.ReactNode;
}

/**
 * Generative column. Precedence:
 *   1. Assistant-composed tiles from the last turn (surface[side])
 *   2. Page-provided `fallback` tile specs
 *   3. Raw `children` (escape hatch for bespoke layouts)
 */
export function SideColumn({ side, fallback, className, children }: SideColumnProps) {
  const { surface, messages } = useChatContext();
  const live = surface[side];
  const hasLive = live.length > 0;
  const hasConversation = messages.length > 0;

  // Key forces remount → retriggers tile-stagger animation when tile set changes
  const animKey = hasLive
    ? `live-${side}-${live.map((t) => t.kind).join(".")}-${messages.length}`
    : `fallback-${side}`;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden",
        side === "left" ? "lg:col-start-1" : "lg:col-start-3",
        "lg:row-start-1 lg:flex-none lg:overflow-y-auto lg:pr-1",
        className,
      )}
    >
      <div key={animKey} className="tile-stagger flex flex-col gap-3">
        {hasLive ? (
          <TileStack tiles={live} />
        ) : fallback ? (
          <TileStack tiles={fallback} />
        ) : (
          children
        )}
      </div>

      {side === "right" && hasConversation && surface.retrieval.length > 0 && (
        <div className="mt-auto">
          <RetrievalTile hits={surface.retrieval} />
        </div>
      )}
    </div>
  );
}

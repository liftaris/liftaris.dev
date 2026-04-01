"use client";

import { SideColumn } from "@/components/SideColumn";
import { EmptyTile } from "@/components/EmptyTile";
import { useChatContext } from "@/components/ChatProvider";
import { Separator } from "@/components/ui/separator";

export function LandingContent() {
  const { messages } = useChatContext();
  const hasMessages = messages.length > 0;

  return (
    <>
      <SideColumn side="left">
        <EmptyTile className="flex-1" />
        <EmptyTile className="flex-1" />
      </SideColumn>

      {/* Hero overlay — only visible when no messages yet */}
      {!hasMessages && (
        <div className="pointer-events-none col-start-2 row-start-1 z-10 flex flex-col items-center justify-center">
          <h1 className="text-7xl font-black tracking-tighter text-foreground">KAIO</h1>
          <p className="mt-2 text-lg tracking-widest text-muted-foreground">BARBOSA-CHIFAN</p>
          <Separator className="mt-6 w-2/3" />
          <Separator className="mt-2 w-1/2" />
        </div>
      )}

      <SideColumn side="right">
        <EmptyTile className="aspect-square" />
        <div className="flex gap-4">
          <EmptyTile className="aspect-square flex-1" />
          <EmptyTile className="aspect-square flex-1" />
        </div>
        <EmptyTile className="flex-1" />
      </SideColumn>
    </>
  );
}

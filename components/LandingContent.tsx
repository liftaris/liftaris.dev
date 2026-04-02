"use client";

import { SideColumn } from "@/components/SideColumn";
import { EmptyTile } from "@/components/EmptyTile";
import { useChatContext } from "@/components/ChatProvider";
import { Separator } from "@/components/ui/separator";

export function LandingContent() {
  const { messages } = useChatContext();
  const hasMessages = messages.length > 0;

  if (!hasMessages) {
    return (
      // Hero: on sm takes top half, on md col-2, on lg col-2 overlay
      <div className="flex flex-1 flex-col items-center justify-center lg:col-start-2 lg:row-start-1">
        <h1 className="text-5xl font-black tracking-tighter text-foreground lg:text-7xl">KAIO</h1>
        <p className="mt-2 text-sm tracking-widest text-muted-foreground lg:text-lg">BARBOSA-CHIFAN</p>
        <Separator className="mt-6 w-2/3" />
        <Separator className="mt-2 w-1/2" />
      </div>
    );
  }

  return (
    <>
      <SideColumn side="left">
        <EmptyTile className="flex-1" />
        <EmptyTile className="flex-1" />
      </SideColumn>

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

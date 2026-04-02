"use client";

import { useWebHaptics } from "web-haptics/react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useChatContext } from "@/components/ChatProvider";

interface SidebarProps {
  open: boolean;
}

export function Sidebar({ open }: SidebarProps) {
  const { sessions, currentSessionId, startNewSession, loadSession } = useChatContext();
  const haptic = useWebHaptics();

  return (
    <aside
      className={cn(
        "row-start-1 flex flex-col border-r border-border bg-card/30 transition-all duration-200 overflow-hidden",
        open ? "w-64" : "w-0"
      )}
    >
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-bold tracking-tight">KAIO</p>
          <p className="text-xs text-muted-foreground">Barbosa-Chifan</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => { haptic.trigger("medium"); startNewSession(); }}>
          <Plus className="size-4" />
        </Button>
      </div>

      <Separator />

      <div className="px-4 py-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Chat History</p>
      </div>

      <ScrollArea className="flex-1 px-2">
        <div className="flex flex-col gap-1">
          {sessions
            .slice()
            .reverse()
            .map((session) => (
              <button
                key={session.id}
                onClick={() => { haptic.trigger("selection"); loadSession(session.id); }}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  session.id === currentSessionId
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <p className="truncate">{session.title}</p>
                <p className="text-xs text-muted-foreground/60">
                  {new Date(session.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

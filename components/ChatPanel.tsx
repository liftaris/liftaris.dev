"use client";

import { useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useWebHaptics } from "web-haptics/react";
import {
  Send,
  Square,
  CornerDownRight,
  LayoutGrid,
  Compass,
  Sparkles,
  Github,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatContext } from "@/components/ChatProvider";
import { promptsFor } from "@/data/prompts";
import type { UIMessage } from "ai";

interface ChatPanelProps {
  compact?: boolean;
  className?: string;
}

function ToolChip({ part }: { part: UIMessage["parts"][number] }) {
  if (part.type === "tool-navigate") {
    const path =
      (part as { input?: { path?: string } }).input?.path ??
      (part as { output?: { path?: string } }).output?.path;
    return (
      <div className="flex items-center gap-1.5 self-start rounded-md border border-border/20 bg-muted/30 px-2 py-1 font-mono text-[10px] text-muted-foreground">
        <Compass className="size-3" />
        navigate
        {path && (
          <>
            <CornerDownRight className="size-2.5" />
            <span className="text-foreground/70">{path}</span>
          </>
        )}
      </div>
    );
  }
  if (part.type === "tool-showTiles") {
    const input = (part as { input?: { left?: unknown[]; right?: unknown[] } })
      .input;
    const n = (input?.left?.length ?? 0) + (input?.right?.length ?? 0);
    return (
      <div className="flex items-center gap-1.5 self-start rounded-md border border-border/20 bg-muted/30 px-2 py-1 font-mono text-[10px] text-muted-foreground">
        <LayoutGrid className="size-3" />
        compose
        <span className="text-foreground/70">
          {n > 0 ? `${n} tile${n === 1 ? "" : "s"}` : "…"}
        </span>
      </div>
    );
  }
  if (part.type === "tool-githubRepo") {
    const repo = (part as { input?: { repo?: string } }).input?.repo;
    return (
      <div className="flex items-center gap-1.5 self-start rounded-md border border-border/20 bg-muted/30 px-2 py-1 font-mono text-[10px] text-muted-foreground">
        <Github className="size-3" />
        fetch
        {repo && (
          <>
            <CornerDownRight className="size-2.5" />
            <span className="text-foreground/70">{repo}</span>
          </>
        )}
      </div>
    );
  }
  return null;
}

function MessageBubble({
  msg,
  streaming,
}: {
  msg: UIMessage;
  streaming: boolean;
}) {
  const text = msg.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");

  if (msg.role === "user") {
    return (
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md border border-secondary/30 bg-secondary/20 px-4 py-2.5 text-sm text-foreground shadow-sm backdrop-blur-sm">
        {text}
      </div>
    );
  }

  const toolParts = msg.parts.filter((p) => p.type.startsWith("tool-"));

  return (
    <div className="mr-auto flex max-w-[90%] flex-col gap-1.5">
      {toolParts.map((p, i) => (
        <ToolChip key={i} part={p} />
      ))}
      {(text || streaming) && (
        <div className="rounded-2xl rounded-bl-md border border-border/15 bg-card/60 px-4 py-2.5 text-sm text-card-foreground shadow-sm backdrop-blur-sm">
          {text ? (
            <Streamdown
              isAnimating={streaming}
              controls={false}
              linkSafety={{ enabled: false }}
            >
              {text}
            </Streamdown>
          ) : (
            <span className="inline-flex gap-1">
              <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:0ms]" />
              <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function ChatPanel({ compact, className }: ChatPanelProps) {
  const { messages, input, setInput, sendMessage, stop, status } =
    useChatContext();
  const router = useRouter();
  const pathname = usePathname();
  const haptic = useWebHaptics();
  const scrollRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<string | null>(null);

  const isStreaming = status === "streaming" || status === "submitted";
  const hasMessages = messages.length > 0;
  const prompts = promptsFor(pathname);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Execute navigate tool-calls exactly once per tool-call id
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;

    for (const part of last.parts) {
      if (part.type !== "tool-navigate") continue;
      const p = part as {
        toolCallId?: string;
        state?: string;
        input?: { path?: string };
      };
      if (!p.input?.path || !p.toolCallId) continue;
      if (navRef.current === p.toolCallId) continue;
      navRef.current = p.toolCallId;
      haptic.trigger("medium");
      router.push(p.input.path);
    }
  }, [messages, router, haptic]);

  function submit(text: string) {
    if (!text.trim() || isStreaming) return;
    haptic.trigger("medium");
    setInput("");
    sendMessage({ text: text.trim() });
  }

  const handleStop = useCallback(() => {
    haptic.trigger("light");
    stop();
  }, [haptic, stop]);

  return (
    <div
      style={{ viewTransitionName: "chat-panel" }}
      className={cn(
        "flex min-h-0 basis-1/2 flex-col overflow-hidden rounded-2xl",
        hasMessages
          ? "border border-border/20 bg-gradient-to-b from-card/30 to-card/10 backdrop-blur-md"
          : "border border-transparent",
        "lg:col-start-2 lg:row-start-1 lg:basis-auto",
        compact && "lg:col-start-auto lg:row-start-auto",
        className,
      )}
    >
      {hasMessages ? (
        <div
          ref={scrollRef}
          className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4"
        >
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              streaming={isStreaming && i === messages.length - 1}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-end gap-3 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5" />
            <span>Ask anything — the page will reshape around the answer</span>
          </div>
        </div>
      )}

      {/* Suggested prompts */}
      {!isStreaming && (
        <div className="flex flex-wrap gap-2 border-t border-border/10 px-4 pt-3">
          {prompts.slice(0, compact ? 2 : 4).map((p) => (
            <button
              key={p}
              onClick={() => submit(p)}
              className="rounded-full border border-border/20 bg-background/40 px-3 py-1 text-[11px] text-muted-foreground transition-all hover:border-border/50 hover:bg-muted/40 hover:text-foreground"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        autoComplete="off"
        className="flex items-center gap-2 p-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            hasMessages ? "Follow up…" : "Ask about Kaio's work, background, or fit for a role"
          }
          disabled={isStreaming}
          className="h-9 flex-1 rounded-full border-border/20 bg-background/40 px-4 text-sm backdrop-blur-sm placeholder:text-muted-foreground/50"
        />
        {isStreaming ? (
          <Button
            type="button"
            size="icon-lg"
            variant="outline"
            onClick={handleStop}
            className="rounded-full"
          >
            <Square className="size-3.5" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon-lg"
            disabled={!input.trim()}
            className="rounded-full"
          >
            <Send className="size-3.5" />
          </Button>
        )}
      </form>
    </div>
  );
}

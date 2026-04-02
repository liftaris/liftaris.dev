// components/ChatPanel.tsx
"use client";

import { useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWebHaptics } from "web-haptics/react";
import { Send, Square } from "lucide-react";
import { Streamdown } from "streamdown";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useChatContext } from "@/components/ChatProvider";

interface ChatPanelProps {
  compact?: boolean;
  className?: string;
}

export function ChatPanel({ compact, className }: ChatPanelProps) {
  const { messages, input, setInput, sendMessage, stop, status } = useChatContext();
  const router = useRouter();
  const haptic = useWebHaptics();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevStatusRef = useRef(status);
  const isStreaming = status === "streaming" || status === "submitted";
  const hasMessages = messages.length > 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Haptic on response complete
  useEffect(() => {
    if (prevStatusRef.current === "streaming" && status === "ready") {
      haptic.trigger("success");
    }
    prevStatusRef.current = status;
  }, [status, haptic]);

  // Handle navigate tool calls
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;

    for (const part of lastMessage.parts) {
      if (part.type === "tool-navigate" && (part.state === "input-available" || part.state === "output-available")) {
        haptic.trigger("medium");
        router.push((part.input as { path: string }).path);
      }
    }
  }, [messages, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    haptic.trigger("medium");
    setInput("");
    sendMessage({ text });
  }

  const handleStop = useCallback(() => {
    haptic.trigger("light");
    stop();
  }, [haptic, stop]);

  return (
    <div
      style={{ viewTransitionName: "chat-panel" }}
      className={cn(
        // mobile: bottom 50%
        "flex min-h-0 basis-1/2 flex-col overflow-hidden rounded-3xl border border-border bg-card/50",
        // desktop: grid-positioned center column
        "lg:col-start-2 lg:row-start-1 lg:basis-auto",
        compact && "lg:col-start-auto lg:row-start-auto",
        className
      )}
    >
      {/* Messages area */}
      {hasMessages && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain p-4">
            <div className="flex flex-col gap-4">
              {messages.map((msg, i) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[85%]",
                    msg.role === "user" ? "ml-auto" : "mr-auto"
                  )}
                >
                  {msg.role === "user" ? (
                    <div className="rounded-2xl border border-white/10 bg-indigo-500/80 px-4 py-2.5 text-sm text-primary-foreground shadow-lg">
                      {msg.parts.map((part, j) =>
                        part.type === "text" ? <span key={j}>{part.text}</span> : null
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-card/80 px-4 py-2.5 text-sm text-card-foreground shadow-lg">
                      <Streamdown
                        isAnimating={isStreaming && i === messages.length - 1}
                        controls={false}
                        linkSafety={{ enabled: false }}
                      >
                        {msg.parts
                          .filter((p) => p.type === "text")
                          .map((p) => p.text)
                          .join("") || "..."}
                      </Streamdown>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Spacer when no messages */}
      {!hasMessages && <div className="flex-1" />}

      {/* Input bar */}
      <form onSubmit={handleSubmit} autoComplete="off" className="flex items-center gap-2 p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about me..."
          disabled={isStreaming}
          className="h-9 flex-1 border-white/10 bg-white/10 text-sm backdrop-blur-xl backdrop-saturate-150"
        />
        {isStreaming ? (
          <Button type="button" size="icon" variant="outline" onClick={handleStop}>
            <Square className="size-3.5" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim()}>
            <Send className="size-3.5" />
          </Button>
        )}
      </form>
    </div>
  );
}

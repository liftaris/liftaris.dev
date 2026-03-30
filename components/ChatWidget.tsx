"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Send, Square } from "lucide-react";
import { Streamdown } from "streamdown";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const transport = new DefaultChatTransport({ api: "/api/ask" });

export default function ChatWidget() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, stop } = useChat({ transport });

  const scrollRef = useRef<HTMLDivElement>(null);
  const isStreaming = status === "streaming" || status === "submitted";
  const hasMessages = messages.length > 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage({ text });
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col overflow-hidden rounded-3xl">
      {/* Messages area */}
      {hasMessages && (
        <>
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overscroll-contain p-4"
          >
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
                        part.type === "text" ? (
                          <span key={j}>{part.text}</span>
                        ) : null
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-card/80 px-4 py-2.5 text-sm text-card-foreground shadow-lg">
                      <Streamdown
                        isAnimating={
                          isStreaming && i === messages.length - 1
                        }
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
      <div>
        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          className="flex items-center gap-2 p-3"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about me..."
            disabled={isStreaming}
            className="h-9 flex-1 border-white/10 bg-white/10 text-sm backdrop-blur-xl backdrop-saturate-150"
          />
          {isStreaming ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={stop}
            >
              <Square className="size-3.5" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
            >
              <Send className="size-3.5" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Streamdown } from "streamdown";

export default function ChatWidget() {
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  async function submit() {
    const question = input.trim();
    if (!question || streaming) return;

    setInput("");
    if (!expanded) setExpanded(true);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setStreaming(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
          };
          return updated;
        });
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: updated[updated.length - 1].content + text,
          };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        };
        return updated;
      });
    }

    setStreaming(false);
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col">
      {/* Messages area — only visible once conversation starts */}
      {expanded && (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-background/80 p-4"
        >
          <div className="flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[85%] ${
                  msg.role === "user" ? "ml-auto" : "mr-auto"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="rounded-2xl bg-primary px-3 py-2 text-sm leading-relaxed text-primary-foreground">
                    {msg.content}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-muted px-3 py-2 text-sm leading-relaxed text-foreground">
                    <Streamdown
                      isAnimating={streaming && i === messages.length - 1}
                    >
                      {msg.content || "..."}
                    </Streamdown>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spacer pushes input to bottom when no messages */}
      {!expanded && <div className="flex-1" />}

      {/* Input bar — always visible at the bottom */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex shrink-0 items-center gap-2 bg-background/80 p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about me..."
          disabled={streaming}
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="shrink-0 rounded-xl bg-primary p-2 text-primary-foreground transition-opacity disabled:opacity-30"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}

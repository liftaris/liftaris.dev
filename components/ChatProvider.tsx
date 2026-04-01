// components/ChatProvider.tsx
"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: UIMessage[];
}

interface ChatContextValue {
  messages: UIMessage[];
  input: string;
  setInput: (input: string) => void;
  sendMessage: (params: { text: string }) => void;
  stop: () => void;
  status: string;
  sessions: ChatSession[];
  currentSessionId: string;
  startNewSession: () => void;
  loadSession: (id: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}

const transport = new DefaultChatTransport({ api: "/api/ask" });

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadSessionsFromStorage(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("chat-sessions");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessionsToStorage(sessions: ChatSession[]) {
  localStorage.setItem("chat-sessions", JSON.stringify(sessions));
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState(() => generateId());
  const [initialized, setInitialized] = useState(false);

  const [input, setInput] = useState("");

  const { messages, sendMessage, stop, status, setMessages } = useChat({
    transport,
    id: currentSessionId,
  });

  // Load sessions from localStorage on mount
  useEffect(() => {
    const stored = loadSessionsFromStorage();
    if (stored.length > 0) {
      const latest = stored[stored.length - 1];
      setSessions(stored);
      setCurrentSessionId(latest.id);
      setMessages(latest.messages);
    }
    setInitialized(true);
  }, [setMessages]);

  // Persist current messages to storage whenever they change
  useEffect(() => {
    if (!initialized || messages.length === 0) return;

    setSessions((prev) => {
      const title =
        messages[0]?.parts
          ?.filter((p) => p.type === "text")
          .map((p) => p.text)
          .join(" ")
          .slice(0, 50) || "New chat";

      const existing = prev.findIndex((s) => s.id === currentSessionId);
      const session: ChatSession = {
        id: currentSessionId,
        title,
        createdAt: existing >= 0 ? prev[existing].createdAt : new Date().toISOString(),
        messages,
      };

      const next =
        existing >= 0
          ? prev.map((s) => (s.id === currentSessionId ? session : s))
          : [...prev, session];

      saveSessionsToStorage(next);
      return next;
    });
  }, [messages, currentSessionId, initialized]);

  const startNewSession = useCallback(() => {
    const newId = generateId();
    setCurrentSessionId(newId);
    setMessages([]);
  }, [setMessages]);

  const loadSession = useCallback(
    (id: string) => {
      const session = sessions.find((s) => s.id === id);
      if (session) {
        setCurrentSessionId(id);
        setMessages(session.messages);
      }
    },
    [sessions, setMessages]
  );

  return (
    <ChatContext.Provider
      value={{
        messages,
        input,
        setInput,
        sendMessage,
        stop,
        status,
        sessions,
        currentSessionId,
        startNewSession,
        loadSession,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

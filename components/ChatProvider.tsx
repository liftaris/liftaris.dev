"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import type { TileSpec, RetrievalHit, TurnSurface } from "@/lib/tiles";
import type { RepoCard } from "@/lib/github";
import { EMPTY_SURFACE } from "@/lib/tiles";

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
  surface: TurnSurface;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}

const STORAGE_KEY = "chat-sessions";
const transport = new DefaultChatTransport({ api: "/api/ask" });

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function readStorage(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStorage(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // quota or disabled storage
  }
}

function deriveSurface(messages: UIMessage[]): TurnSurface {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;

    let left: TileSpec[] = [];
    let right: TileSpec[] = [];
    let retrieval: RetrievalHit[] = [];
    const repos: TileSpec[] = [];

    for (const part of m.parts) {
      if (part.type === "tool-showTiles") {
        // Only trust fully-parsed tool input; partial streaming input yields
        // half-built tile specs (e.g. stack without items).
        const p = part as {
          state?: string;
          input?: { left?: TileSpec[]; right?: TileSpec[] };
        };
        if (p.state !== "input-available" && p.state !== "output-available") continue;
        if (p.input?.left) left = p.input.left;
        if (p.input?.right) right = p.input.right;
      } else if (part.type === "data-retrieval") {
        const data = (part as { data?: RetrievalHit[] }).data;
        if (data) retrieval = data;
      } else if (part.type === "data-ghrepo") {
        const data = (part as { data?: RepoCard }).data;
        if (data)
          repos.push({ kind: "ghrepo", repo: `${data.owner}/${data.name}`, data });
      }
    }

    // Streamed repo cards replace any ghrepo placeholders from showTiles,
    // then prepend to the left column.
    if (repos.length) {
      left = [...repos, ...left.filter((t) => t.kind !== "ghrepo")];
    }

    if (left.length || right.length || retrieval.length) {
      return { left, right, retrieval };
    }
  }
  return EMPTY_SURFACE;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  // Session history is a write-through cache to localStorage. Held in a ref
  // to avoid render cascades; the sidebar reads it lazily on open.
  const sessionsRef = useRef<ChatSession[]>([]);
  const [sessionsVersion, setSessionsVersion] = useState(0);

  const [currentSessionId, setCurrentSessionId] = useState(() => generateId());
  const [input, setInput] = useState("");

  const { messages, sendMessage, stop, status, setMessages } = useChat({
    transport,
    id: currentSessionId,
  });

  const surface = useMemo(() => deriveSurface(messages), [messages]);

  // Hydrate history from localStorage post-mount (ref mutation only).
  useEffect(() => {
    sessionsRef.current = readStorage();
    setSessionsVersion((v) => v + 1);
  }, []);

  // Sync messages → localStorage (external system).
  useEffect(() => {
    if (messages.length === 0) return;

    const title =
      messages[0]?.parts
        ?.filter((p) => p.type === "text")
        .map((p) => (p as { text: string }).text)
        .join(" ")
        .slice(0, 50) || "New chat";

    const list = sessionsRef.current;
    const idx = list.findIndex((s) => s.id === currentSessionId);
    const session: ChatSession = {
      id: currentSessionId,
      title,
      createdAt: idx >= 0 ? list[idx].createdAt : new Date().toISOString(),
      messages,
    };
    sessionsRef.current =
      idx >= 0 ? list.map((s) => (s.id === currentSessionId ? session : s)) : [...list, session];
    writeStorage(sessionsRef.current);
  }, [messages, currentSessionId]);

  const startNewSession = useCallback(() => {
    setCurrentSessionId(generateId());
    setMessages([]);
  }, [setMessages]);

  const loadSession = useCallback(
    (id: string) => {
      const session = sessionsRef.current.find((s) => s.id === id);
      if (!session) return;
      setCurrentSessionId(id);
      setMessages(session.messages);
    },
    [setMessages],
  );

  const sessions = useMemo(
    () => sessionsRef.current,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionsVersion, messages.length],
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
        surface,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

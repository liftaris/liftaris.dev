# Chat-Centric Portfolio Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign liftaris.dev with a three-column bento grid layout where the RAG chat is the central interface, surrounded by contextual tiles that change per route.

**Architecture:** Root layout renders a shell (navbar, collapsible sidebar, 3-col CSS grid, footer). The chat lives in the layout as a context provider and renders in the center column. Each page provides its left/right tile content via `SideColumn` components. The blog/article page is an exception with its own layout that moves chat to the left column. Chat can trigger route changes via an AI SDK tool call.

**Tech Stack:** Next.js 16 (App Router, experimental viewTransition), Tailwind CSS 4, shadcn (base-nova), Vercel AI SDK (`ai` + `@ai-sdk/react` + `@ai-sdk/anthropic`), Supabase, Streamdown, localStorage for chat persistence.

**Spec:** `docs/superpowers/specs/2026-04-01-chat-centric-portfolio-design.md`

---

## File Structure

```
app/
  layout.tsx                    — MODIFY: new shell (navbar, sidebar, grid, footer, ChatProvider)
  page.tsx                      — MODIFY: landing page with hero→chat transition
  about/page.tsx                — MODIFY: about tiles in SideColumns
  projects/page.tsx             — CREATE: projects list page
  projects/[slug]/page.tsx      — CREATE: individual project page
  posts/page.tsx                — CREATE: posts list page
  blog/[slug]/layout.tsx        — CREATE: article exception layout (chat left, article center)
  blog/[slug]/page.tsx          — MODIFY: article page with side tiles
  api/ask/route.ts              — MODIFY: add navigate tool

components/
  ChatProvider.tsx              — CREATE: chat context with localStorage persistence
  ChatPanel.tsx                 — CREATE: refactored from ChatWidget.tsx, supports compact mode
  Navbar.tsx                    — CREATE: top nav with page links + sidebar toggle
  Sidebar.tsx                   — CREATE: collapsible chat history panel
  SideColumn.tsx                — CREATE: grid-positioning wrapper
  ImageTile.tsx                 — CREATE: rounded image card
  EmptyTile.tsx                 — CREATE: placeholder tile

  BentoHero.tsx                 — DELETE (replaced by new layout + landing page)
  ChatWidget.tsx                — DELETE (replaced by ChatPanel.tsx)
  Header.tsx                    — DELETE (replaced by Navbar.tsx)
  Footer.tsx                    — DELETE (replaced by inline footer in layout)
```

---

### Task 1: ChatProvider — Context & localStorage Persistence

**Files:**
- Create: `components/ChatProvider.tsx`

This is the foundation. Everything else depends on the chat context existing.

- [ ] **Step 1: Create ChatProvider with AI SDK integration**

```tsx
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

  const { messages, input, setInput, sendMessage, stop, status, setMessages } = useChat({
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

---

### Task 2: SideColumn, ImageTile, EmptyTile — Layout Primitives

**Files:**
- Create: `components/SideColumn.tsx`
- Create: `components/ImageTile.tsx`
- Create: `components/EmptyTile.tsx`

- [ ] **Step 1: Create SideColumn**

```tsx
// components/SideColumn.tsx
import { cn } from "@/lib/utils";

interface SideColumnProps {
  side: "left" | "right";
  children: React.ReactNode;
  className?: string;
}

export function SideColumn({ side, children, className }: SideColumnProps) {
  return (
    <div
      className={cn(
        "row-start-1 flex flex-col gap-4 overflow-y-auto",
        side === "left" ? "col-start-1" : "col-start-3",
        className
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create ImageTile**

```tsx
// components/ImageTile.tsx
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ImageTileProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function ImageTile({ src, alt, className, priority }: ImageTileProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border", className)}>
      <Image src={src} alt={alt} fill className="object-cover" priority={priority} />
    </div>
  );
}
```

- [ ] **Step 3: Create EmptyTile**

```tsx
// components/EmptyTile.tsx
import { cn } from "@/lib/utils";

export function EmptyTile({ className }: { className?: string }) {
  return <div className={cn("rounded-2xl border border-border", className)} />;
}
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

---

### Task 3: ChatPanel — Refactor ChatWidget

**Files:**
- Create: `components/ChatPanel.tsx`
- Delete: `components/ChatWidget.tsx` (after Task 7 when layout is wired up)

Refactors the existing `ChatWidget.tsx` to use the `ChatProvider` context instead of its own `useChat` instance. Adds a `compact` prop for the article-page left-column mode.

- [ ] **Step 1: Create ChatPanel**

```tsx
// components/ChatPanel.tsx
"use client";

import { useRef, useEffect } from "react";
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
    <div
      className={cn(
        "col-start-2 row-start-1 flex flex-col overflow-hidden rounded-3xl border border-border bg-card/50",
        compact && "col-start-auto row-start-auto",
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
          <Button type="button" size="icon" variant="outline" onClick={stop}>
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
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

---

### Task 4: Navbar & Sidebar

**Files:**
- Create: `components/Navbar.tsx`
- Create: `components/Sidebar.tsx`

- [ ] **Step 1: Create Navbar**

```tsx
// components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/posts", label: "Posts" },
] as const;

interface NavbarProps {
  onToggleSidebar: () => void;
}

export function Navbar({ onToggleSidebar }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between px-6 py-3">
      <Link href="/" className="text-lg font-bold tracking-tight text-foreground hover:text-primary transition-colors">
        KAIO
      </Link>

      <nav className="flex items-center gap-6">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
        <PanelLeft className="size-5" />
      </Button>
    </header>
  );
}
```

- [ ] **Step 2: Create Sidebar**

```tsx
// components/Sidebar.tsx
"use client";

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
        <Button variant="outline" size="icon" onClick={startNewSession}>
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
                onClick={() => loadSession(session.id)}
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
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

---

### Task 5: Root Layout — Wire Up the Shell

**Files:**
- Modify: `app/layout.tsx`

This is the big change. Replace the current minimal layout with the full shell: navbar, sidebar, 3-col grid with ChatPanel, footer.

- [ ] **Step 1: Create a shell wrapper client component**

The root layout must stay a server component (for metadata/fonts), so we need a client wrapper for the interactive shell.

```tsx
// components/Shell.tsx
"use client";

import { useState } from "react";
import { ChatProvider } from "@/components/ChatProvider";
import { ChatPanel } from "@/components/ChatPanel";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";

export function Shell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ChatProvider>
      <div className="flex h-dvh flex-col overflow-hidden">
        {/* Navbar */}
        <Navbar onToggleSidebar={() => setSidebarOpen((o) => !o)} />

        {/* Main area: sidebar + 3-col grid */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar open={sidebarOpen} />

          <main className="grid flex-1 grid-cols-[1fr_2fr_1fr] gap-4 overflow-hidden p-4">
            {/* Pages inject SideColumn left (col-1) and SideColumn right (col-3) */}
            {children}

            {/* Chat always in center */}
            <ChatPanel />
          </main>
        </div>

        {/* Footer */}
        <footer className="py-2 text-center text-xs tracking-widest text-muted-foreground">
          BARBOSA-CHIFAN
        </footer>
      </div>
    </ChatProvider>
  );
}
```

- [ ] **Step 2: Update app/layout.tsx to use Shell**

Replace the contents of `app/layout.tsx`:

```tsx
// app/layout.tsx
import { Spectral, Geist } from "next/font/google";
import { ViewTransition } from "react";
import "../styles/output.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { cn } from "@/lib/utils";
import { Shell } from "@/components/Shell";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const spectral = Spectral({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-spectral",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KAIO",
  description: "Kaio Barbosa-Chifan — Software Engineer & Creative Technologist",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable, spectral.variable)}>
      <body className={spectral.className}>
        <ViewTransition>
          <Shell>{children}</Shell>
        </ViewTransition>
        <Analytics />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

---

### Task 6: Landing Page — Hero to Chat Transition

**Files:**
- Modify: `app/page.tsx`

Replace the current `BentoHero` import. The landing page shows a hero (name/subtitle) in the center when no messages exist. After the first message, it fades to show the chat. Side columns get placeholder tiles.

- [ ] **Step 1: Rewrite landing page**

```tsx
// app/page.tsx
import { LandingContent } from "@/components/LandingContent";

export default function HomePage() {
  return <LandingContent />;
}
```

- [ ] **Step 2: Create LandingContent client component**

```tsx
// components/LandingContent.tsx
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
```

- [ ] **Step 3: Verify compilation and test manually**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

Then start the dev server and confirm:
1. Landing page shows "KAIO / BARBOSA-CHIFAN" in center with chat input below
2. Sending a message hides the hero and shows chat messages
3. Side tiles render as empty bordered boxes

---

### Task 7: About Page — Tiles in SideColumns

**Files:**
- Modify: `app/about/page.tsx`

Replace the current about page (which uses Header/Footer/GridPattern) with SideColumn-based tiles. The about page content from TinaCMS can be embedded in a tile card on the left.

- [ ] **Step 1: Rewrite about page**

```tsx
// app/about/page.tsx
import { SideColumn } from "@/components/SideColumn";
import { ImageTile } from "@/components/ImageTile";
import { EmptyTile } from "@/components/EmptyTile";
import { Card } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | KAIO",
};

export default function AboutPage() {
  return (
    <>
      <SideColumn side="left">
        {/* Timeline tabs placeholder */}
        <div className="flex gap-2">
          <EmptyTile className="flex-1 py-3 text-center text-sm text-muted-foreground">1</EmptyTile>
          <EmptyTile className="flex-1 py-3 text-center text-sm text-muted-foreground">2</EmptyTile>
          <EmptyTile className="flex-1 py-3 text-center text-sm text-muted-foreground">3</EmptyTile>
        </div>

        {/* Bio card */}
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            Born in the Bay Area. My family moved to Natal, Brazil when I was two.
          </p>
          <p className="mt-2 text-xs text-primary">1999</p>
        </Card>

        {/* Map tile */}
        <ImageTile src="/images/natal-map.jpg" alt="Natal, Brazil" className="aspect-[3/4]" />
      </SideColumn>

      <SideColumn side="right">
        {/* Portrait photo */}
        <ImageTile src="/images/portrait.jpg" alt="Kaio Barbosa-Chifan" className="aspect-square" priority />

        {/* Hobbies grid */}
        <div className="grid grid-cols-2 gap-4">
          <EmptyTile className="aspect-square" />
          <EmptyTile className="aspect-square" />
          <EmptyTile className="aspect-square" />
          <EmptyTile className="aspect-square" />
        </div>

        {/* Placeholder */}
        <EmptyTile className="flex-1" />
      </SideColumn>
    </>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

Note: The image paths (`/images/natal-map.jpg`, `/images/portrait.jpg`) are placeholders. Replace with actual images from the `public/` directory. If images don't exist yet, the page will still render — the ImageTile will just show a broken image until assets are added.

---

### Task 8: Posts Page

**Files:**
- Create: `app/posts/page.tsx`

- [ ] **Step 1: Create posts page**

```tsx
// app/posts/page.tsx
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Image from "next/image";
import Link from "next/link";
import { SideColumn } from "@/components/SideColumn";
import { EmptyTile } from "@/components/EmptyTile";
import { Card } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Posts | KAIO",
};

interface BlogPost {
  title: string;
  date: string;
  hero_image: string;
  filename: string;
}

function getPosts(): BlogPost[] {
  const dir = path.join(process.cwd(), "content/posts");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((filename) => {
      const { data } = matter(fs.readFileSync(path.join(dir, filename), "utf8"));
      return {
        title: data.title,
        date: data.date instanceof Date ? data.date.toISOString() : data.date,
        hero_image: data.hero_image,
        filename: filename.replace(/\.md$/, ""),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default function PostsPage() {
  const posts = getPosts();

  return (
    <>
      <SideColumn side="left">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            Writing about software, side projects, and things I find interesting.
          </p>
        </Card>
      </SideColumn>

      <SideColumn side="right">
        <h2 className="text-lg font-bold tracking-tight">POSTS</h2>
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <Link key={post.filename} href={`/blog/${post.filename}`}>
              <Card className="group relative overflow-hidden">
                <div className="relative aspect-[16/9]">
                  <Image
                    src={post.hero_image}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold">{post.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(post.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </SideColumn>
    </>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

---

### Task 9: Projects Page

**Files:**
- Create: `app/projects/page.tsx`
- Create: `app/projects/[slug]/page.tsx`

- [ ] **Step 1: Create projects index page**

```tsx
// app/projects/page.tsx
import { SideColumn } from "@/components/SideColumn";
import { EmptyTile } from "@/components/EmptyTile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects | KAIO",
};

const PROJECTS = [
  {
    slug: "bazaarghost",
    name: "BazaarGhost",
    description: "Stream matchup tracker for Bazaar",
    tags: ["Next.js", "Python", "TypeScript"],
  },
] as const;

export default function ProjectsPage() {
  return (
    <>
      <SideColumn side="left">
        {PROJECTS.map((project) => (
          <Link key={project.slug} href={`/projects/${project.slug}`}>
            <Card className="p-4 transition-colors hover:border-primary/50">
              <h3 className="font-semibold">{project.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </Card>
          </Link>
        ))}
        <EmptyTile className="flex-1" />
      </SideColumn>

      <SideColumn side="right">
        <EmptyTile className="aspect-square" />
        <EmptyTile className="flex-1" />
      </SideColumn>
    </>
  );
}
```

- [ ] **Step 2: Create project detail page**

```tsx
// app/projects/[slug]/page.tsx
import { SideColumn } from "@/components/SideColumn";
import { ImageTile } from "@/components/ImageTile";
import { EmptyTile } from "@/components/EmptyTile";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface ProjectData {
  name: string;
  description: string;
  tags: string[];
  screenshot?: string;
  blogPost?: string;
}

const PROJECTS: Record<string, ProjectData> = {
  bazaarghost: {
    name: "BazaarGhost",
    description: "Stream matchup tracker for Bazaar",
    tags: ["Next.js", "Python", "TypeScript", "AWS"],
    screenshot: "/images/bazaarghost-screenshot.png",
    blogPost: "/blog/bazaar-ghost",
  },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = PROJECTS[slug];
  return { title: project ? `${project.name} | KAIO` : "Project | KAIO" };
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const project = PROJECTS[slug];
  if (!project) notFound();

  return (
    <>
      <SideColumn side="left">
        {/* Project screenshot */}
        {project.screenshot && (
          <ImageTile src={project.screenshot} alt={project.name} className="aspect-video" />
        )}

        {/* Tech tags */}
        <div className="flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <Badge key={tag} variant="secondary">{tag}</Badge>
          ))}
        </div>

        <EmptyTile className="flex-1" />
      </SideColumn>

      <SideColumn side="right">
        {/* GitHub commit grid placeholder */}
        <EmptyTile className="aspect-[2/1]" />

        <EmptyTile className="flex-1" />

        {/* Blog post link */}
        {project.blogPost && (
          <Card className="p-4">
            <Link href={project.blogPost} className="text-sm text-primary hover:underline">
              Read my blog post about it!
            </Link>
          </Card>
        )}
      </SideColumn>
    </>
  );
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

---

### Task 10: Article Page — Exception Layout

**Files:**
- Create: `app/blog/[slug]/layout.tsx`
- Modify: `app/blog/[slug]/page.tsx`

The article page overrides the default grid. Chat moves to the left column, article content fills the center.

- [ ] **Step 1: Create article layout**

```tsx
// app/blog/[slug]/layout.tsx
"use client";

import { ChatPanel } from "@/components/ChatPanel";

export default function ArticleLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Left column: branding + compact chat */}
      <div className="col-start-1 row-start-1 flex flex-col gap-4 overflow-hidden">
        <div className="px-2 py-4">
          <p className="text-sm font-bold tracking-tight">KAIO</p>
          <p className="text-xs text-muted-foreground">BARBOSA-CHIFAN</p>
        </div>
        <ChatPanel compact className="flex-1" />
      </div>

      {/* Center + right columns: provided by page.tsx */}
      {children}
    </>
  );
}
```

- [ ] **Step 2: Rewrite article page**

Replace `app/blog/[slug]/page.tsx`. Moves article content to center column, side tiles to right. Removes old Header/Footer imports since the root layout handles those.

```tsx
// app/blog/[slug]/page.tsx
import fs from "fs";
import path from "path";
import client from "@/tina/__generated__/client";
import type { PostQuery, PostQueryVariables } from "@/tina/__generated__/types";
import PostClient from "@/components/tina/PostClient";
import { SideColumn } from "@/components/SideColumn";
import { EmptyTile } from "@/components/EmptyTile";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getPostData(slug: string) {
  const variables: PostQueryVariables = { relativePath: `${slug}.md` };
  try {
    const res = await client.queries.post(variables);
    return { data: res.data, query: res.query, variables };
  } catch {
    return { data: {} as PostQuery, query: "", variables };
  }
}

export async function generateStaticParams() {
  const postsDirectory = path.join(process.cwd(), "content/posts");
  return fs
    .readdirSync(postsDirectory)
    .filter((f) => f.endsWith(".md"))
    .map((file) => ({ slug: file.replace(/\.md$/, "") }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const postData = await getPostData(slug);
  return { title: `${postData.data.post?.title || "Post"} | KAIO` };
}

export default async function BlogPost({ params }: PageProps) {
  const { slug } = await params;
  const postData = await getPostData(slug);

  return (
    <>
      {/* Article content — center column */}
      <article className="col-start-2 row-start-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <PostClient {...postData} />
        </div>
      </article>

      {/* Right column tiles */}
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
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 4: Test manually**

Start the dev server and confirm:
1. Navigating to `/blog/bazaar-ghost` shows the article layout
2. Chat is in the left column in compact mode
3. Article content fills the center
4. Right column has placeholder tiles

---

### Task 11: Chat-Triggered Navigation — Navigate Tool

**Files:**
- Modify: `app/api/ask/route.ts`
- Modify: `components/ChatPanel.tsx`

- [ ] **Step 1: Add navigate tool to API route**

Add the `z` import and the tools config to the `streamText` call in `app/api/ask/route.ts`. Add `import { z } from "zod";` at the top (zod is already a transitive dep of `ai`).

In `app/api/ask/route.ts`, add the import at the top:

```ts
import { z } from "zod";
```

Then modify the `streamText` call in the POST handler to add tools:

```ts
  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `${SYSTEM_PROMPT}\n\nHere is relevant context from Kaio's portfolio site:\n\n${context}`,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 1024,
    tools: {
      navigate: {
        description:
          "Navigate the user to a specific page on the portfolio site. Use this when the user asks about a topic that has a dedicated page.",
        parameters: z.object({
          path: z.enum([
            "/about",
            "/projects",
            "/projects/bazaarghost",
            "/posts",
          ]),
        }),
      },
    },
  });
```

- [ ] **Step 2: Handle tool call on the client**

In `components/ChatPanel.tsx`, add navigation handling. Add these imports at the top:

```ts
import { useRouter } from "next/navigation";
```

Inside the `ChatPanel` component, add:

```ts
  const router = useRouter();

  // Handle navigate tool calls
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;

    for (const part of lastMessage.parts) {
      if (part.type === "tool-invocation" && part.toolInvocation.toolName === "navigate" && part.toolInvocation.state === "result") {
        router.push(part.toolInvocation.args.path);
      }
    }
  }, [messages, router]);
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

---

### Task 12: Cleanup — Remove Old Components

**Files:**
- Delete: `components/BentoHero.tsx`
- Delete: `components/ChatWidget.tsx`
- Delete: `components/Header.tsx`
- Delete: `components/Footer.tsx`
- Delete: `components/Hero.tsx` (if not used elsewhere)

- [ ] **Step 1: Check for remaining imports of deleted components**

Run: `grep -rn "BentoHero\|ChatWidget\|Header\|Footer\|Hero" app/ components/ --include="*.tsx" --include="*.ts"`

Fix any remaining imports that reference the old components.

- [ ] **Step 2: Delete old component files**

```bash
rm components/BentoHero.tsx components/ChatWidget.tsx components/Header.tsx components/Footer.tsx
```

Only delete `components/Hero.tsx` if the grep in step 1 shows no other imports of it.

- [ ] **Step 3: Verify the app compiles and runs**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Run: `npm run dev` and check each route: `/`, `/about`, `/projects`, `/posts`, `/blog/bazaar-ghost`

---

### Task 13: View Transition Names

**Files:**
- Modify: `components/ChatPanel.tsx`
- Modify: `components/Shell.tsx`

Add `viewTransitionName` styles so the chat panel animates smoothly when it moves between positions across navigations.

- [ ] **Step 1: Add view transition name to ChatPanel**

In `components/ChatPanel.tsx`, add an inline style to the outer div:

```tsx
    <div
      style={{ viewTransitionName: "chat-panel" }}
      className={cn(
        "col-start-2 row-start-1 flex flex-col overflow-hidden rounded-3xl border border-border bg-card/50",
        compact && "col-start-auto row-start-auto",
        className
      )}
    >
```

- [ ] **Step 2: Add view transition name to the main grid**

In `components/Shell.tsx`, add a transition name to the main element:

```tsx
          <main
            style={{ viewTransitionName: "bento-grid" }}
            className="grid flex-1 grid-cols-[1fr_2fr_1fr] gap-4 overflow-hidden p-4"
          >
```

- [ ] **Step 3: Verify transitions work**

Start dev server, navigate between pages, and confirm the chat panel transitions smoothly rather than popping in/out.

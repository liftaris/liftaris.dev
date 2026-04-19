"use client";

import { useState } from "react";
import { ChatProvider } from "@/components/ChatProvider";
import { ChatPanel } from "@/components/ChatPanel";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import {
  ChatVisibilityProvider,
  useChatVisibility,
} from "@/components/ChatVisibility";

function MainGrid({ children }: { children: React.ReactNode }) {
  const { showDefaultChat } = useChatVisibility();

  return (
    <main
      style={{ viewTransitionName: "bento-grid" }}
      className="relative flex flex-1 flex-col gap-3 overflow-hidden p-3 lg:grid lg:grid-cols-[minmax(260px,1fr)_minmax(420px,2fr)_minmax(260px,1fr)] lg:gap-4 lg:p-4"
    >
      <div className="flex min-h-0 basis-1/2 gap-3 lg:contents">{children}</div>
      {showDefaultChat && <ChatPanel className="relative z-10" />}
    </main>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ChatProvider>
      <ChatVisibilityProvider>
        <div className="relative flex h-dvh flex-col overflow-hidden">
          {/* ambient backdrop */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.34_0.18_264/0.35),transparent_60%)]"
          />
          <Navbar onToggleSidebar={() => setSidebarOpen((o) => !o)} />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar open={sidebarOpen} />
            <MainGrid>{children}</MainGrid>
          </div>
          <footer className="flex items-center justify-between px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/40">
            <span>liftaris.dev</span>
            <span>Barbosa-Chifan · {new Date().getFullYear()}</span>
          </footer>
        </div>
      </ChatVisibilityProvider>
    </ChatProvider>
  );
}

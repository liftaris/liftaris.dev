"use client";

import { useState } from "react";
import { ChatProvider } from "@/components/ChatProvider";
import { ChatPanel } from "@/components/ChatPanel";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { ChatVisibilityProvider, useChatVisibility } from "@/components/ChatVisibility";

function MainGrid({ children }: { children: React.ReactNode }) {
  const { showDefaultChat } = useChatVisibility();

  return (
    <main
      style={{ viewTransitionName: "bento-grid" }}
      className="grid flex-1 grid-cols-[1fr_2fr_1fr] gap-4 overflow-hidden p-4"
    >
      {children}
      {showDefaultChat && <ChatPanel />}
    </main>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ChatProvider>
      <ChatVisibilityProvider>
        <div className="flex h-dvh flex-col overflow-hidden">
          <Navbar onToggleSidebar={() => setSidebarOpen((o) => !o)} />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar open={sidebarOpen} />
            <MainGrid>{children}</MainGrid>
          </div>
          <footer className="py-2 text-center text-xs tracking-widest text-muted-foreground">
            BARBOSA-CHIFAN
          </footer>
        </div>
      </ChatVisibilityProvider>
    </ChatProvider>
  );
}

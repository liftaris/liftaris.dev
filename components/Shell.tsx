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
      className="flex flex-1 flex-col gap-4 overflow-hidden p-4 lg:grid lg:grid-cols-[1fr_2fr_1fr]"
    >
      {/* Mobile: children (SideColumns) sit side-by-side in top 50% */}
      <div className="flex min-h-0 basis-1/2 gap-4 lg:contents">
        {children}
      </div>
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

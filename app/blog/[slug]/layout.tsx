"use client";

import { useEffect } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { useChatVisibility } from "@/components/ChatVisibility";

export default function ArticleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setShowDefaultChat } = useChatVisibility();

  // Hide the default center ChatPanel when this layout is active
  useEffect(() => {
    setShowDefaultChat(false);
    return () => setShowDefaultChat(true);
  }, [setShowDefaultChat]);

  return (
    <>
      {/* Left column: branding + compact chat */}
      <div className="order-last flex flex-col gap-4 overflow-hidden lg:order-none lg:col-start-1 lg:row-start-1">
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

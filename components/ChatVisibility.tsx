"use client";

import { createContext, useContext, useState } from "react";

interface ChatVisibilityContextValue {
  showDefaultChat: boolean;
  setShowDefaultChat: (show: boolean) => void;
}

const ChatVisibilityContext = createContext<ChatVisibilityContextValue>({
  showDefaultChat: true,
  setShowDefaultChat: () => {},
});

export function useChatVisibility() {
  return useContext(ChatVisibilityContext);
}

export function ChatVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [showDefaultChat, setShowDefaultChat] = useState(true);

  return (
    <ChatVisibilityContext.Provider value={{ showDefaultChat, setShowDefaultChat }}>
      {children}
    </ChatVisibilityContext.Provider>
  );
}

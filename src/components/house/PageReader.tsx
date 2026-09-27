import { useEffect, useRef } from "react";
import type { ThingSpec } from "./folders";
import "./post-reader.css";

/** Reuse the server-rendered page without duplicating PortableText in React. */
export function PageReader({ page }: { page: ThingSpec }) {
  const iframe = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const frame = iframe.current!;
    let listeners: AbortController | undefined;
    const connect = () => {
      listeners?.abort();
      // Page links can navigate the frame away; never inspect another origin.
      let document: Document | null;
      try { document = frame.contentDocument; } catch { return; }
      if (!document) return;
      listeners = new AbortController();
      const options = { signal: listeners.signal };
      const window = frame.closest(".object-window");
      const raise = () => window?.dispatchEvent(new Event("focusin"));
      document.addEventListener("pointerdown", raise, options);
      document.addEventListener("focusin", raise, options);
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        window?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }, options);
    };
    frame.addEventListener("load", connect);
    connect();
    return () => { frame.removeEventListener("load", connect); listeners?.abort(); };
  }, []);

  const href = page.href || `/p/${encodeURIComponent(page.id)}`;
  const src = `${href}${href.includes("?") ? "&" : "?"}window=1`;
  return <iframe ref={iframe} className="post-reader" src={src} title={page.name} />;
}

import { useEffect, useRef } from "react";
import type { ThingSpec } from "./folders";

/** Reuse the server-rendered page without duplicating PortableText in React. */
export function PageReader({ page }: { page: ThingSpec }) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const href = page.previewUrl || page.href || `/things-preview/${encodeURIComponent(page.id)}`;
  const src = `${href}${href.includes("?") ? "&" : "?"}window=1`;

  useEffect(() => {
    const frame = iframe.current!;
    if (!frame) return;
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
  }, [src]);

  return <iframe ref={iframe} className="post-reader block size-full border-0 bg-paper" src={src} title={page.name} />;
}

import { useEffect, useRef, useState } from "react";
import type { ThingSpec } from "./folders";
import { getCachedWindowHtml, preloadWindowHtml } from "../../lib/house/prefetch";

/** Reuse the server-rendered page without duplicating PortableText in React. */
export function PageReader({ page }: { page: ThingSpec }) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const href = page.href || `/p/${encodeURIComponent(page.id)}`;
  const src = `${href}${href.includes("?") ? "&" : "?"}window=1`;
  const [cachedHtml, setCachedHtml] = useState<string | null>(() => getCachedWindowHtml(src));

  useEffect(() => {
    if (!cachedHtml) {
      void preloadWindowHtml(src).then((html) => {
        if (html) setCachedHtml(html);
      });
    }
  }, [src, cachedHtml]);

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
  }, [cachedHtml]);

  return cachedHtml ? (
    <iframe ref={iframe} className="post-reader block size-full border-0 bg-paper" srcDoc={cachedHtml} title={page.name} />
  ) : (
    <iframe ref={iframe} className="post-reader block size-full border-0 bg-paper" src={src} title={page.name} />
  );
}

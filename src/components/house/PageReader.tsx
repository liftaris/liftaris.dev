import { useContext, useEffect, useRef, useState } from "react";
import { getCachedWindowHtml, preloadWindowHtml, windowPageUrl } from "../../lib/house/prefetch";
import { AuthoringContext } from "./ThingAuthoring";
import type { ThingSpec } from "./folders";

/** Reuse the server-rendered page without duplicating PortableText in React. */
export function PageReader({ page }: { page: ThingSpec }) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const href = page.previewUrl || page.href || `/things-preview/${encodeURIComponent(page.id)}`;
  const src = windowPageUrl(href);
  const { enabled: editing } = useContext(AuthoringContext);
  const direct = editing || Boolean(page.previewUrl);

  // Synchronously initialize with cached HTML if available so frame 0 renders with content
  const [loaded, setLoaded] = useState<{ src: string; html?: string } | undefined>(() => {
    if (direct) return undefined;
    const cached = getCachedWindowHtml(src);
    return cached ? { src, html: cached } : undefined;
  });

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (direct) return;
    if (loaded?.src === src && loaded.html) return;

    let active = true;
    preloadWindowHtml(src)
      .then((html) => {
        if (active) setLoaded({ src, html });
      })
      .catch(() => {
        // Native navigation remains available if fetching HTML fails
        if (active) setLoaded({ src });
      });

    return () => {
      active = false;
    };
  }, [src, direct, loaded?.src, loaded?.html]);

  const current = loaded?.src === src ? loaded : undefined;

  useEffect(() => {
    const frame = iframe.current;
    if (!frame) return;
    let listeners: AbortController | undefined;

    const onFrameLoad = () => {
      setReady(true);
    };

    frame.addEventListener("load", onFrameLoad);

    const connect = () => {
      setReady(true);
      listeners?.abort();
      // Page links can navigate the frame away; never inspect another origin.
      let document: Document | null;
      try { document = frame.contentDocument; } catch { return; }
      if (!document) return;
      listeners = new AbortController();
      const options = { signal: listeners.signal };
      const win = frame.closest(".object-window");
      const raise = () => win?.dispatchEvent(new Event("focusin"));
      document.addEventListener("pointerdown", raise, options);
      document.addEventListener("focusin", raise, options);
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        win?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }, options);
    };

    frame.addEventListener("load", connect);
    connect();

    return () => {
      frame.removeEventListener("load", onFrameLoad);
      frame.removeEventListener("load", connect);
      listeners?.abort();
    };
  }, [src, current?.html]);

  return (
    <iframe
      ref={iframe}
      className={`post-reader block size-full border-0 bg-transparent transition-opacity duration-150 ${ready ? "opacity-100" : "opacity-0"}`}
      src={direct || (current && !current.html) ? src : undefined}
      srcDoc={!direct ? current?.html : undefined}
      title={page.name}
    />
  );
}

import { useContext, useEffect, useRef, useState } from "react";
import { windowPageUrl } from "../../lib/house/prefetch";
import { AuthoringContext } from "./ThingAuthoring";
import type { ThingSpec } from "../../lib/things/scene";

/** Reuse the server-rendered page without duplicating PortableText in React. */
export function PageReader({ page }: { page: ThingSpec }) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const href = page.previewUrl || page.href || `/things-preview/${encodeURIComponent(page.id)}`;
  const src = windowPageUrl(href);
  const { enabled: editing } = useContext(AuthoringContext);
  const direct = editing || Boolean(page.previewUrl);
  const [loaded, setLoaded] = useState<{ src: string; html?: string }>();

  useEffect(() => {
    if (direct) return;
    const controller = new AbortController();
    // Chromium partitions iframe navigations from link-prefetch responses.
    // Read through the browser HTTP cache warmed by Astro, with no JS HTML cache.
    void fetch(src, { signal: controller.signal }).then(async response => {
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) throw new Error("Page unavailable");
      if (new URL(response.url).origin !== location.origin) throw new Error("External page");
      const html = await response.text();
      if (!controller.signal.aborted) setLoaded({ src, html });
    }).catch(() => {
      // Native navigation remains available if fetching HTML fails.
      if (!controller.signal.aborted) setLoaded({ src });
    });
    return () => controller.abort();
  }, [src, direct]);
  const current = loaded?.src === src ? loaded : undefined;

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

  return <iframe ref={iframe} className="post-reader block size-full border-0 bg-transparent" src={direct || (current && !current.html) ? src : undefined} srcDoc={!direct ? current?.html : undefined} title={page.name} />;
}

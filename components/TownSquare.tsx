"use client";

import { useEffect, useRef } from "react";

type TownSquareHandle = { destroy?: () => void };
type TownSquareApi = {
  mountTownSquare: (
    root: HTMLElement,
    options: {
      serverOrigin: string;
      siteKey: string;
      theme: "host";
      scene: {
        benches: number;
        trees: number;
        lamps: number;
        branches: number;
      };
    },
  ) => TownSquareHandle;
};

declare global {
  interface Window {
    __liftarisTownSquare?: TownSquareApi;
  }
}

const SERVER_ORIGIN = "https://townsquare.cauenapier.com";
const SITE_KEY = "site_OCZSUJoivCjamGNG";

export function TownSquare() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const root: HTMLDivElement = rootRef.current;

    let cancelled = false;
    let handle: TownSquareHandle | undefined;
    const registrationObserver = new MutationObserver(() => {
      if (root.textContent?.includes("isn't registered to TownSquare")) {
        handle?.destroy?.();
        root.replaceChildren();
        root.hidden = true;
      }
    });
    registrationObserver.observe(root, { childList: true, subtree: true, characterData: true });

    async function mount() {
      const url = `${SERVER_ORIGIN}/townsquare.mjs`;
      const api = window.__liftarisTownSquare ?? await import(/* webpackIgnore: true */ url) as TownSquareApi;
      window.__liftarisTownSquare = api;
      if (cancelled) return;
      handle = api.mountTownSquare(root, {
        serverOrigin: SERVER_ORIGIN,
        siteKey: SITE_KEY,
        theme: "host",
        scene: {
          benches: 2,
          trees: 3,
          lamps: 2,
          branches: 1,
        },
      });
    }

    mount().catch(() => {
      root.hidden = true;
    });

    return () => {
      cancelled = true;
      registrationObserver.disconnect();
      handle?.destroy?.();
      root.replaceChildren();
      root.hidden = false;
    };
  }, []);

  return <div id="townsquare-root" ref={rootRef} />;
}

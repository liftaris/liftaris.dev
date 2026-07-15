"use client";

import { useEffect, useRef } from "react";
import { TOWNSQUARE_MODULE, TOWNSQUARE_ORIGIN } from "@/lib/townsquare";

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

const SITE_KEY = "site_OCZSUJoivCjamGNG";

export function TownSquare() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const root: HTMLDivElement = rootRef.current;

    let cancelled = false;
    let handle: TownSquareHandle | undefined;

    async function mount() {
      const api = window.__liftarisTownSquare ?? await import(/* webpackIgnore: true */ TOWNSQUARE_MODULE) as TownSquareApi;
      window.__liftarisTownSquare = api;
      if (cancelled) return;
      handle = api.mountTownSquare(root, {
        serverOrigin: TOWNSQUARE_ORIGIN,
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

    mount().catch((error) => {
      console.error("TownSquare failed to mount", error);
      root.hidden = true;
    });

    return () => {
      cancelled = true;
      handle?.destroy?.();
      root.replaceChildren();
      root.hidden = false;
    };
  }, []);

  return <div className="townsquareHost" ref={rootRef} />;
}

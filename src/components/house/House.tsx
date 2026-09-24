import { useCallback, useEffect, useRef, useState } from "react";
import { getHouse, watchHouse } from "../../lib/house/client";
import type { HouseSnapshot } from "../../lib/house/types";
import { GiftComposer } from "./GiftComposer";
import { GiftDialog } from "./GiftDialog";
import { HouseClump } from "./HouseClump";
import "./house.css";

export function House() {
  const [snapshot, setSnapshot] = useState<HouseSnapshot | null>(null);
  const [opened, setOpened] = useState<{ id: string; origin: DOMRect } | null>(null);
  const [status, setStatus] = useState("");
  const [loadError, setLoadError] = useState("");
  const [ready, setReady] = useState(false);
  const latest = useRef(-1);
  const accept = useCallback((next: HouseSnapshot) => {
    if (next.revision < latest.current) return;
    latest.current = next.revision;
    setSnapshot(next);
    setLoadError("");
    setOpened((value) => value && !next.gifts.some((gift) => gift.id === value.id) ? null : value);
  }, []);
  const close = useCallback(() => setOpened(null), []);

  useEffect(() => {
    setReady(true);
    const controller = new AbortController();
    void getHouse(controller.signal).then(accept).catch(() => {
      if (!controller.signal.aborted) setLoadError("The house couldn’t connect. Reconnecting…");
    });
    const disconnect = watchHouse(accept);
    return () => { controller.abort(); disconnect(); };
  }, [accept]);

  const openedGift = snapshot?.gifts.find((gift) => gift.id === opened?.id);
  return <div className="house" data-ready={ready}>
    <HouseClump snapshot={snapshot} onSnapshot={accept} onOpen={(id, origin) => setOpened({ id, origin })} onStatus={setStatus} />
    <GiftComposer onGift={accept} />
    {loadError && <p className="house-connection" role="status">{loadError}</p>}
    <p className={status && status !== "Placed." ? "house-connection" : "house-sr-only"} role="status">{status}</p>
    {opened && openedGift && <GiftDialog gift={openedGift} origin={opened.origin} onClose={close} onSnapshot={accept} />}
  </div>;
}

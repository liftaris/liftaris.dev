import { useCallback, useEffect, useRef, useState } from "react";
import { getHouse } from "../../lib/house/client";
import { useHouseSync } from "../../lib/house/use-house-sync";
import type { Gift, HouseSnapshot } from "../../lib/house/types";
import { GiftComposer } from "./GiftComposer";
import { GiftDialog } from "./GiftDialog";
import { HouseClump } from "./HouseClump";
import "./house.css";

const EMPTY_GIFTS: readonly Gift[] = [];

export function House() {
  const [snapshot, setSnapshot] = useState<HouseSnapshot | null>(null);
  // An open card is a local snapshot, not a lookup into the live collection.
  const [opened, setOpened] = useState<{ gift: Gift; origin: DOMRect } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [ready, setReady] = useState(false);
  const latest = useRef(-1);
  const accept = useCallback((next: HouseSnapshot) => {
    if (next.revision < latest.current) return;
    latest.current = next.revision;
    setSnapshot(next);
    setLoadError("");
  }, []);
  const close = useCallback(() => setOpened(null), []);
  useHouseSync(accept);

  useEffect(() => {
    setReady(true);
    const controller = new AbortController();
    void getHouse(controller.signal).then(accept).catch(() => {
      if (!controller.signal.aborted && latest.current < 0) setLoadError("The house couldn’t connect. Reconnecting…");
    });
    return () => controller.abort();
  }, [accept]);

  return <div className="house" data-ready={ready}>
    <HouseClump gifts={snapshot?.gifts ?? EMPTY_GIFTS} inspectedId={opened?.gift.id ?? null} onOpen={(gift, origin) => setOpened({ gift, origin })} />
    <GiftComposer onGift={accept} />
    {loadError && <p className="house-connection" role="status">{loadError}</p>}
    {opened && <GiftDialog gift={opened.gift} origin={opened.origin} onClose={close} onSnapshot={accept} />}
  </div>;
}

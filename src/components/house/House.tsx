import { useCallback, useEffect, useRef, useState } from "react";
import { getHouse } from "../../lib/house/client";
import { useHouseSync } from "../../lib/house/use-house-sync";
import type { Gift, HouseSnapshot } from "../../lib/house/types";
import { GiftComposer } from "./GiftComposer";
import { GiftDialog } from "./GiftDialog";
import { HouseClump } from "./HouseClump";
import type { ObjectSpec } from "../clump/model";
import { ObjectWindow } from "../window/ObjectWindow";
import { Stage } from "../../../components/Stage";
import "./house.css";

const EMPTY_GIFTS: readonly Gift[] = [];
type OpenedThing = { object: ObjectSpec; gift?: Gift; origin: DOMRect; source: HTMLButtonElement };

export function House() {
  const [snapshot, setSnapshot] = useState<HouseSnapshot | null>(null);
  // An open card is a local snapshot, not a lookup into the live collection.
  const [opened, setOpened] = useState<OpenedThing[]>([]);
  const [loadError, setLoadError] = useState("");
  const [ready, setReady] = useState(false);
  const latest = useRef(-1);
  const accept = useCallback((next: HouseSnapshot) => {
    if (next.revision < latest.current) return;
    latest.current = next.revision;
    setSnapshot(next);
    setLoadError("");
  }, []);
  const close = (id: string) => setOpened((current) => current.filter((item) => item.object.id !== id));
  const open = (object: ObjectSpec, source: HTMLButtonElement, gift?: Gift) => {
    const item = { object, source, gift, origin: source.getBoundingClientRect() };
    setOpened((current) => current.some((entry) => entry.object.id === object.id) ? current : [...current, item]);
  };
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
    <HouseClump gifts={snapshot?.gifts ?? EMPTY_GIFTS} inspectedIds={opened.map((item) => item.object.id)} onOpen={open} />
    <GiftComposer onGift={accept} />
    {loadError && <p className="house-connection" role="status">{loadError}</p>}
    {opened.map((item) => {
      const view = item.object.id === "computer" ? "projects" : item.object.id === "case" ? "experience" : undefined;
      const title = view === "projects" ? "Projects" : view === "experience" ? "Experience" : item.object.name;
      return <ObjectWindow key={item.object.id} title={title} icon={item.object.emoji} origin={item.origin} source={item.source}
        monochrome={!item.gift} closeLabel={item.gift ? "Close gift" : undefined} onClose={() => close(item.object.id)}>
        {item.gift ? <GiftDialog gift={item.gift} onClose={() => close(item.object.id)} onSnapshot={accept} /> : view ? <Stage view={view} /> : null}
      </ObjectWindow>;
    })}
  </div>;
}

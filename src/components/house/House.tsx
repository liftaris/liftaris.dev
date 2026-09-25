import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { getHouse } from "../../lib/house/client";
import { useHouseSync } from "../../lib/house/use-house-sync";
import type { Gift, GiftDetail, HouseSnapshot } from "../../lib/house/types";
import { giftObjects } from "../../lib/house/emoji";
import { GiftComposer } from "./GiftComposer";
import { GiftDialog } from "./GiftDialog";
import { HouseClump } from "./HouseClump";
import type { ObjectSpec } from "../clump/model";
import { ObjectWindow } from "../window/ObjectWindow";
import { Stage } from "../../../components/Stage";
import "./house.css";

const EMPTY_GIFTS: readonly Gift[] = [];
type OpenedThing = { object: ObjectSpec; gift?: Gift; detail?: GiftDetail; origin: DOMRect; source: HTMLButtonElement; previewBounds?: DOMRect };

export function House() {
  const [snapshot, setSnapshot] = useState<HouseSnapshot | null>(null);
  // An open card is a local snapshot, not a lookup into the live collection.
  const [opened, setOpened] = useState<OpenedThing[]>([]);
  const [loadError, setLoadError] = useState("");
  const [ready, setReady] = useState(false);
  const [savingGift, setSavingGift] = useState(false);
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
  const receiveGift = (next: HouseSnapshot, gift: GiftDetail, previewBounds: DOMRect) => {
    // Commit membership first so the real gift, not the composer, owns collapse/focus.
    flushSync(() => accept(next));
    const source = document.querySelector<HTMLButtonElement>(`[data-object="${gift.id}"]`)
      ?? document.querySelector<HTMLButtonElement>('[data-object="leave-gift"]')!;
    setOpened((current) => [...current.filter((item) => item.object.id !== gift.id), {
      object: giftObjects([gift])[0], gift, detail: gift, source, origin: source.getBoundingClientRect(), previewBounds,
    }]);
  };
  const finishComposer = () => {
    const frame = document.querySelector<HTMLElement>(".house-composer")?.closest<HTMLElement>(".object-window");
    if (!frame || matchMedia("(prefers-reduced-motion: reduce)").matches) { close("leave-gift"); return; }
    frame.style.pointerEvents = "none";
    void frame.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "ease-out", fill: "forwards" })
      .finished.then(() => close("leave-gift"), () => close("leave-gift"));
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
    {loadError && <p className="house-connection" role="status">{loadError}</p>}
    {opened.map((item) => {
      const view = item.object.id === "computer" ? "projects" : item.object.id === "case" ? "experience" : undefined;
      const composing = item.object.id === "leave-gift";
      const title = view === "projects" ? "Projects" : view === "experience" ? "Experience" : item.object.name;
      return <ObjectWindow key={item.object.id} title={title} icon={item.object.emoji} origin={item.origin} source={item.source}
        width={composing ? 640 : undefined} height={composing ? 660 : undefined} canClose={!composing || !savingGift}
        initialBounds={item.previewBounds} onReady={item.previewBounds ? finishComposer : undefined}
        monochrome={!item.gift} closeLabel={item.gift ? "Close gift" : undefined} onClose={() => close(item.object.id)}>
        {item.gift ? <GiftDialog gift={item.gift} initialDetail={item.detail} onClose={() => close(item.object.id)} onSnapshot={accept} /> : composing ? <GiftComposer onGift={receiveGift} onSavingChange={setSavingGift} /> : view ? <Stage view={view} /> : null}
      </ObjectWindow>;
    })}
  </div>;
}

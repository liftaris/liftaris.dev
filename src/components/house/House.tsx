import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ensureVisitor, getHouse } from "../../lib/house/client";
import type { Gift, GiftDetail, HouseSnapshot } from "../../lib/house/types";
import { giftObjects } from "../../lib/house/emoji";
import { GiftComposer } from "./GiftComposer";
import { GiftDialog } from "./GiftDialog";
import { HouseClump } from "./HouseClump";
import type { ObjectSpec } from "../clump/model";
import { ObjectWindow } from "../window/ObjectWindow";
import { Folder, type FolderSpec } from "../folder/Folder";
import { PORTFOLIO_FOLDER } from "./folders";
import { Stage } from "../../../components/Stage";
import "./house.css";

const EMPTY_GIFTS: readonly Gift[] = [];
type OpenedThing = { object: ObjectSpec | FolderSpec<ObjectSpec>; gift?: Gift; detail?: GiftDetail; origin: DOMRect; source: HTMLButtonElement; previewBounds?: DOMRect };

export function House() {
  const [snapshot, setSnapshot] = useState<HouseSnapshot | null>(null);
  // Open cards retain their contents until this browser edits or closes them.
  const [opened, setOpened] = useState<OpenedThing[]>([]);
  const [loadError, setLoadError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [ready, setReady] = useState(false);
  const [savingGift, setSavingGift] = useState(false);
  const initialRead = useRef<AbortController | null>(null);
  const accept = useCallback((next: HouseSnapshot) => {
    // A slow initial GET must never replace the result of this tab's mutation.
    initialRead.current?.abort();
    initialRead.current = null;
    setSnapshot(next);
    setOpened((current) => current.map((item) => {
      const gift = item.gift && next.gifts.find((entry) => entry.id === item.gift!.id);
      return gift ? { ...item, gift, object: giftObjects([gift])[0] } : item;
    }));
    setLoadError("");
  }, []);
  const close = (id: string) => setOpened((current) => current.filter((item) => item.object.id !== id));
  const open = (object: ObjectSpec | FolderSpec<ObjectSpec>, source: HTMLButtonElement, gift?: Gift) => {
    const item = { object: object.id === PORTFOLIO_FOLDER.id ? PORTFOLIO_FOLDER : object, source, gift, origin: source.getBoundingClientRect() };
    setOpened((current) => current.some((entry) => entry.object.id === object.id) ? current : [...current, item]);
  };
  const receiveGift = (gift: GiftDetail, previewBounds: DOMRect) => {
    // Membership was committed on POST; don't reapply its snapshot after this GET.
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
  useEffect(() => {
    setReady(true);
    let active = true;
    const controller = new AbortController();
    initialRead.current = controller;
    void ensureVisitor().catch((reason: unknown) => {
      if (active) setSessionError(reason instanceof Error ? reason.message : "Couldn’t start your visitor session. Reload to try again.");
    });
    void getHouse(controller.signal).then((next) => {
      if (!controller.signal.aborted) accept(next);
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError("The gifts couldn’t load. Reload to try again.");
    });
    return () => { active = false; controller.abort(); };
  }, [accept]);

  return <div className="house" data-ready={ready}>
    <HouseClump gifts={snapshot?.gifts ?? EMPTY_GIFTS} inspectedIds={opened.map((item) => item.object.id)} onOpen={open} />
    {loadError && <p className="house-connection" role="status">{loadError}</p>}
    {sessionError && <p className="house-connection" role="status">{sessionError}</p>}
    {opened.map((item) => {
      const folder = "kind" in item.object ? item.object : undefined;
      const fallbackSource = () => document.querySelector<HTMLButtonElement>(`[data-folder-entry="${CSS.escape(item.object.id)}"]`)
        ?? document.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(folder ? PORTFOLIO_FOLDER.id : item.object.id)}"]:not([data-removing="true"])`)
        ?? document.querySelector<HTMLButtonElement>('[data-object="leave-gift"]');
      if (folder) return <Folder key={item.object.id} folder={folder}
        origin={item.origin} source={item.source} fallbackSource={fallbackSource} monochrome openedIds={opened.map((entry) => entry.object.id)}
        onOpen={open} onOpenFolder={open} onClose={() => close(item.object.id)} />;
      const view = item.object.id === "computer" ? "projects" : item.object.id === "case" ? "experience" : undefined;
      const composing = item.object.id === "leave-gift";
      const title = view === "projects" ? "Projects" : view === "experience" ? "Experience" : item.object.name;
      return <ObjectWindow key={item.object.id} title={title} icon={item.object.emoji} origin={item.origin} source={item.source} fallbackSource={fallbackSource}
        width={composing ? 640 : undefined} height={composing ? 660 : undefined} canClose={!composing || !savingGift}
        initialBounds={item.previewBounds} onReady={item.previewBounds ? finishComposer : undefined}
        monochrome={!item.gift} closeLabel={item.gift ? "Close gift" : undefined} onClose={() => close(item.object.id)}>
        {item.gift ? <GiftDialog gift={item.gift} initialDetail={item.detail} onClose={() => close(item.object.id)} onSnapshot={accept} /> : composing ? <GiftComposer onGift={receiveGift} onSnapshot={(next) => flushSync(() => accept(next))} onSavingChange={setSavingGift} /> : view ? <Stage view={view} /> : null}
      </ObjectWindow>;
    })}
  </div>;
}

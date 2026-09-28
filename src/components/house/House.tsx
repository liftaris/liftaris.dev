import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ensureViewer, getHouse, houseMutations, reclaimGift } from "../../lib/house/client";
import type { Gift, GiftDetail, HouseSnapshot } from "../../lib/house/types";
import { giftObjects } from "../../lib/house/emoji";
import { GiftComposer } from "./GiftComposer";
import { GiftDialog } from "./GiftDialog";
import { HouseClump } from "./HouseClump";
import { getBackgroundStyle } from "../clump/model";
import { ObjectWindow } from "../window/ObjectWindow";
import { Folder, type FolderSpec } from "../folder/Folder";
import {
  DEFAULT_THINGS,
  PORTFOLIO_FOLDER_OBJECT,
  WRITING_FOLDER_OBJECT,
  buildFolder,
  writingFolder,
  getDefaultOpenChildren,
  getInitialDefaultOpenThings,
  type HouseThing,
  type ThingSpec,
  type WritingPost,
} from "./folders";
import { PostReader } from "./PostReader";
import { PageReader } from "./PageReader";
import { Stage } from "../../../components/Stage";
import "./house.css";

const EMPTY_GIFTS: readonly Gift[] = [];
type OpenedThing = { object: HouseThing | FolderSpec<HouseThing>; gift?: Gift; detail?: GiftDetail; origin: DOMRect; source: HTMLButtonElement; previewBounds?: DOMRect; onReady?: () => void };

const EMPTY_POSTS: readonly WritingPost[] = [];
const VISITED_STORAGE_KEY = "liftaris:visited_things";

function loadVisitedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(VISITED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function saveVisitedIds(ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem(VISITED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore quota/security errors
  }
}

const SENT_GIFTS_STORAGE_KEY = "liftaris:sent_gifts";

function loadSentGiftIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SENT_GIFTS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function saveSentGiftIds(ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem(SENT_GIFTS_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore quota/security errors
  }
}

function isFolderObject(id: string, kind?: string): boolean {
  return kind === "folder" || id === "portfolio-folder" || id === "writing-folder" || id === "lab-folder" || id.endsWith("-folder");
}

export function House({
  posts = EMPTY_POSTS,
  things = DEFAULT_THINGS,
  thingsConfig,
}: {
  posts?: readonly WritingPost[];
  things?: readonly ThingSpec[];
  thingsConfig?: Record<string, { tint_when_visited?: boolean; default_open?: boolean }>;
}) {
  const effectiveThings = useMemo(() => {
    return things.map((t) => {
      const override = thingsConfig?.[t.id];
      if (!override) return t;
      return {
        ...t,
        ...(override.tint_when_visited !== undefined ? { tint_when_visited: override.tint_when_visited } : {}),
        ...(override.default_open !== undefined ? { default_open: override.default_open } : {}),
      };
    });
  }, [things, thingsConfig]);

  const foldersById = useMemo(() => {
    const map = new Map<string, FolderSpec<HouseThing>>();
    for (const thing of effectiveThings) {
      if (thing.kind === "folder") {
        map.set(thing.id, buildFolder(thing, effectiveThings, posts));
      }
    }
    if (!map.has("writing-folder")) {
      map.set("writing-folder", writingFolder(posts, effectiveThings));
    }
    if (!map.has("portfolio-folder")) {
      const pfThing = effectiveThings.find((t) => t.id === "portfolio-folder") ?? DEFAULT_THINGS.find((t) => t.id === "portfolio-folder")!;
      map.set("portfolio-folder", buildFolder(pfThing, effectiveThings, posts));
    }
    return map;
  }, [effectiveThings, posts]);

  const desktopThings = useMemo(() => {
    const dt = effectiveThings.filter((t) => t.desktop);
    return dt.length > 0 ? dt : undefined;
  }, [effectiveThings]);

  const mergedThingsConfig = useMemo(() => {
    const config: Record<string, { tint_when_visited?: boolean; default_open?: boolean }> = {};
    for (const thing of effectiveThings) {
      config[thing.id] = { tint_when_visited: thing.tint_when_visited, default_open: thing.default_open };
    }
    if (thingsConfig) {
      for (const [id, cfg] of Object.entries(thingsConfig)) {
        config[id] = { ...config[id], ...cfg };
      }
    }
    return config;
  }, [effectiveThings, thingsConfig]);

  const [visitedIds, setVisitedIds] = useState<Set<string>>(() => loadVisitedIds());
  const [sentGiftIds, setSentGiftIds] = useState<Set<string>>(() => loadSentGiftIds());
  const [isAdmin, setIsAdmin] = useState(false);
  const [snapshot, setSnapshot] = useState<HouseSnapshot | null>(null);
  const accepted = useRef<HouseSnapshot | null>(null);
  // Open cards retain their contents until this browser edits or closes them.
  const [opened, setOpened] = useState<OpenedThing[]>([]);
  const [loadError, setLoadError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [ready, setReady] = useState(false);
  const [savingGift, setSavingGift] = useState(false);
  const initialRead = useRef<AbortController | null>(null);

  const markVisited = useCallback((id: string) => {
    if (isFolderObject(id)) return;
    setVisitedIds((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      saveVisitedIds(next);
      return next;
    });
  }, []);
  const accept = useCallback((next: HouseSnapshot) => {
    // A slow initial GET must never replace the result of this tab's mutation.
    initialRead.current?.abort();
    initialRead.current = null;
    accepted.current = next;
    setSnapshot(next);
    setOpened((current) => current.map((item) => {
      const gift = item.gift && next.gifts.find((entry) => entry.id === item.gift!.id);
      return gift ? { ...item, gift, object: giftObjects([gift])[0] } : item;
    }));
    setLoadError("");
  }, []);
  const [mutate] = useState(() => houseMutations((next) => flushSync(() => accept(next))));
  const refreshDetail = useCallback((gift: GiftDetail) => {
    if (gift.canReclaim) {
      setSentGiftIds((current) => {
        if (current.has(gift.id)) return current;
        const next = new Set(current);
        next.add(gift.id);
        saveSentGiftIds(next);
        return next;
      });
    }
    setOpened((current) => current.map((item) => item.object.id === gift.id
      ? { ...item, gift, object: giftObjects([gift])[0] } : item));
  }, []);
  const close = (id: string) => setOpened((current) => current.filter((item) => item.object.id !== id));
  const open = useCallback((object: HouseThing | FolderSpec<HouseThing>, source: HTMLButtonElement, gift?: Gift) => {
    const isFolder = isFolderObject(object.id, "kind" in object ? object.kind : undefined);
    if (!isFolder) {
      markVisited(object.id);
    }
    const resolvedObject = foldersById.get(object.id) ?? object;
    const parentRect = source.getBoundingClientRect();
    const item = { object: resolvedObject, source, gift, origin: parentRect };

    setOpened((current) => {
      const next = [...current];
      if (!next.some((entry) => entry.object.id === object.id)) {
        next.push(item);
      }
      if (isFolder) {
        const defaultChildren = getDefaultOpenChildren(object.id, effectiveThings);
        defaultChildren.forEach((child, idx) => {
          if (!next.some((entry) => entry.object.id === child.id)) {
            if (!isFolderObject(child.id, child.kind)) {
              markVisited(child.id);
            }
            const resolvedChild = foldersById.get(child.id) ?? child;
            const childSource = (typeof document !== "undefined" && (
              document.querySelector<HTMLButtonElement>(`[data-folder-entry="${CSS.escape(child.id)}"]`) ??
              document.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(child.id)}"]`)
            )) || source;
            const origin = new DOMRect(
              parentRect.left + (idx + 1) * 32,
              parentRect.top + (idx + 1) * 32,
              parentRect.width,
              parentRect.height
            );
            next.push({ object: resolvedChild, source: childSource, origin });
          }
        });
      }
      return next;
    });
  }, [foldersById, effectiveThings, markVisited]);
  const receiveGift = (composer: OpenedThing, gift: GiftDetail, previewBounds: DOMRect, form: HTMLFormElement) => {
    // Membership was committed on POST; don't reapply its snapshot after this GET.
    const source = document.querySelector<HTMLButtonElement>(`[data-object="${gift.id}"]`)
      ?? document.querySelector<HTMLButtonElement>('[data-object="leave-gift"]')!;
    const frame = form.closest<HTMLElement>(".object-window");
    let finished = false;
    const finishComposer = () => {
      if (finished) return;
      finished = true;
      // Only retire the composer that submitted this gift, never a newer draft.
      const retire = () => setOpened((current) => current.filter((item) => item !== composer)
        .map((item) => item.onReady === finishComposer ? { ...item, onReady: undefined, previewBounds: undefined } : item));
      if (!frame?.isConnected || matchMedia("(prefers-reduced-motion: reduce)").matches) { retire(); return; }
      frame.style.pointerEvents = "none";
      void frame.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "ease-out", fill: "forwards" })
        .finished.then(retire, retire);
    };
    setSentGiftIds((current) => {
      if (current.has(gift.id)) return current;
      const next = new Set(current);
      next.add(gift.id);
      saveSentGiftIds(next);
      return next;
    });
    const visible = accepted.current?.gifts.find((item) => item.id === gift.id);
    if (!visible) { finishComposer(); return; }
    setOpened((current) => current.some((item) => item.object.id === gift.id)
      ? current.map((item) => item.object.id === gift.id ? { ...item, onReady: finishComposer } : item)
      : [...current, {
        object: giftObjects([visible])[0], gift: visible, detail: gift, source,
        origin: source.getBoundingClientRect(), previewBounds, onReady: finishComposer,
      }]);
  };
  const trashGift = useCallback(async (id: string) => {
    try {
      await mutate(() => reclaimGift(id));
      close(id);
      setSentGiftIds((current) => {
        if (!current.has(id)) return current;
        const next = new Set(current);
        next.delete(id);
        saveSentGiftIds(next);
        return next;
      });
    } catch (error) {
      // Re-throw so caller knows deletion failed and can revert UI
      throw error;
    }
  }, [mutate]);
  useEffect(() => {
    setReady(true);
    let active = true;
    const controller = new AbortController();
    initialRead.current = controller;
    void ensureViewer().then((viewer) => {
      if (active && viewer?.owner) setIsAdmin(true);
    }).catch((reason: unknown) => {
      if (active) setSessionError(reason instanceof Error ? reason.message : "Couldn’t start your visitor session. Reload to try again.");
    });
    void getHouse(controller.signal).then((next) => {
      if (!controller.signal.aborted) accept(next);
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError("The gifts couldn’t load. Reload to try again.");
    });
    return () => { active = false; controller.abort(); };
  }, [accept]);

  const initialOpenDone = useRef(false);
  useEffect(() => {
    if (initialOpenDone.current) return;
    initialOpenDone.current = true;

    const toOpen = getInitialDefaultOpenThings(effectiveThings);
    if (toOpen.length === 0) return;

    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 768;
    const defaultOrigin = new DOMRect(
      Math.max(40, (viewportWidth - 480) / 2),
      Math.max(40, (viewportHeight - 380) / 3),
      48,
      48
    );

    setOpened((current) => {
      const next = [...current];
      toOpen.forEach((thing, idx) => {
        if (next.some((entry) => entry.object.id === thing.id)) return;
        if (!isFolderObject(thing.id, thing.kind)) {
          markVisited(thing.id);
        }
        const resolvedObject = foldersById.get(thing.id) ?? thing;
        const domSource = typeof document !== "undefined" ? (
          document.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(thing.id)}"]`) ??
          document.querySelector<HTMLButtonElement>(`[data-folder-entry="${CSS.escape(thing.id)}"]`) ??
          (thing.parent_id ? document.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(thing.parent_id)}"]`) : null)
        ) : null;

        const source = domSource ?? (typeof document !== "undefined" ? document.createElement("button") : (null as unknown as HTMLButtonElement));
        const domRect = domSource?.getBoundingClientRect();
        const origin = (domRect && domRect.width > 0)
          ? new DOMRect(domRect.left + idx * 32, domRect.top + idx * 32, domRect.width, domRect.height)
          : new DOMRect(defaultOrigin.left + idx * 32, defaultOrigin.top + idx * 32, defaultOrigin.width, defaultOrigin.height);

        next.push({ object: resolvedObject, source, origin });
      });
      return next;
    });
  }, [effectiveThings, foldersById, markVisited]);

  return <div className="house" data-ready={ready}>
    <HouseClump
      gifts={snapshot?.gifts ?? EMPTY_GIFTS}
      inspectedIds={opened.map((item) => item.object.id)}
      visitedIds={visitedIds}
      thingsConfig={mergedThingsConfig}
      desktopObjects={desktopThings}
      isAdmin={isAdmin}
      sentGiftIds={sentGiftIds}
      onOpen={open}
      onTrash={trashGift}
    />
    {loadError && <p className="house-connection" role="status">{loadError}</p>}
    {sessionError && <p className="house-connection" role="status">{sessionError}</p>}
    {opened.map((item) => {
      const folder = "kind" in item.object && item.object.kind === "folder" && "items" in item.object ? (item.object as FolderSpec<HouseThing>) : undefined;
      const post = "kind" in item.object && item.object.kind === "post" ? item.object : undefined;
      const page = "kind" in item.object && item.object.kind === "page" ? (item.object as ThingSpec) : undefined;
      const parentFolderId = "parent_id" in item.object && item.object.parent_id ? item.object.parent_id : undefined;
      const fallbackSource = () => document.querySelector<HTMLButtonElement>(`[data-folder-entry="${CSS.escape(item.object.id)}"]`)
        ?? document.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(item.object.id)}"]:not([data-removing="true"])`)
        ?? (parentFolderId ? document.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(parentFolderId)}"]`) : null)
        ?? document.querySelector<HTMLButtonElement>(`[data-object="${post ? WRITING_FOLDER_OBJECT.id : PORTFOLIO_FOLDER_OBJECT.id}"]`)
        ?? document.querySelector<HTMLButtonElement>('[data-object="leave-gift"]');
      if (folder) return <Folder key={item.object.id} folder={folder}
        origin={item.origin} source={item.source} fallbackSource={fallbackSource} monochrome openedIds={opened.map((entry) => entry.object.id)}
        visitedIds={visitedIds} thingsConfig={mergedThingsConfig} onVisit={markVisited}
        onOpen={open} onOpenFolder={open} onClose={() => close(item.object.id)} />;
      const action = "action" in item.object ? item.object.action : undefined;
      const view = action === "projects" || item.object.id === "computer" ? "projects" : action === "experience" || item.object.id === "case" ? "experience" : undefined;
      const composing = action === "leave-gift" || item.object.id === "leave-gift";
      const title = view === "projects" ? "Projects" : view === "experience" ? "Experience" : item.object.name;
      const icon = ("image" in item.object && (item.object as { image?: string | null }).image) || item.object.emoji;
      const bgStyle = getBackgroundStyle("background_image" in item.object ? item.object : undefined);
      return <ObjectWindow key={item.object.id} title={title} icon={icon} origin={item.origin} source={item.source} fallbackSource={fallbackSource}
        width={post || page ? 780 : composing ? 640 : undefined} height={post || page ? 720 : composing ? 660 : undefined} canClose={!composing || !savingGift}
        initialBounds={item.previewBounds} backgroundStyle={bgStyle} onReady={item.onReady}
        monochrome={!item.gift} closeLabel={item.gift ? "Close gift" : undefined} onClose={() => close(item.object.id)}>
        {item.gift ? <GiftDialog gift={item.gift} initialDetail={item.detail} onClose={() => close(item.object.id)} onDetail={refreshDetail} mutate={mutate} /> : composing ? <GiftComposer onGift={(gift, bounds, form) => receiveGift(item, gift, bounds, form)} mutate={mutate} onSavingChange={setSavingGift} /> : post ? <PostReader post={post} /> : page ? <PageReader page={page} /> : view ? <Stage view={view} /> : null}
      </ObjectWindow>;
    })}
  </div>;
}

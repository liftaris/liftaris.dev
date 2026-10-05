import { AuthoringContext, useThingPreview, ThingsToolbar } from './ThingAuthoring';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ensureViewer, getHouse, houseMutations, reclaimGift } from "../../lib/house/client";
import type { Gift, GiftDetail, HouseSnapshot } from "../../lib/house/types";
import { giftObjects } from "../../lib/house/emoji";
import { GiftDialog } from "./GiftDialog";
import { HouseClump } from "./HouseClump";
import { getBackgroundStyle } from "../clump/model";
import { ObjectWindow } from "../window/ObjectWindow";
import { Folder, type FolderSpec } from "../folder/Folder";
import {
  buildFolder,
  getDefaultOpenChildren,
  getInitialDefaultOpenThings,
  type HouseThing,
  type ThingSpec,
  type WritingPost,
} from "./folders";
import { PageReader } from "./PageReader";

const EMPTY_GIFTS: readonly Gift[] = [];
type OpenedThing = { object: HouseThing | FolderSpec<HouseThing>; gift?: Gift; detail?: GiftDetail; origin: DOMRect; source: HTMLButtonElement; previewBounds?: DOMRect; restoreAnimation?: boolean; onReady?: () => void };

const EMPTY_POSTS: readonly WritingPost[] = [];

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

function isFolderObject(_id: string, kind?: string): boolean {
  return kind === "folder";
}

export function House({
  posts = EMPTY_POSTS,
  things = [],
  editMode = false,
  initialFolderId,
  thingsConfig,
}: {
  posts?: readonly WritingPost[];
  things?: readonly ThingSpec[];
  editMode?: boolean;
  initialFolderId?: string;
  thingsConfig?: Record<string, { default_open?: boolean }>;
}) {
  const { things: effectiveThings, authoring } = useThingPreview(things, editMode);
  const foldersById = useMemo(() => new Map(effectiveThings.filter(t=>t.kind==='folder').map(t=>[t.id,buildFolder(t,effectiveThings)])),[effectiveThings]);
  const desktopThings = useMemo(() => effectiveThings.filter(t=>t.desktop),[effectiveThings]);
  const mergedThingsConfig = useMemo(() => {
    const config: Record<string, { default_open?: boolean }> = {};
    for (const thing of effectiveThings) {
      config[thing.id] = { default_open: thing.default_open };
    }
    if (thingsConfig) {
      for (const [id, cfg] of Object.entries(thingsConfig)) {
        config[id] = { ...config[id], ...cfg };
      }
    }
    return config;
  }, [effectiveThings, thingsConfig]);

  const [sentGiftIds, setSentGiftIds] = useState<Set<string>>(() => loadSentGiftIds());
  const [isAdmin, setIsAdmin] = useState(false);
  const [snapshot, setSnapshot] = useState<HouseSnapshot | null>(null);
  const accepted = useRef<HouseSnapshot | null>(null);
  // Open cards retain their contents until this browser edits or closes them.
  const [opened, setOpened] = useState<OpenedThing[]>([]);
  const [loadError, setLoadError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [ready, setReady] = useState(false);
  const initialRead = useRef<AbortController | null>(null);
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
  }, [foldersById, effectiveThings]);
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
    if(authoring.session)return;
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

    const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const restoreSlug = initialFolderId ?? urlParams?.get("restore");

    const toOpen = authoring.session ? [] : [...getInitialDefaultOpenThings(effectiveThings)];

    let restoredId: string | null = null;
    if (restoreSlug) {
      const restoredThing = effectiveThings.find(t=>t.id===restoreSlug || t.slug===restoreSlug || t.page_source===restoreSlug || t.href===`/${restoreSlug}`);

      if (restoredThing) {
        restoredId = (restoredThing as HouseThing).id;
        if (!toOpen.some((t) => t.id === restoredId)) {
          toOpen.push(restoredThing as ThingSpec);
        }
      }

      if (typeof window !== "undefined" && window.history?.replaceState) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("restore");
        const queryStr = newUrl.searchParams.toString();
        window.history.replaceState({}, "", newUrl.pathname + (queryStr ? `?${queryStr}` : "") + newUrl.hash);
      }
    }

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

        const isRestored = Boolean(restoreSlug && (thing.id === restoreSlug || (restoredId && thing.id === restoredId)));
        next.push({ object: resolvedObject, source, origin, restoreAnimation: isRestored });
      });
      return next;
    });
  }, [effectiveThings, foldersById, posts, initialFolderId]);

  useEffect(() => {
    if (!editMode) return;
    setOpened(items => items.flatMap(item => {
      if(item.gift) return [item];
      const updated = foldersById.get(item.object.id) ?? effectiveThings.find(t=>t.id===item.object.id);
      return updated ? [{...item,object:updated}] : [];
    }));
  }, [effectiveThings,foldersById,editMode]);
  const geometry = (id: string) => authoring.session ? (size: {width:number;height:number}) => authoring.send({type:'resize',id,window_width:size.width,window_height:size.height}) : undefined;
  const moveGeometry = (id: string) => authoring.session ? (pos: {x:number;y:number}) => authoring.send({type:'window_position',id,window_x:pos.x,window_y:pos.y}) : undefined;
  return (
    <AuthoringContext.Provider value={authoring}><ThingsToolbar />
    <div className="house flex flex-col size-full min-w-0 min-h-0 @container text-paper" data-ready={ready}>
      <HouseClump
        gifts={authoring.session ? EMPTY_GIFTS : snapshot?.gifts ?? EMPTY_GIFTS}
        inspectedIds={opened.map((item) => item.object.id)}
        thingsConfig={mergedThingsConfig}
        desktopObjects={desktopThings}
        isAdmin={isAdmin}
        sentGiftIds={sentGiftIds}
        onOpen={open}
        onTrash={trashGift}
      />
      {loadError && <p className="house-connection shrink-0 max-h-[30%] overflow-auto mt-2 px-4 text-center text-xs" role="status">{loadError}</p>}
      {sessionError && <p className="house-connection shrink-0 max-h-[30%] overflow-auto mt-2 px-4 text-center text-xs" role="status">{sessionError}</p>}

      {opened.map((item) => {
        const spec = effectiveThings.find(t=>t.id===item.object.id);
        const folder = "kind" in item.object && item.object.kind === "folder" && "items" in item.object ? (item.object as FolderSpec<HouseThing>) : undefined;
        const page = "kind" in item.object && (item.object.kind === "page" || item.object.kind === "post") ? (item.object as ThingSpec) : undefined;
        const parentFolderId = "parent_id" in item.object && item.object.parent_id ? item.object.parent_id : undefined;
        const fallbackSource = () => document.querySelector<HTMLButtonElement>(`[data-folder-entry="${CSS.escape(item.object.id)}"]`)
          ?? document.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(item.object.id)}"]:not([data-removing="true"])`)
          ?? (parentFolderId ? document.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(parentFolderId)}"]`) : null);
        if (folder) return <Folder key={item.object.id} folder={folder}
          origin={item.origin} source={item.source} fallbackSource={fallbackSource} monochrome openedIds={opened.map((entry) => entry.object.id)}
          thingsConfig={mergedThingsConfig}
          width={spec?.window_width} height={spec?.window_height}
          x={spec?.window_x} y={spec?.window_y}
          onAuthorResize={geometry(item.object.id)} onAuthorMove={moveGeometry(item.object.id)}
          maximizeUrl={spec?.href ?? undefined}
          restoreAnimation={item.restoreAnimation}
          onOpen={open} onOpenFolder={open} onClose={() => close(item.object.id)} />;
        const title = item.object.name;
        const icon = item.object.image || item.object.emoji;
        const bgStyle = spec?.kind === 'folder' ? getBackgroundStyle(spec) : undefined;
        return <ObjectWindow key={item.object.id} title={title} icon={icon} origin={item.origin} source={item.source} fallbackSource={fallbackSource}
          maximizeUrl={spec?.href ?? undefined}
          restoreAnimation={item.restoreAnimation}
          width={spec?.window_width} height={spec?.window_height}
          x={spec?.window_x} y={spec?.window_y}
          onAuthorResize={geometry(item.object.id)} onAuthorMove={moveGeometry(item.object.id)}
          initialBounds={item.previewBounds} backgroundStyle={bgStyle} onReady={item.onReady}
          monochrome={!item.gift} closeLabel={item.gift ? "Close gift" : undefined} onClose={() => close(item.object.id)}>
          {item.gift ? (
            <GiftDialog gift={item.gift} initialDetail={item.detail} onClose={() => close(item.object.id)} onDetail={refreshDetail} mutate={mutate} />
          ) : page ? (
            <PageReader page={page} />
          ) : null}
        </ObjectWindow>;
      })}
    </div></AuthoringContext.Provider>
  );
}

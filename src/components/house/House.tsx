import { AuthoringContext, useThingPreview, ThingsToolbar } from './ThingAuthoring';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HouseClump } from "./HouseClump";
import { ObjectWindow } from "../window/ObjectWindow";
import { Folder, type FolderSpec } from "../folder/Folder";
import {
  buildFolder,
  getDefaultOpenChildren,
  getInitialDefaultOpenThings,
  type HouseThing,
  type ThingSpec,
} from "./folders";
import { PageReader } from "./PageReader";

type OpenedThing = { object: HouseThing | FolderSpec<HouseThing>; origin: DOMRect; source: HTMLButtonElement; restoreAnimation?: boolean; };

export function House({
  things = [],
  editMode = false,
  initialFolderId,
}: {
  things?: readonly ThingSpec[];
  editMode?: boolean;
  initialFolderId?: string;
}) {
  const { things: effectiveThings, authoring } = useThingPreview(things, editMode);
  const foldersById = useMemo(() => new Map(effectiveThings.filter(t=>t.kind==='folder').map(t=>[t.id,buildFolder(t,effectiveThings)])),[effectiveThings]);
  const desktopThings = useMemo(() => effectiveThings.filter(t=>t.desktop),[effectiveThings]);
  const [opened, setOpened] = useState<OpenedThing[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const close = (id: string) => setOpened((current) => current.filter((item) => item.object.id !== id));
  const open = useCallback((object: HouseThing | FolderSpec<HouseThing>, source: HTMLButtonElement) => {
    const isFolder = "kind" in object && object.kind === "folder";
    const resolvedObject = foldersById.get(object.id) ?? object;
    const parentRect = source.getBoundingClientRect();
    const item = { object: resolvedObject, source, origin: parentRect };

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
          (thing.primaryFolder ? document.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(thing.primaryFolder)}"]`) : null)
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
  }, [effectiveThings, foldersById, initialFolderId]);

  useEffect(() => {
    if (!editMode) return;
    setOpened(items => items.flatMap(item => {
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
        inspectedIds={opened.map((item) => item.object.id)}
        desktopObjects={desktopThings}
        onOpen={open}
      />
      {opened.map((item) => {
        const spec = effectiveThings.find(t=>t.id===item.object.id);
        const folder = "kind" in item.object && item.object.kind === "folder" && "items" in item.object ? (item.object as FolderSpec<HouseThing>) : undefined;
        const page = "kind" in item.object && item.object.kind === "page" ? (item.object as ThingSpec) : undefined;
        const parentFolderId = spec?.primaryFolder;
        const fallbackSource = () => document.querySelector<HTMLButtonElement>(`[data-folder-entry="${CSS.escape(item.object.id)}"]`)
          ?? document.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(item.object.id)}"]`)
          ?? (parentFolderId ? document.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(parentFolderId)}"]`) : null);
        if (folder) return <Folder key={item.object.id} folder={folder}
          origin={item.origin} source={item.source} fallbackSource={fallbackSource} openedIds={opened.map((entry) => entry.object.id)}
          width={spec?.window_width} height={spec?.window_height}
          x={spec?.window_x} y={spec?.window_y}
          onAuthorResize={geometry(item.object.id)} onAuthorMove={moveGeometry(item.object.id)}
          maximizeUrl={spec?.href ?? undefined}
          restoreAnimation={item.restoreAnimation}
          onOpen={open} onOpenFolder={open} onClose={() => close(item.object.id)} />;
        const title = item.object.name;
        const icon = item.object.image || item.object.emoji;
        const isGuestbook = spec?.page_source === 'guestbook';
        const winClass = isGuestbook ? "guestbook-window" : undefined;
        return <ObjectWindow key={item.object.id} title={title} icon={icon} origin={item.origin} source={item.source} fallbackSource={fallbackSource}
          className={winClass}
          maximizeUrl={spec?.href ?? undefined}
          restoreAnimation={item.restoreAnimation}
          width={spec?.window_width} height={spec?.window_height}
          x={spec?.window_x} y={spec?.window_y}
          onAuthorResize={geometry(item.object.id)} onAuthorMove={moveGeometry(item.object.id)}
          onClose={() => close(item.object.id)}>
          {page && <PageReader page={page} />}
        </ObjectWindow>;
      })}
    </div></AuthoringContext.Provider>
  );
}

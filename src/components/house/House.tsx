import { AuthoringContext, useThingPreview, ThingsToolbar } from './ThingAuthoring';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HouseClump } from "./HouseClump";
import { getBackgroundStyle } from "../clump/model";
import { ObjectWindow } from "../window/ObjectWindow";
import { Folder } from "../folder/Folder";
import {
  getDefaultOpenChildren,
  getInitialDefaultOpenThings,
} from "../../lib/things/folders";
import { PageReader } from "./PageReader";

import type { ThingSpec } from '../../lib/things/scene';

type OpenedThing = { id: string; origin: DOMRect; source: HTMLButtonElement; restoreAnimation?: boolean; };

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
  const thingsById = useMemo(() => new Map(effectiveThings.map(t => [t.id, t])), [effectiveThings]);
  const desktopThings = useMemo(() => effectiveThings.filter(t=>t.desktop),[effectiveThings]);
  const [opened, setOpened] = useState<OpenedThing[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const close = (id: string) => setOpened((current) => current.filter((item) => item.id !== id));
  const open = useCallback((object: ThingSpec, source: HTMLButtonElement) => {
    const isFolder = object.kind === "folder";
    const parentRect = source.getBoundingClientRect();
    const item = { id: object.id, source, origin: parentRect };

    setOpened((current) => {
      const next = [...current];
      if (!next.some((entry) => entry.id === object.id)) {
        next.push(item);
      }
      if (isFolder) {
        const defaultChildren = getDefaultOpenChildren(object.id, effectiveThings);
        defaultChildren.forEach((child, idx) => {
          if (!next.some((entry) => entry.id === child.id)) {
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
            next.push({ id: child.id, source: childSource, origin });
          }
        });
      }
      return next;
    });
  }, [effectiveThings]);
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
        restoredId = restoredThing.id;
        if (!toOpen.some((t) => t.id === restoredId)) {
          toOpen.push(restoredThing);
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
        if (next.some((entry) => entry.id === thing.id)) return;
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
        next.push({ id: thing.id, source, origin, restoreAnimation: isRestored });
      });
      return next;
    });
  }, [effectiveThings, initialFolderId, authoring.session]);

  const geometry = (id: string) => authoring.session ? (size: {width:number;height:number}) => authoring.send({type:'resize',id,window_width:size.width,window_height:size.height}) : undefined;
  const moveGeometry = (id: string) => authoring.session ? (pos: {x:number;y:number}) => authoring.send({type:'window_position',id,window_x:pos.x,window_y:pos.y}) : undefined;
  return (
    <AuthoringContext.Provider value={authoring}><ThingsToolbar />
    <div className="house flex flex-col size-full min-w-0 min-h-0 @container text-paper" data-ready={ready}>
      <HouseClump
        inspectedIds={opened.map((item) => item.id)}
        desktopObjects={desktopThings}
        onOpen={open}
      />
      {opened.map((item) => {
        const spec = thingsById.get(item.id);
        if (!spec) return null;
        const folder = spec.kind === 'folder' ? spec : undefined;
        const parentFolderId = spec.primaryFolder;
        const fallbackSource = () => document.querySelector<HTMLButtonElement>(`[data-folder-entry="${CSS.escape(item.id)}"]`)
          ?? document.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(item.id)}"]`)
          ?? (parentFolderId ? document.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(parentFolderId)}"]`) : null);
        return <ObjectWindow key={item.id} title={spec.name} icon={spec.image || spec.emoji} origin={item.origin} source={item.source} fallbackSource={fallbackSource}
          className={folder ? "folder-window" : spec.page_source === "guestbook" ? "guestbook-window" : undefined}
          backgroundStyle={folder ? getBackgroundStyle(folder) : undefined}
          maximizeUrl={spec.href ?? undefined}
          restoreAnimation={item.restoreAnimation}
          width={spec.window_width} height={spec.window_height}
          x={spec.window_x} y={spec.window_y}
          onAuthorResize={geometry(item.id)} onAuthorMove={moveGeometry(item.id)}
          onClose={() => close(item.id)}>
          {folder ? <Folder folder={folder} contents={folder.contents.flatMap(id => thingsById.get(id) ?? [])} openedIds={opened.map(entry => entry.id)} onOpen={open} /> : <PageReader page={spec} />}
        </ObjectWindow>;
      })}
    </div></AuthoringContext.Provider>
  );
}

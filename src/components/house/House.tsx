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

type WindowState = { id: string; open: boolean; origin: DOMRect; source: HTMLButtonElement; restoreAnimation?: boolean; activation?: number; };

// Keep only a few inactive windows. Open windows are never evicted.
function retain(items: WindowState[]) {
  const inactive = items.filter(item => !item.open).slice(-4);
  return items.filter(item => item.open || inactive.includes(item));
}

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
  const [windows, setWindows] = useState<WindowState[]>([]);
  const house = useRef<HTMLDivElement>(null);
  const [windowRoot, setWindowRoot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setWindowRoot(house.current?.closest('[data-window-surface]')?.querySelector<HTMLElement>(':scope > [data-window-root]') ?? null);
  }, []);
  const close = (id: string) => setWindows(current => editMode
    ? current.filter(item => item.id !== id)
    : retain(current.map(item => item.id === id ? { ...item, open: false } : item)));
  const warm = (thing: ThingSpec, source: HTMLButtonElement) => {
    if (editMode || thing.kind !== 'page' || !thing.href || thing.previewUrl) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '')) return;
    const item = { id: thing.id, open: false, source, origin: source.getBoundingClientRect() };
    setWindows(current => current.some(entry => entry.id === thing.id) ? current : retain([...current, item]));
  };
  const openedIds = windows.filter(item => item.open).map(item => item.id);
  const open = useCallback((object: ThingSpec, source: HTMLButtonElement) => {
    const isFolder = object.kind === "folder";
    const parentRect = source.getBoundingClientRect();
    const item = { id: object.id, open: true, source, origin: parentRect };

    setWindows((current) => {
      const next = [...current.filter(entry => entry.id !== object.id).map(entry => ({ ...entry })), item];
      if (isFolder) {
        const defaultChildren = getDefaultOpenChildren(object.id, effectiveThings);
        defaultChildren.forEach((child, idx) => {
          if (!next.some((entry) => entry.id === child.id && entry.open)) {
            const childSource = (typeof document !== "undefined" && (
              windowRoot?.querySelector<HTMLButtonElement>(`[data-folder-entry="${CSS.escape(child.id)}"]`) ??
              house.current?.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(child.id)}"]`)
            )) || source;
            const origin = new DOMRect(
              parentRect.left + (idx + 1) * 32,
              parentRect.top + (idx + 1) * 32,
              parentRect.width,
              parentRect.height
            );
            const cached = next.find(entry => entry.id === child.id);
            if (cached) cached.open = true;
            else next.push({ id: child.id, open: true, source: childSource, origin });
          }
        });
      }
      return next;
    });
  }, [effectiveThings, windowRoot]);
  const initialOpenDone = useRef(false);
  useEffect(() => {
    const restore = () => {
      const element = house.current;
      if (!element?.isConnected) return;
      if (element.closest('[data-persisted-desktop]') && !document.documentElement.classList.contains('on-home')) return;
      const first = !initialOpenDone.current;
      initialOpenDone.current = true;
      const params = new URLSearchParams(location.hash.slice(1));
      const restoreId = (first ? initialFolderId : undefined) ?? params.get('restore');
      const closeId = params.get('close');
      const toOpen = first && !authoring.session
        ? getInitialDefaultOpenThings(effectiveThings).filter(t => t.id !== closeId)
        : [];
      const restored = effectiveThings.find(t => t.id === restoreId);
      if (restored && !toOpen.some(t => t.id === restored.id)) toOpen.push(restored);
      if (params.has('restore') || params.has('close')) {
        const url = new URL(location.href);
        params.delete('restore');
        params.delete('close');
        url.hash = params.toString();
        history.replaceState(history.state, '', url);
      }
      if (!toOpen.length && !closeId) return;
      setWindows(current => {
        const next = current.map(entry => ({ ...entry, open: entry.id === closeId ? false : entry.open }));
        toOpen.forEach((thing, index) => {
          const existing = next.find(entry => entry.id === thing.id);
          if (existing) {
            existing.open = true;
            existing.activation = performance.now();
            return;
          }
          const source = element.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(thing.id)}"]`)
            ?? element.querySelector<HTMLButtonElement>(`[data-folder-entry="${CSS.escape(thing.id)}"]`)
            ?? (thing.primaryFolder ? element.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(thing.primaryFolder)}"]`) : null)
            ?? document.createElement('button');
          const rect = source.getBoundingClientRect();
          const origin = rect.width > 0 ? rect : new DOMRect(Math.max(40, (innerWidth - 480) / 2) + index * 32, Math.max(40, (innerHeight - 380) / 3) + index * 32, 48, 48);
          next.push({ id: thing.id, open: true, source, origin, restoreAnimation: thing.id === restoreId });
        });
        return retain(next);
      });
    };
    restore();
    document.addEventListener('astro:page-load', restore);
    return () => document.removeEventListener('astro:page-load', restore);
  }, [effectiveThings, initialFolderId, authoring.session]);

  const geometry = (id: string) => authoring.session ? (size: {width:number;height:number}) => authoring.send({type:'resize',id,window_width:size.width,window_height:size.height}) : undefined;
  const moveGeometry = (id: string) => authoring.session ? (pos: {x:number;y:number}) => authoring.send({type:'window_position',id,window_x:pos.x,window_y:pos.y}) : undefined;
  return (
    <AuthoringContext.Provider value={authoring}><ThingsToolbar />
    <div ref={house} className="house flex flex-col size-full min-w-0 min-h-0 @container text-paper" data-ready={Boolean(windowRoot)} data-edit-mode={editMode}>
      <HouseClump
        inspectedIds={openedIds}
        desktopObjects={desktopThings}
        onOpen={open}
        onWarm={warm}
      />
      {windowRoot && windows.map((item) => {
        const spec = thingsById.get(item.id);
        if (!spec) return null;
        const folder = spec.kind === 'folder' ? spec : undefined;
        const parentFolderId = spec.primaryFolder;
        const fallbackSource = () => windowRoot.querySelector<HTMLButtonElement>(`[data-folder-entry="${CSS.escape(item.id)}"]`)
          ?? house.current?.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(item.id)}"]`)
          ?? (parentFolderId ? house.current?.querySelector<HTMLButtonElement>(`[data-object="${CSS.escape(parentFolderId)}"]`) : null) ?? null;
        return <ObjectWindow key={item.id} thingId={item.id} root={windowRoot} activation={item.activation} open={item.open} title={spec.name} icon={spec.image || spec.emoji} origin={item.origin} source={item.source} fallbackSource={fallbackSource}
          className={folder ? "folder-window" : spec.page_source === "guestbook" ? "guestbook-window" : undefined}
          backgroundStyle={folder ? getBackgroundStyle(folder) : undefined}
          maximizeUrl={spec.href ?? undefined}
          restoreAnimation={item.restoreAnimation}
          width={spec.window_width} height={spec.window_height}
          x={spec.window_x} y={spec.window_y}
          onAuthorResize={geometry(item.id)} onAuthorMove={moveGeometry(item.id)}
          onClose={() => close(item.id)}>
          {folder ? <Folder folder={folder} contents={folder.contents.flatMap(id => thingsById.get(id) ?? [])} openedIds={openedIds} onOpen={open} onWarm={warm} /> : <PageReader page={spec} />}
        </ObjectWindow>;
      })}
    </div></AuthoringContext.Provider>
  );
}

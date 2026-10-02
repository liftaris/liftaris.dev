import { Fragment, useContext } from 'react';
import { AuthoringContext, ThingControls } from './ThingAuthoring';
import { spawnPoint, normalizedPoint } from '../../lib/things/model';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { createSceneEngine } from "../clump/matter-engine";
import { isGift, isImageUrl, OBJECTS } from "../clump/model";
import type { ObjectSpec, Point, SceneEngine } from "../clump/model";
import { giftObjects, worldSize } from "../../lib/house/emoji";
import { getGift } from "../../lib/house/client";
import type { Gift } from "../../lib/house/types";
import { reconcileGifts, retiringGiftIds } from "./gift-presence";
import { GITHUB_THING, PORTFOLIO_FOLDER_OBJECT, WRITING_FOLDER_OBJECT } from "./folders";
import { prefetchThing } from "../../lib/house/prefetch";
import { ThingLabel } from "./ThingLabel";

type Grab = { id: string; point: Point; origin: Point; moved: boolean; pointerId?: number };
const INITIAL_SIZE = { width: 500, height: 600 };
const GIFT_ENTRY: ObjectSpec = { id: "leave-gift", name: "Leave a gift", emoji: "🎁", width: 64, height: 64 };

function measureViewport(element: HTMLDivElement) {
  // Measure the fixed outer box: scrollbars appearing as the crowd grows must
  // not resize the physics world or release an ongoing drag.
  const rect = element.getBoundingClientRect();
  const width = Math.floor(rect.width);
  const height = Math.floor(rect.height);
  if (!width || !height) return null;
  const scale = Math.min(1, width / INITIAL_SIZE.width);
  return { scale, size: { width: Math.round(width / scale), height: Math.floor(height / scale) } };
}

const EMPTY_IDS: ReadonlySet<string> = new Set();

export function HouseClump({
  gifts,
  inspectedIds,
  desktopObjects,
  isAdmin = false,
  sentGiftIds = EMPTY_IDS,
  onOpen,
  onTrash,
  testDragId,
}: {
  gifts: readonly Gift[];
  inspectedIds: readonly string[];
  thingsConfig?: Record<string, { default_open?: boolean }>;
  desktopObjects?: readonly ObjectSpec[];
  isAdmin?: boolean;
  sentGiftIds?: ReadonlySet<string>;
  onOpen: (object: ObjectSpec, source: HTMLButtonElement, gift?: Gift) => void;
  onTrash?: (id: string) => void | Promise<void>;
  testDragId?: string | null;
}) {
  const authoring = useContext(AuthoringContext);
  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const engine = useRef<SceneEngine | null>(null);
  const grabbed = useRef<Grab | null>(null);
  const start = useRef<() => void>(() => {});
  const paint = useRef<() => void>(() => {});
  const clickSuppressed = useRef<{ id: string; until: number } | null>(null);
  const [displayed, setDisplayed] = useState<Gift[]>(() => [...gifts]);
  const [grabId, setGrabId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [trashStatus, setTrashStatus] = useState<"idle" | "over" | "trashed" | "rejected">("idle");
  const [knownRemovable, setKnownRemovable] = useState<Set<string>>(() => new Set());
  const [pendingTrashIds, setPendingTrashIds] = useState<Set<string>>(() => new Set());
  const [scale, setScale] = useState(1);
  const [size, setSize] = useState(INITIAL_SIZE);
  const bounds = useRef(INITIAL_SIZE);
  const available = useRef(INITIAL_SIZE);
  const growth = useRef({ width: 0, height: 0 });
  const baseObjects = useMemo(() => desktopObjects ?? [...OBJECTS, GITHUB_THING, PORTFOLIO_FOLDER_OBJECT, WRITING_FOLDER_OBJECT, GIFT_ENTRY], [desktopObjects]);
  const objects = useMemo(() => [...baseObjects, ...giftObjects(displayed)], [baseObjects, displayed]);
  const retiring = retiringGiftIds(displayed, gifts, [...inspectedIds, grabId]);
  const liveIds = new Set(gifts.map((gift) => gift.id));

  const isEligibleForTrash = useCallback((id: string) => {
    const isGift = displayed.some((g) => g.id === id);
    if (!isGift) return false;
    return isAdmin || sentGiftIds.has(id) || knownRemovable.has(id);
  }, [displayed, isAdmin, sentGiftIds, knownRemovable]);

  const activeDragId = testDragId !== undefined ? testDragId : draggedId;
  const isDraggingDeletable = activeDragId !== null && isEligibleForTrash(activeDragId);
  const canShowTrash = isDraggingDeletable || trashStatus !== "idle" || pendingTrashIds.size > 0;

  useLayoutEffect(() => {
    setDisplayed((current) => reconcileGifts(current, gifts));
  }, [gifts]);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measured = measureViewport(element);
    if (measured) {
      available.current = measured.size;
      bounds.current = { width: measured.size.width + growth.current.width, height: measured.size.height + growth.current.height };
      setSize(bounds.current);
      setScale(measured.scale);
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const scene = createSceneEngine({ scene: authoring.session ? "apartment" : "clump", collision: "outline", size: bounds.current, reducedMotion: reduced.matches });
    engine.current = scene;
    let frame = 0;
    let previous = 0;
    let remainder = 0;
    let disposed = false;
    const draw = () => {
      for (const pose of scene.getPoses()) {
        const element = nodes.current.get(pose.id);
        if (!element) continue;
        // React owns membership and content, never the simulation's transform.
        const transform = pose.angle !== 0
          ? `translate(${pose.x}px, ${pose.y}px) translate(-50%, -50%) rotate(${pose.angle}rad)`
          : `translate(${pose.x}px, ${pose.y}px) translate(-50%, -50%)`;
        element.style.transform = transform;
        element.style.visibility = "visible";
        element.dataset.x = String(pose.x);
        element.dataset.y = String(pose.y);
        element.dataset.angle = String(pose.angle);
      }
    };
    const tick = (now: number) => {
      frame = 0;
      if (disposed) return;
      remainder += previous ? Math.min(now - previous, 50) : 1000 / 60;
      previous = now;
      let active = true;
      while (remainder >= 1000 / 60) {
        active = scene.step(1000 / 60);
        remainder -= 1000 / 60;
      }
      draw();
      if (active) frame = requestAnimationFrame(tick);
      else previous = 0;
    };
    const run = () => {
      if (!frame && !disposed && !document.hidden) {
        previous = 0;
        remainder = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    start.current = run;
    paint.current = draw;
    draw();
    run();
    const observer = new ResizeObserver(() => {
      const next = measureViewport(element);
      if (!next) return;
      setScale(next.scale);
      if (next.size.width === available.current.width && next.size.height === available.current.height) return;
      available.current = next.size;
      const nextBounds = { width: next.size.width + growth.current.width, height: next.size.height + growth.current.height };
      // A viewport resize remaps the existing arrangement, never reseeds it.
      // Matter releases its handle on resize; release the matching UI grab too.
      const grab = grabbed.current;
      if (grab) {
        grabbed.current = null;
        setGrabId(null);
        setDraggedId(null);
        setIsOverTrash(false);
        if (grab.moved) clickSuppressed.current = { id: grab.id, until: performance.now() + 400 };
        const source = nodes.current.get(grab.id);
        if (grab.pointerId !== undefined && source?.hasPointerCapture(grab.pointerId)) source.releasePointerCapture(grab.pointerId);
      }
      scene.resize(nextBounds);
      bounds.current = nextBounds;
      setSize(nextBounds);
      draw();
      run();
    });
    observer.observe(element);
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        if (grabbed.current) {
          scene.endDrag(true);
          grabbed.current = null;
          setGrabId(null);
          setDraggedId(null);
          setIsOverTrash(false);
        }
      } else run();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      scene.dispose();
      engine.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const scene = engine.current;
    if (!scene) return;
    // Apply the existing crowd expansion beyond the measured visible area.
    // Its high-water mark survives deletion; growth never interrupts a grab.
    const requested = worldSize(displayed.length);
    growth.current = {
      width: Math.max(growth.current.width, requested.width - INITIAL_SIZE.width),
      height: Math.max(growth.current.height, requested.height - INITIAL_SIZE.height),
    };
    const next = { width: available.current.width + growth.current.width, height: available.current.height + growth.current.height };
    if (next.width !== bounds.current.width || next.height !== bounds.current.height) {
      scene.resize(next, true);
      bounds.current = next;
      setSize(next);
    }
    const poses = authoring.session ? objects.map(o=>({id:o.id,angle:0,...spawnPoint({width:o.width,height:o.height,spawn_x:o.spawn_x??.5,spawn_y:o.spawn_y??.5},available.current)})) : [];
    scene.syncObjects(objects, poses);
    paint.current();
    start.current();
  }, [objects, displayed.length, authoring.session]);

  const position = (event: ReactPointerEvent): Point => {
    const rect = world.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
  };

  const handleDropOnTrash = async (id: string) => {
    const isGift = displayed.some((g) => g.id === id);
    if (!isGift) {
      engine.current?.unfreeze(id, true);
      paint.current();
      return;
    }

    setPendingTrashIds((curr) => new Set(curr).add(id));

    const revert = () => {
      setPendingTrashIds((curr) => {
        const next = new Set(curr);
        next.delete(id);
        return next;
      });
      engine.current?.unfreeze(id, true);
      paint.current();
      start.current();
    };

    if (isAdmin || sentGiftIds.has(id) || knownRemovable.has(id)) {
      setTrashStatus("trashed");
      setTimeout(() => setTrashStatus("idle"), 400);
      try {
        await onTrash?.(id);
      } catch {
        setTrashStatus("rejected");
        setTimeout(() => setTrashStatus("idle"), 350);
        revert();
      }
      return;
    }

    try {
      const detail = await getGift(id);
      if (detail.canReclaim || detail.canRemove) {
        setKnownRemovable((curr) => new Set(curr).add(id));
        setTrashStatus("trashed");
        setTimeout(() => setTrashStatus("idle"), 400);
        try {
          await onTrash?.(id);
        } catch {
          setTrashStatus("rejected");
          setTimeout(() => setTrashStatus("idle"), 350);
          revert();
        }
      } else {
        setTrashStatus("rejected");
        setTimeout(() => setTrashStatus("idle"), 350);
        revert();
      }
    } catch {
      setTrashStatus("rejected");
      setTimeout(() => setTrashStatus("idle"), 350);
      revert();
    }
  };

  const finish = (cancel = false, droppedOnTrash = false) => {
    const grab = grabbed.current;
    if (!grab) return;
    grabbed.current = null;
    setGrabId(null);
    setDraggedId(null);
    setIsOverTrash(false);
    if (grab.pointerId !== undefined) {
      const element = nodes.current.get(grab.id);
      if (element?.hasPointerCapture(grab.pointerId)) element.releasePointerCapture(grab.pointerId);
    }
    if (grab.moved) clickSuppressed.current = { id: grab.id, until: performance.now() + 400 };

    if (!cancel && droppedOnTrash && grab.moved) {
      let targetPoint: Point | undefined;
      if (trashRef.current && world.current) {
        const trashRect = trashRef.current.getBoundingClientRect();
        const worldRect = world.current.getBoundingClientRect();
        targetPoint = {
          x: (trashRect.left + trashRect.width / 2 - worldRect.left) / scale,
          y: (trashRect.top + trashRect.height / 2 - worldRect.top) / scale,
        };
      }
      engine.current?.freeze(grab.id, targetPoint);
      paint.current();
      void handleDropOnTrash(grab.id);
    } else {
      engine.current?.endDrag(cancel);
    }

    if (!cancel && grab.moved && authoring.session) {
      const pose = engine.current?.getPoses().find(p=>p.id===grab.id);
      const object = objects.find(o=>o.id===grab.id);
      if(pose&&object) authoring.send({type:'position',id:grab.id,...normalizedPoint(pose,object,available.current)});
    }
    start.current();
  };

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if(authoring.session && authoring.selected!==id) { authoring.send({type:'select',id}); return; }
    if (event.button !== 0 || grabbed.current || retiring.has(id) || pendingTrashIds.has(id)) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = position(event);
    grabbed.current = { id, point, origin: point, pointerId: event.pointerId, moved: false };
    setGrabId(id);

    const isGift = displayed.some((g) => g.id === id);
    if (isGift && !isAdmin && !sentGiftIds.has(id) && !knownRemovable.has(id)) {
      void getGift(id).then((detail) => {
        if (detail.canReclaim || detail.canRemove) {
          setKnownRemovable((curr) => new Set(curr).add(id));
        }
      }).catch(() => {});
    }
  };

  const pointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const grab = grabbed.current;
    if (!grab || grab.pointerId !== event.pointerId) return;
    const point = position(event);
    if (!grab.moved) {
      if (Math.hypot(point.x - grab.origin.x, point.y - grab.origin.y) * scale < 5) return;
      if (!engine.current?.beginDrag(grab.id, grab.origin)) return;
      grab.moved = true;
      setDraggedId(grab.id);
    }
    grab.point = point;
    engine.current?.moveDrag(point);

    const eligible = isEligibleForTrash(grab.id);
    if (trashRef.current && eligible) {
      const rect = trashRef.current.getBoundingClientRect();
      const pad = 12;
      const over = event.clientX >= rect.left - pad &&
                   event.clientX <= rect.right + pad &&
                   event.clientY >= rect.top - pad &&
                   event.clientY <= rect.bottom + pad;
      setIsOverTrash(over);
    } else {
      setIsOverTrash(false);
    }

    start.current();
  };

  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const key = event.key.toLowerCase();
    if (key === "escape" && grabbed.current) { event.preventDefault(); finish(true); return; }
    if (["enter", " "].includes(key) && grabbed.current?.id === id) {
      event.preventDefault();
      let droppedOnTrash = false;
      const eligible = isEligibleForTrash(id);
      if (trashRef.current && grabbed.current?.moved && eligible) {
        const objEl = nodes.current.get(id);
        if (objEl) {
          const r1 = objEl.getBoundingClientRect();
          const r2 = trashRef.current.getBoundingClientRect();
          droppedOnTrash = !(r1.right < r2.left || r1.left > r2.right || r1.bottom < r2.top || r1.top > r2.bottom);
        }
      }
      finish(false, droppedOnTrash);
      return;
    }
    if (retiring.has(id) || pendingTrashIds.has(id) || !["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) return;
    event.preventDefault();
    if (authoring.session && authoring.selected !== id) {authoring.send({type:'select',id});return;}
    if (grabbed.current?.pointerId !== undefined) return;
    const scene = engine.current;
    if (!scene) return;
    if (!grabbed.current) {
      const pose = scene.getPoses().find((item) => item.id === id);
      if (!pose || !scene.beginDrag(id, pose)) return;
      grabbed.current = { id, point: { x: pose.x, y: pose.y }, origin: pose, moved: true };
      setGrabId(id);
      setDraggedId(id);
    }
    const grab = grabbed.current;
    const distance = event.shiftKey ? 20 : 7;
    if (key.startsWith("arrow")) {
      grab.point.x = Math.max(40, Math.min(size.width - 40, grab.point.x + (key === "arrowleft" ? -distance : key === "arrowright" ? distance : 0)));
      grab.point.y = Math.max(40, Math.min(size.height - 40, grab.point.y + (key === "arrowup" ? -distance : key === "arrowdown" ? distance : 0)));
      scene.moveDrag(grab.point);

      const eligible = isEligibleForTrash(id);
      if (trashRef.current && eligible) {
        const objEl = nodes.current.get(id);
        if (objEl) {
          const r1 = objEl.getBoundingClientRect();
          const r2 = trashRef.current.getBoundingClientRect();
          const overlaps = !(r1.right < r2.left || r1.left > r2.right || r1.bottom < r2.top || r1.top > r2.bottom);
          setIsOverTrash(overlaps);
        }
      } else {
        setIsOverTrash(false);
      }
    }
    start.current();
  };

  return <div className="house-clump-area relative flex-1 w-full min-w-0 min-h-0 flex flex-col">
    <svg width="0" height="0" className="sr-only absolute w-0 h-0 overflow-hidden pointer-events-none" aria-hidden="true" focusable="false">
      <defs>
        <filter id="thing-outline" x="-40%" y="-40%" width="180%" height="180%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="dilated" />
          <feFlood floodColor="#ffffff" result="white" />
          <feComposite in="white" in2="dilated" operator="in" result="outline" />
          <feMerge>
            <feMergeNode in="outline" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
    <div ref={viewport} className="house-viewport relative flex-1 w-full min-w-0 min-h-0 overflow-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--color-paper)_35%,transparent)_transparent]" role="group" aria-label="Kaio’s things and visitor gifts" aria-describedby="house-movement-help">
      <div className="house-world-space relative mx-auto overflow-clip" style={{ width: size.width * scale, height: size.height * scale }}>
        <div ref={world} className="house-world relative origin-top-left" style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}>
          {objects.map((object) => {
            const gift = displayed.find((item) => item.id === object.id);
            const isGiftItem = Boolean(gift) || isGift(object);
            const removing = retiring.has(object.id);
            const isPendingTrash = pendingTrashIds.has(object.id);
            const disabled = removing || isPendingTrash;
            const opened = inspectedIds.includes(object.id);
            const iconImage = ("image" in object && (object as { image?: string | null }).image)
              || (isImageUrl(object.emoji) ? object.emoji : null);

            return (
              <Fragment key={object.id}>
              {!isGiftItem && <ThingControls id={object.id} name={object.name} floating />}
              <button
                type="button"
                className="house-object group absolute top-0 left-0 flex flex-col items-center m-0 p-0 border-0 bg-transparent cursor-grab touch-none select-none [-webkit-tap-highlight-color:transparent] leading-none no-underline hover:no-underline focus:no-underline focus-visible:no-underline overflow-visible invisible data-[has-bg=true]:overflow-hidden data-[grabbed=true]:z-[3] data-[grabbed=true]:cursor-grabbing data-[window-open=true]:opacity-0 data-[window-open=true]:pointer-events-none data-[trashing=true]:pointer-events-none outline-none hover:outline-none focus:outline-none focus-visible:outline-none data-[gift=true]:[animation:house-arrive_220ms_ease-out] motion-reduce:data-[gift=true]:[animation-duration:1ms] data-[removing=true]:pointer-events-none data-[removing=true]:[animation:house-depart_260ms_ease-in_forwards]"
                data-object={object.id}
                data-gift={isGiftItem ? "true" : undefined}
                data-grabbed={grabId === object.id}
                data-removing={removing}
                data-trashing={isPendingTrash ? "true" : undefined}
                data-window-open={opened}
                ref={(element) => { if (element) nodes.current.set(object.id, element); else nodes.current.delete(object.id); }}
                style={{
                  width: Math.max(44, object.width),
                  height: Math.max(44, object.height),
                  fontSize: Math.max(object.width, object.height) * 0.87,
                  outline:authoring.session && authoring.selected===object.id?'2px dashed #516aff':undefined,
                  outlineOffset:6,
                }}
                aria-disabled={disabled || undefined}
                tabIndex={disabled || opened ? -1 : 0}
                aria-expanded={opened}
                aria-haspopup="dialog"
                aria-label={gift ? `${object.name}, gift${gift.authorName === null ? "" : ` from ${gift.authorName}`}. Open gift or use arrow keys to move.` : `${object.name}. Open window or use arrow keys to move.`}
                aria-describedby="house-movement-help"
                onAnimationEnd={(event) => {
                  if (event.target !== event.currentTarget || event.animationName !== "house-depart" || !removing) return;
                  if (document.activeElement === event.currentTarget) document.querySelector<HTMLButtonElement>('[data-object="leave-gift"]')?.focus({ preventScroll: true });
                  setPendingTrashIds((current) => {
                    if (!current.has(object.id)) return current;
                    const next = new Set(current);
                    next.delete(object.id);
                    return next;
                  });
                  setDisplayed((current) => current.filter((item) => item.id !== object.id));
                }}
                onPointerDown={(event) => pointerDown(event, object.id)}
                onPointerMove={pointerMove}
                onPointerUp={(event) => {
                  if (grabbed.current?.pointerId === event.pointerId) {
                    let droppedOnTrash = false;
                    const eligible = isEligibleForTrash(grabbed.current.id);
                    if (trashRef.current && grabbed.current?.moved && eligible) {
                      const rect = trashRef.current.getBoundingClientRect();
                      const pad = 12;
                      droppedOnTrash = event.clientX >= rect.left - pad &&
                                       event.clientX <= rect.right + pad &&
                                       event.clientY >= rect.top - pad &&
                                       event.clientY <= rect.bottom + pad;
                    }
                    finish(false, droppedOnTrash);
                  }
                }}
                onPointerCancel={(event) => { if (grabbed.current?.pointerId === event.pointerId) finish(true); }}
                onLostPointerCapture={(event) => { if (grabbed.current?.pointerId === event.pointerId) finish(true); }}
                onKeyDown={(event) => keyboard(event, object.id)}
                onBlur={() => { if (grabbed.current?.id === object.id && grabbed.current.pointerId === undefined) finish(); }}
                onPointerEnter={() => prefetchThing(object)}
                onFocus={() => prefetchThing(object)}
                onClick={(event) => {
                  const suppressed = clickSuppressed.current;
                  if (!opened && !disabled && (!gift || liveIds.has(gift.id)) && !(suppressed?.id === object.id && performance.now() < suppressed.until)) onOpen(object, event.currentTarget, gift);
                }}
              >
                <span
                  className="house-object-art flex items-center justify-center size-full rounded-xl pointer-events-none group-data-[shape=circle]:rounded-full group-data-[has-bg=true]:overflow-hidden [transform:translateZ(0)] opacity-[0.99] [filter:contrast(100.01%)] font-['Apple_Color_Emoji','Segoe_UI_Emoji','Noto_Color_Emoji',sans-serif] has-[.house-object-image]:filter-none has-[.house-object-image]:opacity-100 group-data-[grabbed=true]:opacity-100 group-data-[gift=true]:opacity-100"
                  aria-hidden="true"
                >
                  {iconImage ? (
                    <img
                      src={iconImage}
                      alt=""
                      className="house-object-image block size-full max-w-full max-h-full object-contain pointer-events-none select-none"
                      width={Math.round(object.width)}
                      height={Math.round(object.height)}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    object.emoji
                  )}
                </span>
                {!isGiftItem && (
                  <ThingLabel
                    name={object.name}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-[1px] w-max max-w-[100px] pointer-events-none text-paper [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]"
                  />
                )}
              </button></Fragment>
            );
          })}
        </div>
      </div>
      <p id="house-movement-help" className="house-sr-only sr-only">Drag to move things in your own arrangement. With a keyboard, arrows move, Enter places, and Escape cancels. Press Enter on a thing to open its window. When the collection grows, scroll this area to explore more gifts. Senders and admins can drag gifts to the trash icon at the bottom right to remove them.</p>
    </div>
    <div
      ref={trashRef}
      className="house-trash group absolute bottom-5 right-5 max-[480px]:bottom-3 max-[480px]:right-3 w-[52px] h-[52px] max-[480px]:w-[46px] max-[480px]:h-[46px] grid place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-paper)_8%,transparent)] border-[1.5px] border-[color-mix(in_srgb,var(--color-paper)_18%,transparent)] text-[1.6rem] max-[480px]:text-[1.35rem] leading-none select-none z-[4] pointer-events-none opacity-0 scale-70 transition-[transform,background-color,border-color,box-shadow,opacity] duration-180 [transition-timing-function:cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none motion-reduce:[animation:none!important] data-[visible=true]:opacity-85 data-[visible=true]:pointer-events-auto data-[visible=true]:scale-100 data-[visible=true]:hover:opacity-100 data-[visible=true]:hover:bg-[color-mix(in_srgb,var(--color-paper)_14%,transparent)] data-[visible=true]:hover:border-[color-mix(in_srgb,var(--color-paper)_32%,transparent)] data-[over=true]:opacity-100 data-[over=true]:scale-125 data-[over=true]:bg-[rgb(255_80_80/0.28)] data-[over=true]:border-[rgb(255_100_100/0.7)] data-[over=true]:shadow-[0_0_20px_rgb(255_80_80/0.4)] data-[status=trashed]:[animation:house-trash-gobble_350ms_cubic-bezier(0.2,0,0,1)] data-[status=rejected]:[animation:house-trash-shake_350ms_ease-in-out] forced-colors:border-[CanvasText]"
      data-visible={canShowTrash ? "true" : undefined}
      data-over={isOverTrash ? "true" : undefined}
      data-status={trashStatus}
      role="region"
      aria-label="Trash"
      aria-hidden={!canShowTrash ? "true" : undefined}
      title="Drag gifts here to remove them"
    >
      <span className="house-trash-icon flex items-center justify-center pointer-events-none font-['Apple_Color_Emoji','Segoe_UI_Emoji','Noto_Color_Emoji',sans-serif] transition-transform duration-180 [transition-timing-function:cubic-bezier(0.2,0,0,1)] group-data-[over=true]:scale-115 group-data-[over=true]:-rotate-10 motion-reduce:transition-none motion-reduce:[animation:none!important]" aria-hidden="true">🗑️</span>
    </div>
  </div>;
}

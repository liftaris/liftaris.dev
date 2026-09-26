import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { createSceneEngine } from "../clump/matter-engine";
import { OBJECTS } from "../clump/model";
import type { ObjectSpec, Point, SceneEngine } from "../clump/model";
import { giftObjects, worldSize } from "../../lib/house/emoji";
import type { Gift } from "../../lib/house/types";
import { reconcileGifts, retiringGiftIds } from "./gift-presence";
import { PORTFOLIO_FOLDER_OBJECT, WRITING_FOLDER_OBJECT } from "./folders";

type Grab = { id: string; point: Point; origin: Point; moved: boolean; pointerId?: number };
const INITIAL_SIZE = { width: 500, height: 600 };
const GIFT_ENTRY: ObjectSpec = { id: "leave-gift", name: "Leave a gift", emoji: "🎁", width: 64, height: 64, shape: "rectangle" };

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

const EMPTY_VISITED: ReadonlySet<string> = new Set();
const EMPTY_THINGS_CONFIG: Record<string, { tint_when_visited?: boolean }> = {};

export function HouseClump({ gifts, inspectedIds, visitedIds = EMPTY_VISITED, thingsConfig = EMPTY_THINGS_CONFIG, desktopObjects, onOpen }: {
  gifts: readonly Gift[];
  inspectedIds: readonly string[];
  visitedIds?: ReadonlySet<string>;
  thingsConfig?: Record<string, { tint_when_visited?: boolean }>;
  desktopObjects?: readonly ObjectSpec[];
  onOpen: (object: ObjectSpec, source: HTMLButtonElement, gift?: Gift) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const engine = useRef<SceneEngine | null>(null);
  const grabbed = useRef<Grab | null>(null);
  const start = useRef<() => void>(() => {});
  const paint = useRef<() => void>(() => {});
  const clickSuppressed = useRef<{ id: string; until: number } | null>(null);
  const [displayed, setDisplayed] = useState<Gift[]>(() => [...gifts]);
  const [grabId, setGrabId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [size, setSize] = useState(INITIAL_SIZE);
  const bounds = useRef(INITIAL_SIZE);
  const available = useRef(INITIAL_SIZE);
  const growth = useRef({ width: 0, height: 0 });
  const baseObjects = useMemo(() => desktopObjects ?? [...OBJECTS, PORTFOLIO_FOLDER_OBJECT, WRITING_FOLDER_OBJECT, GIFT_ENTRY], [desktopObjects]);
  const objects = useMemo(() => [...baseObjects, ...giftObjects(displayed)], [baseObjects, displayed]);
  const retiring = retiringGiftIds(displayed, gifts, [...inspectedIds, grabId]);
  const liveIds = new Set(gifts.map((gift) => gift.id));

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
    const scene = createSceneEngine({ scene: "clump", collision: "outline", size: bounds.current, reducedMotion: reduced.matches });
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
        element.style.transform = `translate(${pose.x}px, ${pose.y}px) translate(-50%, -50%) rotate(${pose.angle}rad)`;
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
    scene.syncObjects(objects);
    paint.current();
    start.current();
  }, [objects, displayed.length]);

  const position = (event: ReactPointerEvent): Point => {
    const rect = world.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
  };

  const finish = (cancel = false) => {
    const grab = grabbed.current;
    if (!grab) return;
    grabbed.current = null;
    setGrabId(null);
    engine.current?.endDrag(cancel);
    if (grab.pointerId !== undefined) {
      const element = nodes.current.get(grab.id);
      if (element?.hasPointerCapture(grab.pointerId)) element.releasePointerCapture(grab.pointerId);
    }
    if (grab.moved) clickSuppressed.current = { id: grab.id, until: performance.now() + 400 };
    start.current();
  };

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0 || grabbed.current || retiring.has(id)) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = position(event);
    grabbed.current = { id, point, origin: point, pointerId: event.pointerId, moved: false };
    setGrabId(id);
  };

  const pointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const grab = grabbed.current;
    if (!grab || grab.pointerId !== event.pointerId) return;
    const point = position(event);
    if (!grab.moved) {
      if (Math.hypot(point.x - grab.origin.x, point.y - grab.origin.y) * scale < 5) return;
      if (!engine.current?.beginDrag(grab.id, grab.origin)) return;
      grab.moved = true;
    }
    grab.point = point;
    engine.current?.moveDrag(point);
    start.current();
  };

  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const key = event.key.toLowerCase();
    if (key === "escape" && grabbed.current) { event.preventDefault(); finish(true); return; }
    if (["enter", " "].includes(key) && grabbed.current?.id === id) { event.preventDefault(); finish(); return; }
    if (retiring.has(id) || !["arrowleft", "arrowright", "arrowup", "arrowdown", "q", "e"].includes(key)) return;
    event.preventDefault();
    if (grabbed.current?.pointerId !== undefined) return;
    const scene = engine.current;
    if (!scene) return;
    if (!grabbed.current) {
      const pose = scene.getPoses().find((item) => item.id === id);
      if (!pose || !scene.beginDrag(id, pose)) return;
      grabbed.current = { id, point: { x: pose.x, y: pose.y }, origin: pose, moved: true };
      setGrabId(id);
    }
    const grab = grabbed.current;
    const distance = event.shiftKey ? 20 : 7;
    if (key.startsWith("arrow")) {
      grab.point.x = Math.max(40, Math.min(size.width - 40, grab.point.x + (key === "arrowleft" ? -distance : key === "arrowright" ? distance : 0)));
      grab.point.y = Math.max(40, Math.min(size.height - 40, grab.point.y + (key === "arrowup" ? -distance : key === "arrowdown" ? distance : 0)));
      scene.moveDrag(grab.point);
    } else scene.nudge(id, 0, 0, (key === "q" ? -1 : 1) * Math.PI / 12);
    start.current();
  };

  return <div ref={viewport} className="house-viewport" role="group" aria-label="Kaio’s things and visitor gifts" aria-describedby="house-movement-help">
    <div className="house-world-space" style={{ width: size.width * scale, height: size.height * scale }}>
      <div ref={world} className="house-world" style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}>
        {objects.map((object) => {
          const gift = displayed.find((item) => item.id === object.id);
          const removing = retiring.has(object.id);
          const opened = inspectedIds.includes(object.id);
          const isFolder = ("kind" in object && (object as { kind?: string }).kind === "folder") || object.id === PORTFOLIO_FOLDER_OBJECT.id || object.id === WRITING_FOLDER_OBJECT.id || object.id === "lab-folder" || object.id.endsWith("-folder");
          const shouldTint = thingsConfig[object.id]?.tint_when_visited ?? (isFolder ? false : true);
          const visited = !isFolder && shouldTint && visitedIds.has(object.id);
          return <button type="button" key={object.id} className="house-object" data-object={object.id} data-gift={Boolean(gift)} data-visited={visited} data-grabbed={grabId === object.id} data-removing={removing} data-window-open={opened}
            ref={(element) => { if (element) nodes.current.set(object.id, element); else nodes.current.delete(object.id); }}
            style={{ width: Math.max(44, object.width), height: Math.max(44, object.height), fontSize: Math.max(object.width, object.height) * .87 }}
            aria-disabled={removing || undefined} tabIndex={removing || opened ? -1 : 0} aria-expanded={opened} aria-haspopup="dialog"
            aria-label={gift ? `${object.name}, gift${gift.authorName === null ? "" : ` from ${gift.authorName}`}. Open gift or use arrow keys to move.` : `${object.name}. Open window or use arrow keys to move.`} aria-describedby="house-movement-help"
            onAnimationEnd={(event) => {
              if (event.target !== event.currentTarget || event.animationName !== "house-depart" || !removing) return;
              if (document.activeElement === event.currentTarget) document.querySelector<HTMLButtonElement>('[data-object="leave-gift"]')?.focus({ preventScroll: true });
              setDisplayed((current) => current.filter((item) => item.id !== object.id));
            }}
            onPointerDown={(event) => pointerDown(event, object.id)} onPointerMove={pointerMove}
            onPointerUp={(event) => { if (grabbed.current?.pointerId === event.pointerId) finish(); }}
            onPointerCancel={(event) => { if (grabbed.current?.pointerId === event.pointerId) finish(true); }}
            onLostPointerCapture={(event) => { if (grabbed.current?.pointerId === event.pointerId) finish(true); }}
            onKeyDown={(event) => keyboard(event, object.id)}
            onBlur={() => { if (grabbed.current?.id === object.id && grabbed.current.pointerId === undefined) finish(); }}
            onClick={(event) => {
              const suppressed = clickSuppressed.current;
              if (!opened && !removing && (!gift || liveIds.has(gift.id)) && !(suppressed?.id === object.id && performance.now() < suppressed.until)) onOpen(object, event.currentTarget, gift);
            }}
          ><span className="house-object-art" aria-hidden="true">{object.emoji}</span></button>;
        })}
      </div>
    </div>
    <p id="house-movement-help" className="house-sr-only">Drag to move things in your own arrangement. With a keyboard, arrows move, Q and E turn, Enter places, and Escape cancels. Press Enter on a thing to open its window. When the collection grows, scroll this area to explore more gifts.</p>
  </div>;
}

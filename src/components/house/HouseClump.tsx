import type { ThingSpec } from "../../lib/things/scene";
import { Fragment, useContext } from 'react';
import { AuthoringContext, ThingControls } from './ThingAuthoring';
import { spawnPoint, normalizedPoint } from '../../lib/things/model';
import { useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { createSceneEngine } from "../clump/matter-engine";
import type { Point, Rect, SceneEngine } from "../clump/model";
import { ThingArtwork } from "./ThingArtwork";
import { ThingLabel } from "./ThingLabel";

type Grab = { id: string; point: Point; origin: Point; moved: boolean; pointerId?: number };
type Marquee =
  | { kind: "select"; pointerId: number; origin: Point; rect: Rect | null }
  | { kind: "haul"; pointerId: number };
const INITIAL_SIZE = { width: 500, height: 600 };
const ROPE_WIDTH = 8;
/** Screen pixels from the rope's center line that still grab it. */
const ROPE_REACH = ROPE_WIDTH / 2 + 10;
const DOUBLE_CLICK_MS = 400;

/** Leaves the drawn rope behind as a ghost that fades out. */
function letGo(path: SVGPathElement | null) {
  if (!path?.hasAttribute("d")) return;
  const ghost = path.cloneNode() as SVGPathElement;
  path.removeAttribute("d");
  path.parentNode?.insertBefore(ghost, path);
  const remove = () => ghost.remove();
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-out" }).finished.then(remove, remove);
}

function measureViewport(element: HTMLDivElement) {
  // Measure the outer box in CSS pixels, then account for artwork scaling.
  const rect = element.getBoundingClientRect();
  const width = Math.floor(rect.width);
  const height = Math.floor(rect.height);
  if (!width || !height) return null;
  const scale = Math.min(1, width / INITIAL_SIZE.width);
  return { scale, size: { width: Math.round(width / scale), height: Math.floor(height / scale) } };
}

export function HouseClump({
  inspectedIds,
  desktopObjects,
  onOpen,
  onWarm,
}: {
  inspectedIds: readonly string[];
  desktopObjects: readonly ThingSpec[];
  onOpen: (object: ThingSpec, source: HTMLButtonElement) => void;
  onWarm: (object: ThingSpec, source: HTMLButtonElement) => void;
}) {
  const authoring = useContext(AuthoringContext);
  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const engine = useRef<SceneEngine | null>(null);
  const grabbed = useRef<Grab | null>(null);
  const marquee = useRef<Marquee | null>(null);
  const lastClick = useRef<{ time: number; point: Point } | null>(null);
  const marqueeBox = useRef<SVGRectElement>(null);
  const rope = useRef<SVGPathElement>(null);
  const start = useRef<() => void>(() => {});
  const paint = useRef<() => void>(() => {});
  const clickSuppressed = useRef<{ id: string; until: number } | null>(null);
  const [grabId, setGrabId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [size, setSize] = useState(INITIAL_SIZE);
  const bounds = useRef(INITIAL_SIZE);
  const available = useRef(INITIAL_SIZE);
  const objects = desktopObjects;
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measured = measureViewport(element);
    if (measured) {
      available.current = measured.size;
      bounds.current = measured.size;
      setSize(bounds.current);
      setScale(measured.scale);
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const scene = createSceneEngine({ layoutEditing: Boolean(authoring.session), objects: [], size: bounds.current, reducedMotion: reduced.matches });
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
      const outline = scene.getLasso();
      if (outline) rope.current?.setAttribute("d", `M${outline.map(({ x, y }) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`);
      else letGo(rope.current);
    };
    const hidden = () => document.hidden || Boolean(element.closest('[data-persisted-desktop]') && !document.documentElement.classList.contains('on-home'));
    const tick = (now: number) => {
      frame = 0;
      if (disposed || hidden()) return;
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
      if (!frame && !disposed && !hidden()) {
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
      const nextBounds = next.size;
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
      if (hidden()) {
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
    document.addEventListener("astro:after-swap", visibility);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("astro:after-swap", visibility);
      scene.dispose();
      engine.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const scene = engine.current;
    if (!scene) return;
    const poses = authoring.session ? objects.map(o=>({id:o.id,angle:0,...spawnPoint({width:o.width,height:o.height,spawn_x:o.spawn_x??.5,spawn_y:o.spawn_y??.5},available.current)})) : [];
    scene.syncObjects(objects, poses);
    paint.current();
    start.current();
  }, [objects, authoring.session]);

  const position = (event: ReactPointerEvent): Point => {
    const rect = world.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
  };

  const finish = (cancel = false) => {
    const grab = grabbed.current;
    if (!grab) return;
    grabbed.current = null;
    setGrabId(null);
    if (grab.pointerId !== undefined) {
      const element = nodes.current.get(grab.id);
      if (element?.hasPointerCapture(grab.pointerId)) element.releasePointerCapture(grab.pointerId);
    }
    if (grab.moved) clickSuppressed.current = { id: grab.id, until: performance.now() + 400 };

    engine.current?.endDrag(cancel);

    if (!cancel && grab.moved && authoring.session) {
      const pose = engine.current?.getPoses().find(p=>p.id===grab.id);
      const object = objects.find(o=>o.id===grab.id);
      if(pose&&object) authoring.send({type:'position',id:grab.id,...normalizedPoint(pose,object,available.current)});
    }
    start.current();
  };

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if(authoring.session && authoring.selected!==id) { authoring.send({type:'select',id}); return; }
    if (event.button !== 0 || grabbed.current) return;
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
    if (["enter", " "].includes(key) && grabbed.current?.id === id) {
      event.preventDefault();
      finish();
      return;
    }
    if (!["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) return;
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
    }
    const grab = grabbed.current;
    const distance = event.shiftKey ? 20 : 7;
    if (key.startsWith("arrow")) {
      grab.point.x = Math.max(40, Math.min(size.width - 40, grab.point.x + (key === "arrowleft" ? -distance : key === "arrowright" ? distance : 0)));
      grab.point.y = Math.max(40, Math.min(size.height - 40, grab.point.y + (key === "arrowup" ? -distance : key === "arrowdown" ? distance : 0)));
      scene.moveDrag(grab.point);

    }
    start.current();
  };

  const marqueeDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (authoring.session || event.button !== 0 || event.pointerType === "touch" || marquee.current || grabbed.current) return;
    if ((event.target as Element).closest("button, a, input, textarea, select, label")) return;
    const scene = engine.current;
    if (!scene) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = position(event);
    if (scene.touchesLasso(point, ROPE_REACH / scale) && scene.grabLasso(point)) {
      marquee.current = { kind: "haul", pointerId: event.pointerId };
      event.currentTarget.style.cursor = "grabbing";
      start.current();
      return;
    }
    marquee.current = { kind: "select", pointerId: event.pointerId, origin: point, rect: null };
  };

  const marqueeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const selection = marquee.current;
    const box = marqueeBox.current;
    const point = position(event);
    if (!selection) {
      const onRope = !(event.target as Element).closest("button") && engine.current?.touchesLasso(point, ROPE_REACH / scale);
      event.currentTarget.style.cursor = onRope ? "grab" : "";
      return;
    }
    if (!box || selection.pointerId !== event.pointerId) return;
    if (selection.kind === "haul") {
      engine.current?.moveDrag(point);
      start.current();
      return;
    }
    const { origin } = selection;
    const x = Math.max(0, Math.min(size.width, point.x));
    const y = Math.max(0, Math.min(size.height, point.y));
    if (!selection.rect && Math.hypot(x - origin.x, y - origin.y) * scale < 5) return;
    selection.rect = { x: Math.min(origin.x, x), y: Math.min(origin.y, y), width: Math.abs(x - origin.x), height: Math.abs(y - origin.y) };
    box.setAttribute("x", String(selection.rect.x));
    box.setAttribute("y", String(selection.rect.y));
    box.setAttribute("width", String(selection.rect.width));
    box.setAttribute("height", String(selection.rect.height));
    box.setAttribute("visibility", "visible");
  };

  const marqueeEnd = (event: ReactPointerEvent<HTMLDivElement>, cancel = false) => {
    const selection = marquee.current;
    if (selection?.pointerId !== event.pointerId) return;
    marquee.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const scene = engine.current;
    if (selection.kind === "haul") {
      event.currentTarget.style.cursor = "grab";
      scene?.endDrag(cancel);
      start.current();
      return;
    }
    marqueeBox.current?.setAttribute("visibility", "hidden");
    if (!scene || cancel) return;
    letGo(rope.current);
    const { rect } = selection;
    if (rect) {
      const inside = scene.getPoses().filter(({ id, x, y }) =>
        x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
        && nodes.current.get(id)?.dataset.windowOpen !== "true");
      scene.lasso(rect, inside.map(({ id }) => id));
    } else {
      scene.releaseLasso();
      const previous = lastClick.current;
      const double = previous && event.timeStamp - previous.time < DOUBLE_CLICK_MS
        && Math.hypot(selection.origin.x - previous.point.x, selection.origin.y - previous.point.y) * scale < 10;
      lastClick.current = double ? null : { time: event.timeStamp, point: selection.origin };
      if (double) scene.scatter();
    }
    paint.current();
    start.current();
  };

  return <div className="house-clump-area relative flex-1 w-full min-w-0 min-h-0 flex flex-col">
    <div ref={viewport} className="house-viewport relative flex-1 w-full min-w-0 min-h-0 overflow-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--color-paper)_35%,transparent)_transparent]" role="group" aria-label="Kaio’s things" aria-describedby="house-movement-help">
      <div className="house-world-space relative mx-auto overflow-clip" style={{ width: size.width * scale, height: size.height * scale }}>
        <div
          ref={world}
          className="house-world relative origin-top-left"
          style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
          onPointerDown={marqueeDown}
          onPointerMove={marqueeMove}
          onPointerUp={(event) => marqueeEnd(event)}
          onPointerCancel={(event) => marqueeEnd(event, true)}
          onLostPointerCapture={(event) => marqueeEnd(event, true)}
        >
          {objects.map((object) => {
            const opened = inspectedIds.includes(object.id);
            return (
              <Fragment key={object.id}>
              <ThingControls id={object.id} name={object.name} floating />
              <button
                type="button"
                className="house-object group absolute top-0 left-0 flex flex-col items-center m-0 p-0 border-0 bg-transparent cursor-grab touch-none select-none [-webkit-tap-highlight-color:transparent] leading-none no-underline hover:no-underline focus:no-underline focus-visible:no-underline overflow-visible invisible data-[grabbed=true]:z-[3] data-[grabbed=true]:cursor-grabbing data-[window-open=true]:opacity-0 data-[window-open=true]:pointer-events-none outline-none hover:outline-none focus:outline-none focus-visible:outline-none"
                data-object={object.id}
                data-grabbed={grabId === object.id}
                data-window-open={opened}
                ref={(element) => { if (element) nodes.current.set(object.id, element); else nodes.current.delete(object.id); }}
                style={{
                  width: Math.max(44, object.width),
                  height: Math.max(44, object.height),
                  fontSize: Math.max(object.width, object.height) * 0.87,
                  outline:authoring.session && authoring.selected===object.id?'2px dashed #516aff':undefined,
                  outlineOffset:6,
                }}
                tabIndex={opened ? -1 : 0}
                aria-expanded={opened}
                aria-haspopup="dialog"
                aria-label={`${object.name}. Open window or use arrow keys to move.`}
                aria-describedby="house-movement-help"
                onPointerDown={(event) => { onWarm(object, event.currentTarget); pointerDown(event, object.id); }}
                onPointerMove={pointerMove}
                onPointerUp={(event) => { if (grabbed.current?.pointerId === event.pointerId) finish(); }}
                onPointerCancel={(event) => { if (grabbed.current?.pointerId === event.pointerId) finish(true); }}
                onLostPointerCapture={(event) => { if (grabbed.current?.pointerId === event.pointerId) finish(true); }}
                onKeyDown={(event) => keyboard(event, object.id)}
                onBlur={() => { if (grabbed.current?.id === object.id && grabbed.current.pointerId === undefined) finish(); }}
                onPointerEnter={event => onWarm(object, event.currentTarget)}
                onFocus={event => onWarm(object, event.currentTarget)}
                onClick={(event) => {
                  const suppressed = clickSuppressed.current;
                  if (!opened && !(suppressed?.id === object.id && performance.now() < suppressed.until)) onOpen(object, event.currentTarget);
                }}
              >
                <ThingArtwork thing={object} className="house-object-art rounded-xl" imageClassName="house-object-image" />
                  <ThingLabel
                    name={object.name}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-[1px] w-max max-w-[100px] pointer-events-none text-paper [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]"
                  />
              </button></Fragment>
            );
          })}
          <svg
            className="house-lasso absolute inset-0 size-full overflow-visible pointer-events-none z-[4] [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.5))]"
            fill="none"
            stroke="white"
            strokeWidth={ROPE_WIDTH / scale}
            strokeDasharray={`${18 / scale} ${12 / scale}`}
            aria-hidden="true"
          >
            <rect ref={marqueeBox} visibility="hidden" />
            <path ref={rope} strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <p id="house-movement-help" className="house-sr-only sr-only">Drag to move things in your own arrangement. With a keyboard, arrows move, Enter places, and Escape cancels. Press Enter on a thing to open its window.</p>
    </div>
  </div>;
}

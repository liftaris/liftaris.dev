import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { createSceneEngine } from "../clump/matter-engine";
import { initialPoses, OBJECTS } from "../clump/model";
import type { Point, SceneEngine } from "../clump/model";
import { ensureVisitor, HouseError, placeObject } from "../../lib/house/client";
import { giftObjects } from "../../lib/house/emoji";
import type { HouseSnapshot } from "../../lib/house/types";

type Grab = { id: string; point: Point; origin: Point; baseRevision: number; moved: boolean; pointerId?: number };
const INITIAL_SIZE = { width: 500, height: 600 };

export function HouseClump({ snapshot, onSnapshot, onOpen, onStatus }: {
  snapshot: HouseSnapshot | null;
  onSnapshot: (snapshot: HouseSnapshot) => void;
  onOpen: (id: string, origin: DOMRect) => void;
  onStatus: (message: string) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const engine = useRef<SceneEngine | null>(null);
  const currentSnapshot = useRef(snapshot);
  const grabbed = useRef<Grab | null>(null);
  const start = useRef<() => void>(() => {});
  const paint = useRef<() => void>(() => {});
  const clickSuppressed = useRef<{ id: string; until: number } | null>(null);
  const pendingPlacement = useRef(false);
  const centered = useRef(false);
  const transitions = useRef(new Map<string, Animation>());
  const paintedRevision = useRef(-1);
  const hasPainted = useRef(false);
  const [grabId, setGrabId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const objects = useMemo(() => [...OBJECTS, ...giftObjects(snapshot?.gifts ?? [])], [snapshot?.gifts]);
  const size = snapshot?.size ?? INITIAL_SIZE;
  currentSnapshot.current = snapshot;

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setScale(Math.min(1, element.clientWidth / INITIAL_SIZE.width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const scene = createSceneEngine({ scene: "clump", collision: "outline", size: INITIAL_SIZE, reducedMotion: reduced.matches });
    engine.current = scene;
    let frame = 0;
    let previous = 0;
    let remainder = 0;
    let disposed = false;
    const draw = () => {
      for (const pose of scene.getPoses()) {
        const element = nodes.current.get(pose.id);
        if (!element) continue;
        element.style.transform = `translate(${pose.x}px, ${pose.y}px) translate(-50%, -50%) rotate(${pose.angle}rad)`;
        element.dataset.x = String(pose.x);
        element.dataset.y = String(pose.y);
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
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        if (grabbed.current) {
          scene.endDrag(true);
          grabbed.current = null;
          setGrabId(null);
          if (currentSnapshot.current) applySnapshot(currentSnapshot.current);
        }
      } else run();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      scene.dispose();
      for (const animation of transitions.current.values()) animation.cancel();
      transitions.current.clear();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    if (!snapshot || grabbed.current) return;
    applySnapshot(snapshot);
  }, [snapshot, objects]);

  useEffect(() => {
    if (!snapshot || centered.current || !viewport.current) return;
    const element = viewport.current;
    element.scrollLeft = Math.max(0, (snapshot.size.width * scale - element.clientWidth) / 2);
    element.scrollTop = Math.max(0, (snapshot.size.height * scale - element.clientHeight) / 2);
    centered.current = true;
  }, [snapshot, scale]);

  const position = (event: ReactPointerEvent): Point => {
    const bounds = world.current!.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / scale, y: (event.clientY - bounds.top) / scale };
  };

  const applySnapshot = (next: HouseSnapshot) => {
    if (!engine.current || paintedRevision.current === next.revision) return;
    const animate = hasPainted.current && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const before = new Map<string, string>();
    if (animate) for (const [id, element] of nodes.current) before.set(id, getComputedStyle(element).transform);
    for (const animation of transitions.current.values()) animation.cancel();
    transitions.current.clear();
    engine.current.resize(next.size);
    engine.current.syncObjects([...OBJECTS, ...giftObjects(next.gifts)], next.poses);
    engine.current.applyPoses(next.poses);
    paint.current();
    if (animate) for (const [id, element] of nodes.current) {
      const transform = before.get(id);
      if (!transform) continue;
      const animation = element.animate([{ transform }, { transform: element.style.transform }], { duration: 360, easing: "cubic-bezier(0.2, 0, 0, 1)" });
      transitions.current.set(id, animation);
      void animation.finished.then(() => {
        if (transitions.current.get(id) === animation) transitions.current.delete(id);
      }).catch(() => {});
    }
    paintedRevision.current = next.revision;
    hasPainted.current = true;
  };

  const interruptTransition = () => {
    if (!transitions.current.size || !engine.current) return;
    const poses = engine.current.getPoses().map((pose) => {
      const element = nodes.current.get(pose.id);
      if (!element) return pose;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return { ...pose, x: matrix.e + element.offsetWidth / 2, y: matrix.f + element.offsetHeight / 2, angle: Math.atan2(matrix.b, matrix.a) };
    });
    for (const animation of transitions.current.values()) animation.cancel();
    transitions.current.clear();
    engine.current.applyPoses(poses);
    paint.current();
    paintedRevision.current = -1;
  };

  const synchronize = (next: HouseSnapshot) => {
    // A later socket event can arrive before our own mutation's HTTP response.
    // Reject old poses as well as old React state in that case.
    if (next.revision < (currentSnapshot.current?.revision ?? -1)) return;
    currentSnapshot.current = next;
    onSnapshot(next);
    applySnapshot(next);
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
    if (!grab.moved || cancel) {
      const latest = currentSnapshot.current;
      if (latest) synchronize(latest);
      return;
    }
    const pose = engine.current?.getPoses().find((item) => item.id === grab.id);
    if (!pose) return;
    pendingPlacement.current = true;
    start.current();
    void ensureVisitor().then(() => placeObject({ baseRevision: grab.baseRevision, pose })).then((next) => {
      synchronize(next);
      onStatus("Placed.");
    }).catch((error: unknown) => {
      if (error instanceof HouseError && error.snapshot) {
        synchronize(error.snapshot);
        onStatus("The house changed while you were moving that. Try again.");
      } else {
        if (currentSnapshot.current) synchronize(currentSnapshot.current);
        onStatus(error instanceof Error ? error.message : "Couldn’t save that move. Try again.");
      }
    }).finally(() => { pendingPlacement.current = false; });
  };

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0 || grabbed.current || pendingPlacement.current || !currentSnapshot.current) return;
    event.preventDefault();
    interruptTransition();
    paintedRevision.current = -1;
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = position(event);
    grabbed.current = { id, point, origin: point, pointerId: event.pointerId, baseRevision: currentSnapshot.current.revision, moved: false };
  };

  const pointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const grab = grabbed.current;
    if (!grab || grab.pointerId !== event.pointerId) return;
    const point = position(event);
    if (!grab.moved) {
      if (Math.hypot(point.x - grab.origin.x, point.y - grab.origin.y) * scale < 5) return;
      if (!engine.current?.beginDrag(grab.id, grab.origin)) return;
      grab.moved = true;
      setGrabId(grab.id);
    }
    grab.point = point;
    engine.current?.moveDrag(point);
    start.current();
  };

  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const key = event.key.toLowerCase();
    if (key === "escape" && grabbed.current) { event.preventDefault(); finish(true); return; }
    if (["enter", " "].includes(key) && grabbed.current?.id === id) { event.preventDefault(); finish(); return; }
    if (!["arrowleft", "arrowright", "arrowup", "arrowdown", "q", "e"].includes(key)) return;
    event.preventDefault();
    if (pendingPlacement.current || !currentSnapshot.current || grabbed.current?.pointerId !== undefined) return;
    const scene = engine.current;
    if (!scene) return;
    if (!grabbed.current) {
      interruptTransition();
      paintedRevision.current = -1;
      const pose = scene.getPoses().find((item) => item.id === id);
      if (!pose || !scene.beginDrag(id, pose)) return;
      grabbed.current = { id, point: { x: pose.x, y: pose.y }, origin: pose, baseRevision: currentSnapshot.current.revision, moved: true };
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

  const initial = initialPoses("clump", INITIAL_SIZE);
  return <div ref={viewport} className="house-viewport" role="group" aria-label="Kaio’s things and visitor gifts" aria-describedby="house-movement-help">
    <div className="house-world-space" style={{ width: size.width * scale, height: size.height * scale }}>
      <div ref={world} className="house-world" style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}>
        {objects.map((object) => {
          const gift = snapshot?.gifts.find((item) => item.id === object.id);
          const pose = snapshot?.poses.find((item) => item.id === object.id) ?? initial.find((item) => item.id === object.id);
          return <button type="button" key={object.id} className="house-object" data-object={object.id} data-gift={Boolean(gift)} data-grabbed={grabId === object.id}
            ref={(element) => { if (element) nodes.current.set(object.id, element); else nodes.current.delete(object.id); }}
            style={{ width: Math.max(44, object.width), height: Math.max(44, object.height), fontSize: Math.max(object.width, object.height) * .87, transform: `translate(${pose?.x ?? size.width / 2}px, ${pose?.y ?? size.height / 2}px) translate(-50%, -50%) rotate(${pose?.angle ?? 0}rad)` }}
            aria-label={gift ? `${object.name}, gift from ${gift.authorName}. Open gift or use arrow keys to move.` : `${object.name}. Use arrow keys to move.`} aria-describedby="house-movement-help"
            onPointerDown={(event) => pointerDown(event, object.id)} onPointerMove={pointerMove}
            onPointerUp={(event) => { if (grabbed.current?.pointerId === event.pointerId) finish(); }}
            onPointerCancel={(event) => { if (grabbed.current?.pointerId === event.pointerId) finish(true); }}
            onLostPointerCapture={(event) => { if (grabbed.current?.pointerId === event.pointerId) finish(true); }}
            onKeyDown={(event) => keyboard(event, object.id)}
            onBlur={() => { if (grabbed.current?.id === object.id && grabbed.current.pointerId === undefined) finish(); }}
            onClick={(event) => {
              const suppressed = clickSuppressed.current;
              if (gift && !(suppressed?.id === gift.id && performance.now() < suppressed.until)) onOpen(gift.id, event.currentTarget.getBoundingClientRect());
            }}
          ><span className="house-object-art" aria-hidden="true">{object.emoji}</span></button>;
        })}
      </div>
    </div>
    <p id="house-movement-help" className="house-sr-only">Drag to move things. With a keyboard, arrows move, Q and E turn, Enter places, and Escape cancels. Press Enter on a gift to open it.</p>
  </div>;
}

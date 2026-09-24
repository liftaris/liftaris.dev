import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { createSceneEngine } from "./matter-engine";
import { OBJECTS, isFixed } from "./model";
import type { CollisionMode, Point, Pose, Scene, SceneEngine, Size } from "./model";
import "./clump.css";

const SCENES: { id: Scene; number: string; label: string; description: string }[] = [
  { id: "clump", number: "01", label: "The clump", description: "Pull something away. Let it find a new place in the pile." },
  { id: "structure", number: "02", label: "A little structure", description: "The light, plant, and computer stay. Make yourself at home around them." },
  { id: "apartment", number: "03", label: "The apartment", description: "An empty place, full of your things. Leave them wherever you like." },
];

type SavedScene = { poses: Pose[]; size: Size };
type Grab = { id: string; point: Point; pointerId?: number };

function Floorplan() {
  return (
    <svg className="floorplan" viewBox="0 0 420 360" preserveAspectRatio="none" aria-hidden="true">
      <path d="M24 26 H396 V334 H244 M202 334 H24 Z M220 26 V124 M220 162 V180 H310 M348 180 H396 M24 180 H126 M166 180 H220" />
      <path className="floorplan-door" d="M220 124 H182 M182 124 A38 38 0 0 0 220 162 M126 180 V140 M126 140 A40 40 0 0 1 166 180 M310 180 V142 M310 142 A38 38 0 0 1 348 180 M202 334 V292 M202 292 A42 42 0 0 1 244 334" />
      <text x="46" y="51">BEDROOM</text>
      <text x="281" y="51">BATH</text>
      <text x="45" y="309">LIVING / KITCHEN</text>
    </svg>
  );
}

export function ClumpLab() {
  const [scene, setScene] = useState<Scene>("clump");
  const [collision, setCollision] = useState<CollisionMode>("outline");
  const [showBodies, setShowBodies] = useState(false);
  const [color, setColor] = useState(false);
  const [revision, setRevision] = useState(0);
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [ready, setReady] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const polygonRefs = useRef(new Map<string, SVGPolygonElement>());
  const engineRef = useRef<SceneEngine | null>(null);
  const grabRef = useRef<Grab | null>(null);
  const startRef = useRef<() => void>(() => {});
  const cacheRef = useRef(new Map<string, SavedScene>());
  const resetKeyRef = useRef<string | null>(null);
  const modeKey = `${scene}:${scene === "apartment" ? "direct" : collision}`;
  const currentScene = SCENES.find((item) => item.id === scene)!;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let size: Size = { width: stage.clientWidth, height: stage.clientHeight };
    const saved = resetKeyRef.current === modeKey ? undefined : cacheRef.current.get(modeKey);
    resetKeyRef.current = null;
    const poses = saved?.poses.map((pose) => ({
      ...pose,
      x: pose.x / saved.size.width * size.width,
      y: pose.y / saved.size.height * size.height,
    }));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const engine = createSceneEngine({ scene, collision, size, poses, reducedMotion: reducedMotion.matches });
    engineRef.current = engine;
    let frame = 0;
    let previous = 0;
    let elapsed = 0;
    let disposed = false;

    const paint = () => {
      for (const pose of engine.getPoses()) {
        const node = itemRefs.current.get(pose.id);
        if (node) {
          node.style.transform = `translate(${pose.x}px, ${pose.y}px) translate(-50%, -50%) rotate(${pose.angle}rad)`;
          node.dataset.x = pose.x.toFixed(2);
          node.dataset.y = pose.y.toFixed(2);
          node.dataset.angle = pose.angle.toFixed(3);
        }
      }
      for (const shape of engine.getDebugShapes()) {
        polygonRefs.current.get(shape.id)?.setAttribute("points", shape.vertices.map((vertex) => `${vertex.x},${vertex.y}`).join(" "));
      }
    };

    const tick = (now: number) => {
      if (disposed) return;
      frame = 0;
      elapsed += previous ? Math.min(now - previous, 50) : 1000 / 60;
      previous = now;
      let active = true;
      while (elapsed >= 1000 / 60) {
        active = engine.step(1000 / 60);
        elapsed -= 1000 / 60;
      }
      paint();
      stage.dataset.moving = String(active);
      if (active) frame = requestAnimationFrame(tick);
      else previous = 0;
    };

    const start = () => {
      if (!frame && !disposed && !document.hidden) {
        previous = 0;
        elapsed = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    startRef.current = start;
    paint();
    setReady(true);
    start();

    const observer = new ResizeObserver(() => {
      const next = { width: stage.clientWidth, height: stage.clientHeight };
      if (next.width > 0 && next.height > 0 && (next.width !== size.width || next.height !== size.height)) {
        engine.endDrag(true);
        grabRef.current = null;
        setGrabbed(null);
        size = next;
        engine.resize(next);
        paint();
        start();
      }
    });
    observer.observe(stage);
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        engine.endDrag();
        grabRef.current = null;
        setGrabbed(null);
      } else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      engine.endDrag();
      cacheRef.current.set(modeKey, { poses: engine.getPoses(), size });
      engine.dispose();
      engineRef.current = null;
      grabRef.current = null;
      startRef.current = () => {};
    };
  }, [scene, collision, modeKey, revision]);

  const position = (event: ReactPointerEvent): Point => {
    const bounds = stageRef.current!.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const finishGrab = (cancel = false) => {
    const grab = grabRef.current;
    if (!grab) return;
    engineRef.current?.endDrag(cancel);
    grabRef.current = null;
    const node = itemRefs.current.get(grab.id);
    if (grab.pointerId !== undefined && node?.hasPointerCapture(grab.pointerId)) node.releasePointerCapture(grab.pointerId);
    setGrabbed(null);
    const label = OBJECTS.find((item) => item.id === grab.id)?.name;
    setAnnouncement(`${label} ${cancel ? "returned to its previous position" : "placed"}.`);
    startRef.current();
  };

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0 || grabRef.current?.pointerId !== undefined) return;
    event.preventDefault();
    finishGrab();
    const point = position(event);
    if (!engineRef.current?.beginDrag(id, point)) return;
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    grabRef.current = { id, point, pointerId: event.pointerId };
    setGrabbed(id);
    startRef.current();
  };

  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const key = event.key.toLowerCase();
    if (!["arrowleft", "arrowright", "arrowup", "arrowdown", "q", "e", " ", "enter", "escape"].includes(key)) return;
    event.preventDefault();
    const engine = engineRef.current;
    if (key === "escape") return finishGrab(true);
    if (!engine || grabRef.current?.pointerId !== undefined) return;
    if ((key === " " || key === "enter") && grabRef.current?.id === id) return finishGrab();
    if (!grabRef.current) {
      const pose = engine.getPoses().find((item) => item.id === id)!;
      if (!engine.beginDrag(id, pose)) return;
      grabRef.current = { id, point: { x: pose.x, y: pose.y } };
      setGrabbed(id);
      setAnnouncement(`${OBJECTS.find((item) => item.id === id)?.name} picked up. Arrows move, Q and E rotate, Enter places, Escape cancels.`);
    }
    const grab = grabRef.current;
    const step = event.shiftKey ? 18 : 6;
    if (key.startsWith("arrow")) {
      grab.point.x += key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
      grab.point.y += key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
      const object = OBJECTS.find((item) => item.id === id)!;
      const pose = engine.getPoses().find((item) => item.id === id)!;
      const cosine = Math.abs(Math.cos(pose.angle));
      const sine = Math.abs(Math.sin(pose.angle));
      const halfWidth = (object.width * cosine + object.height * sine) / 2 + 5;
      const halfHeight = (object.width * sine + object.height * cosine) / 2 + 5;
      const stage = stageRef.current!;
      grab.point.x = Math.max(halfWidth, Math.min(stage.clientWidth - halfWidth, grab.point.x));
      grab.point.y = Math.max(halfHeight, Math.min(stage.clientHeight - halfHeight, grab.point.y));
      engine.moveDrag(grab.point);
    } else if (key === "q" || key === "e") {
      engine.nudge(id, 0, 0, (key === "q" ? -1 : 1) * Math.PI / 12);
    }
    startRef.current();
  };

  const reset = () => {
    finishGrab(true);
    // Cleanup caches the outgoing world. Ignore that snapshot for an explicit reset.
    resetKeyRef.current = modeKey;
    setRevision((value) => value + 1);
    setAnnouncement("This scene has been reset.");
  };

  return (
    <div className="clump-lab">
      <header className="lab-topline"><a href="/" aria-label="Kaio's portfolio">KAIO BARBOSA <span>/ LAB</span></a><span>AN OPEN HOUSE · STUDY 001</span></header>
      <main>
        <div className="lab-intro"><p className="lab-eyebrow">A SMALL EXPERIMENT IN FEELING AT HOME</p><h1>A place for my things.</h1><p>Move things around. Make a little mess.</p></div>
        <div className="scene-picker" role="group" aria-label="Choose a scene">
          {SCENES.map((item) => <button key={item.id} type="button" aria-pressed={scene === item.id} onClick={() => { finishGrab(); setScene(item.id); setGrabbed(null); }}><span>{item.number}</span>{item.label}</button>)}
        </div>
        <p className="scene-description" id="scene-description">{currentScene.description}</p>
        <section className="experiment" aria-label={currentScene.label}>
          <div className="stage-surround">
            <div className="stage-label"><span>{scene === "apartment" ? "1 BED / 1 BATH / YOUR RULES" : scene === "structure" ? "SOME THINGS STAY. THE REST IS YOURS." : "A COLLECTION, ALWAYS REARRANGING."}</span><span>{OBJECTS.length} THINGS</span></div>
            <div ref={stageRef} className="object-stage" data-scene={scene} data-collision={collision} data-ready={ready} data-color={color} data-bodies={showBodies} aria-describedby="scene-description movement-help">
              {scene === "apartment" && <Floorplan />}
              <svg className="collision-overlay" aria-hidden="true">{OBJECTS.map((object) => <polygon key={object.id} ref={(node) => { if (node) polygonRefs.current.set(object.id, node); else polygonRefs.current.delete(object.id); }} />)}</svg>
              {OBJECTS.map((object) => {
                const fixed = isFixed(object, scene);
                return <button
                  key={object.id} type="button" className="thing" data-object={object.id} data-fixed={fixed} data-grabbed={grabbed === object.id}
                  ref={(node) => { if (node) itemRefs.current.set(object.id, node); else itemRefs.current.delete(object.id); }}
                  style={{ width: object.width, height: object.height, fontSize: Math.max(object.width, object.height) * .87 }}
                  disabled={fixed} aria-label={`${object.name}${fixed ? ", fixed in place" : ", movable"}`} aria-describedby={!fixed ? "movement-help" : undefined}
                  onPointerDown={(event) => pointerDown(event, object.id)}
                  onPointerMove={(event) => { if (grabRef.current?.pointerId === event.pointerId) { const point = position(event); grabRef.current.point = point; engineRef.current?.moveDrag(point); startRef.current(); } }}
                  onPointerUp={(event) => { if (grabRef.current?.pointerId === event.pointerId) { finishGrab(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } }}
                  onPointerCancel={(event) => { if (grabRef.current?.pointerId === event.pointerId) finishGrab(true); }}
                  onLostPointerCapture={(event) => { if (grabRef.current?.pointerId === event.pointerId) finishGrab(); }}
                  onKeyDown={(event) => keyboard(event, object.id)}
                  onBlur={() => { if (grabRef.current?.id === object.id && grabRef.current.pointerId === undefined) finishGrab(); }}
                ><span className="thing-art" aria-hidden="true">{object.emoji}</span>{fixed && <span className="anchor-mark" aria-hidden="true" />}</button>;
              })}
            </div>
            <div className="stage-bottom"><span>{grabbed ? "MAKE IT YOURS" : scene === "structure" ? "● FIXED OBJECTS" : "PICK SOMETHING UP"}</span><button type="button" className="reset-button" onClick={reset}><span aria-hidden="true">↺</span> Start again</button></div>
          </div>
        </section>
        <div className="lab-controls">
          <fieldset className="collision-picker" disabled={scene === "apartment"}><legend>Objects bump with</legend><div>{([ ["outline", "Their shape"], ["peg", "A small peg"] ] as const).map(([value, label]) => <label key={value}><input type="radio" name="collision" value={value} checked={collision === value} onChange={() => { finishGrab(); setCollision(value); setGrabbed(null); }} /><span>{label}</span></label>)}</div></fieldset>
          <div className="display-options"><label><input type="checkbox" checked={showBodies} disabled={scene === "apartment"} onChange={(event) => setShowBodies(event.target.checked)} /> Show bodies</label><label><input type="checkbox" checked={color} onChange={(event) => setColor(event.target.checked)} /> A little color</label></div>
        </div>
        <p className="collision-note">{scene === "apartment" ? "No pull, no drift. Every thing stays where you leave it." : collision === "peg" ? "The little pegs collide. The drawings can overlap, like posters on pins." : "Simple bodies follow the size of each thing. Grab an edge to give it a turn."}</p>
        <p id="movement-help" className="movement-help">Drag to move. With a keyboard: arrows move, Q / E turn,<br />Enter places, Escape puts it back.</p>
        <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      </main>
      <footer className="lab-footer"><span>NOTHING PRECIOUS. EVERYTHING PERSONAL.</span><span>ARRANGEMENTS LIVE IN THIS VISIT.</span></footer>
    </div>
  );
}

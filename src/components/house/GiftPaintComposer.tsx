import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { DefaultColorStyle, DefaultSizeStyle, GeoShapeGeoStyle, Tldraw, useValue } from "tldraw";
import type { Editor, TLDefaultColorStyle, TLDefaultSizeStyle } from "tldraw";
import "tldraw/tldraw.css";
import { createGift, ensureVisitor, getGift, uploadDoodle } from "../../lib/house/client";
import type { HouseMutation } from "../../lib/house/client";
import { EMOJI_CATALOG, findEmoji } from "../../lib/house/emoji";
import type { GiftDetail, Visitor } from "../../lib/house/types";

export interface GiftPaintComposerProps {
  onGift: (gift: GiftDetail, bounds: DOMRect, form: HTMLFormElement) => void;
  mutate: HouseMutation;
  onSavingChange: (saving: boolean) => void;
  onClose?: () => void;
}

const BEVEL = "border-2 border-t-white border-l-white border-r-gray-600 border-b-gray-600";
const INSET = "border-2 border-t-gray-600 border-l-gray-600 border-r-white border-b-white";
const BUTTON = `${BEVEL} inline-flex items-center justify-center rounded-none bg-[#c0c0c0] text-black cursor-pointer active:border-t-gray-600 active:border-l-gray-600 active:border-r-white active:border-b-white aria-pressed:border-t-gray-600 aria-pressed:border-l-gray-600 aria-pressed:border-r-white aria-pressed:border-b-white aria-pressed:bg-[#e0e0e0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000080] disabled:cursor-not-allowed disabled:opacity-50`;

const TOOLS = [
  { id: "select", label: "Select", path: "M5 3v16l4-5 4 7 3-2-4-6 7-1Z" },
  { id: "draw", label: "Pencil / Brush", path: "m4 16 12-12 4 4L8 20l-5 1 1-5Zm9-9 4 4" },
  { id: "eraser", label: "Eraser", path: "m3 14 10-10 8 8-8 8H9l-6-6Zm5-5 8 8M13 20h8" },
  { id: "text", label: "Text", path: "M5 6V4h14v2M12 4v16M8 20h8" },
  { id: "rectangle", label: "Rectangle", path: "M3 5h18v14H3Z" },
  { id: "ellipse", label: "Ellipse", path: "M21 12a9 7 0 1 1-18 0 9 7 0 1 1 18 0" },
  { id: "line", label: "Line", path: "M4 20 20 4" },
  { id: "arrow", label: "Arrow", path: "M4 20 20 4M8 4h12v12" },
] as const;

const SIZES: { id: TLDefaultSizeStyle; label: string; width: number }[] = [
  { id: "s", label: "Thin", width: 1 },
  { id: "m", label: "Medium", width: 3 },
  { id: "l", label: "Thick", width: 5 },
  { id: "xl", label: "Extra Thick", width: 8 },
];

const PALETTE: { id: TLDefaultColorStyle; label: string; color: string }[] = [
  { id: "black", label: "Black", color: "#1d1d1d" },
  { id: "grey", label: "Grey", color: "#9fa8b2" },
  { id: "light-violet", label: "Light violet", color: "#e9a8ff" },
  { id: "violet", label: "Violet", color: "#8e44ad" },
  { id: "blue", label: "Blue", color: "#4465e9" },
  { id: "light-blue", label: "Light blue", color: "#4ba1f1" },
  { id: "yellow", label: "Yellow", color: "#f1c40f" },
  { id: "orange", label: "Orange", color: "#e67e22" },
  { id: "green", label: "Green", color: "#099268" },
  { id: "light-green", label: "Light green", color: "#4cb05e" },
  { id: "light-red", label: "Light red", color: "#ff8a8a" },
  { id: "red", label: "Red", color: "#e03131" },
];

function PaintTools({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const current = useValue("gift paint tools", () => ({
    tool: editor?.getCurrentToolId() ?? "draw",
    geo: editor?.getStyleForNextShape(GeoShapeGeoStyle) ?? "rectangle",
    size: editor?.getStyleForNextShape(DefaultSizeStyle) ?? "m",
  }), [editor]);

  return <fieldset disabled={disabled || !editor} className="m-0 w-20 shrink-0 border-0 p-0">
    <legend className="mb-1 text-xs">Tools</legend>
    <div className="grid grid-cols-2 gap-1">
      {TOOLS.map((tool) => <button
        key={tool.id} type="button" className={`${BUTTON} h-9 w-full`}
        aria-label={tool.label} title={tool.label}
        aria-pressed={tool.id === "rectangle" || tool.id === "ellipse"
          ? current.tool === "geo" && current.geo === tool.id
          : current.tool === tool.id}
        onClick={() => {
          if (!editor) return;
          editor.complete();
          if (tool.id === "rectangle" || tool.id === "ellipse") {
            editor.setStyleForNextShapes(GeoShapeGeoStyle, tool.id);
            editor.setCurrentTool("geo");
          } else editor.setCurrentTool(tool.id);
          editor.focus();
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" aria-hidden="true"><path d={tool.path} /></svg>
      </button>)}
    </div>
    <div role="group" aria-label="Stroke size" className={`${INSET} mt-3 p-1`}>
      {SIZES.map((size) => <button
        key={size.id} type="button" className={`${BUTTON} mb-1 h-7 w-full last:mb-0`}
        aria-label={size.label} title={size.label} aria-pressed={current.size === size.id}
        onClick={() => { editor?.setStyleForNextShapes(DefaultSizeStyle, size.id); }}
      ><span className="block w-10 bg-black" style={{ height: size.width }} aria-hidden="true" /></button>)}
    </div>
  </fieldset>;
}

function PaintPalette({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const color = useValue("gift paint color", () => editor?.getStyleForNextShape(DefaultColorStyle) ?? "black", [editor]);
  const active = PALETTE.find((option) => option.id === color)!;

  return <fieldset disabled={disabled || !editor} className="m-0 flex min-w-0 items-center gap-2 border-0 p-0">
    <legend className="sr-only">Colors</legend>
    <div className={`${INSET} grid size-11 shrink-0 place-items-center bg-[#d4d0c8]`} role="img" aria-label={`Current color: ${active.label}`} title={`Current color: ${active.label}`}>
      <span className="size-7 border border-black" style={{ backgroundColor: active.color }} />
    </div>
    <div className="flex flex-wrap gap-1">
      {PALETTE.map((option) => <button
        key={option.id} type="button" className={`${BUTTON} size-7 p-0.5`}
        aria-label={option.label} title={option.label} aria-pressed={option.id === color}
        onClick={() => { editor?.setStyleForNextShapes(DefaultColorStyle, option.id); }}
      ><span className="block size-full border border-black/30" style={{ backgroundColor: option.color }} /></button>)}
    </div>
  </fieldset>;
}

function PaintUtilities({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const state = useValue("gift paint history", () => ({
    canUndo: editor?.canUndo() ?? false,
    canRedo: editor?.canRedo() ?? false,
    hasShapes: Boolean(editor?.getCurrentPageShapeIds().size),
    zoom: Math.round((editor?.getZoomLevel() ?? 1) * 100),
  }), [editor]);

  return <fieldset disabled={disabled || !editor} className="m-0 flex flex-wrap items-center gap-1 border-0 p-0">
    <legend className="sr-only">Canvas actions</legend>
    <button type="button" className={`${BUTTON} min-h-8 px-2`} disabled={!state.canUndo} onClick={() => { editor?.undo(); }}>Undo</button>
    <button type="button" className={`${BUTTON} min-h-8 px-2`} disabled={!state.canRedo} onClick={() => { editor?.redo(); }}>Redo</button>
    <button type="button" className={`${BUTTON} min-h-8 px-2`} disabled={!state.hasShapes} onClick={() => {
      if (!editor) return;
      editor.complete();
      editor.markHistoryStoppingPoint("clear gift drawing");
      editor.deleteShapes(Array.from(editor.getCurrentPageShapeIds()));
    }}>Clear</button>
    <span className="flex-1" />
    {/* Explicit zoom controls can move the locked camera; pan gestures cannot. */}
    <button type="button" className={`${BUTTON} size-8 text-lg`} aria-label="Zoom Out" title="Zoom Out" onClick={() => { editor?.zoomOut(undefined, { force: true }); }}>−</button>
    <span className="min-w-10 text-center tabular-nums" aria-label={`Zoom: ${state.zoom}%`}>{state.zoom}%</span>
    <button type="button" className={`${BUTTON} size-8 text-lg`} aria-label="Zoom In" title="Zoom In" onClick={() => { editor?.zoomIn(undefined, { force: true }); }}>+</button>
  </fieldset>;
}

export function GiftPaintComposer({ onGift, mutate, onSavingChange, onClose }: GiftPaintComposerProps) {
  const id = useId();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [selected, setSelected] = useState(() => findEmoji("gift")!);
  const [picking, setPicking] = useState(false);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pickerButton = useRef<HTMLButtonElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const pending = useRef<{ key: string; requestId: string; url?: string } | null>(null);

  useEffect(() => {
    let active = true;
    void ensureVisitor().then((identity) => { if (active) setVisitor(identity); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Couldn’t create your visitor identity.");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!picking) return;
    picker.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !picker.current?.contains(event.target) && !pickerButton.current?.contains(event.target)) setPicking(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [picking]);

  const mountEditor = useCallback((mounted: Editor) => {
    mounted.setCamera({ x: 0, y: 0, z: 1 });
    mounted.setCameraOptions({ isLocked: true, wheelBehavior: "zoom" });
    mounted.setCurrentTool("draw");
    mounted.setStyleForNextShapes(DefaultColorStyle, "black");
    mounted.setStyleForNextShapes(DefaultSizeStyle, "m");
    setEditor(mounted);
  }, []);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || !editor || !canvas.current) return;
    editor.complete();
    const shapes = editor.getCurrentPageShapeIds();
    if (!shapes.size) {
      setError("Draw something before leaving your gift.");
      return;
    }
    const form = event.currentTarget;
    const bounds = canvas.current.getBoundingClientRect();
    submitting.current = true;
    setSaving(true);
    setPicking(false);
    setError("");
    onSavingChange(true);
    editor.updateInstanceState({ isReadonly: true });
    try {
      setVisitor(await ensureVisitor());
      const baked = await editor.toImageDataUrl(Array.from(shapes), { format: "webp", scale: 1, background: true });
      const name = displayName.trim();
      // Reuse the upload and request ID when retrying the same drawing and attribution.
      const key = JSON.stringify([selected.id, name, baked.url]);
      if (pending.current?.key !== key) pending.current = { key, requestId: crypto.randomUUID() };
      const draft = pending.current;
      if (!draft.url) draft.url = (await uploadDoodle(baked.url)).url;
      const { createdGiftId } = await mutate(() => createGift({
        emojiId: selected.id,
        displayName: name,
        doodle: draft.url,
        visibility: "public",
        requestId: draft.requestId,
      }));
      if (!createdGiftId) throw new Error("This gift has already been taken back. Change your drawing to leave a new one.");
      const gift = await getGift(createdGiftId);
      onGift(gift, bounds, form);
      pending.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your gift couldn’t be left. Please try again.");
    } finally {
      editor.updateInstanceState({ isReadonly: false });
      submitting.current = false;
      setSaving(false);
      onSavingChange(false);
    }
  };

  return <form
    className={`house-composer gift-paint-composer ${BEVEL} w-full bg-[#c0c0c0] p-2 text-xs leading-normal text-black [font-family:Tahoma,Verdana,sans-serif]`}
    aria-label="Paint a gift" aria-busy={saving} onSubmit={(event) => { void submit(event); }}
    onKeyDown={(event) => {
      if (picking && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation();
        setPicking(false);
        pickerButton.current?.focus();
      }
    }}
  >
    <div className="relative mb-2 flex items-center gap-2">
      <button ref={pickerButton} type="button" className={`${BUTTON} size-9 shrink-0 text-2xl`} aria-label={`Choose gift emoji: ${selected.name}`} aria-expanded={picking} aria-controls={`${id}-picker`} disabled={saving} onClick={() => setPicking(!picking)}>
        <span aria-hidden="true">{selected.emoji}</span>
      </button>
      <label htmlFor={`${id}-name`} className="shrink-0">From:</label>
      <input id={`${id}-name`} name="displayName" type="text" autoComplete="nickname" maxLength={40} placeholder={visitor?.name ?? "Anonymous animal"} value={displayName} disabled={saving} onChange={(event) => setDisplayName(event.target.value)} className={`${INSET} h-9 w-0 min-w-0 flex-1 rounded-none bg-white px-2 text-base placeholder:text-gray-500 focus-visible:outline-2 focus-visible:outline-[#000080] disabled:opacity-50`} />
      <button type="submit" className={`${BUTTON} min-h-9 shrink-0 px-2 font-bold`} disabled={saving || !editor}>{saving ? "Leaving gift..." : "Leave gift"}</button>
      {onClose && <button type="button" className={`${BUTTON} size-7 shrink-0 text-lg`} aria-label="Close gift composer" title="Close" disabled={saving} onClick={onClose}>×</button>}
      {picking && <div ref={picker} id={`${id}-picker`} role="group" aria-label="Choose a gift emoji" className={`${BEVEL} absolute top-full left-0 z-[500] mt-1 grid max-h-60 w-72 max-w-full grid-cols-6 gap-1 overflow-y-auto overscroll-contain bg-[#d4d0c8] p-2 shadow-lg`}>
        {EMOJI_CATALOG.map((option) => <button key={option.id} type="button" className={`${BUTTON} h-10 text-2xl`} aria-label={option.name} title={option.name} aria-pressed={selected.id === option.id} onClick={() => {
          setSelected(option);
          setPicking(false);
          setError("");
          pickerButton.current?.focus();
        }}><span aria-hidden="true">{option.emoji}</span></button>)}
      </div>}
    </div>
    <div className="flex items-start gap-2">
      <PaintTools editor={editor} disabled={saving} />
      <div ref={canvas} className={`${INSET} relative aspect-square min-w-0 flex-1 overflow-hidden bg-white`} inert={saving}>
        <Tldraw licenseKey={process.env.TLDRAW_API_KEY || undefined} hideUi autoFocus={false} onMount={mountEditor} />
      </div>
    </div>
    <div className="mt-2 space-y-2 border-t border-gray-500 pt-2">
      <PaintPalette editor={editor} disabled={saving} />
      <PaintUtilities editor={editor} disabled={saving} />
    </div>
    <p className="mt-2 mb-0 empty:hidden" role="alert">{error}</p>
  </form>;
}

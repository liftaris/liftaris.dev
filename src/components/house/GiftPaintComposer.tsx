import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode, SubmitEvent } from "react";
import { DefaultColorStyle, DefaultSizeStyle, GeoShapeGeoStyle, Tldraw } from "tldraw";
import type { Editor, TLDefaultColorStyle, TLDefaultSizeStyle } from "tldraw";
import "tldraw/tldraw.css";
import { createGift, ensureVisitor, getGift, uploadDoodle } from "../../lib/house/client";
import type { HouseMutation } from "../../lib/house/client";
import { EMOJI_CATALOG, findEmoji } from "../../lib/house/emoji";
import type { GiftDetail, Visitor } from "../../lib/house/types";

export interface GiftPaintComposerProps {
  onGift?: (gift: GiftDetail, bounds: DOMRect, form: HTMLFormElement) => void;
  mutate?: HouseMutation;
  onSavingChange?: (saving: boolean) => void;
  onClose?: () => void;
  standalone?: boolean;
}

type ToolId = "select" | "draw" | "eraser" | "text" | "line" | "arrow" | "rectangle" | "ellipse";

const BEVEL = "border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]";
const INSET = "border-2 border-t-[#808080] border-l-[#808080] border-r-white border-b-white";
const BUTTON_BASE = "inline-flex items-center justify-center rounded-[2px] text-black cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50 transition-none";
const BUTTON_RETRO = `${BUTTON_BASE} bg-[#ece9d8] border border-[#7f9db9] hover:bg-[#f6f4ec] active:bg-[#d4d0c8] active:border-[#316ac5] aria-pressed:bg-[#d8d3c5] aria-pressed:border-[#000080] aria-pressed:shadow-inner`;
const BUTTON_MENU = `${BUTTON_BASE} px-1.5 py-0.5 text-[11px] leading-tight text-black hover:bg-[#316ac5] hover:text-white active:bg-[#1a4ea8]`;

const TOOLS: { id: ToolId; label: string; icon: (active: boolean) => ReactNode }[] = [
  {
    id: "select",
    label: "Select",
    icon: () => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M4 2l11 11-4.5 1 4 8-3 1.5-4-8-3.5 3.5V2z" />
      </svg>
    ),
  },
  {
    id: "draw",
    label: "Pencil / Brush",
    icon: () => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
    ),
  },
  {
    id: "eraser",
    label: "Eraser",
    icon: () => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
        <path d="M22 21H7" />
        <path d="m5 11 9 9" />
      </svg>
    ),
  },
  {
    id: "text",
    label: "Text",
    icon: () => (
      <span className="font-serif font-black text-sm leading-none" aria-hidden="true">A</span>
    ),
  },
  {
    id: "line",
    label: "Line",
    icon: () => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <line x1="4" y1="20" x2="20" y2="4" />
      </svg>
    ),
  },
  {
    id: "arrow",
    label: "Arrow",
    icon: () => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="5" y1="19" x2="19" y2="5" />
        <polyline points="9 5 19 5 19 15" />
      </svg>
    ),
  },
  {
    id: "rectangle",
    label: "Rectangle",
    icon: () => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="1" />
      </svg>
    ),
  },
  {
    id: "ellipse",
    label: "Ellipse / Circle",
    icon: () => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
];

const SIZES: { id: TLDefaultSizeStyle; label: string; height: number }[] = [
  { id: "s", label: "Thin (1px)", height: 1 },
  { id: "m", label: "Medium (3px)", height: 2.5 },
  { id: "l", label: "Thick (5px)", height: 4.5 },
  { id: "xl", label: "Extra Thick (8px)", height: 6.5 },
];

const PALETTE: { id: TLDefaultColorStyle; label: string; color: string }[] = [
  { id: "black", label: "Black", color: "#000000" },
  { id: "grey", label: "Grey", color: "#7f7f7f" },
  { id: "white", label: "White", color: "#ffffff" },
  { id: "red", label: "Red", color: "#e03131" },
  { id: "light-red", label: "Light Red", color: "#ff8a8a" },
  { id: "orange", label: "Orange", color: "#f76707" },
  { id: "yellow", label: "Yellow", color: "#f1c40f" },
  { id: "green", label: "Green", color: "#099268" },
  { id: "light-green", label: "Light Green", color: "#4cb05e" },
  { id: "blue", label: "Blue", color: "#0e54f0" },
  { id: "light-blue", label: "Light Blue", color: "#4ba1f1" },
  { id: "violet", label: "Violet", color: "#8e44ad" },
  { id: "light-violet", label: "Light Violet", color: "#e9a8ff" },
];

export function GiftPaintComposer({ onGift, mutate, onSavingChange, onClose, standalone = false }: GiftPaintComposerProps) {
  const id = useId();
  const editorRef = useRef<Editor | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId>("draw");
  const [activeColor, setActiveColor] = useState<TLDefaultColorStyle>("black");
  const [activeSize, setActiveSize] = useState<TLDefaultSizeStyle>("m");
  const [zoomLevel, setZoomLevel] = useState<number>(100);

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
      if (event.target instanceof Node && !picker.current?.contains(event.target) && !pickerButton.current?.contains(event.target)) {
        setPicking(false);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [picking]);

  const onMount = useCallback((mounted: Editor) => {
    editorRef.current = mounted;
    mounted.setCurrentTool("draw");
    mounted.setStyleForNextShapes(DefaultColorStyle, "black");
    mounted.setStyleForNextShapes(DefaultSizeStyle, "m");
    mounted.setCameraOptions({ panSpeed: 0, zoomSpeed: 1 });
    setEditorReady(true);

    const onChange = () => {
      const z = Math.round(mounted.getZoomLevel() * 100);
      setZoomLevel((prev) => (prev !== z ? z : prev));
    };
    mounted.on("change", onChange);
    return () => {
      mounted.off("change", onChange);
    };
  }, []);

  const selectTool = (tool: ToolId) => {
    const ed = editorRef.current;
    setActiveTool(tool);
    if (!ed) return;
    if (tool === "rectangle" || tool === "ellipse") {
      ed.setStyleForNextShapes(GeoShapeGeoStyle, tool);
      ed.setCurrentTool("geo");
    } else {
      ed.setCurrentTool(tool);
    }
    ed.setStyleForNextShapes(DefaultColorStyle, activeColor);
    ed.setStyleForNextShapes(DefaultSizeStyle, activeSize);
  };

  const selectColor = (colorId: TLDefaultColorStyle) => {
    const ed = editorRef.current;
    setActiveColor(colorId);
    if (!ed) return;
    ed.setStyleForNextShapes(DefaultColorStyle, colorId);
    if (activeTool === "eraser" || activeTool === "select") {
      setActiveTool("draw");
      ed.setCurrentTool("draw");
    }
  };

  const selectSize = (sizeId: TLDefaultSizeStyle) => {
    const ed = editorRef.current;
    setActiveSize(sizeId);
    if (!ed) return;
    ed.setStyleForNextShapes(DefaultSizeStyle, sizeId);
  };

  const handleUndo = () => editorRef.current?.undo();
  const handleRedo = () => editorRef.current?.redo();
  const handleClear = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const shapes = ed.getCurrentPageShapeIds();
    if (shapes.size > 0) {
      ed.deleteShapes(Array.from(shapes));
    }
  };
  const handleZoomIn = () => editorRef.current?.zoomIn();
  const handleZoomOut = () => editorRef.current?.zoomOut();
  const handleZoomReset = () => editorRef.current?.resetZoom();

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ed = editorRef.current;
    if (submitting.current || !ed || !canvas.current) return;
    const shapes = ed.getCurrentPageShapeIds();
    if (!shapes || shapes.size === 0) {
      setError("Draw something before leaving your gift.");
      return;
    }
    const form = event.currentTarget;
    const bounds = canvas.current.getBoundingClientRect();
    submitting.current = true;
    setSaving(true);
    setPicking(false);
    setError("");
    onSavingChange?.(true);
    try {
      setVisitor(await ensureVisitor());
      const baked = await ed.toImageDataUrl(Array.from(shapes), { format: "webp", scale: 1, background: true });
      const name = displayName.trim();
      const key = JSON.stringify([selected.id, name, baked.url]);
      if (pending.current?.key !== key) pending.current = { key, requestId: crypto.randomUUID() };
      const draft = pending.current;
      if (!draft.url) draft.url = (await uploadDoodle(baked.url)).url;

      const performCreate = () => createGift({
        emojiId: selected.id,
        displayName: name,
        doodle: draft.url,
        visibility: "public",
        requestId: draft.requestId,
      });

      const { createdGiftId } = mutate ? await mutate(performCreate) : await performCreate();
      if (!createdGiftId) throw new Error("This gift has already been taken back. Change your drawing to leave a new one.");
      const gift = await getGift(createdGiftId);
      if (onGift) {
        onGift(gift, bounds, form);
      } else {
        window.location.href = `/?restore=${encodeURIComponent(createdGiftId)}`;
      }
      pending.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your gift couldn’t be left. Please try again.");
    } finally {
      submitting.current = false;
      setSaving(false);
      onSavingChange?.(false);
    }
  };

  return (
    <form
      className={`gift-paint-composer size-full flex flex-col min-h-0 bg-[#ece9d8] text-black [font-family:Tahoma,Verdana,sans-serif] text-xs select-none`}
      aria-label="Paint a gift"
      aria-busy={saving}
      onSubmit={(e) => { void submit(e); }}
      onKeyDown={(event) => {
        if (picking && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setPicking(false);
          pickerButton.current?.focus();
        }
      }}
    >
      {/* 1. Thin cream Windows XP window menubar */}
      <div className="h-6 shrink-0 bg-[#ece9d8] border-b border-[#aca899] px-2 flex items-center justify-between text-[11px] text-black">
        <div className="flex items-center gap-0.5">
          <span className="px-1.5 py-0.5 font-medium hover:bg-[#316ac5] hover:text-white rounded-[2px] cursor-default">File</span>
          <span className="px-1.5 py-0.5 font-medium hover:bg-[#316ac5] hover:text-white rounded-[2px] cursor-default">Edit</span>
          <span className="w-px h-3.5 bg-[#aca899] mx-1" aria-hidden="true" />
          <button type="button" className={`${BUTTON_MENU} px-1.5`} onClick={handleUndo} title="Undo (Ctrl+Z)">Undo</button>
          <button type="button" className={`${BUTTON_MENU} px-1.5`} onClick={handleRedo} title="Redo (Ctrl+Y)">Redo</button>
          <button type="button" className={`${BUTTON_MENU} px-1.5`} onClick={handleClear} title="Clear Canvas">Clear</button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-600 text-[10px] mr-1">Zoom:</span>
          <button type="button" className={`${BUTTON_MENU} size-4.5 p-0 font-bold`} onClick={handleZoomOut} title="Zoom Out">−</button>
          <button type="button" className={`${BUTTON_MENU} px-1 tabular-nums font-mono`} onClick={handleZoomReset} title="Reset Zoom">{zoomLevel}%</button>
          <button type="button" className={`${BUTTON_MENU} size-4.5 p-0 font-bold`} onClick={handleZoomIn} title="Zoom In">+</button>
        </div>
      </div>

      {/* 2. Thin attribution header row */}
      <div className="relative shrink-0 bg-[#f4f2ea] border-b border-[#aca899] px-2 py-1 flex items-center gap-1.5 text-xs">
        <button
          ref={pickerButton}
          type="button"
          className={`${BUTTON_RETRO} size-7 text-lg shrink-0`}
          aria-label={`Choose gift emoji: ${selected.name}`}
          aria-expanded={picking}
          aria-controls={`${id}-picker`}
          disabled={saving}
          onClick={() => setPicking(!picking)}
        >
          <span aria-hidden="true">{selected.emoji}</span>
        </button>
        <label htmlFor={`${id}-name`} className="shrink-0 text-[11px] font-bold text-gray-700">From:</label>
        <input
          id={`${id}-name`}
          name="displayName"
          type="text"
          autoComplete="nickname"
          maxLength={40}
          placeholder={visitor?.name ?? "Anonymous animal"}
          value={displayName}
          disabled={saving}
          onChange={(e) => setDisplayName(e.target.value)}
          className="h-6 min-w-0 flex-1 px-1.5 text-xs bg-white border border-[#7f9db9] rounded-none focus:outline-none focus:border-[#316ac5] disabled:opacity-50"
        />
        <button
          type="submit"
          className={`${BUTTON_RETRO} h-6 px-2.5 text-[11px] font-bold shrink-0`}
          disabled={saving || !editorReady}
        >
          {saving ? "Leaving gift..." : "Leave gift"}
        </button>
        {onClose && (
          <button
            type="button"
            className={`${BUTTON_RETRO} size-6 text-sm shrink-0`}
            aria-label="Close"
            disabled={saving}
            onClick={onClose}
          >
            ×
          </button>
        )}

        {/* Emoji picker dropdown */}
        {picking && (
          <div
            ref={picker}
            id={`${id}-picker`}
            role="group"
            aria-label="Choose a gift emoji"
            className={`${BEVEL} absolute top-full left-2 z-[500] mt-1 grid max-h-56 w-68 grid-cols-6 gap-1 overflow-y-auto overscroll-contain bg-[#ece9d8] p-1.5 shadow-xl`}
          >
            {EMOJI_CATALOG.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`${BUTTON_RETRO} h-9 text-xl`}
                aria-label={option.name}
                title={option.name}
                aria-pressed={selected.id === option.id}
                onClick={() => {
                  setSelected(option);
                  setPicking(false);
                  pickerButton.current?.focus();
                }}
              >
                <span aria-hidden="true">{option.emoji}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Center Workspace: Left Single-Column Toolbar + Right 1:1 Canvas */}
      <div className="flex-1 flex items-stretch min-h-0 bg-[#808080] p-1.5 gap-1.5 overflow-hidden">
        {/* Left: Single-Column Retro Toolbar */}
        <div className="w-8 shrink-0 flex flex-col items-center gap-1 p-1 bg-[#ece9d8] border border-[#7f9db9] rounded-[2px] shadow-xs">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={`${BUTTON_RETRO} size-6.5 text-xs ${activeTool === tool.id ? "bg-[#d0cbbe] border-t-gray-700 border-l-gray-700 border-r-white border-b-white" : ""}`}
              aria-label={tool.label}
              title={tool.label}
              aria-pressed={activeTool === tool.id}
              disabled={saving || !editorReady}
              onClick={() => selectTool(tool.id)}
            >
              {tool.icon(activeTool === tool.id)}
            </button>
          ))}

          <span className="w-full h-px bg-[#aca899] my-0.5" aria-hidden="true" />

          {/* Stroke sizes */}
          {SIZES.map((size) => (
            <button
              key={size.id}
              type="button"
              className={`${BUTTON_RETRO} size-6.5 flex items-center justify-center ${activeSize === size.id ? "bg-[#d0cbbe] border-t-gray-700 border-l-gray-700 border-r-white border-b-white" : ""}`}
              aria-label={size.label}
              title={size.label}
              aria-pressed={activeSize === size.id}
              disabled={saving || !editorReady}
              onClick={() => selectSize(size.id)}
            >
              <span className="block w-3.5 bg-black" style={{ height: size.height }} aria-hidden="true" />
            </button>
          ))}
        </div>

        {/* Center/Right: 1:1 Canvas container */}
        <div className="flex-1 flex items-center justify-center min-w-0 min-h-0 overflow-hidden">
          <div
            ref={canvas}
            className={`${INSET} relative aspect-square max-h-full max-w-full overflow-hidden bg-white shadow-md select-none touch-none`}
            style={{
              width: standalone ? "min(100%, calc(100vh - 120px))" : "min(100%, 100%)",
              height: standalone ? "min(100%, calc(100vh - 120px))" : "min(100%, 100%)",
            }}
          >
            <Tldraw
              licenseKey={process.env.TLDRAW_API_KEY || undefined}
              hideUi={true}
              autoFocus={false}
              onMount={onMount}
            />
          </div>
        </div>
      </div>

      {/* 4. Single Thin Row Color Palette */}
      <div className="shrink-0 h-8 bg-[#ece9d8] border-t border-[#aca899] px-2 flex items-center gap-1.5 overflow-x-auto">
        {/* Active color preview */}
        <div
          className={`${INSET} size-6 shrink-0 bg-white p-0.5 flex items-center justify-center`}
          title={`Active color: ${activeColor}`}
        >
          <span
            className="size-full border border-black/40"
            style={{ backgroundColor: PALETTE.find((p) => p.id === activeColor)?.color ?? "#000000" }}
          />
        </div>

        <span className="w-px h-4 bg-[#aca899] mx-0.5 shrink-0" aria-hidden="true" />

        {/* Color swatches */}
        <div className="flex items-center gap-1 shrink-0">
          {PALETTE.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`size-5 rounded-none border cursor-pointer transition-transform ${
                activeColor === option.id
                  ? "border-black ring-1 ring-black scale-110 z-10"
                  : "border-gray-500 hover:border-black"
              }`}
              style={{ backgroundColor: option.color }}
              aria-label={option.label}
              title={option.label}
              disabled={saving || !editorReady}
              onClick={() => selectColor(option.id)}
            />
          ))}
        </div>
      </div>

      {error && (
        <p className="bg-red-100 text-red-700 px-2 py-0.5 text-[11px] border-t border-red-300 m-0" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

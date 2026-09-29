import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { DefaultColorStyle, type Editor, Tldraw } from "tldraw";
import "tldraw/tldraw.css";

export interface GiftDoodleCanvasHandle {
  exportDoodle: () => Promise<string | null>;
  hasDoodle: () => boolean;
  clear: () => void;
}

const PALETTE: Array<{ id: "blue" | "black" | "red" | "green" | "orange"; label: string; color: string }> = [
  { id: "blue", label: "Blue", color: "#0E54F0" },
  { id: "black", label: "Black", color: "#111827" },
  { id: "red", label: "Red", color: "#e03131" },
  { id: "green", label: "Green", color: "#2f9e44" },
  { id: "orange", label: "Orange", color: "#f76707" },
];

export const GiftDoodleCanvas = forwardRef<GiftDoodleCanvasHandle, { disabled?: boolean }>(function GiftDoodleCanvas(
  { disabled },
  ref,
) {
  const editorRef = useRef<Editor | null>(null);
  const [activeTool, setActiveTool] = useState<"draw" | "eraser">("draw");
  const [activeColor, setActiveColor] = useState<"blue" | "black" | "red" | "green" | "orange">("blue");

  useImperativeHandle(ref, () => ({
    async exportDoodle() {
      const editor = editorRef.current;
      if (!editor) return null;
      const shapes = editor.getCurrentPageShapeIds();
      if (!shapes || shapes.size === 0) return null;
      const shapeIds = Array.from(shapes);
      try {
        if (typeof editor.toImageDataUrl === "function") {
          const result = await editor.toImageDataUrl(shapeIds, { format: "webp", scale: 1, background: false });
          if (result?.url) return result.url;
        }
        const { blob } = await editor.toImage(shapeIds, { format: "webp", scale: 1, background: false });
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    },
    hasDoodle() {
      const editor = editorRef.current;
      if (!editor) return false;
      const shapes = editor.getCurrentPageShapeIds();
      return Boolean(shapes && shapes.size > 0);
    },
    clear() {
      const editor = editorRef.current;
      if (!editor) return;
      const shapes = editor.getCurrentPageShapeIds();
      if (shapes && shapes.size > 0) {
        editor.deleteShapes(Array.from(shapes));
      }
    },
  }));

  const selectTool = (tool: "draw" | "eraser") => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setCurrentTool(tool);
    setActiveTool(tool);
  };

  const selectColor = (colorId: "blue" | "black" | "red" | "green" | "orange") => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setCurrentTool("draw");
    editor.setStyleForNextShapes(DefaultColorStyle, colorId);
    setActiveColor(colorId);
    setActiveTool("draw");
  };

  const undo = () => {
    editorRef.current?.undo();
  };

  const clear = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const shapes = editor.getCurrentPageShapeIds();
    if (shapes && shapes.size > 0) {
      editor.deleteShapes(Array.from(shapes));
    }
  };

  return (
    <div className="gift-doodle-module w-full flex flex-col items-center">
      {/* 1:1 Canvas container */}
      <div className="gift-doodle-canvas-wrapper relative aspect-square w-full max-w-[280px] sm:max-w-[320px] mx-auto border border-dashed border-current bg-white text-blue overflow-hidden select-none">
        <Tldraw
          licenseKey={process.env.TLDRAW_API_KEY || undefined}
          hideUi={true}
          autoFocus={false}
          onMount={(editor) => {
            editorRef.current = editor;
            editor.setCurrentTool("draw");
            editor.setStyleForNextShapes(DefaultColorStyle, "blue");
          }}
        />
      </div>

      {/* Compact Controls */}
      <div className="gift-doodle-toolbar flex flex-wrap items-center justify-between gap-1.5 w-full max-w-[280px] sm:max-w-[320px] mt-2 text-xs font-mono">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`px-2 py-1 border border-current text-xs cursor-pointer transition-all ${
              activeTool === "draw" ? "bg-blue text-paper" : "bg-transparent text-inherit hover:opacity-80"
            }`}
            disabled={disabled}
            onClick={() => selectTool("draw")}
            aria-pressed={activeTool === "draw"}
            title="Draw"
          >
            Pen
          </button>
          <button
            type="button"
            className={`px-2 py-1 border border-current text-xs cursor-pointer transition-all ${
              activeTool === "eraser" ? "bg-blue text-paper" : "bg-transparent text-inherit hover:opacity-80"
            }`}
            disabled={disabled}
            onClick={() => selectTool("eraser")}
            aria-pressed={activeTool === "eraser"}
            title="Eraser"
          >
            Eraser
          </button>
        </div>

        {/* Color Palette */}
        <div className="flex items-center gap-1">
          {PALETTE.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`size-5 rounded-full border cursor-pointer transition-transform ${
                activeColor === p.id && activeTool === "draw"
                  ? "scale-125 border-current ring-1 ring-current"
                  : "border-gray-400 opacity-80 hover:opacity-100"
              }`}
              style={{ backgroundColor: p.color }}
              disabled={disabled}
              onClick={() => selectColor(p.id)}
              aria-label={p.label}
              title={p.label}
            />
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="px-2 py-1 border border-current bg-transparent text-inherit text-xs cursor-pointer hover:opacity-80 transition-all"
            disabled={disabled}
            onClick={undo}
            title="Undo"
          >
            Undo
          </button>
          <button
            type="button"
            className="px-2 py-1 border border-current bg-transparent text-inherit text-xs cursor-pointer hover:opacity-80 transition-all"
            disabled={disabled}
            onClick={clear}
            title="Clear canvas"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
});

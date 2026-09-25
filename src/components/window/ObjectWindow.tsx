import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type WinBox from "winbox/src/js/winbox.js";
import "winbox/dist/css/winbox.min.css";
import "./window.css";

type ObjectWindowProps = {
  title: string;
  icon: string;
  source: HTMLButtonElement;
  origin: DOMRect;
  monochrome?: boolean;
  closeLabel?: string;
  width?: number;
  height?: number;
  canClose?: boolean;
  initialBounds?: DOMRect;
  onReady?: () => void;
  onClose: () => void;
  children?: ReactNode;
};

export function ObjectWindow({ title, icon, source, origin, monochrome = false, closeLabel = "Close window", width = 480, height = 380, canClose = true, initialBounds, onReady, onClose, children }: ObjectWindowProps) {
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [error, setError] = useState(false);
  const close = useRef(onClose);
  close.current = onClose;
  const closeAllowed = useRef(canClose);
  closeAllowed.current = canClose;
  const ready = useRef(onReady);
  ready.current = onReady;
  useLayoutEffect(() => { if (body) ready.current?.(); }, [body]);

  // Capture focus before React removes portal children on parent-driven close.
  useLayoutEffect(() => {
    let disposed = false;
    let instance: WinBox | undefined;
    let restoreFocus = false;
    let detach = () => {};
    // WinBox's template accesses document when the module loads.
    void import("winbox/src/js/winbox.js").then(({ default: WinBox }) => {
      if (disposed) return;
      const template = document.createElement("div");
      template.innerHTML = `<div class="wb-header">
        <div class="wb-control">
          <button type="button" class="wb-collapse" aria-label="Minimize window">−</button>
          <button type="button" class="wb-close">×</button>
        </div>
        <div class="wb-drag">
          <button type="button" class="object-window-icon"></button>
          <div class="object-window-handle" tabindex="0" role="button"><div class="wb-title"></div></div>
        </div>
      </div><div class="wb-body"></div>`;
      let closing = false;
      const options: WinBox.Params & { template: HTMLElement } = {
        template, title, index: 20, header: 18,
        class: "object-window no-max no-full no-resize no-animation",
        width, height, minwidth: 1, minheight: 44,
        top: 58, left: 36, right: 12, bottom: 12,
        x: initialBounds?.left ?? origin.left + 24, y: initialBounds?.top ?? origin.top + 16,
        onclose(force) {
          if (force) return false;
          if (!closeAllowed.current) return true;
          if (closing) return true;
          closing = true;
          restoreFocus = frame.contains(document.activeElement);
          const finish = () => { if (!disposed) close.current(); };
          if (matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
          else {
            const target = source.getBoundingClientRect();
            const rect = frame.getBoundingClientRect();
            frame.style.pointerEvents = "none";
            void frame.animate([
              { transform: "none", opacity: 1 },
              { transform: `translate(${target.x - rect.x}px, ${target.y - rect.y}px) scale(.08)`, opacity: 0 },
            ], { duration: 180, easing: "ease-in", fill: "forwards" }).finished.then(finish, finish);
          }
          return true;
        },
      };
      const win = instance = new WinBox(options);
      const frame = win.window as HTMLElement;
      frame.setAttribute("role", "dialog");
      frame.setAttribute("aria-label", title);
      frame.dataset.monochrome = String(monochrome);
      const iconButton = frame.querySelector<HTMLButtonElement>(".object-window-icon")!;
      iconButton.textContent = icon;
      iconButton.setAttribute("aria-label", `Collapse ${title} window`);
      iconButton.title = "Drag to move; click to minimize";
      // WinBox owns movement; the pointer gesture only distinguishes a click from a drag.
      let iconPress: { id: number; x: number; y: number; moved: boolean } | undefined;
      iconButton.onpointerdown = (event) => {
        if (event.button !== 0 || iconPress) return;
        iconPress = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
        iconButton.setPointerCapture(event.pointerId);
        iconButton.focus({ preventScroll: true });
      };
      iconButton.onpointermove = (event) => {
        if (iconPress?.id === event.pointerId) iconPress.moved ||= Math.hypot(event.clientX - iconPress.x, event.clientY - iconPress.y) >= 5;
      };
      iconButton.onpointerup = (event) => {
        if (iconPress?.id !== event.pointerId) return;
        const moved = iconPress.moved || Math.hypot(event.clientX - iconPress.x, event.clientY - iconPress.y) >= 5;
        iconPress = undefined;
        if (iconButton.hasPointerCapture(event.pointerId)) iconButton.releasePointerCapture(event.pointerId);
        if (!moved) win.close();
      };
      iconButton.onpointercancel = iconButton.onlostpointercapture = () => { iconPress = undefined; };
      iconButton.onclick = (event) => { if (event.detail === 0) win.close(); };
      frame.querySelector(".wb-close")!.setAttribute("aria-label", closeLabel);
      const handle = frame.querySelector<HTMLElement>(".object-window-handle")!;
      handle.setAttribute("aria-label", `Move ${title} window. Use arrow keys; Escape collapses.`);
      frame.querySelector<HTMLButtonElement>(".wb-collapse")!.onclick = () => { win.close(); };

      const move = (x: number, y: number) => win.move(
        Math.max(Number(win.left), Math.min(x, innerWidth - Number(win.width) - Number(win.right))),
        Math.max(Number(win.top), Math.min(y, innerHeight - Number(win.height) - Number(win.bottom))),
      );
      // WinBox bounds dragging but does not resize open windows on viewport changes.
      const fit = () => {
        win.resize(Math.min(initialBounds?.width ?? width, innerWidth - 48), Math.min(initialBounds?.height ?? height, innerHeight - Number(win.top) - Number(win.bottom)));
        move(Number(win.x), Number(win.y));
      };
      const keyboard = (event: KeyboardEvent) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); win.close(); }
        if (event.target !== handle || !event.key.startsWith("Arrow")) return;
        event.preventDefault();
        const step = event.shiftKey ? 40 : 10;
        move(Number(win.x) + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
          Number(win.y) + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0));
      };
      const focus = () => { win.focus(); };
      // Disabling a focused action blurs to BODY without another focusin.
      const trackFocus = () => { restoreFocus = frame.contains(document.activeElement); };
      document.addEventListener("focusin", trackFocus);
      frame.addEventListener("keydown", keyboard);
      frame.addEventListener("focusin", focus);
      frame.addEventListener("pointerdown", focus);
      window.addEventListener("resize", fit);
      fit();
      win.blur().focus();
      handle.focus({ preventScroll: true });
      setBody(win.body);
      detach = () => {
        window.removeEventListener("resize", fit);
        document.removeEventListener("focusin", trackFocus);
        frame.removeEventListener("keydown", keyboard);
        frame.removeEventListener("focusin", focus);
        frame.removeEventListener("pointerdown", focus);
        restoreFocus ||= frame.contains(document.activeElement);
      };
    }).catch(() => { if (!disposed) setError(true); });
    return () => {
      disposed = true;
      detach();
      instance?.close(true);
      if (restoreFocus) {
        if (source.isConnected && source.dataset.removing !== "true") source.focus({ preventScroll: true });
        else document.querySelector<HTMLButtonElement>('[data-object="leave-gift"]')?.focus({ preventScroll: true });
      }
    };
  }, [title, icon, source, origin, monochrome, closeLabel, width, height, initialBounds]);

  if (error) return <p role="alert">Couldn’t load this window. <button type="button" onClick={onClose}>Return to icon</button></p>;
  return body ? createPortal(<div className="object-window-content">{children}</div>, body) : null;
}

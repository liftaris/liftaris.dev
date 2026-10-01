import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import type WinBox from "winbox/src/js/winbox.js";
import { isImageUrl } from "../clump/model";
import "winbox/dist/css/winbox.min.css";

type ObjectWindowProps = {
  title: string;
  icon: string;
  source: HTMLButtonElement;
  fallbackSource?: () => HTMLButtonElement | null;
  origin: DOMRect;
  monochrome?: boolean;
  closeLabel?: string;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  className?: string;
  autoFit?: boolean;
  canClose?: boolean;
  initialBounds?: DOMRect;
  backgroundStyle?: CSSProperties;
  maximizeUrl?: string;
  restoreAnimation?: boolean;
  onMaximize?: () => void;
  onReady?: () => void;
  onClose: () => void;
  children?: ReactNode;
};

export function ObjectWindow({ title, icon, source, fallbackSource, origin, monochrome = false, closeLabel = "Close window", width = 480, height = 380, minWidth = 180, minHeight = 100, resizable = true, className, autoFit = false, canClose = true, initialBounds, backgroundStyle, maximizeUrl, restoreAnimation = false, onMaximize, onReady, onClose, children }: ObjectWindowProps) {
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [error, setError] = useState(false);
  const initial = useRef({ source, origin, width, height, minWidth, minHeight, resizable, initialBounds, className });
  const windowInstance = useRef<WinBox | null>(null);
  const readyFired = useRef(false);
  const isAnimating = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;
  const closeAllowed = useRef(canClose);
  closeAllowed.current = canClose;
  const maxUrl = useRef(maximizeUrl);
  maxUrl.current = maximizeUrl;
  const maxHandler = useRef(onMaximize);
  maxHandler.current = onMaximize;

  const fallback = useRef(fallbackSource);
  fallback.current = fallbackSource;
  useLayoutEffect(() => {
    const win = windowInstance.current;
    if (!body || !win) return;
    win.setTitle(title);
    const frame = win.window as HTMLElement;
    frame.setAttribute("aria-label", title);
    frame.dataset.monochrome = String(monochrome);
    if (className) frame.classList.add(className);
    const iconButton = frame.querySelector<HTMLButtonElement>(".object-window-icon")!;
    if (isImageUrl(icon)) {
      iconButton.replaceChildren();
      const img = document.createElement("img");
      img.src = icon;
      img.alt = "";
      img.className = "object-window-image";
      iconButton.appendChild(img);
    } else {
      iconButton.textContent = icon;
    }
    iconButton.setAttribute("aria-label", `Collapse ${title} window`);
    const maxBtn = frame.querySelector<HTMLButtonElement>(".wb-max");
    if (maxBtn) maxBtn.setAttribute("aria-label", `Maximize ${title} window`);
    frame.querySelector(".wb-close")!.setAttribute("aria-label", closeLabel);
    frame.querySelector(".object-window-handle")!.setAttribute("aria-label", `Move ${title} window. Use arrow keys; Escape collapses.`);
  }, [body, title, icon, monochrome, closeLabel, className]);
  useLayoutEffect(() => {
    if (body && onReady && !readyFired.current) { readyFired.current = true; onReady(); }
  }, [body, onReady]);

  useLayoutEffect(() => {
    if (maximizeUrl) {
      void import("astro:prefetch").then(({ prefetch }) => prefetch(maximizeUrl)).catch(() => {});
    }
  }, [maximizeUrl]);

  useLayoutEffect(() => {
    const win = windowInstance.current;
    if (!body || !win || !autoFit) return;
    const content = body.firstElementChild as HTMLElement | null;
    if (!content) return;

    const measureAndResize = () => {
      if (win.max || isAnimating.current) return;
      const target = (content.firstElementChild as HTMLElement) || content;
      const rect = target.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const style = window.getComputedStyle(content);
      const padX = parseFloat(style.paddingLeft || "0") + parseFloat(style.paddingRight || "0");
      const padY = parseFloat(style.paddingTop || "0") + parseFloat(style.paddingBottom || "0");

      const targetWidth = Math.ceil(rect.width + padX + 6);
      const targetHeight = Math.ceil(rect.height + padY + 18 + 6);

      const maxWidth = innerWidth - Number(win.left) - Number(win.right);
      const maxHeight = innerHeight - Number(win.top) - Number(win.bottom);

      win.resize(Math.min(targetWidth, maxWidth), Math.min(targetHeight, maxHeight));
      win.move(
        Math.max(Number(win.left), Math.min(Number(win.x), innerWidth - Number(win.width) - Number(win.right))),
        Math.max(Number(win.top), Math.min(Number(win.y), innerHeight - Number(win.height) - Number(win.bottom))),
      );
    };

    measureAndResize();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measureAndResize);
      ro.observe(content);
      if (content.firstElementChild) ro.observe(content.firstElementChild);
      return () => ro.disconnect();
    }
  }, [body, autoFit]);

  // Capture focus before React removes portal children on parent-driven close.
  useLayoutEffect(() => {
    // Geometry and source belong to this mounted window, not its changing content.
    const { source, origin, width, height, minWidth = 180, minHeight = 100, resizable = true, initialBounds, className: windowClass } = initial.current;
    let disposed = false;
    let instance: WinBox | undefined;
    let restoreFocus = false;
    let detach = () => {};
    const returnTarget = () => source.isConnected && source.dataset.removing !== "true" ? source : fallback.current?.();
    // WinBox's template accesses document when the module loads.
    void import("winbox/src/js/winbox.js").then(({ default: WinBox }) => {
      if (disposed) return;
      const template = document.createElement("div");
      template.innerHTML = `<div class="wb-header">
        <div class="wb-control">
          <button type="button" class="wb-collapse" aria-label="Minimize window">−</button>
          <button type="button" class="wb-max" aria-label="Maximize window"><span class="wb-max-square" aria-hidden="true"></span><span class="wb-restore-square" aria-hidden="true"></span></button>
          <button type="button" class="wb-close">×</button>
        </div>
        <div class="wb-drag">
          <button type="button" class="object-window-icon"></button>
          <div class="object-window-handle" tabindex="0" role="button"><div class="wb-title"></div></div>
        </div>
      </div><div class="wb-body"></div>`;
      let closing = false;
      const options: WinBox.Params & { template: HTMLElement } = {
        root: document.body,
        template, index: 20, header: 18,
        class: ["object-window", "@container", "no-full", !resizable && "no-resize", "no-animation", windowClass].filter(Boolean).join(" "),
        width, height,
        minwidth: Math.min(minWidth, width),
        minheight: Math.min(minHeight, height),
        top: 19, left: 12, right: 12, bottom: 12,
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
            const target = returnTarget()?.getBoundingClientRect() ?? origin;
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
      windowInstance.current = win;
      const frame = win.window as HTMLElement;
      frame.setAttribute("role", "dialog");
      const iconButton = frame.querySelector<HTMLButtonElement>(".object-window-icon")!;
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
      const handle = frame.querySelector<HTMLElement>(".object-window-handle")!;
      frame.querySelector<HTMLButtonElement>(".wb-collapse")!.onclick = () => { win.close(); };
      const maxButton = frame.querySelector<HTMLButtonElement>(".wb-max")!;
      const handleMaximize = () => {
        if (closing || isAnimating.current) return;
        if (maxHandler.current) {
          maxHandler.current();
          return;
        }

        const isReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (win.max) {
          if (isReducedMotion) {
            win.restore();
            frame.classList.remove("maximizing", "restoring");
            maxButton.setAttribute("aria-label", `Maximize ${title} window`);
            return;
          }

          const isFolder = frame.classList.contains("folder-window") || Boolean(frame.querySelector(".folder"));
          const outerBody = isFolder ? document.querySelector<HTMLElement>(".site-window-body") : null;
          const outerRect = outerBody ? outerBody.getBoundingClientRect() : null;

          isAnimating.current = true;
          frame.classList.remove("max");
          frame.classList.add("restoring");
          maxButton.setAttribute("aria-label", `Maximize ${title} window`);

          if (outerRect) {
            frame.style.top = `${outerRect.top}px`;
            frame.style.left = `${outerRect.left}px`;
            frame.style.width = `${outerRect.width}px`;
            frame.style.height = `${outerRect.height}px`;
            frame.style.borderRadius = "0 0 3px 3px";
          } else {
            frame.style.top = "18px";
            frame.style.left = "0px";
            frame.style.width = "100vw";
            frame.style.height = "calc(100vh - 18px)";
          }
          frame.style.boxShadow = "none";
          frame.style.border = "none";
          void frame.offsetWidth;

          frame.style.transition = "top 220ms cubic-bezier(0.16, 1, 0.3, 1), left 220ms cubic-bezier(0.16, 1, 0.3, 1), width 220ms cubic-bezier(0.16, 1, 0.3, 1), height 220ms cubic-bezier(0.16, 1, 0.3, 1)";
          frame.style.top = `${win.y}px`;
          frame.style.left = `${win.x}px`;
          frame.style.width = `${win.width}px`;
          frame.style.height = `${win.height}px`;

          setTimeout(() => {
            if (disposed) return;
            frame.style.transition = "";
            frame.style.boxShadow = "";
            frame.style.border = "";
            frame.style.borderRadius = "";
            frame.classList.remove("restoring");
            win.restore();
            win.focus();
            isAnimating.current = false;
          }, 220);
          return;
        }

        const url = maxUrl.current;
        if (!url) {
          if (isReducedMotion) {
            win.maximize();
            maxButton.setAttribute("aria-label", `Restore ${title} window`);
            return;
          }

          const isFolder = frame.classList.contains("folder-window") || Boolean(frame.querySelector(".folder"));
          const outerBody = isFolder ? document.querySelector<HTMLElement>(".site-window-body") : null;
          const outerRect = outerBody ? outerBody.getBoundingClientRect() : null;

          isAnimating.current = true;
          frame.classList.add("maximizing");
          maxButton.setAttribute("aria-label", `Restore ${title} window`);
          frame.style.transition = "top 220ms cubic-bezier(0.16, 1, 0.3, 1), left 220ms cubic-bezier(0.16, 1, 0.3, 1), width 220ms cubic-bezier(0.16, 1, 0.3, 1), height 220ms cubic-bezier(0.16, 1, 0.3, 1)";
          if (outerRect) {
            frame.style.top = `${outerRect.top}px`;
            frame.style.left = `${outerRect.left}px`;
            frame.style.width = `${outerRect.width}px`;
            frame.style.height = `${outerRect.height}px`;
            frame.style.borderRadius = "0 0 3px 3px";
          } else {
            frame.style.top = "18px";
            frame.style.left = "0px";
            frame.style.width = "100vw";
            frame.style.height = "calc(100vh - 18px)";
          }
          frame.style.boxShadow = "none";
          frame.style.border = "none";

          setTimeout(() => {
            if (disposed) return;
            frame.style.transition = "";
            frame.classList.remove("maximizing");
            win.maximize();
            isAnimating.current = false;
          }, 220);
          return;
        }

        const siteWindow = document.querySelector<HTMLElement>(".site-window");
        const siteRect = siteWindow?.getBoundingClientRect();

        isAnimating.current = true;
        frame.classList.add("maximizing");
        maxButton.setAttribute("aria-label", `Restore ${title} window`);
        frame.style.pointerEvents = "none";
        frame.style.transition = "top 220ms cubic-bezier(0.16, 1, 0.3, 1), left 220ms cubic-bezier(0.16, 1, 0.3, 1), width 220ms cubic-bezier(0.16, 1, 0.3, 1), height 220ms cubic-bezier(0.16, 1, 0.3, 1)";
        const isMd = typeof window !== "undefined" && window.innerWidth >= 768;
        const pad = isMd ? 16 : 10;
        const routeTop = pad;
        const routeHeight = typeof window !== "undefined" ? window.innerHeight - 2 * pad : 0;
        const routeWidth = siteRect ? siteRect.width : (typeof window !== "undefined" ? window.innerWidth - 2 * pad : 0);
        const routeLeft = siteRect ? siteRect.left : pad;

        if (siteRect) {
          frame.style.top = `${routeTop}px`;
          frame.style.left = `${routeLeft}px`;
          frame.style.width = `${routeWidth}px`;
          frame.style.height = `${routeHeight}px`;
          frame.style.borderRadius = "3px";
          if (siteWindow) {
            siteWindow.style.transition = "max-height 220ms cubic-bezier(0.16, 1, 0.3, 1)";
            siteWindow.style.maxHeight = "none";
          }
        } else {
          frame.style.top = "0px";
          frame.style.left = "0px";
          frame.style.width = "100vw";
          frame.style.height = "100vh";
        }
        frame.style.boxShadow = "none";
        frame.style.border = "1px solid var(--color-window-border)";

        const outerDrag = document.querySelector<HTMLElement>(".site-window-drag");
        if (outerDrag && !outerDrag.textContent?.trim()) {
          const iconSpan = document.createElement("span");
          iconSpan.className = "site-window-icon";
          if (icon?.startsWith("/") || icon?.startsWith("http")) {
            const img = document.createElement("img");
            img.src = icon;
            img.alt = "";
            img.className = "site-window-image";
            iconSpan.appendChild(img);
          } else if (icon) {
            iconSpan.textContent = icon;
          }
          const handleDiv = document.createElement("div");
          handleDiv.className = "site-window-handle";
          const titleSpan = document.createElement("span");
          titleSpan.className = "site-window-title";
          titleSpan.textContent = title;
          handleDiv.appendChild(titleSpan);

          outerDrag.replaceChildren(iconSpan, handleDiv);
        }

        const redirect = () => {
          frame.style.setProperty("view-transition-name", "site-window");
          if (typeof document !== "undefined" && "startViewTransition" in document && typeof (document as unknown as { startViewTransition?: (cb: () => void) => unknown }).startViewTransition === "function") {
            void import("astro:transitions/client")
              .then(({ navigate }) => navigate(url))
              .catch(() => {
                (document as unknown as { startViewTransition: (cb: () => void) => unknown }).startViewTransition(() => {
                  window.location.href = url;
                });
              });
          } else {
            window.location.href = url;
          }
        };

        if (isReducedMotion) {
          redirect();
        } else {
          setTimeout(redirect, 200);
        }
      };
      maxButton.addEventListener("click", (event) => {
        event.stopPropagation();
        event.stopImmediatePropagation();
        event.preventDefault();
        handleMaximize();
      }, true);
      handle.ondblclick = (event) => {
        event.stopPropagation();
        event.stopImmediatePropagation();
        handleMaximize();
      };

      const move = (x: number, y: number) => win.move(
        Math.max(Number(win.left), Math.min(x, innerWidth - Number(win.width) - Number(win.right))),
        Math.max(Number(win.top), Math.min(y, innerHeight - Number(win.height) - Number(win.bottom))),
      );
      // WinBox bounds dragging but does not resize open windows on viewport changes.
      const fit = () => {
        const currentW = Number(win.width) || (initialBounds?.width ?? width);
        const currentH = Number(win.height) || (initialBounds?.height ?? height);
        win.resize(
          Math.min(currentW, innerWidth - Number(win.left) - Number(win.right)),
          Math.min(currentH, innerHeight - Number(win.top) - Number(win.bottom))
        );
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
      if (restoreAnimation && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        isAnimating.current = true;
        const targetX = Number(win.x);
        const targetY = Number(win.y);
        const targetW = Number(win.width);
        const targetH = Number(win.height);

        const siteWindow = document.querySelector<HTMLElement>(".site-window");
        const siteRect = siteWindow?.getBoundingClientRect();

        const isMd = typeof window !== "undefined" && window.innerWidth >= 768;
        const pad = isMd ? 16 : 10;
        const routeTop = pad;
        const routeHeight = typeof window !== "undefined" ? window.innerHeight - 2 * pad : 0;
        const routeWidth = siteRect ? siteRect.width : (typeof window !== "undefined" ? window.innerWidth - 2 * pad : 0);
        const routeLeft = siteRect ? siteRect.left : pad;

        frame.style.pointerEvents = "none";
        frame.classList.add("restoring");
        if (siteRect) {
          frame.style.top = `${routeTop}px`;
          frame.style.left = `${routeLeft}px`;
          frame.style.width = `${routeWidth}px`;
          frame.style.height = `${routeHeight}px`;
          frame.style.borderRadius = "3px";
        } else {
          frame.style.top = "0px";
          frame.style.left = "0px";
          frame.style.width = "100vw";
          frame.style.height = "100vh";
        }
        frame.style.boxShadow = "none";
        frame.style.border = "1px solid var(--color-window-border)";

        requestAnimationFrame(() => {
          if (disposed) return;
          frame.style.transition = "top 240ms cubic-bezier(0.16, 1, 0.3, 1), left 240ms cubic-bezier(0.16, 1, 0.3, 1), width 240ms cubic-bezier(0.16, 1, 0.3, 1), height 240ms cubic-bezier(0.16, 1, 0.3, 1)";
          frame.style.top = `${targetY}px`;
          frame.style.left = `${targetX}px`;
          frame.style.width = `${targetW}px`;
          frame.style.height = `${targetH}px`;
          frame.style.borderRadius = "";

          setTimeout(() => {
            if (disposed) return;
            frame.style.pointerEvents = "";
            frame.style.transition = "";
            frame.style.boxShadow = "";
            frame.style.border = "";
            frame.style.borderRadius = "";
            frame.classList.remove("restoring");
            isAnimating.current = false;
            win.focus();
            handle.focus({ preventScroll: true });
          }, 240);
        });
      }
      if (!restoreAnimation || matchMedia("(prefers-reduced-motion: reduce)").matches) {
        win.focus();
        handle.focus({ preventScroll: true });
      }
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
      windowInstance.current = null;
      if (restoreFocus) returnTarget()?.focus({ preventScroll: true });
    };
  }, []);

  if (error) return <p role="alert">Couldn’t load this window. <button type="button" onClick={onClose}>Return to icon</button></p>;
  return body ? createPortal(<div className="object-window-content" style={backgroundStyle}>{children}</div>, body) : null;
}

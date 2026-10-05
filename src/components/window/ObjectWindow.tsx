import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import type WinBox from "winbox/src/js/winbox.js";
import { isImageUrl } from "../clump/model";
import { normalizeEmojiPresentation } from "../../lib/house/emoji";
import { windowPoint, normalizedWindowPoint } from "../../lib/things/model";
import "winbox/dist/css/winbox.min.css";

type ObjectWindowProps = {
  root: HTMLElement;
  thingId: string;
  activation?: number;
  open: boolean;
  title: string;
  icon: string;
  source: HTMLButtonElement;
  fallbackSource?: () => HTMLButtonElement | null;
  origin: DOMRect;
  width?: number;
  height?: number;
  x?: number | null;
  y?: number | null;
  className?: string;
  backgroundStyle?: CSSProperties;
  maximizeUrl?: string;
  restoreAnimation?: boolean;
  onAuthorResize?: (size: {width:number;height:number}) => void;
  onAuthorMove?: (pos: {x:number;y:number}) => void;
  onClose: () => void;
  children?: ReactNode;
};

export function ObjectWindow({ root, thingId, activation, open, title, icon, source, fallbackSource, origin, width = 480, height = 380, x, y, className, backgroundStyle, maximizeUrl, restoreAnimation = false, onAuthorResize, onAuthorMove, onClose, children }: ObjectWindowProps) {
  const visible = useRef(open); visible.current = open;
  const closing = useRef(false);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [error, setError] = useState(false);
  const initial = useRef({ source, origin, width, height, x, y, className });
  const windowInstance = useRef<WinBox | null>(null);
  const isAnimating = useRef(false);
  const resizeCallback = useRef(onAuthorResize); resizeCallback.current = onAuthorResize;
  const moveCallback = useRef(onAuthorMove); moveCallback.current = onAuthorMove;
  const close = useRef(onClose);
  close.current = onClose;
  const maxUrl = useRef(maximizeUrl);
  maxUrl.current = maximizeUrl;

  const fallback = useRef(fallbackSource);
  fallback.current = fallbackSource;
  useLayoutEffect(() => {
    const win = windowInstance.current;
    if (!body || !win) return;
    const frame = win.window as HTMLElement;
    const hadFocus = frame.contains(document.activeElement);
    frame.inert = !open;
    frame.setAttribute('aria-hidden', String(!open));
    if (open) {
      closing.current = false;
      frame.getAnimations().forEach(animation => animation.cancel());
      frame.style.pointerEvents = '';
      win.show();
      win.focus();
      frame.querySelector<HTMLElement>('.object-window-handle')?.focus({ preventScroll: true });
    } else {
      win.hide();
      win.blur();
      if (hadFocus) (source.isConnected ? source : fallback.current?.())?.focus({ preventScroll: true });
    }
  }, [body, open, source, activation]);

  useLayoutEffect(() => {
    const win = windowInstance.current;
    if (!body || !win) return;
    win.setTitle(title);
    const frame = win.window as HTMLElement;
    frame.setAttribute("aria-label", title);
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
      iconButton.textContent = normalizeEmojiPresentation(icon).trim();
    }
    iconButton.setAttribute("aria-label", `Collapse ${title} window`);
    const maxBtn = frame.querySelector<HTMLButtonElement>(".wb-max");
    if (maxBtn) maxBtn.setAttribute("aria-label", `Maximize ${title} window`);
    frame.querySelector(".wb-close")!.setAttribute("aria-label", "Close window");
    frame.querySelector(".object-window-handle")!.setAttribute("aria-label", `Move ${title} window. Use arrow keys; Escape collapses.`);
  }, [body, title, icon, className]);

  useLayoutEffect(() => {
    const button = body?.closest(".object-window")?.querySelector(".wb-max");
    if (!button || !maximizeUrl) return;
    const prefetch = () => {
      void import("astro:prefetch").then(({ prefetch }) => prefetch(maximizeUrl)).catch(() => {});
    };
    button.addEventListener("pointerenter", prefetch);
    button.addEventListener("focus", prefetch);
    return () => {
      button.removeEventListener("pointerenter", prefetch);
      button.removeEventListener("focus", prefetch);
    };
  }, [body, maximizeUrl]);

  useLayoutEffect(() => {
    const win = windowInstance.current;
    if(!win || !body || !onAuthorResize || win.max || isAnimating.current)return;
    win.resize(Math.min(width,innerWidth-24),Math.min(height,innerHeight-40));
  },[body,width,height,onAuthorResize]);

  useLayoutEffect(() => {
    const win = windowInstance.current;
    if (!win || !body || !onAuthorMove || win.max || isAnimating.current) return;
    const { x: px, y: py } = windowPoint(
      { window_x: x, window_y: y, window_width: Number(win.width), window_height: Number(win.height) },
      { width: innerWidth, height: innerHeight }
    );
    if (px !== null && py !== null) {
      win.move(
        Math.max(Number(win.left), Math.min(px, innerWidth - Number(win.width) - Number(win.right))),
        Math.max(Number(win.top), Math.min(py, innerHeight - Number(win.height) - Number(win.bottom)))
      );
    }
  }, [body, x, y, onAuthorMove]);

  // Capture focus before React removes portal children on parent-driven close.
  useLayoutEffect(() => {
    // Geometry and source belong to this mounted window, not its changing content.
    const { source, origin, width, height, x, y, className: windowClass } = initial.current;
    let disposed = false;
    let instance: WinBox | undefined;
    let restoreFocus = false;
    let detach = () => {};
    const returnTarget = () => source.isConnected ? source : fallback.current?.();
    // WinBox's template accesses document when the module loads.
    void import("winbox/src/js/winbox.js").then(({ default: WinBox }) => {
      if (disposed) return;
      const template = document.createElement("div");
      template.innerHTML = `<div class="wb-header">
        <div class="wb-control">
          <button type="button" class="wb-max" aria-label="Maximize window"><span class="wb-max-square" aria-hidden="true"></span><span class="wb-restore-square" aria-hidden="true"></span></button>
          <button type="button" class="wb-close">×</button>
        </div>
        <div class="wb-drag">
          <button type="button" class="object-window-icon" tabindex="-1"></button>
          <div class="object-window-handle" tabindex="0" role="button"><div class="wb-title"></div></div>
        </div>
      </div><div class="wb-body"></div><div class="wb-n"></div><div class="wb-s"></div><div class="wb-e"></div><div class="wb-w"></div><div class="wb-ne"></div><div class="wb-nw"></div><div class="wb-se"></div><div class="wb-sw"></div>`;
      const { x: initialPixelX, y: initialPixelY } = windowPoint(
        { window_x: x, window_y: y, window_width: width, window_height: height },
        { width: innerWidth, height: innerHeight }
      );
      const options: WinBox.Params & { template: HTMLElement } = {
        root, hidden: true,
        template, index: 20, header: 18,
        class: ["object-window", "@container", "no-full", "no-max", "no-animation", windowClass].filter(Boolean).join(" "),
        width, height,
        minwidth: Math.min(180, width),
        minheight: Math.min(100, height),
        top: 18, left: 12, right: 12, bottom: 12,
        x: initialPixelX ?? origin.left + 24,
        y: initialPixelY ?? origin.top + 16,
        onclose(force) {
          if (force) return false;
          if (closing.current) return true;
          closing.current = true;
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
      frame.dataset.windowId = thingId;
      frame.inert = !visible.current;
      let sizing = false;
      const resizeStart = (event: PointerEvent) => { sizing = event.target instanceof HTMLElement && /^wb-(n|s|e|w|ne|nw|se|sw)$/.test(event.target.className); };
      const resizeEnd = () => {
        if(sizing && !win.max && !isAnimating.current) resizeCallback.current?.({width:Math.round(Number(win.width)),height:Math.round(Number(win.height))});
        sizing=false;
      };
      let moving = false;
      let startPos = { x: 0, y: 0 };
      const moveStart = (event: PointerEvent) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (target.closest('.wb-control')) return;
        if (target.closest('.wb-drag, .wb-header, .object-window-handle')) {
          moving = true;
          startPos = { x: Number(win.x), y: Number(win.y) };
        }
      };
      const moveEnd = () => {
        if (moving && !win.max && !isAnimating.current) {
          const curX = Math.round(Number(win.x));
          const curY = Math.round(Number(win.y));
          if (curX !== Math.round(startPos.x) || curY !== Math.round(startPos.y)) {
            const norm = normalizedWindowPoint(
              { x: curX, y: curY },
              { width: Number(win.width), height: Number(win.height) },
              { width: innerWidth, height: innerHeight }
            );
            moveCallback.current?.({ x: norm.window_x, y: norm.window_y });
          }
        }
        moving = false;
      };
      frame.addEventListener('pointerdown', resizeStart);
      document.addEventListener('pointerup', resizeEnd);
      frame.addEventListener('pointerdown', moveStart);
      document.addEventListener('pointerup', moveEnd);

      const iconButton = frame.querySelector<HTMLButtonElement>(".object-window-icon")!;
      iconButton.title = "Drag to move; click to close";
      // WinBox owns movement; the pointer gesture only distinguishes a click from a drag.
      let iconPress: { id: number; x: number; y: number; moved: boolean } | undefined;
      iconButton.onpointerdown = (event) => {
        if (event.button !== 0 || iconPress) return;
        iconPress = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
        iconButton.setPointerCapture(event.pointerId);
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
      const maxButton = frame.querySelector<HTMLButtonElement>(".wb-max")!;
      const handleMaximize = () => {
        if (closing.current || isAnimating.current) return;
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
            frame.style.borderRadius = "0";
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
            if (visible.current) win.focus();
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
            frame.style.borderRadius = "0";
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

        const siteWindow = (document.querySelector<HTMLElement>(".site-window") ?? root.parentElement?.querySelector<HTMLElement>(".physics-area"));
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
          frame.style.borderRadius = "0";
          if (siteWindow && siteWindow.classList.contains("site-window")) {
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
        frame.style.border = "4px double var(--color-ink)";

        const outerDrag = document.querySelector<HTMLElement>(".site-window-drag");
        if (outerDrag && !outerDrag.textContent?.trim()) {
          const iconSpan = document.createElement("span");
          iconSpan.className = "site-window-icon";
          if (isImageUrl(icon)) {
            const img = document.createElement("img");
            img.src = icon;
            img.alt = "";
            img.className = "site-window-image";
            iconSpan.appendChild(img);
          } else if (icon) {
            iconSpan.textContent = normalizeEmojiPresentation(icon).trim();
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
          if (disposed || !visible.current) return;
          frame.style.setProperty("view-transition-name", "site-window");
          const header = frame.querySelector<HTMLElement>(".wb-header");
          if (header) {
            header.style.setProperty("view-transition-name", "window-titlebar");
          }
          void import("astro:transitions/client")
            .then(async ({ navigate }) => {
              if (disposed) return;
              await navigate(url);
              if (disposed) return;
              // The window survives navigation; undo the outgoing route animation
              // without changing its saved visitor geometry or stacking order.
              frame.style.transition = '';
              frame.style.pointerEvents = '';
              frame.style.boxShadow = '';
              frame.style.border = '';
              frame.style.borderRadius = '';
              frame.style.removeProperty('view-transition-name');
              header?.style.removeProperty('view-transition-name');
              frame.classList.remove('maximizing');
              frame.style.width = `${win.width}px`;
              frame.style.height = `${win.height}px`;
              frame.style.left = `${win.x}px`;
              frame.style.top = `${win.y}px`;
              maxButton.setAttribute('aria-label', `Maximize ${frame.getAttribute('aria-label')} window`);
              isAnimating.current = false;
            })
            .catch(() => { if (!disposed) window.location.assign(url); });
        };

        if (isReducedMotion) {
          redirect();
        } else {
          setTimeout(redirect, 220);
        }
      };
      let lastTriggerTime = 0;
      const triggerMaximize = () => {
        const now = Date.now();
        if (now - lastTriggerTime < 500) return;
        lastTriggerTime = now;
        handleMaximize();
      };

      maxButton.addEventListener("click", (event) => {
        event.stopPropagation();
        event.stopImmediatePropagation();
        event.preventDefault();
        triggerMaximize();
      }, true);

      const header = frame.querySelector<HTMLElement>(".wb-header")!;
      let lastHeaderClick = 0;
      let lastHeaderX = 0;
      let lastHeaderY = 0;

      header.addEventListener("pointerdown", (event) => {
        if ((event.target as HTMLElement).closest(".wb-control, .object-window-icon")) return;
        const now = Date.now();
        const diff = now - lastHeaderClick;
        const dist = Math.hypot(event.clientX - lastHeaderX, event.clientY - lastHeaderY);
        lastHeaderClick = now;
        lastHeaderX = event.clientX;
        lastHeaderY = event.clientY;
        if (diff < 350 && dist < 10) {
          lastHeaderClick = 0;
          event.stopPropagation();
          event.preventDefault();
          triggerMaximize();
        }
      }, true);

      header.addEventListener("dblclick", (event) => {
        if ((event.target as HTMLElement).closest(".wb-control, .object-window-icon")) return;
        event.stopPropagation();
        event.stopImmediatePropagation();
        event.preventDefault();
        triggerMaximize();
      });

      const move = (x: number, y: number) => win.move(
        Math.max(Number(win.left), Math.min(x, innerWidth - Number(win.width) - Number(win.right))),
        Math.max(Number(win.top), Math.min(y, innerHeight - Number(win.height) - Number(win.bottom))),
      );
      // WinBox bounds dragging but does not resize open windows on viewport changes.
      const fit = () => {
        const currentW = Number(win.width) || width;
        const currentH = Number(win.height) || height;
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
        const norm = normalizedWindowPoint(
          { x: Number(win.x), y: Number(win.y) },
          { width: Number(win.width), height: Number(win.height) },
          { width: innerWidth, height: innerHeight }
        );
        moveCallback.current?.({ x: norm.window_x, y: norm.window_y });
      };
      const focus = () => { if (visible.current && !root.closest('[inert]')) win.focus(); };
      // Disabling a focused action blurs to BODY without another focusin.
      const trackFocus = () => { restoreFocus = frame.contains(document.activeElement); };
      document.addEventListener("focusin", trackFocus);
      frame.addEventListener("keydown", keyboard);
      frame.addEventListener("focusin", focus);
      frame.addEventListener("pointerdown", focus);
      window.addEventListener("resize", fit);
      fit();
      if (visible.current && restoreAnimation && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        isAnimating.current = true;
        const targetX = Number(win.x);
        const targetY = Number(win.y);
        const targetW = Number(win.width);
        const targetH = Number(win.height);

        const siteWindow = (document.querySelector<HTMLElement>(".site-window") ?? root.parentElement?.querySelector<HTMLElement>(".physics-area"));
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
          frame.style.borderRadius = "0";
        } else {
          frame.style.top = "0px";
          frame.style.left = "0px";
          frame.style.width = "100vw";
          frame.style.height = "100vh";
        }
        frame.style.boxShadow = "none";
        frame.style.border = "4px double var(--color-ink)";

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
            if (visible.current) {
              win.focus();
              handle.focus({ preventScroll: true });
            }
          }, 240);
        });
      }
      if (visible.current && (!restoreAnimation || matchMedia("(prefers-reduced-motion: reduce)").matches)) {
        win.focus();
        handle.focus({ preventScroll: true });
      }
      setBody(win.body);
      detach = () => {
        frame.removeEventListener('pointerdown', resizeStart);
        document.removeEventListener('pointerup', resizeEnd);
        frame.removeEventListener('pointerdown', moveStart);
        document.removeEventListener('pointerup', moveEnd);
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

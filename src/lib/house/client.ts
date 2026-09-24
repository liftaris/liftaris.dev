import type { CreateGift, EmojiOption, GiftDetail, HouseSnapshot, PlaceObject, Visitor } from "./types";

const TOKEN_KEY = "kaio.house.visitor";
let visitorPromise: Promise<Visitor> | undefined;

export class HouseError extends Error {
  constructor(message: string, readonly status: number, readonly snapshot?: HouseSnapshot) {
    super(message);
    this.name = "HouseError";
  }
}

function token(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const saved = token();
  if (saved) headers.set("Authorization", `Bearer ${saved}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const failure = result && typeof result === "object" ? result as { error?: unknown; snapshot?: HouseSnapshot } : null;
    throw new HouseError(typeof failure?.error === "string" ? failure.error : "That didn’t go through. Please try again.", response.status, failure?.snapshot);
  }
  return result as T;
}

async function restoreOrCreateVisitor(): Promise<Visitor> {
  // Verify persistence before creating a visitor or publishing anything for them.
  try {
    const probe = `${TOKEN_KEY}.check`;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
  } catch {
    throw new Error("Enable browser storage to leave a gift and take it back later.");
  }
  if (token()) {
    const session = await request<{ user: Visitor } | null>("/api/visitors/get-session");
    if (session?.user) return session.user;
    throw new Error("This browser’s visitor identity could not be restored. Please reload and try again.");
  }
  const result = await request<{ token: string; user: Visitor }>("/api/visitors/sign-in/anonymous", { method: "POST", body: "{}" });
  if (!result.token || !result.user) throw new Error("Couldn’t create your visitor identity. Please try again.");
  localStorage.setItem(TOKEN_KEY, result.token);
  return result.user;
}

export function ensureVisitor(): Promise<Visitor> {
  if (!visitorPromise) {
    // Other tabs check storage again after obtaining the same origin-wide lock.
    visitorPromise = (navigator.locks
      ? navigator.locks.request("kaio.house.visitor", restoreOrCreateVisitor)
      : restoreOrCreateVisitor()).catch((error: unknown) => {
      visitorPromise = undefined;
      throw error;
    });
  }
  return visitorPromise;
}

export const getHouse = (signal?: AbortSignal) => request<HouseSnapshot>("/api/house", { signal });
export const getGift = (id: string, signal?: AbortSignal) => request<GiftDetail>(`/api/house/gifts/${encodeURIComponent(id)}`, { signal });
export const createGift = (gift: CreateGift) => request<HouseSnapshot>("/api/house/gifts", { method: "POST", body: JSON.stringify(gift) });
export const reclaimGift = (id: string) => request<HouseSnapshot>(`/api/house/gifts/${encodeURIComponent(id)}`, { method: "DELETE" });
export const placeObject = (placement: PlaceObject) => request<HouseSnapshot>("/api/house/place", { method: "POST", body: JSON.stringify(placement) });
export const suggestEmoji = (text: string, signal?: AbortSignal) => request<{ options: EmojiOption[] }>("/api/house/suggest", { method: "POST", body: JSON.stringify({ text }), signal });

export function watchHouse(onSnapshot: (snapshot: HouseSnapshot) => void): () => void {
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let retries = 0;
  const connect = () => {
    if (disposed) return;
    const url = new URL("/api/house/events", location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    // Public snapshots only. Never put the visitor credential in a socket URL.
    socket = new WebSocket(url);
    socket.onopen = () => {
      retries = 0;
      void getHouse().then((snapshot) => { if (!disposed) onSnapshot(snapshot); }).catch(() => {});
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message.type === "snapshot" && message.snapshot) onSnapshot(message.snapshot);
      } catch { /* Ignore malformed events; a reconnect retrieves the canonical snapshot. */ }
    };
    socket.onclose = () => {
      if (!disposed) timer = setTimeout(connect, Math.min(1000 * 2 ** retries++, 15000));
    };
    socket.onerror = () => socket?.close();
  };
  connect();
  const refresh = () => {
    if (!document.hidden) void getHouse().then((snapshot) => { if (!disposed) onSnapshot(snapshot); }).catch(() => {});
  };
  document.addEventListener("visibilitychange", refresh);
  return () => {
    disposed = true;
    clearTimeout(timer);
    socket?.close();
    document.removeEventListener("visibilitychange", refresh);
  };
}

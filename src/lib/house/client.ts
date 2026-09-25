import type { CreateGift, CreatedGift, EmojiOption, GiftDetail, HouseSnapshot, UpdateGift, Viewer, Visitor } from "./types";

let visitorPromise: Promise<Visitor> | undefined;

export class HouseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "HouseError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const failure = result && typeof result === "object" ? result as { error?: unknown } : null;
    throw new HouseError(typeof failure?.error === "string" ? failure.error : "That didn’t go through. Please try again.", response.status);
  }
  return result as T;
}

async function restoreOrCreateVisitor(): Promise<Visitor> {
  const created = await request<Viewer>("/api/house/me", { method: "POST", body: "{}" });
  const persisted = await request<Viewer>("/api/house/me");
  if (!created.visitor || persisted.visitor?.id !== created.visitor.id) {
    throw new Error("Enable cookies to leave a gift and edit or take it back later.");
  }
  return persisted.visitor;
}

export function ensureVisitor(): Promise<Visitor> {
  if (!visitorPromise) {
    // The server reuses the cookie session after obtaining this origin-wide lock.
    visitorPromise = (typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request("kaio.house.visitor", restoreOrCreateVisitor)
      : restoreOrCreateVisitor()).finally(() => {
      visitorPromise = undefined;
    });
  }
  return visitorPromise;
}

export const getHouse = (signal?: AbortSignal) => request<HouseSnapshot>("/api/house", { signal });
export const getGift = (id: string, signal?: AbortSignal) => request<GiftDetail>(`/api/house/gifts/${encodeURIComponent(id)}`, { signal });
export const createGift = (gift: CreateGift) => request<CreatedGift>("/api/house/gifts", { method: "POST", body: JSON.stringify(gift) });
export const updateGift = (id: string, gift: UpdateGift) => request<HouseSnapshot>(`/api/house/gifts/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(gift) });
export const reclaimGift = (id: string) => request<HouseSnapshot>(`/api/house/gifts/${encodeURIComponent(id)}`, { method: "DELETE" });
export const suggestEmoji = (text: string, signal?: AbortSignal) => request<{ options: EmojiOption[] }>("/api/house/suggest", { method: "POST", body: JSON.stringify({ text }), signal });

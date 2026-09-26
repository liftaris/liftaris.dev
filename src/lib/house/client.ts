import type { CreateGift, CreatedGift, EmojiOption, GiftDetail, HouseSnapshot, UpdateGift, Viewer, Visitor } from "./types";

import { GIFT_API, type GIFT_METHODS } from "./gift-api";

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
    const failure = result && typeof result === "object" ? result as { error?: string | { message?: unknown } } : null;
    const message = typeof failure?.error === "string" ? failure.error : failure?.error?.message;
    throw new HouseError(typeof message === "string" ? message : "That didn’t go through. Please try again.", response.status);
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

export type HouseMutation = <T extends HouseSnapshot>(request: () => Promise<T>) => Promise<T>;

/** One queue per mounted House; accepting the snapshot is part of the mutation. */
export function houseMutations(accept: (snapshot: HouseSnapshot) => void): HouseMutation {
  let pending = Promise.resolve();
  return (request) => {
    const next = pending.then(request).then((snapshot) => { accept(snapshot); return snapshot; });
    pending = next.then(() => {}, () => {});
    return next;
  };
}

async function giftRequest<T>(route: keyof typeof GIFT_METHODS, init: RequestInit = {}, id?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-EmDash-Request", "1");
  const result = await request<{ data: T }>(`${GIFT_API}/${route}${id === undefined ? "" : `?id=${encodeURIComponent(id)}`}`, { ...init, headers });
  return result.data;
}

export const getHouse = (signal?: AbortSignal) => giftRequest<HouseSnapshot>("snapshot", { signal });
export async function getGift(id: string, signal?: AbortSignal): Promise<GiftDetail> {
  try { return await giftRequest<GiftDetail>("gift", { signal }, id); }
  catch (error) {
    // A new browser can read public gifts without creating a CMS identity.
    // Never retry mutations or conceal permission, conflict or server failures.
    if (!(error instanceof HouseError) || error.status !== 401) throw error;
    return giftRequest<GiftDetail>("public-gift", { signal }, id);
  }
}
export const createGift = (gift: CreateGift) => giftRequest<CreatedGift>("create", { method: "POST", body: JSON.stringify(gift) });
export const updateGift = (id: string, gift: UpdateGift) => giftRequest<HouseSnapshot>("update", { method: "PATCH", body: JSON.stringify(gift) }, id);
export const reclaimGift = (id: string) => giftRequest<HouseSnapshot>("gift", { method: "DELETE" }, id);
export const suggestEmoji = (text: string, signal?: AbortSignal) => request<{ options: EmojiOption[] }>("/api/house/suggest", { method: "POST", body: JSON.stringify({ text }), signal });

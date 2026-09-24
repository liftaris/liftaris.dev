import type { Gift } from "../../lib/house/types";

/** Membership updates do not unmount a gift before its local interaction/exit ends. */
export function reconcileGifts(displayed: readonly Gift[], incoming: readonly Gift[]): Gift[] {
  const live = new Map(incoming.map((gift) => [gift.id, gift]));
  const known = new Set(displayed.map((gift) => gift.id));
  return [...displayed.map((gift) => live.get(gift.id) ?? gift), ...incoming.filter((gift) => !known.has(gift.id))];
}

export function retiringGiftIds(displayed: readonly Gift[], incoming: readonly Gift[], protectedIds: readonly (string | null)[]): Set<string> {
  const keep = new Set([...incoming.map((gift) => gift.id), ...protectedIds]);
  return new Set(displayed.filter((gift) => !keep.has(gift.id)).map((gift) => gift.id));
}

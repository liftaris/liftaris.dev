import type { ObjectSpec, Size } from "../../components/clump/model";
import type { EmojiOption, Gift } from "./types";

import catalog from "./emoji-catalog.json";

export const normalizeEmojiPresentation = (emoji: string): string => emoji.replace(/\uFE0F/g, "");
export const EMOJI_CATALOG: readonly EmojiOption[] = catalog;

const byId = new Map<string, EmojiOption>(EMOJI_CATALOG.map((item) => [item.id, item]));

/** Convert any raw emoji string into a valid, decodeable EmojiOption. */
export function emojiToOption(char: string, name = "Icon"): EmojiOption {
  const actualPoints = Array.from(char).map((c) => c.codePointAt(0)!);
  const id = "u_" + actualPoints.map((cp) => cp.toString(16)).join("_");
  return { id, emoji: char, name, keywords: "" };
}

/** Looks up an emoji by registered ID or decodes any unicode hex ID (e.g. 'u_1f600'). */
export const findEmoji = (id: string): EmojiOption | undefined => {
  const found = byId.get(id);
  if (found) return found;
  if (id.length <= 100 && /^u_[0-9a-f]{1,6}(?:_[0-9a-f]{1,6})*$/i.test(id)) {
    const points = id.slice(2).split("_").map(hex => Number.parseInt(hex, 16));
    if (points.every(cp => cp <= 0x10ffff && (cp < 0xd800 || cp > 0xdfff))) {
      const emoji = String.fromCodePoint(...points);
      const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(emoji)];
      if (graphemes.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(emoji)) {
        return { id, emoji, name: "Icon", keywords: "" };
      }
    }
  }
  return undefined;
};

/**
 * Searches the emoji catalog efficiently.
 * - Supports direct emoji input (e.g. pasted emojis or emoji keyboard).
 * - Matches by exact id, name, keywords, prefix, and substrings.
 * - Does NOT impose arbitrary small caps (e.g. 5 items).
 */
export function searchEmojiCatalog(text: string): EmojiOption[] {
  const input = text.trim();
  if (!input) return [...EMOJI_CATALOG];

  const lower = input.toLowerCase();
  const normalizedInput = normalizeEmojiPresentation(input);
  const words = lower.split(/\s+/).filter(Boolean);

  // Check if query contains any raw emoji characters directly
  const customEmojis: EmojiOption[] = [];
  const emojiMatches = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(input)]
    .map(part => part.segment).filter(char => /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(char));
  for (const char of emojiMatches) {
    const existing = EMOJI_CATALOG.find(
      (e) => e.emoji === char || normalizeEmojiPresentation(e.emoji) === normalizeEmojiPresentation(char)
    );
    if (existing) {
      if (!customEmojis.some((e) => e.id === existing.id)) {
        customEmojis.push(existing);
      }
    } else {
      const opt = emojiToOption(char);
      if (!customEmojis.some((e) => e.id === opt.id)) {
        customEmojis.push(opt);
      }
    }
  }

  const scored = EMOJI_CATALOG.map((item, index) => {
    const lowerName = item.name.toLowerCase();
    const lowerKeywords = item.keywords.toLowerCase();
    const tokens = `${lowerName} ${lowerKeywords}`.split(/\s+/);

    const exact =
      lower === item.id ||
      input === item.emoji ||
      normalizedInput === normalizeEmojiPresentation(item.emoji) ||
      lower === lowerName;
    const namePrefix = lowerName.startsWith(lower);

    let score = exact ? 100 : namePrefix ? 50 : 0;
    for (const word of words) {
      if (lowerName.includes(word)) score += 25;
      if (tokens.includes(word)) score += 15;
      else if (tokens.some((token) => token.startsWith(word))) score += 8;
      else if (lowerKeywords.includes(word)) score += 4;
    }
    return { item, score, index };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);

  // Deduplicate items that might be in customEmojis already
  const seen = new Set(customEmojis.map((e) => e.id));
  const result = [...customEmojis];
  for (const item of scored) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }

  return result;
}

export function giftObjects(gifts: readonly Gift[]): ObjectSpec[] {
  return gifts.flatMap((gift) => {
    const emoji = findEmoji(gift.emojiId);
    return emoji ? [{ id: gift.id, name: emoji.name, emoji: emoji.emoji, width: 48, height: 48, isGift: true }] : [];
  });
}

export function worldSize(giftCount: number): Size {
  const growth = Math.max(1, Math.sqrt((10 + giftCount) / 16));
  return { width: Math.ceil(500 * growth), height: Math.ceil(600 * growth) };
}

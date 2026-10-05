import type { EmojiOption } from "./types";

import catalog from "./emoji-catalog.json";

export const normalizeEmojiPresentation = (emoji: string): string => emoji.replace(/\uFE0F/g, "");
export const EMOJI_CATALOG: readonly EmojiOption[] = catalog;

const byId = new Map<string, EmojiOption>(EMOJI_CATALOG.map((item) => [item.id, item]));

export const findEmoji = (id: string): EmojiOption | undefined => byId.get(id);
export const DEFAULT_EMOJI = byId.get('u_1f381')!;

/**
 * Searches the emoji catalog efficiently.
 * - Matches pasted emojis within the catalog.
 * - Matches by exact id, name, keywords, prefix, and substrings.
 * - Does NOT impose arbitrary small caps (e.g. 5 items).
 */
export function searchEmojiCatalog(text: string): EmojiOption[] {
  const input = text.trim();
  if (!input) return [...EMOJI_CATALOG];

  const lower = input.toLowerCase();
  const normalizedInput = normalizeEmojiPresentation(input);
  const words = lower.split(/\s+/).filter(Boolean);

  return EMOJI_CATALOG.map((item, index) => {
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

}

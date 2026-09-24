import { expect, test } from "bun:test";
import { EMOJI_CATALOG, localSuggestions } from "./emoji";

test("catalog fits one Jev Choice and exact emoji names win local fallback", () => {
  expect(EMOJI_CATALOG.length).toBeLessThanOrEqual(255);
  expect(new Set(EMOJI_CATALOG.map((item) => item.id)).size).toBe(EMOJI_CATALOG.length);
  expect(localSuggestions("popcorn")[0].emoji).toBe("🍿");
  expect(localSuggestions("🐙")[0].id).toBe("octopus");
});

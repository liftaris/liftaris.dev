import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GiftDialog } from "../../components/house/GiftDialog";
import { HouseClump } from "../../components/house/HouseClump";
import { houseMutations } from "./client";
import type { Gift, GiftDetail } from "./types";

const gift: Gift = { id: "gift-1", emojiId: "gift", authorName: "Original author", createdAt: "2026-09-24", visibility: "public", message: "Previously public note" };

test("redacted detail replaces old public text and attribution while the private icon remains accessible", () => {
  const hidden: GiftDetail = { ...gift, version: 2, visibility: "private", message: null, authorName: null, canEdit: false, canReclaim: false, canRemove: false };
  const render = (detail: GiftDetail) => renderToStaticMarkup(<GiftDialog gift={gift} initialDetail={detail} onClose={() => {}} onDetail={() => {}} mutate={houseMutations(() => {})} />);
  const html = render(hidden);
  expect(html).not.toContain(gift.message!);
  expect(html).not.toContain(gift.authorName!);
  expect(html).not.toContain("house-attribution");
  const scene = renderToStaticMarkup(<HouseClump gifts={[hidden]} inspectedIds={[]} onOpen={() => {}} />);
  expect(scene).toContain('data-object="gift-1"');
  expect(scene).not.toContain(gift.authorName!);
  const authorized = render({ ...hidden, message: "Private note", authorName: "Stored author", canEdit: true });
  expect(authorized).toContain("Private note");
  expect(authorized).toContain("Stored author");
});

test("visited icons receive data-visited while folders are strictly excluded", () => {
  const visited = new Set(["computer", "gift-1", "portfolio-folder", "writing-folder", "lab-folder"]);
  const scene = renderToStaticMarkup(<HouseClump gifts={[gift]} inspectedIds={[]} visitedIds={visited} onOpen={() => {}} />);
  
  // Visited object and visited gift have data-visited="true"
  expect(scene).toMatch(/data-object="computer"[^>]*data-visited="true"/);
  expect(scene).toMatch(/data-object="gift-1"[^>]*data-visited="true"/);
  
  // Unvisited object has data-visited="false"
  expect(scene).toMatch(/data-object="shoes"[^>]*data-visited="false"/);
  
  // Folders are strictly excluded from visited state even if requested
  expect(scene).toMatch(/data-object="portfolio-folder"[^>]*data-visited="false"/);
  expect(scene).toMatch(/data-object="writing-folder"[^>]*data-visited="false"/);
});

test("thingsConfig tint_when_visited can disable visited tint per thing in clump and folder", () => {
  const visited = new Set(["computer", "shoes", "case"]);
  const thingsConfig = {
    computer: { tint_when_visited: false },
    shoes: { tint_when_visited: true },
  };
  const clumpScene = renderToStaticMarkup(
    <HouseClump gifts={[]} inspectedIds={[]} visitedIds={visited} thingsConfig={thingsConfig} onOpen={() => {}} />
  );
  // Computer was visited but has tint_when_visited: false -> data-visited="false"
  expect(clumpScene).toMatch(/data-object="computer"[^>]*data-visited="false"/);
  // Shoes was visited and has tint_when_visited: true -> data-visited="true"
  expect(clumpScene).toMatch(/data-object="shoes"[^>]*data-visited="true"/);
  // Case was visited with default config -> data-visited="true"
  expect(clumpScene).toMatch(/data-object="case"[^>]*data-visited="true"/);
});


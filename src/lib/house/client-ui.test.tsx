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

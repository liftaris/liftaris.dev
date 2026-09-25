import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GiftDialog } from "../../components/house/GiftDialog";
import type { Gift, GiftDetail } from "./types";

const gift: Gift = { id: "gift-1", emojiId: "gift", authorName: "Original author", createdAt: "2026-09-24", visibility: "public", message: "Previously public note" };
const detail: GiftDetail = { ...gift, canEdit: false, canReclaim: false, canRemove: false };
function render(current: GiftDetail) {
  return renderToStaticMarkup(<GiftDialog gift={gift} initialDetail={current} onClose={() => {}} onSnapshot={() => {}} />);
}

test("authoritative private detail never falls back to an old public message", () => {
  const html = render({ ...detail, visibility: "private", message: null, authorName: "Updated author" });
  expect(html).not.toContain("Previously public note");
  expect(html).toContain("A private note for Kaio");
  expect(html).toContain("From Updated author");
  expect(html).not.toContain("Original author");
});

test("only the gift author is offered editing; site moderation does not imply edit permission", () => {
  expect(render({ ...detail, canEdit: true, canReclaim: true })).toContain("Edit gift");
  expect(render(detail)).not.toContain("Edit gift");
  const ownerView = render({ ...detail, canRemove: true });
  expect(ownerView).not.toContain("Edit gift");
  expect(ownerView).toContain("Remove gift");
});

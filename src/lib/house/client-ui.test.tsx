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

test("isImageUrl correctly identifies image and gif URLs versus emojis", () => {
  const { isImageUrl } = require("../../components/clump/model");
  expect(isImageUrl("🐙")).toBe(false);
  expect(isImageUrl("📦")).toBe(false);
  expect(isImageUrl("hello world")).toBe(false);
  expect(isImageUrl(null)).toBe(false);
  expect(isImageUrl(undefined)).toBe(false);

  expect(isImageUrl("https://media.giphy.com/media/xyz/giphy.gif")).toBe(true);
  expect(isImageUrl("http://example.com/icon.webp")).toBe(true);
  expect(isImageUrl("/_emdash/api/media/file/image123.avif")).toBe(true);
  expect(isImageUrl("/assets/icons/retro.png")).toBe(true);
  expect(isImageUrl("https://example.com/photo.jpeg?w=100")).toBe(true);
  expect(isImageUrl("data:image/webp;base64,AAAA")).toBe(true);
});

test("HouseClump renders <img> for things with image or image URL emoji", () => {
  const customThings = [
    { id: "gif-thing", name: "Dancing Cat", emoji: "🐱", image: "https://example.com/cat.gif", width: 60, height: 60, shape: "rectangle" as const },
    { id: "webp-thing", name: "WebP Icon", emoji: "https://example.com/icon.webp", width: 60, height: 60, shape: "circle" as const },
    { id: "emoji-thing", name: "Standard Emoji", emoji: "🐙", width: 60, height: 60, shape: "circle" as const },
  ];
  const visited = new Set(["gif-thing"]);
  const scene = renderToStaticMarkup(
    <HouseClump gifts={[]} inspectedIds={[]} visitedIds={visited} desktopObjects={customThings} onOpen={() => {}} />
  );

  // Gif thing renders img with GIF url and visited tint
  expect(scene).toContain('<img src="https://example.com/cat.gif" alt="" class="house-object-image"');
  expect(scene).toMatch(/data-object="gif-thing"[^>]*data-visited="true"/);

  // Webp thing renders img from emoji url
  expect(scene).toContain('<img src="https://example.com/icon.webp" alt="" class="house-object-image"');

  // Standard emoji thing renders raw emoji text
  expect(scene).toContain('<span class="house-object-art" aria-hidden="true">🐙</span>');
});

test("Folder renders <img> for items and links with image icons", () => {
  const { FolderContent } = require("../../components/folder/Folder");
  const folderSpec = {
    id: "test-folder",
    name: "Test Folder",
    emoji: "📁",
    kind: "folder" as const,
    items: [
      {
        kind: "item" as const,
        id: "gif-item",
        name: "Animated GIF",
        emoji: "✨",
        image: "/images/sparkle.gif",
        value: { id: "gif-item" },
      },
      {
        kind: "link" as const,
        id: "web-link",
        name: "Website",
        emoji: "🌐",
        image: "https://example.com/globe.avif",
        href: "https://example.com",
      },
      {
        kind: "item" as const,
        id: "text-item",
        name: "Text Emoji",
        emoji: "📝",
        value: { id: "text-item" },
      },
    ],
  };

  const html = renderToStaticMarkup(
    <FolderContent folder={folderSpec} />
  );

  expect(html).toContain('<img src="/images/sparkle.gif" alt="" class="folder-entry-image"');
  expect(html).toContain('<img src="https://example.com/globe.avif" alt="" class="folder-entry-image"');
  expect(html).toContain('<span class="folder-entry-art" aria-hidden="true">📝</span>');
});


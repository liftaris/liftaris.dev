import {isImageUrl,getBackgroundStyle} from "../../components/clump/model";
import {FolderContent} from "../../components/folder/Folder";
import {DEFAULT_THINGS} from "../../components/house/folders";
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GiftDialog } from "../../components/house/GiftDialog";
import { House } from "../../components/house/House";
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

test("isImageUrl correctly identifies image and gif URLs versus emojis", () => {
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
    { id: "gif-thing", name: "Dancing Cat", emoji: "🐱", image: "https://example.com/cat.gif", width: 60, height: 60 },
    { id: "webp-thing", name: "WebP Icon", emoji: "https://example.com/icon.webp", width: 60, height: 60 },
    { id: "emoji-thing", name: "Standard Emoji", emoji: "🐙", width: 60, height: 60 },
  ];
  const scene = renderToStaticMarkup(
    <HouseClump gifts={[]} inspectedIds={[]} desktopObjects={customThings} onOpen={() => {}} />
  );

  // Gif thing renders img with GIF url
  expect(scene).toMatch(/<img src="https:\/\/example\.com\/cat\.gif" alt="" class="house-object-image[^"]*"/);

  // Webp thing renders img from emoji url
  expect(scene).toMatch(/<img src="https:\/\/example\.com\/icon\.webp" alt="" class="house-object-image[^"]*"/);

  // Standard emoji thing renders raw emoji text
  expect(scene).toMatch(/<span class="house-object-art[^"]*"[^>]* aria-hidden="true">🐙<\/span>/);
});

test("Folder renders <img> for items and links with image icons", () => {
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

  expect(html).toMatch(/<img src="\/images\/sparkle\.gif" alt="" class="folder-entry-image[^"]*"/);
  expect(html).toMatch(/<img src="https:\/\/example\.com\/globe\.avif" alt="" class="folder-entry-image[^"]*"/);
  expect(html).toMatch(/<span class="folder-entry-art[^"]*"[^>]* aria-hidden="true">📝<\/span>/);
});

test("getBackgroundStyle converts background properties into expected CSS rules", () => {

  expect(getBackgroundStyle(null)).toBeUndefined();
  expect(getBackgroundStyle(undefined)).toBeUndefined();
  expect(getBackgroundStyle({})).toBeUndefined();
  expect(getBackgroundStyle({ background_image: "" })).toBeUndefined();

  // Basic cover with default center and no-repeat
  const cover = getBackgroundStyle({ background_image: "https://example.com/wallpaper.jpg" });
  expect(cover).toEqual({
    backgroundImage: 'url("https://example.com/wallpaper.jpg")',
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  });

  // Scale (maps to contain) and custom positioning
  const scale = getBackgroundStyle({
    background_image: "/assets/banner.png",
    background_size: "scale",
    background_position: "top left",
    background_repeat: "no-repeat",
  });
  expect(scale).toEqual({
    backgroundImage: 'url("/assets/banner.png")',
    backgroundSize: "contain",
    backgroundPosition: "top left",
    backgroundRepeat: "no-repeat",
  });

  // Tile (maps to repeat with auto size if not specified)
  const tile = getBackgroundStyle({
    background_image: "/assets/grid.svg",
    background_repeat: "tile",
  });
  expect(tile).toEqual({
    backgroundImage: 'url("/assets/grid.svg")',
    backgroundSize: "auto",
    backgroundPosition: "center",
    backgroundRepeat: "repeat",
  });

  // Explicit size and repeat-x
  const repeatX = getBackgroundStyle({
    background_image: "linear-gradient(to right, red, blue)",
    background_size: "100% 4px",
    background_position: "bottom",
    background_repeat: "repeat-x",
  });
  expect(repeatX).toEqual({
    backgroundImage: "linear-gradient(to right, red, blue)",
    backgroundSize: "100% 4px",
    backgroundPosition: "bottom",
    backgroundRepeat: "repeat-x",
  });
});

test("HouseClump keeps folder backgrounds off desktop icons", () => {
  const customThings = [
    {
      id: "bg-thing",
      name: "Tiled Thing",
      emoji: "🎨",
      background_image: "https://example.com/tile.png",
      background_repeat: "repeat",
      background_size: "auto",
      background_position: "center",
      width: 60,
      height: 60,
    },
  ];
  const scene = renderToStaticMarkup(
    <HouseClump gifts={[]} inspectedIds={[]} desktopObjects={customThings} onOpen={() => {}} />
  );

  expect(scene).toContain('data-object="bg-thing"');
  expect(scene).not.toContain('data-has-bg="true"');
  expect(scene).not.toContain("background-image:url(&quot;https://example.com/tile.png&quot;)");
  expect(scene).not.toContain("background-repeat:repeat");
});

test("FolderContent leaves the background on the window surface and off icons", () => {
  const folderSpec = {
    id: "wallpaper-folder",
    name: "Wallpaper Folder",
    emoji: "📁",
    kind: "folder" as const,
    background_image: "/images/folder-bg.webp",
    background_size: "cover",
    background_position: "center",
    background_repeat: "no-repeat",
    items: [
      {
        kind: "item" as const,
        id: "entry-with-bg",
        name: "Pattern Entry",
        emoji: "⭐",
        background_image: "/images/star-pattern.png",
        background_repeat: "tile",
        value: { id: "entry-with-bg" },
      },
    ],
  };

  const html = renderToStaticMarkup(<FolderContent folder={folderSpec} />);

  // The window applies its background once, outside the content grid.
  expect(html).toContain('data-has-bg="true"');
  expect(html).not.toContain("background-image:url(&quot;/images/folder-bg.webp&quot;)");
  expect(html).not.toContain("background-size:cover");

  // Entry artwork does not inherit a window background.
  expect(html).not.toContain("background-image:url(&quot;/images/star-pattern.png&quot;)");
  expect(html).not.toContain("background-repeat:repeat");
});

test("HouseClump renders trash emoji icon at bottom right of landing page physics area", () => {
  const scene = renderToStaticMarkup(
    <HouseClump gifts={[gift]} inspectedIds={[]} onOpen={() => {}} />
  );

  // Trash container at bottom right of physics area
  expect(scene).toMatch(/class="house-trash[^"]*"/);
  expect(scene).toContain('role="region"');
  expect(scene).toContain('aria-label="Trash"');
  expect(scene).toContain('title="Drag gifts here to remove them"');
  expect(scene).toContain("🗑️");

  // Physics area wrapper contains both the viewport and trash element
  expect(scene).toMatch(/class="house-clump-area[^"]*"/);
  expect(scene).toMatch(/class="house-viewport[^"]*"/);

  // Accessible instructions mention senders and admins can drag gifts to trash
  expect(scene).toContain("Senders and admins can drag gifts to the trash icon at the bottom right to remove them.");
});

test("House renders HouseClump containing the trash zone", () => {
  const html = renderToStaticMarkup(<House />);
  expect(html).toMatch(/class="house[^"]*"/);
  expect(html).toMatch(/class="house-trash[^"]*"/);
  expect(html).toContain("🗑️");
});

test("HouseClump trashcan is hidden by default and only shows when a deletable item is dragged", () => {
  // 1. Resting state: no item is dragged -> trashcan is hidden
  const resting = renderToStaticMarkup(
    <HouseClump gifts={[gift]} inspectedIds={[]} onOpen={() => {}} />
  );
  expect(resting).toMatch(/class="house-trash\s[^"]*"/);
  expect(resting).not.toContain('data-visible="true"');
  expect(resting).toMatch(/class="house-trash\s[^"]*"[^>]*aria-hidden="true"/);

  // 2. Dragging a desktop object (non-gift) -> trashcan remains hidden
  const draggingDesktop = renderToStaticMarkup(
    <HouseClump gifts={[gift]} inspectedIds={[]} testDragId="computer" onOpen={() => {}} />
  );
  expect(draggingDesktop).not.toContain('data-visible="true"');
  expect(draggingDesktop).toMatch(/class="house-trash\s[^"]*"[^>]*aria-hidden="true"/);

  // 3. Dragging another visitor's gift when not admin -> trashcan remains hidden
  const otherGift: Gift = { id: "other-gift-99", emojiId: "cake", authorName: "Someone else", createdAt: "2026-09-27", visibility: "public", message: "Hello" };
  const draggingOtherGift = renderToStaticMarkup(
    <HouseClump
      gifts={[gift, otherGift]}
      inspectedIds={[]}
      isAdmin={false}
      sentGiftIds={new Set(["gift-1"])}
      testDragId="other-gift-99"
      onOpen={() => {}}
    />
  );
  expect(draggingOtherGift).not.toContain('data-visible="true"');
  expect(draggingOtherGift).toMatch(/class="house-trash\s[^"]*"[^>]*aria-hidden="true"/);

  // 4. Dragging own gift (in sentGiftIds) as non-admin -> trashcan IS visible
  const draggingOwnGift = renderToStaticMarkup(
    <HouseClump
      gifts={[gift, otherGift]}
      inspectedIds={[]}
      isAdmin={false}
      sentGiftIds={new Set(["gift-1"])}
      testDragId="gift-1"
      onOpen={() => {}}
    />
  );
  expect(draggingOwnGift).toContain('data-visible="true"');
  expect(draggingOwnGift).not.toMatch(/class="house-trash\s[^"]*"[^>]*aria-hidden="true"/);

  // 5. Dragging any gift as admin -> trashcan IS visible
  const draggingAdmin = renderToStaticMarkup(
    <HouseClump
      gifts={[gift, otherGift]}
      inspectedIds={[]}
      isAdmin={true}
      sentGiftIds={new Set()}
      testDragId="other-gift-99"
      onOpen={() => {}}
    />
  );
  expect(draggingAdmin).toContain('data-visible="true"');
  expect(draggingAdmin).not.toMatch(/class="house-trash\s[^"]*"[^>]*aria-hidden="true"/);
});

test("House accepts thingsConfig with default_open and merges with things specs", () => {
  const thingsConfig = {
    computer: { default_open: true },
    shoes: { default_open: false },
  };
  const html = renderToStaticMarkup(<House things={DEFAULT_THINGS} thingsConfig={thingsConfig} />);
  expect(html).toMatch(/class="house[^"]*"/);
  expect(html).toContain('data-object="computer"');
});




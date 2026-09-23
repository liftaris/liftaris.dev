import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { createSeed, markdownToBlocks } from "./migrate-posts.mjs";

describe("EmDash content migration", () => {
  test("preserves every post's URL, date and publication state", () => {
    const seed = createSeed("content/posts");
    expect(seed.content.posts.map((post) => [post.slug, post.data.date, post.status])).toEqual([
      ["Understanding-L-Systems", "2023-03-19T18:50:44.000Z", "published"],
      ["bazaar-ghost", "2025-11-30T00:00:00.000Z", "published"],
      ["building-a-website", "2023-03-09T16:04:44.000Z", "published"],
    ]);
  });
  test("keeps nested lists, inline formatting, links and code", () => {
    const blocks = markdownToBlocks("* Parent **bold**\n  * Child [link](https://example.com)\n\n```js\nconsole.log(1)\n```");
    expect(blocks[0]).toMatchObject({ listItem: "bullet", level: 1 });
    expect(blocks[0].children[1].marks).toContain("strong");
    expect(blocks[1]).toMatchObject({ listItem: "bullet", level: 2 });
    expect(blocks[1].markDefs[0]).toMatchObject({ href: "https://example.com" });
    expect(blocks[2]).toMatchObject({ _type: "code", language: "js", code: "console.log(1)" });
  });
  test("preserves the theme image and all image assets", () => {
    const posts = createSeed("content/posts").content.posts;
    const blocks = posts.flatMap((post) => post.data.content);
    const theme = blocks.find((block) => block._type === "themeImage");
    expect(theme).toMatchObject({ lightSrc: "/BazaarGhost/BG-Vod_Processing_Diagram-Light.png", darkSrc: "/BazaarGhost/BG-Vod_Processing_Diagram-Dark.png", alt: "VOD Processing Diagram" });
    for (const block of blocks) {
      const urls = block._type === "image" ? [block.asset.url] : block._type === "themeImage" ? [block.lightSrc, block.darkSrc] : [];
      for (const url of urls) expect(existsSync(`public${url}`)).toBe(true);
    }
  });
  test("refuses unknown MDX instead of silently losing content", () => {
    expect(() => markdownToBlocks('<Unknown value="x" />')).toThrow("Unsupported Markdown");
  });
});

import { describe, expect, test } from "bun:test";
import path from "node:path";
import { getPostSlugs, isPostSlug, postExists } from "./posts";

const postsDirectory = path.join(process.cwd(), "content/posts");

describe("post discovery", () => {
  test("returns every published Markdown post", () => {
    expect(getPostSlugs(postsDirectory)).toEqual([
      "Understanding-L-Systems",
      "bazaar-ghost",
      "building-a-website",
    ]);
  });

  test("reports whether a post exists", () => {
    expect(postExists("bazaar-ghost", postsDirectory)).toBe(true);
    expect(postExists("does-not-exist", postsDirectory)).toBe(false);
  });

  test("rejects path traversal", () => {
    expect(postExists("../about", postsDirectory)).toBe(false);
  });

  test("uses one filename policy for discovery and lookup", () => {
    expect(isPostSlug("release-notes")).toBe(true);
    expect(isPostSlug("release_notes")).toBe(false);
    expect(isPostSlug("../about")).toBe(false);
  });
});

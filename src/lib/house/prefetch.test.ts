import { describe, expect, test } from "bun:test";
import { getThingPrefetchUrls } from "./prefetch";

describe("prefetch helper", () => {
  test("resolves github url", () => {
    expect(getThingPrefetchUrls({ id: "github" })).toEqual(["/github"]);
  });

  test("resolves projects url for computer or action", () => {
    expect(getThingPrefetchUrls({ id: "computer" })).toEqual(["/projects"]);
    expect(getThingPrefetchUrls({ id: "custom", action: "projects" })).toEqual(["/projects"]);
  });

  test("resolves experience url for case or action", () => {
    expect(getThingPrefetchUrls({ id: "case" })).toEqual(["/experience"]);
    expect(getThingPrefetchUrls({ id: "custom", action: "experience" })).toEqual(["/experience"]);
  });

  test("resolves blog post url and window iframe url", () => {
    expect(getThingPrefetchUrls({ id: "post-1", kind: "post", href: "/blog/my-post" })).toEqual([
      "/blog/my-post",
      "/blog/my-post?window=1",
    ]);
  });

  test("resolves page url and window iframe url", () => {
    expect(getThingPrefetchUrls({ id: "about", kind: "page", href: "/p/about" })).toEqual([
      "/p/about",
      "/p/about?window=1",
    ]);
    expect(getThingPrefetchUrls({ id: "about", kind: "page" })).toEqual([
      "/p/about",
      "/p/about?window=1",
    ]);
  });

  test("returns empty array for regular objects or gifts without routes", () => {
    expect(getThingPrefetchUrls({ id: "octopus", kind: "object" })).toEqual([]);
    expect(getThingPrefetchUrls({ id: "shoes", kind: "object" })).toEqual([]);
    expect(getThingPrefetchUrls(null)).toEqual([]);
  });
});

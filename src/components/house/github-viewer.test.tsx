import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GITHUB_THING, DEFAULT_THINGS } from "./folders";
import { House } from "./House";
import { GitHubViewer } from "./GitHubViewer";
import { GET } from "../../pages/api/github/contributions";

import type { APIContext } from "astro";

describe("GitHub custom Thing", () => {
  test("GITHUB_THING is defined as a custom object and is NOT in DEFAULT_THINGS (not in CMS)", () => {
    expect(GITHUB_THING.id).toBe("github");
    expect(GITHUB_THING.name).toBe("GitHub");
    expect(GITHUB_THING.desktop).toBe(true);
    expect(GITHUB_THING.image).toBe("/github.svg");
    expect(GITHUB_THING.shape).toBe("circle");

    // Must not be in CMS-seeded DEFAULT_THINGS
    expect(DEFAULT_THINGS.some((t) => t.id === "github")).toBe(false);
  });

  test("House renders the GitHub Thing on the desktop clump", () => {
    const html = renderToStaticMarkup(<House />);
    expect(html).toContain('data-object="github"');
    expect(html).toContain('src="/github.svg"');
  });

  test("GitHubViewer renders commit rectangles and View on GitHub button", () => {
    const html = renderToStaticMarkup(<GitHubViewer />);

    // Renders the profile handle
    expect(html).toContain("@liftaris");

    // Renders commit day rectangles
    expect(html).toContain('class="github-day"');
    expect(html).toContain('data-level="0"');

    // Renders View on GitHub button with target link
    expect(html).toContain('href="https://github.com/liftaris"');
    expect(html).toContain("View on GitHub");
    expect(html).toContain("github-view-button");
  });

  test("API route GET /api/github/contributions returns JSON with username and days", async () => {
    const response = await GET({} as unknown as APIContext);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { username: string; total: number; days: unknown[] };
    expect(body.username).toBe("liftaris");
    expect(typeof body.total).toBe("number");
    expect(Array.isArray(body.days)).toBe(true);
    expect(body.days.length).toBeGreaterThan(0);
  });

  test("github-viewer.css styles window to fit commit graph without scrollbars", async () => {
    const css = await Bun.file(new URL("./github-viewer.css", import.meta.url).pathname).text();
    expect(css).toContain(".winbox.github-window .wb-body");
    expect(css).toContain("overflow: hidden !important;");
    expect(css).toContain("overflow: visible !important;");
  });
});

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

  test("github-viewer.css styles window to fit commit graph with responsive scrolling", async () => {
    const css = await Bun.file(new URL("./github-viewer.css", import.meta.url).pathname).text();
    expect(css).toContain(".winbox.github-window .wb-body");
    expect(css).toContain("overflow: auto;");
    expect(css).toContain("overflow-x: auto;");
  });

  test("window.css styles window titlebar icon to fit within header", async () => {
    const css = await Bun.file(new URL("../window/window.css", import.meta.url).pathname).text();
    expect(css).toContain(".object-window-icon");
    expect(css).toContain("width: 18px;");
    expect(css).toContain("height: 18px;");
    expect(css).toContain(".object-window-image");
    expect(css).toContain("width: 16px;");
    expect(css).toContain("height: 16px;");
  });

  test("window.css styles maximize button with square glyph", async () => {
    const css = await Bun.file(new URL("../window/window.css", import.meta.url).pathname).text();
    expect(css).toContain(".wb-max .wb-max-square");
    expect(css).toContain("border: 1.5px solid currentColor;");
    expect(css).toContain(".object-window .wb-max .wb-restore-square {\n  display: none;\n}");
    expect(css).toContain(".wb-restore-square::after");
    expect(css).toContain("body.desktop-collapsed .winbox.object-window");
  });

  test("Portfolio.astro defines outermost site-window with close button to homepage", async () => {
    const astroLayout = await Bun.file(new URL("../../layouts/Portfolio.astro", import.meta.url).pathname).text();
    expect(astroLayout).toContain('class="site-window"');
    expect(astroLayout).toContain('class="site-window-header"');
    expect(astroLayout).toContain('class="site-window-close"');
    expect(astroLayout).toContain('href="/"');
    expect(astroLayout).toContain("liftaris:collapse-desktop");
  });

  test("public/face.svg exists as an SVG avatar icon", async () => {
    const svg = await Bun.file(new URL("../../../public/face.svg", import.meta.url).pathname).text();
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  test("src/pages/github.astro exists and renders GitHubViewer", async () => {
    const pageText = await Bun.file(new URL("../../pages/github.astro", import.meta.url).pathname).text();
    expect(pageText).toContain("GitHubViewer");
    expect(pageText).toContain("Portfolio");
  });

  test("global.css and house.css define site-window and pinned-face-avatar", async () => {
    const globalCss = await Bun.file(new URL("../../styles/global.css", import.meta.url).pathname).text();
    expect(globalCss).toContain(".site-window");
    expect(globalCss).toContain(".site-window-header");
    expect(globalCss).toContain("height: 18px;");
    expect(globalCss).toContain(".site-window-close");
    expect(globalCss).toContain(".site-window-icon");
    expect(globalCss).toContain(".site-window-title");

    const houseCss = await Bun.file(new URL("./house.css", import.meta.url).pathname).text();
    expect(houseCss).toContain(".pinned-face-avatar");
    expect(houseCss).toContain("position: fixed;");
  });

  test("Portfolio.astro renders title and icon for subroutes and empty header for home", async () => {
    const astroLayout = await Bun.file(new URL("../../layouts/Portfolio.astro", import.meta.url).pathname).text();
    expect(astroLayout).toContain("windowTitle");
    expect(astroLayout).toContain("windowIcon");
    expect(astroLayout).toContain("site-window-icon");
    expect(astroLayout).toContain("site-window-title");
    expect(astroLayout).toContain("!isHome");
  });

  test("ObjectWindow bounds maximize and dragging below 18px outermost titlebar with no border spacing", async () => {
    const code = await Bun.file(new URL("../window/ObjectWindow.tsx", import.meta.url).pathname).text();
    expect(code).toContain("top: 19");
    expect(code).toContain('frame.style.top = "0px"');
    expect(code).toContain('frame.style.height = "100vh"');
    expect(code).toContain('frame.style.border = "none"');
    expect(code).toContain("wb-restore-square");

    const windowCss = await Bun.file(new URL("../window/window.css", import.meta.url).pathname).text();
    expect(windowCss).toContain(".winbox.object-window.max");
    expect(windowCss).toContain("top: 18px !important");
    expect(windowCss).toContain("left: 0px !important");
    expect(windowCss).toContain("width: 100vw !important");
    expect(windowCss).toContain("height: calc(100vh - 18px) !important");
    expect(windowCss).toContain(".object-window:has(.folder) .object-window-content");
    expect(windowCss).toContain(".winbox.object-window.restoring");
  });

  test("ObjectWindow and Portfolio support minimizing animation and view transition from route", async () => {
    const code = await Bun.file(new URL("../window/ObjectWindow.tsx", import.meta.url).pathname).text();
    expect(code).toContain("restoreAnimation");
    expect(code).toContain('frame.classList.add("restoring")');
    expect(code).toContain("win.restore()");

    const astroLayout = await Bun.file(new URL("../../layouts/Portfolio.astro", import.meta.url).pathname).text();
    expect(astroLayout).toContain("startViewTransition");
    expect(astroLayout).toContain(".site-window-max");

    const houseCode = await Bun.file(new URL("./House.tsx", import.meta.url).pathname).text();
    expect(houseCode).toContain("restoreAnimation");
  });

  test("public/face.webp exists and House renders face.webp", async () => {
    const webpExists = await Bun.file(new URL("../../../public/face.webp", import.meta.url).pathname).exists();
    expect(webpExists).toBe(true);

    const houseCode = await Bun.file(new URL("./House.tsx", import.meta.url).pathname).text();
    expect(houseCode).toContain('src="/face.webp"');
    expect(houseCode).toContain('createPortal(');
    expect(houseCode).toContain('document.body');
    expect(houseCode).toContain('urlParams?.get("restore")');
  });

  test("subroutes have white paper background and no pane blur animation", async () => {
    const globalCss = await Bun.file(new URL("../../styles/global.css", import.meta.url).pathname).text();
    expect(globalCss).toContain(".site-window:not([data-home=\"true\"])");
    expect(globalCss).toContain(".pane {\n  animation: none;\n}");
    expect(globalCss).toContain(".wb-restore-square");
  });
});

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GITHUB_THING } from "./folders";
import { House } from "./House";
import { GitHubViewer } from "./GitHubViewer";
import { GET } from "../../pages/api/github/contributions";

import type { APIContext } from "astro";

describe("GitHub custom Thing", () => {
  test("an empty CMS does not recreate default or GitHub objects", () => {
    const html = renderToStaticMarkup(<House things={[]} />);
    expect(html).not.toContain('data-object="github"');
    expect(html).not.toContain('data-object="computer"');
  });

  test("House renders the GitHub Thing on the desktop clump", () => {
    const html = renderToStaticMarkup(<House things={[{...GITHUB_THING,kind:"page",page_source:"github"}]} />);
    expect(html).toContain('data-object="github"');
    expect(html).toContain('src="/github.svg"');
  });

  test("GitHubViewer renders commit rectangles and View on GitHub button", () => {
    const html = renderToStaticMarkup(<GitHubViewer />);

    // Renders the profile handle
    expect(html).toContain("@liftaris");

    // Renders commit day rectangles
    expect(html).toContain("github-day");
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

  test("global.css and GitHubViewer style window to fit commit graph with responsive scrolling", async () => {
    const css = await Bun.file(new URL("../../styles/global.css", import.meta.url).pathname).text();
    expect(css).toContain(".winbox.github-window .wb-body");
    expect(css).toContain("overflow: auto;");
    const viewerCode = await Bun.file(new URL("./GitHubViewer.tsx", import.meta.url).pathname).text();
    expect(viewerCode).toContain("overflow-x-auto");
  });

  test("global.css styles window titlebar icon to fit within header", async () => {
    const css = await Bun.file(new URL("../../styles/global.css", import.meta.url).pathname).text();
    expect(css).toContain(".object-window-icon");
    expect(css).toContain("width: 18px;");
    expect(css).toContain("height: 18px;");
    expect(css).toContain(".object-window-image");
    expect(css).toContain("width: 16px;");
    expect(css).toContain("height: 16px;");
  });

  test("global.css styles maximize button with square glyph", async () => {
    const css = await Bun.file(new URL("../../styles/global.css", import.meta.url).pathname).text();
    expect(css).toContain(".wb-max .wb-max-square");
    expect(css).toContain("border: 1.5px solid currentColor;");
    expect(css).toContain(".object-window .wb-max .wb-restore-square {\n  display: none;\n}");
    expect(css).toContain(".wb-restore-square::after");
  });

  test("Portfolio.astro defines outermost site-window with close button to homepage", async () => {
    const astroLayout = await Bun.file(new URL("../../layouts/Portfolio.astro", import.meta.url).pathname).text();
    expect(astroLayout).toContain('class="site-window');
    expect(astroLayout).toContain('class="site-window-header"');
    expect(astroLayout).toContain('class="site-window-close"');
    expect(astroLayout).toContain('href="/"');
    expect(astroLayout).toContain('class="physics-area');
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

  test("global.css defines site-window and physics-area", async () => {
    const globalCss = await Bun.file(new URL("../../styles/global.css", import.meta.url).pathname).text();
    expect(globalCss).toContain(".site-window");
    expect(globalCss).toContain(".site-window-header");
    expect(globalCss).toContain("height: 18px;");
    expect(globalCss).toContain(".site-window-close");
    expect(globalCss).toContain(".site-window-icon");
    expect(globalCss).toContain(".site-window-title");
    expect(globalCss).toContain(".physics-area");
    expect(globalCss).toContain("border: none;");
  });

  test("Portfolio.astro renders title and icon for subroutes and physics area for home", async () => {
    const astroLayout = await Bun.file(new URL("../../layouts/Portfolio.astro", import.meta.url).pathname).text();
    expect(astroLayout).toContain("windowTitle");
    expect(astroLayout).toContain("windowIcon");
    expect(astroLayout).toContain("site-window-icon");
    expect(astroLayout).toContain("site-window-title");
    expect(astroLayout).toContain("physics-area");
  });

  test("ObjectWindow bounds maximize and dragging below 18px outermost titlebar with no border spacing", async () => {
    const code = await Bun.file(new URL("../window/ObjectWindow.tsx", import.meta.url).pathname).text();
    expect(code).toContain("top: 18");
    expect(code).toContain('frame.style.top = "0px"');
    expect(code).toContain('frame.style.height = "100vh"');
    expect(code).toContain('frame.style.border = "none"');
    expect(code).toContain("wb-restore-square");

    const windowCss = await Bun.file(new URL("../../styles/global.css", import.meta.url).pathname).text();
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
    expect(code).toContain("root: document.body");
    expect(code).toContain("restoreAnimation");
    expect(code).toContain('frame.classList.add("restoring")');
    expect(code).toContain("win.restore()");

    const astroLayout = await Bun.file(new URL("../../layouts/Portfolio.astro", import.meta.url).pathname).text();
    expect(astroLayout).toContain("startViewTransition");
    expect(astroLayout).toContain(".site-window-max");

    const houseCode = await Bun.file(new URL("./House.tsx", import.meta.url).pathname).text();
    expect(houseCode).toContain("restoreAnimation");
  });

  test("public/face.webp exists", async () => {
    const webpExists = await Bun.file(new URL("../../../public/face.webp", import.meta.url).pathname).exists();
    expect(webpExists).toBe(true);

    const houseCode = await Bun.file(new URL("./House.tsx", import.meta.url).pathname).text();
    expect(houseCode).toContain('urlParams?.get("restore")');
  });

  test("subroutes have white paper background and no pane blur animation", async () => {
    const globalCss = await Bun.file(new URL("../../styles/global.css", import.meta.url).pathname).text();
    expect(globalCss).toContain(".site-window {");
    expect(globalCss).toContain("background: var(--color-paper);");
    expect(globalCss).toContain(".pane {\n  animation: none;\n}");
    expect(globalCss).toContain(".wb-restore-square");
  });

  test("window titlebar uses ink background and border is 4px double ink with no radius", async () => {
    const globalCss = await Bun.file(new URL("../../styles/global.css", import.meta.url).pathname).text();
    expect(globalCss).toContain(".site-window-header {\n  height: 18px;\n  line-height: 18px;\n  background: var(--ink);\n  border-bottom: 1px solid var(--ink);");
    expect(globalCss).toContain(".winbox .wb-header,\n.object-window .wb-header {\n  height: 18px;\n  line-height: 18px;\n  overflow: hidden;\n  background: var(--ink);\n  border-bottom: 1px solid var(--ink);");
    expect(globalCss).toContain(".site-window {\n  display: flex;\n  flex-direction: column;\n  box-sizing: border-box;\n  position: relative;\n  z-index: 1;\n  overflow: hidden;\n  border-radius: 0;\n  background: var(--color-paper);\n  border: 4px double var(--ink);");
    expect(globalCss).toContain(".winbox,\n.winbox.object-window {\n  color: var(--ink);\n  background: var(--color-paper);\n  border: 4px double var(--ink);\n  border-radius: 0;\n  box-shadow: 8px 8px 0px #00000047;");
    expect(globalCss).not.toContain("backdrop-filter: blur");

    const objectWindowCode = await Bun.file(new URL("../window/ObjectWindow.tsx", import.meta.url).pathname).text();
    expect(objectWindowCode).toContain("normalizeEmojiPresentation(icon).trim()");
    expect(objectWindowCode).toContain('frame.style.border = "4px double var(--ink)"');
  });

  test("window titlebar focus behavior has outline only on buttons, not titlebar or icon", async () => {
    const globalCss = await Bun.file(new URL("../../styles/global.css", import.meta.url).pathname).text();
    expect(globalCss).toContain(".object-window-handle:focus-visible");
    expect(globalCss).toContain(".object-window-icon:focus-visible");
    expect(globalCss).toContain(".object-window .wb-control button:focus-visible");
    expect(globalCss).toContain(".site-window-max:focus-visible");
    expect(globalCss).toContain(".site-window-close:focus-visible");

    const objectWindowCode = await Bun.file(new URL("../window/ObjectWindow.tsx", import.meta.url).pathname).text();
    expect(objectWindowCode).toContain('class="object-window-icon" tabindex="-1"');
    expect(objectWindowCode).not.toContain("iconButton.focus(");
  });
});


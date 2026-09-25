// Run against an already initialized local dev server: bun scripts/verify-windows-browser.ts <url>
import assert from "node:assert/strict";

const url = new URL(process.argv[2] ?? "http://127.0.0.1:4321");
assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Use a local server");
const session = `windows-${crypto.randomUUID()}`;
function browser(...args: string[]): Record<string, unknown> {
  const process = Bun.spawnSync(["bun", "x", "agent-browser@0.38.1", "--json", "--session", session, ...args], { timeout: 35_000 });
  const output = JSON.parse(process.stdout.toString().split("\n").filter((line) => line.startsWith("{")).at(-1) ?? "null");
  assert(output?.success, output?.error ?? process.stderr.toString());
  return output.data;
}
function evaluate<T>(expression: string): T { return browser("eval", expression).result as T; }
async function until(expression: string) {
  const end = Date.now() + 10_000;
  do {
    if (evaluate<boolean>(`Boolean(${expression})`)) return;
    await Bun.sleep(100);
  } while (Date.now() < end);
  throw new Error(`Timed out: ${expression}`);
}
const windowFor = (title: string) => `.object-window[aria-label="${title}"]`;
const query = (selector: string) => `document.querySelector(${JSON.stringify(selector)})`;
async function open(id: string, title: string) {
  browser("focus", `[data-object="${id}"]`);
  browser("press", "Enter");
  await until(`${query(windowFor(title))}?.winbox && ${query(windowFor(title))}?.querySelector('.object-window-content')`);
}
function rect(selector: string): { x: number; y: number; width: number; height: number } {
  return evaluate(`${query(selector)}.getBoundingClientRect().toJSON()`);
}
async function closed(id: string, title: string) {
  await until(`!${query(windowFor(title))}`);
  assert(evaluate<boolean>(`${query(`[data-object="${id}"]`)}?.getAttribute('aria-expanded')==='false'`));
}
try {
  browser("set", "viewport", "1440", "900");
  browser("open", url.href);
  await until("document.querySelector('.house[data-ready=true]') && document.querySelector('[data-object=octopus]')?.dataset.x");
  await open("octopus", "Octopus");
  assert(evaluate<boolean>("document.querySelector('[data-object=octopus]').getAttribute('aria-expanded')==='true'"));
  const selector = windowFor("Octopus");
  assert(evaluate<boolean>(`(()=>{const w=${query(selector)};const header=w.querySelector('.wb-header');const title=w.querySelector('.wb-title');return header.getBoundingClientRect().height <= parseFloat(getComputedStyle(title).fontSize) + 6})()`), "Title bar should closely fit its text height");
  const before = rect(selector);
  const handle = rect(`${selector} .wb-drag`);
  const x = Math.round(handle.x + handle.width / 2), y = Math.round(handle.y + handle.height / 2);
  browser("mouse", "move", String(x), String(y));
  browser("mouse", "down");
  browser("mouse", "move", String(x - 80), String(y - 60));
  browser("mouse", "up");
  const after = rect(selector);
  assert(after.x < before.x - 50 && after.y < before.y - 30, "Dragging must move the window");
  browser("focus", `${selector} .wb-drag`);
  browser("press", "ArrowLeft");
  assert(rect(selector).x < after.x, "Keyboard movement must move the window");
  await open("case", "Experience");
  assert.equal(evaluate("document.querySelectorAll('.object-window').length"), 2);
  evaluate(`${query(selector)}.querySelector('.wb-drag').focus()`);
  assert(evaluate(`${query(selector)}.winbox.focused`), "Keyboard focus raises the window");
  browser("click", `${selector} [aria-label='Minimize window']`);
  await closed("octopus", "Octopus");
  assert(evaluate("document.activeElement?.dataset.object==='octopus'"), "Collapse restores source focus");
  assert.equal(evaluate("document.querySelectorAll('.winbox.min').length"), 0);
  browser("click", `${windowFor("Experience")} [aria-label='Close window']`);
  await closed("case", "Experience");
  console.log("PASS WinBox drag, keyboard movement, stacking, minimize, close and focus restoration");

  await open("octopus", "Octopus");
  browser("click", `${selector} .object-window-icon`);
  await closed("octopus", "Octopus");
  assert(evaluate("document.activeElement?.dataset.object==='octopus'"), "Icon collapse restores source focus");
  for (const key of ["Enter", "Space"]) {
    await open("octopus", "Octopus");
    browser("focus", `${selector} .object-window-icon`);
    browser("press", key);
    await closed("octopus", "Octopus");
  }
  console.log("PASS corner icon collapses by click, Enter and Space");

  for (const [width, height] of [[390, 844], [320, 568], [844, 390]]) {
    browser("set", "viewport", String(width), String(height));
    await open("computer", "Projects");
    assert(evaluate<boolean>(`(()=>{const w=${query(windowFor("Projects"))};const r=w.getBoundingClientRect();const icon=w.querySelector('.object-window-icon').getBoundingClientRect();return r.right<=innerWidth && r.bottom<=innerHeight && icon.left>=0 && icon.top>=0 && document.documentElement.scrollWidth<=innerWidth})()`), `No overflow at ${width}×${height}`);
    browser("press", "Escape");
    await closed("computer", "Projects");
  }
  browser("set", "viewport", "1440", "900");
  await open("computer", "Projects");
  browser("set", "viewport", "320", "568");
  await until(`(()=>{const r=${query(windowFor("Projects"))}.getBoundingClientRect();return r.right<=innerWidth && r.bottom<=innerHeight})()`);
  browser("press", "Escape");
  await closed("computer", "Projects");
  browser("set", "media", "reduced-motion");
  await open("octopus", "Octopus");
  assert(evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"));
  browser("click", `${windowFor("Octopus")} [aria-label='Minimize window']`);
  await closed("octopus", "Octopus");
  assert.equal(evaluate("document.querySelectorAll('.winbox.min').length"), 0);
  assert.deepEqual(browser("errors").errors, []);
  console.log("PASS narrow/landscape layouts, Escape, viewport resize, reduced motion, no browser exceptions");
} finally { browser("close"); }

// Run against an initialized LOCAL dev server: bun scripts/verify-folders-browser.ts <url>
import assert from "node:assert/strict";

const url = new URL(process.argv[2] ?? "http://localhost:4321");
assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Local hosts only");
const session = `folders-${crypto.randomUUID()}`;
function browser(...args: string[]): Record<string, unknown> {
  const result = Bun.spawnSync([process.execPath, "x", "agent-browser@0.38.1", "--json", "--session", session, ...args], { timeout: 35_000 });
  const output = JSON.parse(result.stdout.toString().split("\n").filter((line) => line.startsWith("{")).at(-1) ?? "null");
  assert(output?.success, output?.error ?? result.stderr.toString());
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
const frame = (title: string) => `.object-window[aria-label="${title}"]`;
async function openFolder() {
  browser("focus", "[data-object=portfolio-folder]");
  browser("press", "Enter");
  await until("document.querySelector('[aria-label=Portfolio] .folder')");
}
try {
  browser("set", "viewport", "1440", "900");
  browser("open", url.href);
  await until("document.querySelector('.house[data-ready=true]') && document.querySelector('[data-object=computer]')?.dataset.x");
  assert(evaluate<boolean>("!!document.querySelector('[data-object=portfolio-folder]')"), "The House includes a folder icon");
  await openFolder();
  assert.equal(evaluate<number>("document.querySelectorAll('.folder .folder-entry').length"), 3);
  assert(evaluate<boolean>("document.querySelector('[data-object=portfolio-folder]').getAttribute('aria-expanded')==='true'"));
  assert(evaluate<boolean>("[...document.querySelectorAll('.folder .folder-entry')].every(e=>e.textContent.trim() && e.getBoundingClientRect().height>=44)"), "Folder entries have visible names and usable hit targets");
  if (process.env.TMPDIR) browser("screenshot", `${process.env.TMPDIR}/folder-desktop.png`);
  evaluate("window.parentFolder=document.querySelector('.object-window[aria-label=Portfolio]');true");
  browser("click", `${frame("Portfolio")} .folder li:last-child button`);
  await until("document.querySelector('[aria-label=Lab] .folder')");
  assert(evaluate<boolean>("document.querySelector('.object-window[aria-label=Portfolio]')===window.parentFolder && window.parentFolder.isConnected"), "Opening a child preserves its parent window");
  assert(evaluate<boolean>("document.querySelector('.object-window[aria-label=Lab]').parentElement===document.body"), "The child pops out, not into the parent DOM");
  assert.equal(evaluate<number>("document.querySelectorAll('.object-window:has(.folder)').length"), 2, "Both folders remain open as peers");
  assert(evaluate<boolean>("window.parentFolder.querySelector('.folder li:last-child button').getAttribute('aria-expanded')==='true'"), "The parent tracks the open child");
  evaluate("window.parentFolder.querySelector('.folder li:last-child button').click();true");
  assert.equal(evaluate<number>("document.querySelectorAll('.object-window[aria-label=Lab]').length"), 1, "Opening a child twice does not duplicate its window");
  assert.equal(evaluate<string>("document.querySelector('.folder a').getAttribute('href')"), "/lab/clump");
  assert(evaluate<boolean>("document.activeElement?.closest('.object-window')?.getAttribute('aria-label')==='Lab'"), "Focus follows the child window");
  if (process.env.TMPDIR) browser("screenshot", `${process.env.TMPDIR}/folders-open-desktop.png`);
  browser("press", "Escape");
  await until("!document.querySelector('.object-window[aria-label=Lab]')");
  assert(evaluate<boolean>("document.activeElement===window.parentFolder.querySelector('.folder li:last-child button') && document.activeElement.getAttribute('aria-expanded')==='false'"), "Closing a child returns to its parent entry");
  browser("press", "Escape");
  await until("!document.querySelector('.folder')");
  assert(evaluate<boolean>("document.activeElement?.dataset.object==='portfolio-folder'"), "Closing restores the folder trigger");
  await openFolder();
  assert.equal(evaluate<number>("document.querySelectorAll('.folder .folder-entry').length"), 3, "Reopening starts at the root, not the previous child");
  browser("press", "Escape");
  await until("!document.querySelector('.folder')");
  await openFolder();
  browser("click", `${frame("Portfolio")} .folder li:nth-child(2) button`);
  await until("document.querySelector('[aria-label=Experience] .experiencePane')");
  assert.equal(evaluate<number>("document.querySelectorAll('.object-window').length"), 2, "Items open independent content windows without closing the folder");
  browser("press", "Escape");
  await until("!document.querySelector('.object-window[aria-label=Experience]')");
  assert(evaluate<boolean>("document.activeElement?.closest('.folder') && !document.activeElement.disabled"), "Closing an item returns to its enabled folder entry");
  browser("press", "Enter");
  await until("document.querySelector('[aria-label=Experience] .experiencePane')");
  browser("focus", `${frame("Portfolio")} .folder li:last-child button`);
  browser("press", "Enter");
  await until("document.querySelector('[aria-label=Lab] .folder')");
  browser("focus", `${frame("Portfolio")} .object-window-handle`);
  browser("press", "Escape");
  await until("!document.querySelector('.object-window[aria-label=Portfolio]')");
  assert(evaluate<boolean>("!!document.querySelector('.object-window[aria-label=Experience]') && !!document.querySelector('.object-window[aria-label=Lab]')"), "Closing a parent leaves child folders and content windows open");
  browser("focus", `${frame("Experience")} .object-window-handle`);
  browser("press", "Escape");
  await until("!document.querySelector('.object-window[aria-label=Experience]')");
  assert(evaluate<boolean>("document.activeElement?.dataset.object==='case'"), "A detached folder entry falls back to the item's House icon");
  await openFolder();
  assert(evaluate<boolean>("document.querySelector('[data-folder-entry=lab-folder]').getAttribute('aria-expanded')==='true'"), "A reopened parent recognizes the existing child");
  assert.equal(evaluate<number>("document.querySelectorAll('.object-window:has(.folder)').length"), 2);
  browser("focus", `${frame("Lab")} .object-window-handle`);
  browser("press", "Escape");
  await until("!document.querySelector('.object-window[aria-label=Lab]')");
  assert(evaluate<boolean>("document.activeElement===document.querySelector('[data-folder-entry=lab-folder]')"), "A child returns focus to the reopened parent's live entry");
  browser("press", "Escape");
  await until("!document.querySelector('.folder')");
  for (const [width, height] of [[390, 844], [320, 568], [844, 390]]) {
    browser("set", "viewport", String(width), String(height));
    await openFolder();
    assert(evaluate<boolean>("(()=>{const w=document.querySelector('.object-window');const r=w.getBoundingClientRect();const b=w.querySelector('.wb-body');return r.right<=innerWidth && r.bottom<=innerHeight && b.scrollWidth<=b.clientWidth && document.documentElement.scrollWidth<=innerWidth})()"), `Folder fits ${width}×${height}`);
    if (width === 390 && process.env.TMPDIR) browser("screenshot", `${process.env.TMPDIR}/folder-mobile.png`);
    browser("focus", `${frame("Portfolio")} .folder li:last-child button`);
    browser("press", "Space");
    await until("document.querySelector('[aria-label=Lab] .folder')");
    assert(evaluate<boolean>("(()=>{const w=document.querySelector('.object-window[aria-label=Lab]');const r=w.getBoundingClientRect();const icon=w.querySelector('.object-window-icon').getBoundingClientRect();return r.right<=innerWidth && r.bottom<=innerHeight && icon.left>=0 && icon.top>=0})()"), `Popped-out child fits ${width}×${height}`);
    if (width === 390 && process.env.TMPDIR) browser("screenshot", `${process.env.TMPDIR}/folders-open-mobile.png`);
    browser("click", `${frame("Lab")} .object-window-icon`);
    await until("!document.querySelector('.object-window[aria-label=Lab]')");
    assert(evaluate<boolean>("document.activeElement?.closest('.object-window')?.getAttribute('aria-label')==='Portfolio'"));
    browser("press", "Escape");
    await until("!document.querySelector('.folder')");
    assert(evaluate<boolean>("document.activeElement?.dataset.object==='portfolio-folder'"));
  }
  browser("set", "media", "reduced-motion");
  await openFolder();
  browser("click", `${frame("Portfolio")} .folder li:last-child button`);
  await until("document.querySelector('[aria-label=Lab] .folder')");
  browser("click", `${frame("Lab")} [aria-label='Close window']`);
  await until("!document.querySelector('.object-window[aria-label=Lab]')");
  assert(evaluate<boolean>("!!document.querySelector('.object-window[aria-label=Portfolio]')"));
  browser("press", "Escape");
  await until("!document.querySelector('.folder')");
  assert(evaluate<boolean>("document.activeElement?.dataset.object==='portfolio-folder'"));
  assert.deepEqual(browser("errors").errors, []);
  console.log("PASS folder icon, labeled contents, persistent parent, duplicate prevention, links and focus");
  console.log("PASS independent child/item windows and focus recovery after parent closure");
  console.log("PASS phone, narrow phone, landscape, Space, icon collapse and reduced motion");
} finally { browser("close"); }

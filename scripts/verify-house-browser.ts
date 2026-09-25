// Run against an already initialized, disposable LOCAL Worker: bun scripts/verify-house-browser.ts <url>
// Requires Chromium for `bunx agent-browser@0.38.1` (install with its `install` command).
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = new URL(process.argv[2] ?? "http://127.0.0.1:8787");
assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Refusing to create test gifts on a non-local host");
const directory = await mkdtemp(join(tmpdir(), "house-browser-"));
const init = join(directory, "sockets.js");
await Bun.write(init, `window.probeSockets=[];window.probeOffline=false;
const Native=window.WebSocket;
window.WebSocket=class extends Native {
  constructor(...args){super(...args);window.probeSockets.push(this);if(window.probeOffline)this.addEventListener('open',()=>this.close());this.addEventListener('message',event=>{if(this.probeSilent)event.stopImmediatePropagation()});}
  send(data){if(!this.probeSilent)super.send(data);}
};`);
const prefix = `house-${crypto.randomUUID()}`;
const sender = `${prefix}-sender`, visitor = `${prefix}-visitor`;
const created = new Set<string>();
const quote = JSON.stringify;

function browser(session: string, ...args: string[]): Record<string, unknown> {
  const result = Bun.spawnSync([process.execPath, "x", "agent-browser@0.38.1", "--json", "--session", session, "--init-script", init, ...args], { timeout: 35_000 });
  const lines = result.stdout.toString().split("\n").filter((line) => line.startsWith("{"));
  const output = JSON.parse(lines.at(-1) ?? "null");
  assert(output?.success, output?.error ?? result.stderr.toString());
  return output.data;
}
function evaluate<T>(session: string, expression: string): T {
  return browser(session, "eval", expression).result as T;
}
async function until(session: string, expression: string, timeout = 12_000) {
  const end = Date.now() + timeout;
  do {
    if (evaluate<boolean>(session, expression)) return;
    await Bun.sleep(100);
  } while (Date.now() < end);
  throw new Error(`Timed out: ${expression}`);
}
const node = (id: string) => `document.querySelector(${quote(`[data-object="${id}"]`)})`;
function create(message: string, visibility = "public"): string {
  const id = evaluate<string>(sender, `(async()=>{
    const before=await fetch('/api/house').then(r=>r.json());
    const r=await fetch('/api/house/gifts',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('kaio.house.visitor')},body:JSON.stringify({requestId:crypto.randomUUID(),emojiId:'popcorn',message:${quote(message)},visibility:${quote(visibility)}})});
    const next=await r.json();if(!r.ok)throw Error(JSON.stringify(next));
    return next.gifts.find(g=>!before.gifts.some(old=>old.id===g.id)).id;
  })()`);
  created.add(id);
  return id;
}
function remove(id: string) {
  assert(evaluate<boolean>(sender, `(async()=>{
    const r=await fetch('/api/house/gifts/'+${quote(id)},{method:'DELETE',headers:{Authorization:'Bearer '+localStorage.getItem('kaio.house.visitor')}});
    if(!r.ok)throw Error('Delete failed: '+r.status);
    return !(await r.json()).gifts.some(g=>g.id===${quote(id)});
  })()`));
  created.delete(id);
}

try {
  // Reject redirects before opening browsers, including accidental canonical-host forwarding.
  const response = await fetch(url, { redirect: "manual" });
  assert.equal(response.status, 200, "Initialize the local CMS and visitor migrations before this check");
  for (const session of [sender, visitor]) {
    browser(session, "open", url.href);
    await until(session, "document.querySelector('.house[data-ready=true]') && document.querySelector('[data-object=octopus]')?.dataset.x");
    assert.equal(evaluate<string>(session, "location.origin"), url.origin);
  }
  evaluate(sender, `(async()=>{
    const r=await fetch('/api/visitors/sign-in/anonymous',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const data=await r.json();if(!r.ok)throw Error('Visitor setup failed: '+r.status);
    localStorage.setItem('kaio.house.visitor',data.token);return true;
  })()`);

  const inspected = create("retained public card");
  await until(visitor, `!!${node(inspected)}`);
  browser(visitor, "focus", `[data-object="${inspected}"]`);
  browser(visitor, "press", "Enter");
  await until(visitor, "document.querySelector('.object-window .house-gift-message')?.textContent === 'retained public card'");
  remove(inspected);
  await Bun.sleep(400);
  assert(evaluate<boolean>(visitor, `!!document.querySelector('.object-window') && !!${node(inspected)} && document.querySelector('.house-gift-message')?.textContent === 'retained public card'`));
  evaluate(visitor, `window.departures=[];document.querySelector('.house-world').addEventListener('animationstart',event=>{if(event.target.dataset.removing==='true')window.departures.push(event.target.dataset.object)});true`);
  browser(visitor, "click", "[aria-label='Close gift']");
  await until(visitor, `!${node(inspected)}`);
  assert(evaluate<boolean>(visitor, `window.departures.includes(${quote(inspected)}) && document.activeElement?.id==='gift-draft'`));
  console.log("PASS inspection survives remote deletion, then fades out and restores focus");

  for (const outcome of ["success", "404", "focus moved"] as const) {
    const reclaimed = create("keyboard reclaim");
    await until(sender, `!!${node(reclaimed)}`);
    browser(sender, "focus", `[data-object="${reclaimed}"]`);
    browser(sender, "press", "Enter");
    await until(sender, "!!document.querySelector('.object-window .house-reclaim')");
    if (outcome === "404") {
      remove(reclaimed);
      await Bun.sleep(400);
    }
    browser(sender, "focus", ".object-window .house-reclaim");
    if (outcome === "focus moved") {
      browser(sender, "focus", "[data-object=octopus]");
      evaluate(sender, "document.querySelector('.house-reclaim').click()");
    } else browser(sender, "press", "Enter");
    await until(sender, `!document.querySelector('.object-window') && !${node(reclaimed)}`);
    created.delete(reclaimed);
    if (outcome === "focus moved") assert.equal(evaluate<string>(sender, "document.activeElement?.dataset.object"), "octopus", "Reclaim must not steal focus from outside its window");
    else assert.equal(evaluate<string>(sender, "document.activeElement?.id"), "gift-draft", `Keyboard reclaim restores focus after ${outcome}`);
    console.log(`PASS reclaim focus after ${outcome}`);
  }

  const held = create("held gift");
  await until(visitor, `!!${node(held)}`);
  browser(visitor, "focus", `[data-object="${held}"]`);
  browser(visitor, "press", "ArrowRight");
  await until(visitor, `${node(held)}?.dataset.grabbed==='true'`);
  const addition = create("addition during grab");
  await until(visitor, `!!${node(addition)}`);
  assert(evaluate<boolean>(visitor, `${node(held)}?.dataset.grabbed==='true'`));
  remove(held);
  await Bun.sleep(400);
  assert(evaluate<boolean>(visitor, `${node(held)}?.dataset.grabbed==='true'`));
  browser(visitor, "press", "Enter");
  await until(visitor, `!${node(held)}`);
  assert(!evaluate<boolean>(visitor, "!!document.querySelector('.object-window')"));
  remove(addition);
  console.log("PASS membership changes preserve a grab; deleted held gift departs on release");

  const missed = create("missed deletion");
  await until(visitor, `!!${node(missed)}`);
  evaluate(visitor, "window.probeOffline=true;window.probeSockets.forEach(socket=>socket.close());true");
  remove(missed);
  await Bun.sleep(400);
  assert(evaluate<boolean>(visitor, `!!${node(missed)}`));
  evaluate(visitor, "window.probeOffline=false;true");
  await until(visitor, `!${node(missed)}`, 25_000);
  console.log("PASS reconnect replaces stale membership without reload");

  const stalled = create("half-open connection");
  await until(visitor, `!!${node(stalled)}`);
  evaluate(visitor, "window.probeSockets.filter(socket=>socket.readyState===1).forEach(socket=>socket.probeSilent=true);true");
  remove(stalled);
  await Bun.sleep(400);
  assert(evaluate<boolean>(visitor, `!!${node(stalled)}`));
  evaluate(visitor, "window.dispatchEvent(new Event('pageshow'));true");
  await until(visitor, `!${node(stalled)}`);
  console.log("PASS foreground replaces an OPEN socket that silently drops frames");

  const privateId = create("already authorized private card", "private");
  await until(sender, `!!${node(privateId)}`);
  browser(sender, "focus", `[data-object="${privateId}"]`);
  browser(sender, "press", "Enter");
  await until(sender, "document.querySelector('.house-gift-message')?.textContent === 'already authorized private card'");
  remove(privateId);
  await Bun.sleep(400);
  assert(evaluate<boolean>(sender, `!!document.querySelector('.object-window') && !!${node(privateId)} && document.querySelector('.house-gift-message')?.textContent === 'already authorized private card'`));
  browser(sender, "click", "[aria-label='Close gift']");
  await until(sender, `!${node(privateId)}`);
  console.log("PASS loaded private detail survives deletion until close");

  for (const session of [sender, visitor]) assert.deepEqual(browser(session, "errors").errors, []);
} finally {
  for (const id of created) try { remove(id); } catch (error) { console.error("Test-gift cleanup failed", error); }
  for (const session of [sender, visitor]) try { browser(session, "close"); } catch (error) { console.error("Browser cleanup failed", error); }
  await rm(directory, { recursive: true, force: true });
}

// Run against an initialized, disposable LOCAL CMS: bun scripts/verify-house-browser.ts <url>
// Requires Chromium for `bunx agent-browser@0.38.1` (install with its `install` command).
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CreatedGift, GiftDetail, HouseSnapshot, Viewer } from "../src/lib/house/types";

const url = new URL(process.argv[2] ?? "http://127.0.0.1:8787");
assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Refusing to create test gifts on a non-local host");
const directory = await mkdtemp(join(tmpdir(), "house-browser-"));
const init = join(directory, "http-probe.js");
await Bun.write(init, `(() => {
  if(window.houseProbe)return;
  window.houseProbe={requests:[],sockets:[]};
  const Native=window.WebSocket;
  window.WebSocket=class extends Native {
    constructor(...args){
      // Vite HMR is unrelated; record only attempts to open the retired gift stream.
      if(new URL(args[0],location.href).pathname==='/api/house/events')window.houseProbe.sockets.push(String(args[0]));
      super(...args);
    }
  };
  window.probeFetch=window.fetch.bind(window);
  window.fetch=async(input,options={})=>{
    const path=new URL(input instanceof Request?input.url:input,location.href).pathname;
    if(!path.startsWith('/api/house'))return window.probeFetch(input,options);
    const entry={path,method:options.method??(input instanceof Request?input.method:'GET'),body:options.body,
      credentials:options.credentials??(input instanceof Request?input.credentials:'same-origin'),
      authorization:new Headers(options.headers??(input instanceof Request?input.headers:undefined)).has('Authorization')};
    window.houseProbe.requests.push(entry);
    const response=await window.probeFetch(input,options);
    entry.status=response.status;
    entry.data=await response.clone().json().catch(()=>null);
    return response;
  };
})();`);
const prefix = `house-${crypto.randomUUID()}`;
const sender = `${prefix}-sender`, visitor = `${prefix}-visitor`;
const sessions = [sender, visitor];
const opened = new Set<string>();
const created = new Map<string, string>();
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
  throw new Error(`Timed out: ${expression}\n${JSON.stringify(evaluate(session, "({sessionErrors:[...document.querySelectorAll('.house-connection,.house-error')].map(e=>e.textContent),requests:window.houseProbe.requests})"))}`);
}
const node = (id: string) => `document.querySelector(${quote(`[data-object="${id}"]`)})`;
function recorded<T>(session: string, method: string, path: string): T {
  const request = evaluate<{ status: number; data: T } | null>(session, `window.houseProbe.requests.findLast(r=>r.method===${quote(method)} && r.path===${quote(path)}) ?? null`);
  assert(request, `Missing ${method} ${path}`);
  assert.equal(request.status, 200, `${method} ${path}: ${quote(request.data)}`);
  return request.data;
}
// Test reads bypass the observer so it counts only application requests, not the verifier's own reads.
function api<T>(session: string, path: string, method = "GET", body?: unknown, credentials = "same-origin", status = 200): T {
  const result = evaluate<{ status: number; data: T }>(session, `(async()=>{
    if(location.origin!==${quote(url.origin)})throw Error('Refusing an off-origin API request');
    const response=await window.probeFetch(${quote(path)},${quote({ method, credentials, cache: "no-store", redirect: "error", ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: quote(body) }) })});
    return {status:response.status,data:await response.json()};
  })()`);
  assert.equal(result.status, status, `${method} ${path}: ${quote(result.data)}`);
  return result.data;
}
async function mounted(session: string): Promise<Viewer> {
  await until(session, "document.querySelector('.house[data-ready=true]') && document.querySelector('[data-object=leave-gift]')?.dataset.x && window.houseProbe.requests.some(r=>r.path==='/api/house' && r.status===200 && r.data) && window.houseProbe.requests.some(r=>r.path==='/api/house/me' && r.method==='GET' && r.data?.visitor)");
  assert.equal(evaluate<string>(session, "location.origin"), url.origin);
  const initial = recorded<Viewer>(session, "POST", "/api/house/me");
  const persisted = recorded<Viewer>(session, "GET", "/api/house/me");
  assert(initial.visitor, "House mount must initialize a native anonymous session");
  assert.equal(persisted.visitor?.id, initial.visitor.id, "The follow-up GET must verify the session cookie");
  assert.equal(persisted.owner, false, "Named test browsers must not inherit the site owner's session");
  assert.equal(evaluate<string>(session, "window.houseProbe.requests.find(r=>r.path==='/api/house/me' && r.method==='POST').body"), "{}");
  assert.equal(evaluate<string | null>(session, "localStorage.getItem('kaio.house.visitor')"), null, "No legacy bearer token should be stored");
  return persisted;
}
function httpOnly(session: string) {
  assert.deepEqual(evaluate(session, "window.houseProbe.sockets"), [], "No gift WebSocket attempts (Vite HMR excluded)");
  assert.equal(evaluate<number>(session, "window.houseProbe.requests.filter(r=>r.path==='/api/house' && r.method==='GET').length"), 1, "Only the initial snapshot GET: no polling, foreground refresh, or refetch after mutation");
  assert(evaluate<boolean>(session, "window.houseProbe.requests.every(r=>!r.authorization && r.credentials==='same-origin')"), "Application requests must use same-origin cookies, not bearer headers");
  assert.deepEqual(browser(session, "errors").errors, []);
}
async function reload(session: string, identity: Viewer) {
  httpOnly(session);
  browser(session, "reload");
  assert.deepEqual(await mounted(session), identity, "Reload must preserve the native visitor identity");
}
async function openGift(session: string, id: string) {
  await until(session, `!!${node(id)}?.dataset.x`);
  browser(session, "focus", `[data-object="${id}"]`);
  browser(session, "press", "Enter");
  await until(session, `!!document.querySelector('.house-gift-body') && window.houseProbe.requests.some(r=>r.path===${quote(`/api/house/gifts/${id}`)} && r.status===200 && r.data)`);
}
function remove(session: string, id: string) {
  const next = api<HouseSnapshot>(session, `/api/house/gifts/${id}`, "DELETE");
  assert(!next.gifts.some((gift) => gift.id === id));
  api(session, `/api/house/gifts/${id}`, "GET", undefined, "same-origin", 404);
  created.delete(id);
}

try {
  // Reject redirects before opening browsers, including accidental canonical-host forwarding.
  assert.equal((await fetch(url, { redirect: "manual" })).status, 200, "Initialize the disposable local CMS before this check");
  const identities = new Map<string, Viewer>();
  for (const session of sessions) {
    opened.add(session);
    browser(session, "open", url.href);
    identities.set(session, await mounted(session));
  }
  assert.notEqual(identities.get(sender)!.visitor!.id, identities.get(visitor)!.visitor!.id, "Separate browsers must receive separate cookie identities");
  console.log("PASS House mount initializes and verifies two independent native cookie sessions");

  browser(sender, "focus", "[data-object=leave-gift]");
  browser(sender, "press", "Enter");
  await until(sender, "!!document.querySelector('.house-composer')");
  browser(sender, "fill", "#gift-message", "Original public note");
  browser(sender, "fill", "#gift-name", "Original sender");
  browser(sender, "click", ".house-send");
  await until(sender, "window.houseProbe.requests.some(r=>r.path==='/api/house/gifts' && r.method==='POST' && r.data?.createdGiftId)");
  const published = recorded<CreatedGift>(sender, "POST", "/api/house/gifts");
  assert(published.createdGiftId);
  const id = published.createdGiftId;
  created.set(id, sender);
  const path = `/api/house/gifts/${id}`;
  await until(sender, `!!${node(id)} && !document.querySelector('.house-composer') && document.querySelector('.house-gift-message')?.textContent==='Original public note'`);
  assert.deepEqual(published.gifts, api<HouseSnapshot>(sender, "/api/house").gifts, "POST returns a complete public snapshot");
  assert(!evaluate<boolean>(visitor, `!!${node(id)}`), "Other browsers do not receive creations automatically");
  await reload(visitor, identities.get(visitor)!);
  await openGift(visitor, id);
  await until(visitor, "document.querySelector('.house-gift-message')?.textContent==='Original public note'");
  assert(!evaluate<boolean>(visitor, "!!document.querySelector('.house-gift-actions button')"), "A non-sender has no edit or reclaim controls");
  const before = api<GiftDetail>(sender, path);
  assert(before.canEdit && before.canReclaim && !before.canRemove);
  const stranger = api<GiftDetail>(visitor, path);
  assert(!stranger.canEdit && !stranger.canReclaim && !stranger.canRemove);
  api(visitor, path, "PATCH", { emojiId: "gift", message: "Unauthorized edit", visibility: "public" }, "same-origin", 403);
  api(visitor, path, "DELETE", undefined, "same-origin", 403);
  assert.deepEqual(api<GiftDetail>(sender, path), before, "Rejected mutations leave the gift untouched");
  console.log("PASS sender sees its POST immediately; another browser sees it after reload and cannot edit or reclaim it");

  // An unseen second gift proves PATCH replaces the whole snapshot, not just the edited row.
  const extra = api<CreatedGift>(visitor, "/api/house/gifts", "POST", { requestId: crypto.randomUUID(), emojiId: "popcorn", message: "Other visitor's gift", visibility: "public" });
  assert(extra.createdGiftId);
  const otherId = extra.createdGiftId;
  created.set(otherId, visitor);
  assert(!evaluate<boolean>(sender, `!!${node(otherId)}`));
  const edit = { emojiId: "seedling", message: "Edited private note", visibility: "private", displayName: "Edited sender" };
  browser(sender, "find", "role", "button", "click", "--name", "Edit gift");
  await until(sender, "!!document.querySelector('form[aria-label=\"Edit gift\"]')");
  browser(sender, "select", ".house-gift-editor [name=emojiId]", edit.emojiId);
  browser(sender, "fill", ".house-gift-editor [name=message]", edit.message);
  browser(sender, "fill", ".house-gift-editor [name=nickname]", edit.displayName);
  browser(sender, "select", ".house-gift-editor [name=visibility]", edit.visibility);
  browser(sender, "click", ".house-gift-editor .house-send");
  await until(sender, `!document.querySelector('.house-gift-editor') && document.querySelector('.house-gift-message')?.textContent===${quote(edit.message)} && !!${node(otherId)}`);
  const updated = recorded<HouseSnapshot>(sender, "PATCH", path);
  assert.deepEqual(updated, api<HouseSnapshot>(sender, "/api/house"), "PATCH returns the complete fresh public snapshot");
  assert(updated.gifts.some((gift) => gift.id === otherId), "PATCH includes other visitors' intervening gifts");
  assert.deepEqual(updated.gifts.find((gift) => gift.id === id), { id, emojiId: edit.emojiId, authorName: edit.displayName, message: null, visibility: edit.visibility, createdAt: before.createdAt });
  assert(!quote(updated).includes(edit.message), "PATCH must redact private text even for its sender");
  assert.equal(evaluate<string>(sender, `${node(id)}?.textContent`), "🌱", "The sender's scene updates without a reload");
  assert.equal(evaluate<string>(sender, "document.querySelector('.house-attribution')?.textContent"), "From Edited sender");
  const privateDetail = api<GiftDetail>(sender, path);
  assert.equal(privateDetail.message, edit.message);
  assert(privateDetail.canEdit && privateDetail.canReclaim);
  for (const [session, credentials] of [[visitor, "same-origin"], [sender, "omit"]]) {
    const hidden = api<GiftDetail>(session, path, "GET", undefined, credentials);
    assert.equal(hidden.message, null);
    assert(!hidden.canEdit && !hidden.canReclaim && !hidden.canRemove);
  }
  api(sender, path, "PATCH", edit, "omit", 401);
  assert.deepEqual(api<GiftDetail>(sender, path), privateDetail, "Cookie-free edits cannot change the saved gift");
  // A bounded idle/foreground observation supplements the per-document request-count assertion.
  evaluate(visitor, "window.dispatchEvent(new Event('pageshow'));window.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange'));true");
  await Bun.sleep(1_500);
  assert.equal(evaluate<string>(visitor, "document.querySelector('.house-gift-message')?.textContent"), "Original public note", "Already-open cards do not auto-refresh");
  assert.equal(evaluate<string>(visitor, `${node(id)}?.textContent`), "🎁", "Other scenes retain their previous snapshot until reload");
  await reload(visitor, identities.get(visitor)!);
  await openGift(visitor, id);
  await until(visitor, "document.querySelector('.house-attribution')?.textContent==='From Edited sender' && !!document.querySelector('.house-private')");
  assert(!evaluate<boolean>(visitor, "!!document.querySelector('.house-gift-message') || !!document.querySelector('.house-gift-actions button')"));
  assert.equal(evaluate<string>(visitor, `${node(id)}?.textContent`), "🌱");
  console.log("PASS all four edit fields persist; PATCH refreshes the sender's full scene and private detail stays cookie-protected");

  await reload(sender, identities.get(sender)!);
  await openGift(sender, id);
  await until(sender, `document.querySelector('.house-gift-message')?.textContent===${quote(edit.message)}`);
  assert(recorded<GiftDetail>(sender, "GET", path).canEdit, "Reload preserves edit ownership and private access");
  browser(sender, "find", "role", "button", "click", "--name", "Take back");
  await until(sender, `!document.querySelector('.object-window') && !${node(id)}`);
  assert.deepEqual(recorded<HouseSnapshot>(sender, "DELETE", path), api<HouseSnapshot>(sender, "/api/house"), "DELETE returns the fresh public snapshot");
  api(sender, path, "GET", undefined, "same-origin", 404);
  created.delete(id);
  assert(evaluate<boolean>(sender, `!!${node(otherId)}`), "Reclaim preserves other visitors' gifts");
  assert(evaluate<boolean>(visitor, `!!${node(id)} && !!document.querySelector('.house-gift-body')`), "Remote deletion does not push changes into another browser");
  await reload(visitor, identities.get(visitor)!);
  await until(visitor, `!${node(id)} && !!${node(otherId)}`);
  for (const session of sessions) httpOnly(session);
  console.log("PASS reload preserves identity; cookie reclaim updates only the sender until reload; no gift sockets or snapshot polling");
} finally {
  // Also collect a successful UI POST if a later UI assertion failed before recording its ID.
  for (const session of opened) try {
    for (const id of evaluate<string[]>(session, "(window.houseProbe?.requests ?? []).filter(r=>r.method==='POST' && r.path==='/api/house/gifts' && r.data?.createdGiftId).map(r=>r.data.createdGiftId)")) {
      if (!created.has(id)) {
        const exists = evaluate<number>(session, `(async()=> (await window.probeFetch('/api/house/gifts/'+${quote(id)},{credentials:'same-origin',cache:'no-store',redirect:'error'})).status)()`);
        if (exists !== 404) created.set(id, session);
      }
    }
  } catch (error) { console.error("Test-gift discovery failed", error); process.exitCode = 1; }
  for (const [id, session] of created) try { remove(session, id); } catch (error) { console.error("Test-gift cleanup failed", error); process.exitCode = 1; }
  for (const session of opened) try { browser(session, "close"); } catch (error) { console.error("Browser cleanup failed", error); process.exitCode = 1; }
  await rm(directory, { recursive: true, force: true });
}

// Run against a disposable LOCAL Worker: bun scripts/verify-gift-composer-browser.ts <url>
import assert from "node:assert/strict";

const url = new URL(process.argv[2] ?? "http://localhost:4321");
assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Local hosts only");
const session = `composer-${crypto.randomUUID()}`;
function browser(...args: string[]): Record<string, unknown> {
  const result = Bun.spawnSync([process.execPath, "x", "agent-browser@0.38.1", "--json", "--session", session, ...args], { timeout: 35_000 });
  const output = JSON.parse(result.stdout.toString().split("\n").filter((line) => line.startsWith("{")).at(-1) ?? "null");
  assert(output?.success, output?.error ?? result.stderr.toString());
  return output.data;
}
function evaluate<T>(expression: string): T { return browser("eval", expression).result as T; }
async function until(expression: string) {
  const end = Date.now() + 12_000;
  do {
    if (evaluate<boolean>(expression)) return;
    await Bun.sleep(100);
  } while (Date.now() < end);
  throw new Error(`Timed out: ${expression}\n${JSON.stringify(evaluate("({hidden:document.hidden,error:document.querySelector('#gift-error')?.textContent,windows:[...document.querySelectorAll('.object-window')].map(e=>e.getAttribute('aria-label')),pending:document.querySelector('.house-send')?.disabled})"))}`);
}
try {
  assert.equal((await fetch(url, { redirect: "manual" })).status, 200);
  browser("open", url.href);
  await until("!!document.querySelector('.house[data-ready=true]')");
  assert.equal(evaluate<string>("location.origin"), url.origin, "Refusing an off-origin browser session");
  assert(evaluate<boolean>("!!document.querySelector('[data-object=leave-gift]')"), "A present object is the gift entrypoint");
  assert(!evaluate<boolean>("!!document.querySelector('.house-composer')"), "No inline composer on the homepage");
  browser("focus", "[data-object=leave-gift]");
  browser("press", "Enter");
  await until("!!document.querySelector('.house-composer')");
  assert.equal(evaluate<string>("document.querySelector('.house-composer h2')?.textContent"), "Leave your mark on my site.");
  assert.equal(evaluate<string>("document.querySelector('[aria-label=\"Change gift object\"]')?.textContent"), "🎁");
  assert.equal(evaluate<string>("document.querySelector('#gift-message')?.value"), "");
  assert(evaluate<boolean>("!!document.querySelector('.gift-preview textarea') && !!document.querySelector('.gift-preview #gift-name')"));
  browser("fill", "#gift-message", "Keep this unsent draft.");
  browser("fill", "#gift-name", "Draft visitor");
  browser("select", ".house-audience select", "private");
  for (const [label, trigger, field] of [
    ["icon trigger", "[aria-label='Change gift object']", null],
    ["Change object text trigger", ".gift-change-object", null],
    ["another composer field", "[aria-label='Change gift object']", "#gift-name"],
  ] as const) {
    browser("click", trigger);
    assert(evaluate<boolean>("!!document.querySelector('#gift-picker')"));
    if (field) browser("focus", field);
    assert(evaluate<boolean>(`document.activeElement?.matches(${JSON.stringify(field ?? trigger)})`), `Escape starts from ${label}, not the search input`);
    browser("press", "Escape");
    await until("!document.querySelector('#gift-picker')");
    assert(evaluate<boolean>("!!document.querySelector('.house-composer')"), `Escape from ${label} must close only the picker, not the composer`);
    assert.equal(evaluate<string>("document.querySelector('#gift-message')?.value"), "Keep this unsent draft.", `Message survives Escape from ${label}`);
    assert.equal(evaluate<string>("document.querySelector('#gift-name')?.value"), "Draft visitor", `Name survives Escape from ${label}`);
    assert.equal(evaluate<string>("document.querySelector('.house-audience select')?.value"), "private", `Audience survives Escape from ${label}`);
    console.log(`PASS picker Escape from ${label} preserves the composer and draft`);
  }
  browser("press", "Escape");
  await until("!document.querySelector('.object-window')");
  assert(evaluate<boolean>("document.activeElement?.dataset.object==='leave-gift'"), "Escape with the picker closed dismisses the composer and restores focus");
  console.log("PASS Escape dismisses the composer when the picker is closed");
  browser("press", "Enter");
  await until("!!document.querySelector('.house-composer')");
  browser("click", "[aria-label='Change gift object']");
  browser("fill", "#gift-search", "popcorn");
  await until("!!document.querySelector('.house-suggestions [aria-label=Popcorn]')");
  evaluate("window.searchSubmits=0;window.preventSearchSubmit=e=>{window.searchSubmits++;e.preventDefault();e.stopImmediatePropagation()};document.querySelector('.house-composer').addEventListener('submit',window.preventSearchSubmit,true);true");
  browser("press", "Enter");
  assert.equal(evaluate<number>("window.searchSubmits"), 0, "Enter while searching must not publish a gift");
  evaluate("document.querySelector('.house-composer').removeEventListener('submit',window.preventSearchSubmit,true);true");
  browser("click", ".house-suggestions [aria-label=Popcorn]");
  assert.equal(evaluate<string>("document.querySelector('[aria-label=\"Change gift object\"]')?.textContent"), "🍿");
  assert.equal(evaluate<string>("document.querySelector('#gift-message')?.value"), "", "Searching for an object does not write a message");
  console.log("PASS present entrypoint, nested editable card, default present and independent emoji search");
  evaluate(`window.createdGifts=[];window.giftRequests=[];window.nativeFetch=window.fetch;
    window.fetch=async(...args)=>{
      const response=await window.nativeFetch(...args);
      if(args[0]==='/api/house/gifts' && args[1]?.method==='POST') {
        window.giftRequests.push(JSON.parse(args[1].body));
        const data=await response.clone().json();
        if(data.createdGiftId)window.createdGifts.push(data.createdGiftId);
        if(window.loseNext){window.loseNext=false;throw new TypeError('Test: response lost after saving');}
        if(window.holdNext){window.holdNext=false;await new Promise(resolve=>window.releaseGift=resolve);}
      }
      return response;
    };true`);
  browser("fill", "#gift-message", "For the next movie night.");
  browser("fill", "#gift-name", "Cinema visitor");
  evaluate("document.querySelector('.house-composer').addEventListener('submit',()=>{window.previewBounds=document.querySelector('.gift-preview').getBoundingClientRect().toJSON()},{once:true});true");
  browser("click", ".house-send");
  await until("!document.querySelector('.house-composer') && !!document.querySelector('.house-gift-body')");
  assert.equal(evaluate<string>("document.querySelector('.house-gift-message')?.textContent"), "For the next movie night.");
  assert.equal(evaluate<string>("document.querySelector('.house-attribution')?.textContent"), "From Cinema visitor");
  assert(evaluate<boolean>("!!document.querySelector('.house-reclaim')"));
  assert(evaluate<boolean>(`(()=>{const r=document.querySelector('.object-window').getBoundingClientRect();return Math.abs(r.x-window.previewBounds.x)<2 && Math.abs(r.y-window.previewBounds.y)<2 && Math.abs(r.width-window.previewBounds.width)<2})()`), JSON.stringify(evaluate("({preview:window.previewBounds,real:document.querySelector('.object-window').getBoundingClientRect().toJSON()})")));
  assert(evaluate<boolean>("document.querySelector('[data-object=leave-gift]').dataset.windowOpen==='false'"));
  browser("click", "[aria-label='Close gift']");
  await until("!document.querySelector('.object-window')");
  assert(evaluate<boolean>("document.activeElement?.dataset.object===window.createdGifts[0]"));
  assert(evaluate<boolean>("document.activeElement?.dataset.windowOpen==='false'"));
  console.log("PASS submission promotes the preview into a real, reclaimable gift; collapsing returns to its own object");
  browser("focus", "[data-object=leave-gift]");
  browser("press", "Enter");
  await until("!!document.querySelector('#gift-message')");
  browser("fill", "#gift-message", "This note is private.");
  browser("select", ".house-audience select", "private");
  evaluate("window.loseNext=true;true");
  browser("click", ".house-send");
  await until("document.querySelector('#gift-error')?.textContent.includes('response lost')");
  assert.equal(evaluate<string>("document.querySelector('#gift-message').value"), "This note is private.");
  evaluate("window.holdNext=true;true");
  browser("click", ".house-send");
  await until("typeof window.releaseGift==='function'");
  browser("click", ".object-window > .wb-header .wb-close");
  assert(evaluate<boolean>("!!document.querySelector('.house-composer') && document.querySelector('.house-send').disabled"), "Pending publication cannot be dismissed or resubmitted");
  evaluate("window.releaseGift();true");
  await until("!document.querySelector('.house-composer') && !!document.querySelector('.house-gift-body')");
  assert(evaluate<boolean>("window.giftRequests[1].requestId===window.giftRequests[2].requestId && window.createdGifts[1]===window.createdGifts[2]"), "A lost-response retry creates exactly one gift");
  assert.equal(evaluate<string>("document.querySelector('.house-gift-message')?.textContent"), "This note is private.");
  assert(evaluate<boolean>(`(async()=>{
    const id=window.createdGifts[1];
    const publicScene=await window.nativeFetch('/api/house').then(r=>r.json());
    const stranger=await window.nativeFetch('/api/house/gifts/'+id,{credentials:'omit',cache:'no-store'}).then(r=>r.json());
    return publicScene.gifts.find(g=>g.id===id).message===null && stranger.message===null && !stranger.canReclaim && !stranger.canEdit;
  })()`), "Private text and ownership are not exposed to other visitors");
  browser("click", "[aria-label='Close gift']");
  await until("!document.querySelector('.object-window')");
  console.log("PASS private note, preserved failed draft, idempotent lost-response retry and pending-send guard");

  browser("set", "media", "reduced-motion");
  for (const [width, height] of [[390, 844], [320, 640], [844, 390]]) {
    browser("set", "viewport", String(width), String(height));
    browser("focus", "[data-object=leave-gift]");
    browser("press", "Enter");
    await until("!!document.querySelector('.house-composer')");
    assert(evaluate<boolean>(`(()=>{const r=document.querySelector('.object-window').getBoundingClientRect();const b=document.querySelector('.wb-body');return r.right<=innerWidth && r.bottom<=innerHeight && b.scrollWidth<=b.clientWidth && document.documentElement.scrollWidth<=innerWidth})()`), `Composer fits ${width}×${height}`);
    browser("click", "[aria-label='Change gift object']");
    browser("focus", "#gift-search");
    browser("press", "Escape");
    assert(evaluate<boolean>("!!document.querySelector('.house-composer') && !document.querySelector('#gift-picker')"), "Escape closes just the picker");
    evaluate("document.querySelector('.house-send').scrollIntoView({block:'nearest'});true");
    assert(evaluate<boolean>("(()=>{const b=document.querySelector('.house-send');const r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()"), "The submit button is reachable by scrolling the window body");
    browser("click", ".house-send");
    await until("!document.querySelector('.house-composer') && !!document.querySelector('.house-gift-body')");
    assert(evaluate<boolean>("(()=>{const r=document.querySelector('.object-window').getBoundingClientRect();return r.right<=innerWidth && r.bottom<=innerHeight && r.top>=58})()"));
    assert(!evaluate<boolean>("!!document.querySelector('.house-gift-message')"), "The default present may be sent without text");
    assert.equal(evaluate<string>("window.giftRequests.at(-1).emojiId"), "gift");
    assert(evaluate<boolean>("window.giftRequests.at(-1).displayName===undefined && window.giftRequests.at(-1).message===undefined"));
    browser("click", "[aria-label='Close gift']");
    await until("!document.querySelector('.object-window')");
  }
  assert.deepEqual(browser("errors").errors, []);
  console.log("PASS phone, narrow phone, landscape, reduced-motion submission, picker Escape and blank anonymous presents");
} finally {
  try {
    assert(evaluate<boolean>(`(async()=>{
      for(const id of new Set(window.createdGifts ?? [])) {
        if(location.origin!==${JSON.stringify(url.origin)})throw Error('Refusing off-origin cleanup');
        const r=await window.nativeFetch('/api/house/gifts/'+id,{method:'DELETE',credentials:'same-origin',redirect:'error'});
        if(!r.ok)throw Error('Cleanup failed: '+r.status);
        if((await r.json()).gifts.some(g=>g.id===id))return false;
        if((await window.nativeFetch('/api/house/gifts/'+id,{credentials:'same-origin',cache:'no-store',redirect:'error'})).status!==404)return false;
      }return true;
    })()`));
  } catch (error) { console.error("Gift cleanup failed", error); process.exitCode = 1; }
  try { browser("close"); } catch (error) { console.error("Browser cleanup failed", error); process.exitCode = 1; }
}

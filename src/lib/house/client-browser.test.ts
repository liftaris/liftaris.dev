// Deferred real-Chromium checks: HOUSE_BROWSER_TESTS=1 bun test src/lib/house/client-browser.test.ts
// Only network and scene physics are doubled; the windows, portals and gift forms are real.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const enabled = process.env.HOUSE_BROWSER_TESTS === "1";
const check = enabled ? test : test.skip;
const session = `house-client-${crypto.randomUUID()}`;
let directory = "";
function browser(...args: string[]): Record<string, unknown> {
  const result = Bun.spawnSync([process.execPath, "x", "agent-browser@0.38.1", "--json", "--session", session, ...args], { timeout: 35_000 });
  const output = JSON.parse(result.stdout.toString().split("\n").filter((line) => line.startsWith("{")).at(-1) ?? "null");
  if (!output?.success) throw new Error(output?.error ?? result.stderr.toString());
  return output.data;
}
function evaluate<T>(body: string): T { return browser("eval", `(async()=>{${body}})()`).result as T; }

beforeAll(async () => {
  if (!enabled) return;
  directory = await mkdtemp(join(tmpdir(), "house-client-tests-"));
  const stubs: Record<string, string> = {
    "./HouseClump": `export function HouseClump({gifts,onOpen}) {return <div id="scene"><button data-object="leave-gift" onClick={e=>onOpen({id:"leave-gift",name:"Present",emoji:"🎁"},e.currentTarget)}>Compose</button>{gifts.map(g=><button key={g.id} data-object={g.id} onClick={e=>onOpen({id:g.id,name:g.emojiId,emoji:g.emojiId},e.currentTarget,g)}>{g.id}:{g.emojiId}</button>)}</div>}`,
    "../folder/Folder": "export const Folder = () => null",
    "../../../components/Stage": "export const Stage = () => null",
  };
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(), loader: "tsx", contents: `
        import React from "react";
        import {createRoot} from "react-dom/client";
        import {flushSync} from "react-dom";
        import {House} from "./src/components/house/House";
        import {GiftDialog} from "./src/components/house/GiftDialog";
        import {ObjectWindow} from "./src/components/window/ObjectWindow";
        import {houseMutations} from "./src/lib/house/client";
        const gift = {id:"gift-1",emojiId:"gift",authorName:"Quiet Otter",createdAt:"2026-09-24",visibility:"public",message:"Old public note",version:1,canEdit:true,canReclaim:true,canRemove:false};
        let root;
        Object.assign(window, {React,gift,House,GiftDialog,ObjectWindow,houseMutations,
          mount(Component,props={}) {if(root)flushSync(()=>root.unmount());root=createRoot(document.getElementById("root"));flushSync(()=>root.render(React.createElement(Component,props)));},
          render(Component,props) {flushSync(()=>root.render(React.createElement(Component,props)));},
          async until(predicate) {const end=Date.now()+3000;while(!predicate()){if(Date.now()>end)throw Error("Timed out: "+predicate+"\\n"+document.body.innerText);await new Promise(r=>setTimeout(r,10));}},
          tick() {return new Promise(r=>setTimeout(r,30));},
          change(selector,value) {const el=document.querySelector(selector); const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,"value").set.call(el,value);el.dispatchEvent(new Event(el instanceof HTMLSelectElement?"change":"input",{bubbles:true}));},
          submit(selector) {document.querySelector(selector).dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));},
          clickText(text) {const el=[...document.querySelectorAll("button")].find(el=>el.textContent===text);if(!el)throw Error("Missing button: "+text);el.click();},
        });`,
    },
    outfile: "test.js", bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [{ name: "component-boundaries", setup(api) {
      api.onResolve({ filter: /.*/ }, (args) => args.path in stubs ? { path: args.path, namespace: "stub" } : undefined);
      api.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: stubs[args.path], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  const script = bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text;
  const css = bundle.outputFiles.find((file) => file.path.endsWith(".css"))!.text;
  await writeFile(join(directory, "test.html"), `<html><head><style>${css}</style></head><body><div id="root"></div><script>${script.replaceAll("</script", "<\\/script")}</script></body></html>`);
  browser("open", new URL(`file://${directory}/test.html`).href);
}, 60_000);

afterAll(async () => {
  if (!enabled) return;
  try { browser("close"); } finally { if (directory) await rm(directory, { recursive: true, force: true }); }
}, 40_000);

check("House orders creation/edit/reclaim snapshots and a created window never retires a later composer", () => {
  const result = evaluate(`
    let releaseInitial, initialSignal, releaseCreated, releasePatch, current={...gift};
    const other={...gift,id:'other'}, retiring={...gift,id:'retiring'}, calls=[];
    window.fetch=async(path,init={})=>{
      const method=init.method??'GET';calls.push([path,method]);
      if(path==='/api/house/me')return Response.json({visitor:{id:'me',name:'Quiet Otter'},owner:false});
      if(path==='/api/house') {initialSignal=init.signal;return new Promise(r=>releaseInitial=()=>r(Response.json({gifts:[]})));}
      if(method==='POST')return Response.json({gifts:[other,retiring,gift],createdGiftId:gift.id});
      if(method==='PATCH') {current={...current,...JSON.parse(init.body),version:current.version+1};return new Promise(r=>releasePatch=()=>r(Response.json({gifts:[other,current]})));}
      if(method==='DELETE')return Response.json({gifts:path.endsWith('/retiring')?[other,current]:[current]});
      if(path.endsWith('/other'))return Response.json(other);
      if(path.endsWith('/retiring'))return Response.json(retiring);
      if(!releaseCreated)return new Promise(r=>releaseCreated=()=>r(Response.json(gift)));
      return Response.json(current);
    };
    mount(House);clickText('Compose');
    await until(()=>document.querySelector('.house-composer'));
    submit('.house-composer');await until(()=>releaseCreated);
    const immediate=!!document.querySelector('#scene [data-object="gift-1"]'), aborted=initialSignal.aborted;
    releaseInitial();await tick();
    const retained=!!document.querySelector('#scene [data-object="gift-1"]');
    document.querySelector('#scene [data-object="retiring"]').click();
    await until(()=>[...document.querySelectorAll('button')].some(el=>el.textContent==='Take back'));
    clickText('Take back');await until(()=>!document.querySelector('#scene [data-object="retiring"]') && !document.querySelector('.house-gift-body'));
    // The just-created icon can also be opened before the composer's detail read finishes.
    document.querySelector('#scene [data-object="gift-1"]').click();await until(()=>document.querySelector('.house-gift-body'));
    clickText('Edit gift');await until(()=>document.querySelector('.house-gift-editor'));
    change('.house-gift-editor [name=emojiId]','seedling');await tick();submit('.house-gift-editor');
    await until(()=>releasePatch);releasePatch();
    await until(()=>!document.querySelector('.house-gift-editor') && document.querySelector('.house-gift-body').closest('.object-window').getAttribute('aria-label')==='Seedling');
    releaseCreated();await until(()=>!document.querySelector('.house-composer') && document.querySelector('.house-gift-body'));
    const handoffPreserved=document.querySelector('.house-gift-body').closest('.object-window').getAttribute('aria-label')==='Seedling';
    releasePatch=undefined;
    const originalFrame=document.querySelector('.house-gift-body').closest('.object-window'), originalBody=originalFrame.querySelector('.wb-body');
    clickText('Compose');await until(()=>document.querySelector('.house-composer'));
    change('#gift-message','Unsent second draft');await tick();
    document.querySelector('#scene [data-object="other"]').click();
    await until(()=>document.querySelectorAll('.house-gift-body').length===2);
    originalFrame.querySelector('.house-reclaim').click();await until(()=>document.querySelector('.house-gift-editor'));
    change('.house-gift-editor [name=emojiId]','heart');await tick();submit('.house-gift-editor');
    await until(()=>releasePatch);
    const otherFrame=[...document.querySelectorAll('.house-gift-body')].find(el=>el.closest('.object-window')!==originalFrame);
    [...otherFrame.querySelectorAll('button')].find(el=>el.textContent==='Take back').click();await tick();
    const serialized=!calls.some(c=>c[0].endsWith('/other') && c[1]==='DELETE');
    releasePatch();await until(()=>!document.querySelector('#scene [data-object="other"]') && originalFrame.getAttribute('aria-label')==='Heart');
    await tick();
    const final={immediate,aborted,retained,serialized,handoffPreserved,removedStayedRemoved:!document.querySelector('#scene [data-object="retiring"]'),
      sameWindow:originalFrame.isConnected && originalFrame.querySelector('.wb-body')===originalBody,
      draft:document.querySelector('#gift-message')?.value,
      mutations:calls.filter(c=>['POST','PATCH','DELETE'].includes(c[1]) && c[0]!=='/api/house/me').map(c=>c[1]),
      initialReads:calls.filter(c=>c[0]==='/api/house').length,
      sessionMethods:calls.filter(c=>c[0]==='/api/house/me').slice(0,2).map(c=>c[1])};
    // Reclaim a second created gift while its original detail response is held.
    const withdrawn={...gift,id:'withdrawn'};let releaseWithdrawn;
    window.fetch=async(path,init={})=>{
      if(path==='/api/house/me')return Response.json({visitor:{id:'me',name:'Quiet Otter'},owner:false});
      if(init.method==='POST')return Response.json({gifts:[current,withdrawn],createdGiftId:withdrawn.id});
      if(init.method==='DELETE')return Response.json({gifts:[current]});
      if(!releaseWithdrawn)return new Promise(r=>releaseWithdrawn=()=>r(Response.json(withdrawn)));
      return Response.json(withdrawn);
    };
    submit('.house-composer');await until(()=>releaseWithdrawn);
    document.querySelector('#scene [data-object="withdrawn"]').click();await until(()=>document.querySelectorAll('.house-gift-body').length===2);
    const withdrawing=[...document.querySelectorAll('.house-gift-body')].find(el=>el.closest('.object-window')!==originalFrame);
    await until(()=>[...withdrawing.querySelectorAll('button')].some(el=>el.textContent==='Take back'));
    [...withdrawing.querySelectorAll('button')].find(el=>el.textContent==='Take back').click();
    await until(()=>!document.querySelector('#scene [data-object="withdrawn"]') && document.querySelectorAll('.house-gift-body').length===1);
    releaseWithdrawn();await until(()=>!document.querySelector('.house-composer'));
    final.lateRevocation=document.querySelectorAll('.house-gift-body').length===1 && !document.querySelector('#scene [data-object="withdrawn"]');
    mount(()=>null);return final;
  `);
  expect(result).toEqual({ immediate: true, aborted: true, retained: true, serialized: true, handoffPreserved: true, lateRevocation: true, removedStayedRemoved: true, sameWindow: true, draft: "Unsent second draft", mutations: ["POST", "DELETE", "PATCH", "PATCH", "DELETE"], initialReads: 1, sessionMethods: ["POST", "GET"] });
}, 40_000);

check("conflicts retain the draft until explicit reload; failures never silently rebase or reveal redacted fields", () => {
  const result = evaluate(`
    let initialSignal,releaseInitial,current={...gift},reloadFails=true,saved=false;
    const bodies=[],snapshots=[],details=[];
    window.fetch=async(path,init={})=>{
      if(init.method==='PATCH') {
        bodies.push(JSON.parse(init.body));
        if(bodies.length===1)return Response.json({error:'Offline'},{status:503});
        if(bodies.length===2){current={...gift,emojiId:'seedling',message:'Other tab',version:2};return Response.json({error:'Changed'},{status:409});}
        saved=true;return Response.json({gifts:[{...gift,visibility:'private',authorName:null,message:null}]});
      }
      if(!releaseInitial){initialSignal=init.signal;return new Promise(r=>releaseInitial=()=>r(Response.json(gift)));}
      if(reloadFails || saved)return Response.json({error:'Offline'},{status:503});
      return Response.json(current);
    };
    mount(GiftDialog,{gift,initialDetail:gift,onClose(){},onDetail(next){details.push(next.emojiId);},mutate:houseMutations(s=>snapshots.push(s))});
    await until(()=>releaseInitial);clickText('Edit gift');await until(()=>document.querySelector('.house-gift-editor'));
    change('[name=message]','Unsent draft');await tick();submit('.house-gift-editor');
    await until(()=>document.querySelector('.house-error').textContent==='Offline');
    const retryDraft=document.querySelector('[name=message]').value;
    submit('.house-gift-editor');await until(()=>document.body.textContent.includes('changed elsewhere'));
    const conflictDraft=document.querySelector('[name=message]').value, disabled=document.querySelector('[type=submit]').disabled;
    releaseInitial();await tick();submit('.house-gift-editor');await tick();
    const noRetry=bodies.length===2;
    clickText('Reload latest gift');await until(()=>document.querySelector('.house-error').textContent==='Offline');
    const failedReloadPreservesDraft=document.querySelector('[name=message]').value==='Unsent draft' && document.querySelector('[type=submit]').disabled;
    clickText('Cancel');await until(()=>!document.querySelector('.house-gift-editor'));
    const cancelCannotBypass=[...document.querySelectorAll('button')].find(el=>el.textContent==='Edit gift').disabled;
    reloadFails=false;clickText('Reload latest gift');await until(()=>document.querySelector('.house-gift-message')?.textContent==='Other tab');
    clickText('Edit gift');await until(()=>document.querySelector('[name=message]'));
    const reloadedDraft=document.querySelector('[name=message]').value;
    change('[name=message]','');change('[name=nickname]','');change('[name=visibility]','private');await tick();submit('.house-gift-editor');
    await until(()=>document.querySelector('.house-error').textContent.includes('was saved'));
    const final={retryDraft,conflictDraft,disabled,noRetry,failedReloadPreservesDraft,cancelCannotBypass,reloadedDraft,
      aborted:initialSignal.aborted,versions:bodies.map(b=>b.version),last:bodies.at(-1),snapshots:snapshots.length,details,
      redacted:!document.querySelector('.house-gift-message,.house-attribution'),
      cannotEdit:![...document.querySelectorAll('button')].some(el=>el.textContent==='Edit gift')};
    mount(()=>null);return final;
  `);
  expect(result).toEqual({ retryDraft: "Unsent draft", conflictDraft: "Unsent draft", disabled: true, noRetry: true, failedReloadPreservesDraft: true, cancelCannotBypass: true, reloadedDraft: "Other tab", aborted: true, versions: [1, 1, 2], last: { version: 2, emojiId: "seedling", message: "", displayName: "", visibility: "private" }, snapshots: 1, details: ["seedling"], redacted: true, cannotEdit: true });
}, 40_000);

check("ObjectWindow updates in place without resetting content, focus, geometry or its one-shot ready callback", () => {
  const result = evaluate(`
    const source=document.createElement('button');document.body.append(source);
    let ready=0,closed=0;
    function Draft(){const [value,setValue]=React.useState('');return React.createElement('input',{id:'unsent',value,onChange:e=>setValue(e.target.value)});}
    const props={title:'Present',icon:'🎁',source,origin:new DOMRect(50,60,48,48),onReady(){ready++;},onClose(){closed++;}};
    const children=React.createElement(Draft);
    mount(ObjectWindow,{...props,children});await until(()=>document.querySelector('#unsent'));
    const frame=document.querySelector('.object-window'),body=frame.querySelector('.wb-body'),input=document.querySelector('#unsent');
    frame.winbox.move(100,120);change('#unsent','Keep this draft');await tick();input.focus();input.setSelectionRange(3,7);
    render(ObjectWindow,{...props,title:'Heart',icon:'❤️',origin:new DOMRect(0,0,1,1),initialBounds:new DOMRect(0,0,20,20),children});await tick();
    const final={sameWindow:document.querySelector('.object-window')===frame,sameBody:frame.querySelector('.wb-body')===body,
      sameInput:document.querySelector('#unsent')===input,value:input.value,focused:document.activeElement===input,selection:[input.selectionStart,input.selectionEnd],
      position:[frame.winbox.x,frame.winbox.y],title:frame.getAttribute('aria-label'),icon:frame.querySelector('.object-window-icon').textContent,ready};
    frame.winbox.close();await until(()=>closed===1);mount(()=>null);
    final.focusReturned=document.activeElement===source;final.windows=document.querySelectorAll('.object-window').length;source.remove();return final;
  `);
  expect(result).toEqual({ sameWindow: true, sameBody: true, sameInput: true, value: "Keep this draft", focused: true, selection: [3, 7], position: [100, 120], title: "Heart", icon: "❤️", ready: 1, focusReturned: true, windows: 0 });
}, 40_000);

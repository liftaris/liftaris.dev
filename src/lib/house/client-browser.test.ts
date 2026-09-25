// Optional real-Chromium component checks, without a dev server or DOM-test dependencies:
// HOUSE_BROWSER_TESTS=1 bun test src/lib/house/client-browser.test.ts
// Network and window/physics boundaries are doubles; React and gift components are real.
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
    "../window/ObjectWindow": `export function ObjectWindow({children,title,icon}) {return <section className="object-window"><h2>{icon} {title}</h2>{children}</section>}`,
    "../folder/Folder": "export const Folder = () => null",
    "../../../components/Stage": "export const Stage = () => null",
    "../../lib/house/use-house-sync": "export function useHouseSync() { window.syncInvocations++; }",
  };
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(), loader: "tsx", contents: `
        import React from "react";
        import {createRoot} from "react-dom/client";
        import {flushSync} from "react-dom";
        import {House} from "./src/components/house/House";
        import {GiftDialog} from "./src/components/house/GiftDialog";
        import {GiftComposer} from "./src/components/house/GiftComposer";
        const gift = {id:"gift-1",emojiId:"gift",authorName:"Quiet Otter",createdAt:"2026-09-24",visibility:"public",message:"Old public note",canEdit:true,canReclaim:true,canRemove:false};
        let root;
        Object.assign(window, {gift,House,GiftDialog,GiftComposer,syncInvocations:0,
          mount(Component,props={}) {if(root)flushSync(()=>root.unmount());root=createRoot(document.getElementById("root"));flushSync(()=>root.render(React.createElement(Component,props)));},
          async until(predicate) {const end=Date.now()+3000;while(!predicate()){if(Date.now()>end)throw Error("Timed out: "+predicate+"\\n"+document.body.innerText);await new Promise(r=>setTimeout(r,10));}},
          change(selector,value) {const el=document.querySelector(selector); const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,"value").set.call(el,value);el.dispatchEvent(new Event(el instanceof HTMLSelectElement?"change":"input",{bubbles:true}));},
          submit(selector) {document.querySelector(selector).dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));},
          clickText(text) {const el=[...document.querySelectorAll("button")].find(el=>el.textContent===text);if(!el)throw Error("Missing button: "+text);el.click();},
        });`,
    },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [{ name: "component-boundaries", setup(api) {
      api.onResolve({ filter: /.*/ }, (args) => args.path in stubs ? { path: args.path, namespace: "stub" } : args.path.endsWith(".css") ? { path: args.path, namespace: "style" } : undefined);
      api.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: stubs[args.path], loader: "tsx", resolveDir: process.cwd() }));
      api.onLoad({ filter: /.*/, namespace: "style" }, () => ({ contents: "", loader: "js" }));
    } }],
  });
  await writeFile(join(directory, "test.html"), `<html><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`);
  browser("open", new URL(`file://${directory}/test.html`).href);
}, 60_000);

afterAll(async () => {
  if (!enabled) return;
  try { browser("close"); } finally { if (directory) await rm(directory, { recursive: true, force: true }); }
}, 40_000);

check("House initializes the anonymous session on mount without realtime", () => {
  const result = evaluate<{ methods: string[]; sync: number }>(`
    const calls=[];
    window.fetch=async(path,init={})=>{calls.push([path,init.method??"GET"]);return Response.json(path==="/api/house"?{gifts:[]}:{visitor:{id:"me",name:"Quiet Otter"},owner:false});};
    mount(House);
    await until(()=>calls.some(c=>c[0]==="/api/house/me" && c[1]==="GET"));
    return {methods:calls.filter(c=>c[0]==="/api/house/me").map(c=>c[1]),sync:window.syncInvocations};
  `);
  expect(result.methods).toEqual(["POST", "GET"]);
  expect(result.sync).toBe(0);
}, 40_000);

check("creation updates the scene before detail resolves and invalidates the late initial GET", () => {
  const result = evaluate<{ immediate: boolean; retained: boolean; aborted: boolean }>(`
    let releaseInitial, releaseDetail, initialSignal;
    window.fetch=async(path,init={})=>{
      if(path==="/api/house") {initialSignal=init.signal;return new Promise(r=>releaseInitial=()=>r(Response.json({gifts:[]})));}
      if(path==="/api/house/me")return Response.json({visitor:{id:"me",name:"Quiet Otter"},owner:false});
      if(path==="/api/house/gifts")return Response.json({gifts:[gift],createdGiftId:gift.id});
      return new Promise(r=>releaseDetail=()=>r(Response.json(gift)));
    };
    mount(House);
    clickText("Compose");
    await until(()=>document.querySelector('.house-composer'));
    submit('.house-composer');
    await until(()=>releaseDetail);
    await new Promise(r=>setTimeout(r,30));
    const immediate=!!document.querySelector('#scene [data-object="gift-1"]');
    const aborted=initialSignal.aborted;
    releaseInitial();
    await new Promise(r=>setTimeout(r,30));
    const retained=!!document.querySelector('#scene [data-object="gift-1"]');
    releaseDetail();
    await until(()=>document.querySelector('.house-gift-body'));
    mount(()=>null);
    return {immediate,retained,aborted};
  `);
  expect(result).toEqual({ immediate: true, retained: true, aborted: true });
}, 40_000);

check("own gift edits PATCH then refresh detail without letting an older detail win", () => {
  const result = evaluate<{ body: unknown; order: string[]; immediate: boolean; oldReadAborted: boolean; message: string | null; name: string | null }>(`
    let releaseInitial, initialSignal, releasePatch, releaseDetail, body;
    const order=[], snapshots=[];
    const updated={...gift,emojiId:"heart",message:"New private note",visibility:"private",authorName:"Friend"};
    const snapshot={gifts:[{...updated,message:null}]};
    window.fetch=async(path,init={})=>{
      if(init.method==="PATCH") {body=JSON.parse(init.body);order.push("PATCH");return new Promise(r=>releasePatch=()=>r(Response.json(snapshot)));}
      if(!releaseInitial) {initialSignal=init.signal;return new Promise(r=>releaseInitial=()=>r(Response.json(gift)));}
      order.push("GET");return new Promise(r=>releaseDetail=()=>r(Response.json(updated)));
    };
    mount(GiftDialog,{gift,initialDetail:gift,onClose(){},onSnapshot(s){snapshots.push(s);}});
    await until(()=>releaseInitial);
    clickText("Edit gift");
    await until(()=>document.querySelector('[aria-label="Edit gift"]'));
    change('[name="emojiId"]','heart'); change('[name="message"]',' New private note ');
    change('[name="nickname"]',' Friend '); change('[name="visibility"]','private');
    await new Promise(r=>setTimeout(r,0));
    submit('[aria-label="Edit gift"]');
    await until(()=>releasePatch);
    if(!document.querySelector('[type="submit"]').disabled)throw Error("Save must disable while pending");
    releasePatch();
    await until(()=>releaseDetail);
    const immediate=snapshots.length===1 && snapshots[0].gifts[0].message===null;
    releaseDetail();
    await until(()=>document.querySelector('.house-gift-message')?.textContent==='New private note');
    releaseInitial();
    await new Promise(r=>setTimeout(r,30));
    return {body,order,immediate,oldReadAborted:initialSignal.aborted,message:document.querySelector('.house-gift-message')?.textContent??null,name:document.querySelector('.house-attribution')?.textContent??null};
  `);
  expect(result).toEqual({
    body: { emojiId: "heart", message: "New private note", visibility: "private", displayName: "Friend" },
    order: ["PATCH", "GET"], immediate: true, oldReadAborted: true, message: "New private note", name: "From Friend",
  });
}, 40_000);

check("editing an object updates its open window title and scene immediately", () => {
  const result = evaluate<{ title: string; scene: string }>(`
    let current=gift;
    window.fetch=async(path,init={})=>{
      if(path==="/api/house/me")return Response.json({visitor:{id:"me",name:"Quiet Otter"},owner:false});
      if(path==="/api/house")return Response.json({gifts:[current]});
      if(init.method==="PATCH") {current={...current,...JSON.parse(init.body)};return Response.json({gifts:[current]});}
      return Response.json(current);
    };
    mount(House);
    await until(()=>document.querySelector('#scene [data-object="gift-1"]'));
    document.querySelector('#scene [data-object="gift-1"]').click();
    await until(()=>[...document.querySelectorAll('button')].some(el=>el.textContent==='Edit gift'));
    clickText('Edit gift');
    await until(()=>document.querySelector('[name="emojiId"]'));
    change('[name="emojiId"]','heart');
    await new Promise(r=>setTimeout(r,0));
    submit('[aria-label="Edit gift"]');
    await until(()=>document.querySelector('#scene [data-object="gift-1"]').textContent.includes('heart'));
    return {title:document.querySelector('.object-window h2').textContent,scene:document.querySelector('#scene [data-object="gift-1"]').textContent};
  `);
  expect(result).toEqual({ title: "❤️ Heart", scene: "gift-1:heart" });
}, 40_000);

check("a saved private gift with failed detail refresh cannot expose or overwrite the old message", () => {
  const result = evaluate<{ oldMessage: boolean; editable: boolean; saved: boolean }>(`
    let saved=false;
    window.fetch=async(path,init={})=>{
      if(init.method==="PATCH"){saved=true;return Response.json({gifts:[{...gift,visibility:'private',message:null}]});}
      return saved?Response.json({error:'Offline'},{status:503}):Response.json(gift);
    };
    mount(GiftDialog,{gift,initialDetail:gift,onClose(){},onSnapshot(){}});
    await new Promise(r=>setTimeout(r,20));
    clickText('Edit gift');
    await until(()=>document.querySelector('[name="visibility"]'));
    change('[name="visibility"]','private');
    await new Promise(r=>setTimeout(r,0));
    submit('[aria-label="Edit gift"]');
    await until(()=>document.querySelector('.house-error')?.textContent.includes('was saved'));
    return {oldMessage:document.querySelector('#root').textContent.includes('Old public note'),editable:[...document.querySelectorAll('button')].some(el=>el.textContent==='Edit gift'),saved};
  `);
  expect(result).toEqual({ oldMessage: false, editable: false, saved: true });
}, 40_000);

check("failed edits preserve the draft for retry, including explicit blank fields", () => {
  const result = evaluate<{ preserved: string; bodies: unknown[]; removed: boolean; cancelled: boolean }>(`
    const bodies=[];
    let current=gift, snapshots=0;
    window.fetch=async(path,init={})=>{
      if(init.method==="PATCH") {
        bodies.push(JSON.parse(init.body));
        if(bodies.length===1)return Response.json({error:'Try again'},{status:503});
        current={...gift,...bodies.at(-1),message:null};return Response.json({gifts:[current]});
      }
      return Response.json(current);
    };
    mount(GiftDialog,{gift,initialDetail:gift,onClose(){},onSnapshot(){snapshots++;}});
    clickText('Edit gift');
    await until(()=>document.querySelector('[name="message"]'));
    change('[name="message"]','Unsent draft');
    await new Promise(r=>setTimeout(r,0));
    submit('[aria-label="Edit gift"]');
    await until(()=>document.querySelector('.house-error')?.textContent==='Try again');
    const preserved=document.querySelector('[name="message"]').value;
    change('[name="message"]','');change('[name="nickname"]','');
    await new Promise(r=>setTimeout(r,0));
    submit('[aria-label="Edit gift"]');
    await until(()=>!document.querySelector('.house-gift-editor') && [...document.querySelectorAll('button')].some(el=>el.textContent==='Edit gift'));
    const removed=!document.querySelector('.house-gift-message') && snapshots===1;
    clickText('Edit gift');
    await until(()=>document.querySelector('.house-gift-editor'));
    change('[name="message"]','Discard this');
    clickText('Cancel');
    await until(()=>!document.querySelector('.house-gift-editor'));
    return {preserved,bodies,removed,cancelled:bodies.length===2 && !document.querySelector('.house-gift-message')};
  `);
  expect(result.preserved).toBe("Unsent draft");
  expect(result.bodies).toEqual([
    { emojiId: "gift", message: "Unsent draft", visibility: "public", displayName: "Quiet Otter" },
    { emojiId: "gift", message: "", visibility: "public", displayName: "" },
  ]);
  expect(result.removed).toBe(true);
  expect(result.cancelled).toBe(true);
}, 40_000);

check("taking back a gift immediately delivers the deletion snapshot and closes the card", () => {
  const result = evaluate<{ methods: string[]; snapshots: unknown[]; closed: number }>(`
    const methods=[],snapshots=[];let closed=0;
    window.fetch=async(path,init={})=>{methods.push(init.method??'GET');return Response.json(init.method==='DELETE'?{gifts:[]}:gift);};
    mount(GiftDialog,{gift,initialDetail:gift,onClose(){closed++;},onSnapshot(s){snapshots.push(s);}});
    clickText('Take back');
    await until(()=>closed===1);
    return {methods,snapshots,closed};
  `);
  expect(result.methods).toContain("DELETE");
  expect(result.snapshots).toEqual([{ gifts: [] }]);
  expect(result.closed).toBe(1);
}, 40_000);

check("a delayed created-gift detail never reapplies its older snapshot over another mutation", () => {
  const result = evaluate<{ removedStayedRemoved: boolean; createdVisible: boolean }>(`
    const other={...gift,id:'old-gift'};
    let releaseDetail;
    window.fetch=async(path,init={})=>{
      if(path==='/api/house/me')return Response.json({visitor:{id:'me',name:'Quiet Otter'},owner:false});
      if(path==='/api/house')return Response.json({gifts:[other]});
      if(init.method==='DELETE')return Response.json({gifts:[gift]});
      if(path==='/api/house/gifts')return Response.json({gifts:[other,gift],createdGiftId:gift.id});
      if(path.endsWith('/old-gift'))return Response.json(other);
      return new Promise(r=>releaseDetail=()=>r(Response.json(gift)));
    };
    mount(House);
    await until(()=>document.querySelector('#scene [data-object="old-gift"]'));
    document.querySelector('#scene [data-object="old-gift"]').click();
    await until(()=>[...document.querySelectorAll('button')].some(el=>el.textContent==='Take back'));
    clickText('Compose');
    await until(()=>document.querySelector('.house-composer'));
    submit('.house-composer');
    await until(()=>releaseDetail);
    clickText('Take back');
    await until(()=>!document.querySelector('#scene [data-object="old-gift"]'));
    releaseDetail();
    await until(()=>document.querySelector('.house-gift-body'));
    return {removedStayedRemoved:!document.querySelector('#scene [data-object="old-gift"]'),createdVisible:!!document.querySelector('#scene [data-object="gift-1"]')};
  `);
  expect(result).toEqual({ removedStayedRemoved: true, createdVisible: true });
}, 40_000);

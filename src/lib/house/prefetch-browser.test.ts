// Run against a running Astro server or deployed preview:
// HOUSE_PREFETCH_URL=http://127.0.0.1:4331 bun test src/lib/house/prefetch-browser.test.ts
import { afterAll, expect, test } from 'bun:test';

const base = process.env.HOUSE_PREFETCH_URL;
const check = base ? test : test.skip;
const session = `prefetch-${crypto.randomUUID()}`;
function browser(...args: string[]) {
  const result = Bun.spawnSync([process.execPath, 'x', 'agent-browser@0.38.1', '--json', '--session', session, ...args], { timeout: 45_000 });
  const output = JSON.parse(result.stdout.toString().split('\n').filter(line => line.startsWith('{')).at(-1) ?? 'null');
  if (!output?.success) throw new Error(output?.error ?? result.stderr.toString());
  return output.data;
}
afterAll(() => { if (base) browser('close'); });

check('hover and keyboard focus warm embedded pages with native Astro prefetch, then the reader reuses HTTP cache', () => {
  browser('open', base!);
  const result = browser('eval', `(async () => {
    const until = async (test) => {const end = Date.now()+20000;while(!test()){if(Date.now()>end)throw Error('Timed out');await new Promise(r=>setTimeout(r,30));}};
    await until(()=>document.querySelector('[data-object="computer"]'));
    // Visitor initialization sets a cookie. Wait for its POST + confirming GET:
    // a cookie change correctly invalidates Vary: Cookie between hover and open.
    const identity = new URL('/api/house/me',location.href).href;
    await until(()=>performance.getEntriesByName(identity).filter(e=>e.responseEnd>0).length>=2);
    const icon = document.querySelector('[data-object="computer"]');
    icon.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));
    const embedded = new URL('/projects?window=1',location.href).href;
    await until(()=>performance.getEntriesByName(embedded).some(e=>e.initiatorType==='link' && e.responseEnd>0));
    const nativeLink = [...document.querySelectorAll('link[rel=prefetch]')].some(l=>l.href===embedded);
    icon.click();
    await until(()=>[...document.querySelectorAll('iframe')].some(f=>f.srcdoc && f.contentDocument?.querySelector('astro-island')));
    const reads = performance.getEntriesByName(embedded).filter(e=>e.initiatorType==='fetch');
    const fullPage = new URL('/projects',location.href).href;
    const noDuplicatePage = performance.getEntriesByName(fullPage).length === 0;
    document.querySelector('iframe.post-reader').closest('.object-window').querySelector('.wb-max').focus();
    await until(()=>performance.getEntriesByName(fullPage).some(e=>e.initiatorType==='link' && e.responseEnd>0));
    document.querySelector('[data-object="case"]').focus();
    const experience = new URL('/experience?window=1',location.href).href;
    await until(()=>performance.getEntriesByName(experience).some(e=>e.initiatorType==='link' && e.responseEnd>0));
    return {nativeLink,noDuplicatePage,maximizePrefetched:true,fetches:reads.length,cached:reads[0]?.transferSize===0 && reads[0]?.decodedBodySize>0,focusPrefetched:true};
  })()`).result;
  expect(result).toEqual({nativeLink:true,noDuplicatePage:true,maximizePrefetched:true,fetches:1,cached:true,focusPrefetched:true});
}, 60_000);

check('folders open locally and only the hovered or focused article is prefetched', () => {
  browser('open', base!);
  const result = browser('eval', `(async () => {
    const end=Date.now()+20000;
    while(!document.querySelector('[data-object="writing-folder"]')){if(Date.now()>end)throw Error('No Writing folder');await new Promise(r=>setTimeout(r,30));}
    await new Promise(r=>setTimeout(r,1500));
    document.querySelector('[data-object="writing-folder"]').dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));
    await new Promise(r=>setTimeout(r,200));
    const unrelatedPrefetches = [...document.querySelectorAll('link[rel=prefetch]')].filter(l=>l.href.includes('/writing')).length;
    document.querySelector('[data-object="writing-folder"]').click();
    while(!document.querySelector('[data-folder-entry="01M3DGW2FEY2W6TAYFZAECFG36"]')){if(Date.now()>end)throw Error('Folder did not open');await new Promise(r=>setTimeout(r,30));}
    document.querySelector('[data-folder-entry="01M3DGW2FEY2W6TAYFZAECFG36"]').focus();
    while(![...document.querySelectorAll('link[rel=prefetch]')].some(l=>l.href.includes('/writing/') && l.href.includes('window=1'))){if(Date.now()>end)throw Error('Post window not prefetched');await new Promise(r=>setTimeout(r,30));}
    return {unrelatedPrefetches,folderOpened:!!document.querySelector('[data-folder-entry]'),postPrefetched:true};
  })()`).result;
  expect(result).toEqual({unrelatedPrefetches:0,folderOpened:true,postPrefetched:true});
}, 60_000);

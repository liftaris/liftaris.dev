import type {APIRoute} from 'astro';
import {readThings} from '../server/things/read';
import {pathFor} from '../lib/things/model';
export const GET:APIRoute=async({site,url})=>{
 const things=await readThings('published');
 const paths=new Set(['/',...things.map(t=>pathFor(t,things)).filter((p):p is string=>Boolean(p))]);
 const escape=(v:string)=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+[...paths].map(p=>`<url><loc>${escape(new URL(p,site ?? url.origin).href)}</loc></url>`).join('')+'</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8'}});
};

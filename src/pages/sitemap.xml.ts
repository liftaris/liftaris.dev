import type {APIRoute} from 'astro';
import {getEmDashCollection} from 'emdash';
import {readThings} from '../server/things/read';
import {pathFor} from '../lib/things/model';
export const GET:APIRoute=async({site,url})=>{
 const things=await readThings('published');
 const paths=new Set(['/',...things.map(t=>pathFor(t,things)).filter((p):p is string=>Boolean(p))]);
 let cursor:string|undefined;
 do{const page=await getEmDashCollection('posts',{status:'published',limit:100,cursor});if(page.error)throw page.error;for(const post of page.entries){if(!things.some(t=>t.postId===post.data.id))paths.add('/blog/'+encodeURIComponent(post.id));}cursor=page.nextCursor;}while(cursor);
 const escape=(v:string)=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+[...paths].map(p=>`<url><loc>${escape(new URL(p,site ?? url.origin).href)}</loc></url>`).join('')+'</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8'}});
};

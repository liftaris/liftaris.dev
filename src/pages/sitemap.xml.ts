import {cachePublicResponse} from '../server/things/page-cache';
import type {APIRoute} from 'astro';
import {getDb} from 'emdash/runtime';
import {publicPostPaths} from '../server/things/graph';
import {readThings} from '../server/things/read';
import {pathFor} from '../lib/things/model';
export const GET:APIRoute=async(context)=>{
 const {site,url}=context;
 const headers=new Headers({'Content-Type':'application/xml; charset=utf-8'});
 cachePublicResponse(context,headers);
 const things=await readThings('published');
 const paths=new Set(['/']);
 for(const thing of things){try{const path=pathFor(thing,things);if(path)paths.add(path);}catch{/* Unavailable ancestors do not produce public routes. */}}
 const placedPosts=new Set(things.map(thing=>thing.postId));
 for(const post of await publicPostPaths(await getDb())){
  if(!placedPosts.has(post.id))paths.add('/blog/'+encodeURIComponent(post.slug ?? post.id));
 }
 const escape=(v:string)=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+[...paths].map(p=>`<url><loc>${escape(new URL(p,site ?? url.origin).href)}</loc></url>`).join('')+'</urlset>',{headers});
};

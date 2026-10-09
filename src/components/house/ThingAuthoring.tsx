import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { STUDIO_PATH } from '../../lib/things/model';
import { validMessage, messageFor, type PreviewMessage } from '../../lib/things/bridge';
import type { ThingSpec } from '../../lib/things/scene';

export const AuthoringContext = createContext<{enabled: boolean; session: string; selected: string | null; send: (message: PreviewMessage) => void}>({ enabled:false,session:'',selected:null,send:()=>{} });
export function useThingPreview(initial: readonly ThingSpec[], enabled: boolean) {
  const [snapshot,setSnapshot]=useState<readonly ThingSpec[] | null>(null);
  const [selected,setSelected]=useState<string|null>(null);
  const [session]=useState(()=> typeof location !== 'undefined' && enabled ? new URLSearchParams(location.search).get('things-session') ?? '' : '');
  const send = (message: PreviewMessage) => { if(session && parent!==window) parent.postMessage(messageFor(session,message),location.origin); };
  useEffect(()=> {
    if(!enabled || !session || parent===window) return;
    const receive=(event:MessageEvent)=> {
      if(!validMessage(event,parent,session)||event.data.type!=='snapshot')return;
      const data=event.data; const next=data.things;
      setSnapshot(next.map(t=>t.id===data.selected?{...t,desktop:true,previewUrl:data.previewUrl}:t));setSelected(data.selected);
    };
    window.addEventListener('message',receive);send({type:'ready'});
    return()=>window.removeEventListener('message',receive);
  },[enabled,session]);
  return {things: session && snapshot ? snapshot : initial,authoring:{enabled,session,selected,send}};
}
export function ThingControls({id,name,floating=false}:{id:string;name:string;floating?:boolean}) {
  const ctx=useContext(AuthoringContext); const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]); const controls=useRef<HTMLDivElement>(null);
  useEffect(()=> {
    if(!ctx.enabled || !floating)return;
    let frame=0;
    const place=()=>{
      const icon=document.querySelector<HTMLElement>(`[data-object="${CSS.escape(id)}"]`);
      const el=controls.current;
      if(icon&&el){ const rect=icon.getBoundingClientRect(); el.style.left=`${rect.left+rect.width/2}px`;el.style.top=`${rect.top-30}px`;el.style.visibility=rect.width&&icon.dataset.windowOpen!=='true'?'visible':'hidden'; }
      frame=requestAnimationFrame(place);
    }; place(); return()=>cancelAnimationFrame(frame);
  },[ctx.enabled,floating,id,mounted]);
  if(!ctx.enabled || !mounted)return null;
  const act=(type:'select'|'trash')=>{
    if(ctx.session)ctx.send({type,id});
    else location.href=`${STUDIO_PATH}?thing=${encodeURIComponent(id)}${type==='trash'?'&trash=1':''}`;
  };
  const ui=<div ref={controls} className="thing-edit-controls" style={{position:floating?'fixed':'relative',display:'flex',gap:4,justifyContent:'center',zIndex:floating?10:1,transform:floating?'translateX(-50%)':undefined}}>
    <button type="button" aria-label={`Edit ${name}`} title={`Edit ${name}`} onClick={()=>act('select')} style={{background:'#fff',color:'#1738a0',borderRadius:5,padding:'3px 8px',fontSize:16,cursor:'pointer'}}>✎</button>
    <button type="button" aria-label={`Trash ${name}`} title={`Trash ${name}`} onClick={()=>act('trash')} style={{background:'#fff',color:'#cf2424',borderRadius:5,padding:'3px 8px',fontSize:16,cursor:'pointer'}}>×</button>
  </div>;
  return floating?createPortal(ui,document.body):ui;
}
/** Compatibility adapter for EmDash 1.0.1's toolbar; never replaces native controls. */
export function ThingsToolbar() {
  const ctx=useContext(AuthoringContext);const [target,setTarget]=useState<HTMLElement|null>(null);
  useEffect(()=>{
    if(!ctx.enabled||ctx.session||location.pathname!=='/')return;
    const find=()=>setTarget(document.getElementById('emdash-toolbar'));
    find();const observer=new MutationObserver(find);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();
  },[ctx.enabled,ctx.session]);
  return target?createPortal(<a href={`${STUDIO_PATH}?new=1`} title="Create a Thing" aria-label="Create a Thing" style={{fontSize:24,padding:'0 12px',textDecoration:'none'}}>+</a>,target):null;
}

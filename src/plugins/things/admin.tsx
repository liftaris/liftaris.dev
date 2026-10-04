import { useCallback, useEffect, useRef, useState } from 'react';
import { MediaPickerModal, PortableTextEditor, apiFetch, parseApiResponse, fetchContent, createContent, updateContent,
  publishContent, deleteContent, restoreContent, getPreviewUrl, fetchManifest, acquireEntryLock, releaseEntryLock,
  type ContentItem, type ContentEditorPanelExtension, type ContentListColumnExtension, type PortableTextEditorProps, type MediaItem } from '@emdash-cms/admin';
import { Button } from '@cloudflare/kumo';
import { DEFAULT_DATA, STUDIO_PATH, mediaUrl, pathFor, slugFromName, dependentNames, canAddToFolder, type ThingRecord, type ThingData } from '../../lib/things/model';
import { messageFor, validMessage } from '../../lib/things/bridge';
import { EMOJI_CATALOG } from '../../lib/house/emoji';
import './workspace.css';

type Draft = ThingRecord;
function Workspace() {
  const [pluginBlocks,setPluginBlocks]=useState<PortableTextEditorProps['pluginBlocks']>();
  const [posts,setPosts]=useState<{id:string;title:string;status:string}[]>([]);
  const [things, setThings] = useState<ThingRecord[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const current = useRef<Draft | null>(null);
  const item = useRef<ContentItem | null>(null);
  const dirty = useRef(false);
  const generation = useRef(0);
  const pending = useRef<Promise<void> | null>(null);
  const [state, setState] = useState('Loading');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [emojiQuery, setEmojiQuery] = useState('');
  const [folderQuery, setFolderQuery] = useState('');
  const [picker, setPicker] = useState<'image' | 'background_image' | null>(null);
  const [lastTrashed, setLastTrashed] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [session] = useState(() => crypto.randomUUID());
  const frame = useRef<HTMLIFrameElement>(null);
  const graph = useRef(things); graph.current = things;
  const [ready, setReady] = useState(0);
  const [previewReady,setPreviewReady]=useState(false);
  const lock = useRef<{id: string; token?: string} | null>(null);
  const [locked, setLocked] = useState(false);
  const setCurrent = (next: Draft | null) => { current.current = next; setDraft(next); };
  const fail = (e: unknown) => { const message=e instanceof Error ? e.message : String(e);setError(message);setState(/conflict|revision|changed since/i.test(message)?'Conflict':'Save failed'); };
  const reload = useCallback(async () => {
    const result = await parseApiResponse<{things: ThingRecord[];posts:{id:string;title:string;status:string}[]}>(await apiFetch('/_emdash/api/plugins/liftaris-things/graph'), 'Could not load Things');
    setPosts(result.posts); setThings(result.things); graph.current = result.things; return result.things;
  }, []);
  const unlock = async () => { const old = lock.current; lock.current = null; if (old) await releaseEntryLock('things', old.id, { token: old.token }); };
  const open = async (id: string) => {
    await save(); await unlock();
    // Read the revision before the graph so a concurrent edit can only make
    // our token stale, never authorize overwriting an older graph snapshot.
    const content = await fetchContent('things', id);
    const record = graph.current.length ? graph.current : await reload();
    const found = record.find(t => t.id === id); if (!found) throw new Error('This Thing is no longer available.');
    item.current = content; setCurrent({ ...found, data: { ...found.data, ...(content.data as Record<string, unknown>) } }); dirty.current = false; setPreviewUrl(undefined); setError('');
    const acquired = await acquireEntryLock('things', id);
    lock.current = { id, token: undefined }; setLocked(!(acquired.heldByCaller || !acquired.enabled));
    if (!(acquired.heldByCaller || !acquired.enabled)) setError('Another editor holds this Thing. Open it after they finish.');
    setState('Saved');
    const url = new URL(location.href); url.searchParams.set('thing', id); url.searchParams.delete('new'); history.replaceState({}, '', url);
    void refreshPreview(id);
  };
  async function refreshPreview(id: string) {
    const preview = await getPreviewUrl('things', id, { pathPattern: '/things-preview/{id}' });
    if (current.current?.id === id) setPreviewUrl(preview?.url ? preview.url + (preview.url.includes('?')?'&':'?') + 'things-rev=' + encodeURIComponent(item.current?._rev ?? '') : undefined);
  }
  function patch(values: Partial<ThingData>) {
    if (!current.current || locked) return;
    dirty.current = true; generation.current++; setState('Unsaved'); setError('');
    const slug=current.current.id==='new' && values.name ? slugFromName(values.name) : current.current.slug;
    setCurrent({ ...current.current, slug, data: { ...current.current.data, ...values } });
  }
  function patchRecord(values: Partial<ThingRecord>) {
    if (!current.current || locked) return;
    dirty.current = true; generation.current++; setState('Unsaved'); setError(''); setCurrent({ ...current.current, ...values });
  }
  async function save(): Promise<void> {
    if (pending.current) await pending.current;
    const value = current.current;
    if (!value || !dirty.current || locked) return;
    if (!value.data.name.trim()) throw new Error('Give this Thing a name.');
    const version = generation.current;
    const write = async () => {
      setState('Saving');
      await parseApiResponse(await apiFetch('/_emdash/api/plugins/liftaris-things/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}),'This Thing cannot be saved');
      const data = Object.fromEntries(Object.entries(value.data).filter(([key]) => key in DEFAULT_DATA || key === 'date'));
      const payload = { data, slug: value.slug, references: { contents: value.contents, primary_folder: value.primaryFolder ? [value.primaryFolder] : [], post: value.data.page_source==='post' && value.postId ? [value.postId] : [] } };
      let result = value.id === 'new' ? await createContent('things', { ...payload, status: 'draft' })
        : await updateContent('things', value.id, { ...payload, _rev: item.current?._rev });
      item.current = result;
      if(value.id === 'new') {
        // Native create only accepts draft. Remember its ID before publishing
        // so a failed publication can be retried without creating a duplicate.
        if(current.current?.id==='new')setCurrent({...current.current,id:result.id});
        await acquireEntryLock('things',result.id); lock.current={id:result.id};
      }
      if(result.status!=='published')result=await publishContent('things',result.id,{_rev:result._rev});
      item.current=result;
      // Preserve edits made during a request; advance only the acknowledged revision.
      if (current.current?.id === result.id) {
        setCurrent({ ...current.current, id: result.id });
        dirty.current = generation.current !== version;
      }
      if (value.primaryFolder) {
        const parentThing = graph.current.find(t => t.id === value.primaryFolder);
        if (!parentThing || !parentThing.contents.includes(result.id)) {
          const parent = await fetchContent('things', value.primaryFolder);
          const parentContents = (parent.references as { contents?: { entries?: { id: string }[] } } | undefined)?.contents?.entries?.map(e => e.id) ?? parentThing?.contents ?? [];
          if (!parentContents.includes(result.id)) {
            await updateContent('things', value.primaryFolder, { data: {}, references: { contents: [...parentContents, result.id] }, _rev: parent._rev });
          }
        }
      }
      await reload(); await refreshPreview(result.id);
      setState(dirty.current ? 'Unsaved' : 'Saved');
    };
    pending.current = write();
    try { await pending.current; } finally { pending.current = null; }
    if (dirty.current && generation.current !== version) await save();
  }
  async function trash(id: string) {
    await save(); const target = graph.current.find(t => t.id === id); if (!target) return;
    const dependents = dependentNames(id, graph.current.filter(t => t.status === 'published'));
    if (dependents.length) throw new Error('First reassign the primary folder of: ' + dependents.join(', '));
    const appearances = graph.current.filter(t => t.contents.includes(id)).map(t => t.data.name);
    if (!confirm(`Move ${target.data.name} to trash everywhere?\n${[...(target.data.desktop ? ['Homepage'] : []), ...appearances].join(', ')}\nIts contents will not be deleted.`)) return;
    await deleteContent('things', id); setLastTrashed(id); lock.current=null; setCurrent(null); dirty.current = false; await reload(); setState('Moved to trash');
  }
  async function create(kind: 'page' | 'folder' | 'picture') {
    await save(); await unlock(); item.current = null; setLocked(false);
    const data = { ...DEFAULT_DATA, name: kind === 'page' ? 'New page' : kind === 'picture' ? 'New picture' : 'New folder', kind: kind === 'page' ? 'page' as const : 'folder' as const,
      emoji: kind === 'page' ? '📄' : kind === 'picture' ? '🖼️' : '📁' };
    setCurrent({ id: 'new', slug: slugFromName(data.name) + '-' + crypto.randomUUID().slice(0, 4), status: 'published', data, contents: [], primaryFolder: null, postId:null });
    dirty.current = true; generation.current++; setState('New Thing'); setError(''); setPreviewUrl(undefined);
    if (kind === 'picture') setPicker('background_image');
  }
  useEffect(() => {
    document.cookie = 'emdash-edit-mode=true;path=/;samesite=lax';
    setPreviewReady(true);
    void fetchManifest().then(m=>setPluginBlocks(Object.entries(m.plugins).flatMap(([pluginId,p])=>(p.portableTextBlocks ?? []).map(b=>({...b,pluginId}))))).catch(fail);
    void reload().then(async () => {
      const params = new URLSearchParams(location.search); const id = params.get('thing');
      if (id) { await open(id); if(params.has('trash')) await trash(id); } else if (params.has('new')) await create('folder'); else setState('Choose a Thing');
    }).catch(fail);
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current || pending.current) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); const l = lock.current; if (l) void releaseEntryLock('things', l.id, { token: l.token, keepalive: true }); };
  }, []);
  useEffect(() => {
    if (!dirty.current || locked || error) return;
    const timer = setTimeout(() => { void save().catch(fail); }, 700);
    return () => clearTimeout(timer);
  }, [draft, locked, error]);
  useEffect(() => {
    const timer = setInterval(() => { const l = lock.current; if (l) void acquireEntryLock('things', l.id, { token: l.token }).then(next => { if (!(next.heldByCaller || !next.enabled)) { setLocked(true); setError('The edit lock was lost. Reload before saving.'); } }).catch(fail); }, 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!validMessage(event, frame.current?.contentWindow ?? null, session)) return;
      const message = event.data;
      if (message.type === 'ready') setReady(n => n + 1);
      if (message.type === 'select') void open(message.id).catch(fail);
      if (message.type === 'trash') void trash(message.id).catch(fail);
      if ((message.type === 'resize' || message.type === 'position') && current.current?.id === message.id) {
        if (message.type === 'position') patch({ spawn_x: Math.round(message.spawn_x * 1000) / 1000, spawn_y: Math.round(message.spawn_y * 1000) / 1000 });
        else patch({ window_width: message.window_width, window_height: message.window_height });
      }
    };
    window.addEventListener('message', receive); return () => window.removeEventListener('message', receive);
  }, [locked]);
  useEffect(() => {
    const snapshot = draft ? [...things.filter(t => t.id !== draft.id), draft] : things;
    frame.current?.contentWindow?.postMessage(messageFor(session, { type: 'snapshot', things: snapshot, selected: draft?.id ?? null, previewUrl }), location.origin);
  }, [draft, things, session, ready, previewUrl]);
  const act = (task: () => Promise<unknown>) => { setError(''); void task().catch(fail); };
  const d = draft?.data;
  const text = (key: keyof ThingData, label: string) => <label>{label}<input value={String(d?.[key] ?? '')} onChange={e => patch({ [key]: e.target.value })} /></label>;
  const number = (key: keyof ThingData, label: string, min: number, max: number, step: number | string = 1) => <label>{label}<input type="number" min={min} max={max} step={step} value={Number(d?.[key] ?? 0)} onChange={e => { const value = e.target.valueAsNumber; if (Number.isFinite(value)) patch({ [key]: Math.min(max, Math.max(min, value)) }); }} /></label>;
  const toggle = (key: keyof ThingData, label: string) => <label className="thing-check"><input type="checkbox" checked={Boolean(d?.[key])} onChange={e => patch({ [key]: e.target.checked })} />{label}</label>;
  let route = 'No public page'; try { route = draft ? pathFor(draft, [...things.filter(t => t.id !== draft.id), draft]) ?? route : route; } catch(e) { route = e instanceof Error ? e.message : route; }
  return <div className="things-workspace">
    <header><div><h1>Things</h1><p>Arrange your world. Changes save automatically and appear on the site.</p></div><div className="thing-actions"><Button onClick={() => act(() => create('page'))}>+ Page</Button><Button onClick={() => act(() => create('folder'))}>+ Folder</Button><Button onClick={() => act(() => create('picture'))}>+ Picture</Button></div></header>
    <div className="things-layout"><section className="things-preview" aria-label="Interactive site preview">{previewReady && <iframe ref={frame} src={`/?_edit&things-session=${session}`} title="Portfolio live preview" />}<p>Drag the selected icon to set its starting position. Open its window and drag an edge to set its size.</p></section>
    <aside className="things-inspector"><label>Find a Thing<input type="search" placeholder="Search names…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <select aria-label="Choose a Thing" value={draft?.id === 'new' ? '' : draft?.id ?? ''} onChange={e => e.target.value && act(() => open(e.target.value))}><option value="">Choose a Thing…</option>{things.filter(t => t.data.name.toLowerCase().includes(query.toLowerCase())).map(t => <option key={t.id} value={t.id}>{t.data.name}</option>)}</select>
      <div className="thing-savebar"><span role="status">{state}</span><Button variant="primary" disabled={!draft || locked} onClick={() => act(save)}>Save</Button></div>
      {error && <p role="alert" className="thing-error">{error}</p>}
      {lastTrashed && <Button onClick={() => act(async () => { await restoreContent('things', lastTrashed); const restored=await fetchContent('things',lastTrashed); await publishContent('things',lastTrashed,{_rev:restored._rev}); const id = lastTrashed; setLastTrashed(null); await open(id); })}>Restore trashed Thing</Button>}
      {!d || !draft ? <p>Select an icon in the preview or create a Thing to get started.</p> : <fieldset disabled={locked}>
        <details open><summary>Identity</summary>{text('name', 'Name')}<label>Kind<select value={d.kind} onChange={e => patch({ kind: e.target.value as ThingData['kind'] })}><option value="page">Page</option><option value="folder">Folder / picture</option><option value="application">Application</option></select></label></details>
        <details open><summary>Icon</summary><div className="thing-icon-preview">{d.icon_type === 'image' && mediaUrl(d.image) ? <img src={mediaUrl(d.image)!} alt="Selected icon" /> : d.emoji}</div>
          <div className="thing-actions"><Button onClick={() => patch({icon_type: 'emoji'})}>Emoji</Button><Button onClick={() => { patch({icon_type: 'image'}); setPicker('image'); }}>Image…</Button></div>
          {d.icon_type === 'emoji' && <>{text('emoji', 'Emoji')}<input aria-label="Search emoji" placeholder="Search emoji…" value={emojiQuery} onChange={e => setEmojiQuery(e.target.value)} /><div className="thing-emoji-grid">{EMOJI_CATALOG.filter(e => `${e.name} ${e.keywords}`.includes(emojiQuery.toLowerCase())).slice(0, 36).map(e => <button key={e.id} title={e.name} aria-label={e.name} onClick={() => patch({emoji: e.emoji})}>{e.emoji}</button>)}</div></>}
          <div className="thing-pair">{number('width', 'Width',24,240)}{number('height','Height',24,240)}</div></details>
        <details open><summary>Window</summary><div className="thing-pair">{number('window_width','Width',180,2560)}{number('window_height','Height',100,1800)}</div>{toggle('default_open','Open on arrival')}</details>
        {d.kind === 'page' && <details open><summary>Page content</summary><label>Source<select value={d.page_source} onChange={e => patch({page_source:e.target.value as ThingData['page_source']})}>{['content','post','projects','experience','github','clump'].map(s => <option key={s}>{s}</option>)}</select></label>{d.page_source === 'content' ? <><PortableTextEditor pluginBlocks={pluginBlocks} value={d.body as PortableTextEditorProps['value']} onChange={body => patch({body})} /></> : d.page_source==='post' ? <><label>Post<select aria-label="Post" value={draft.postId ?? ''} onChange={e=>patchRecord({postId:e.target.value||null})}><option value="">Choose a Post…</option>{posts.map(p=><option key={p.id} value={p.id}>{p.title}{p.status==='published'?'':' · Unpublished'}</option>)}</select></label>{draft.postId&&<a href={`/_emdash/admin/content/posts/${draft.postId}`}>Edit Post content →</a>}<p>Post content and publishing are managed in Posts. Unpublished Posts stay hidden from visitors.</p></> : <p>This page’s content is maintained in code. Its icon, name, and window are editable here.</p>}</details>}
        {d.kind === 'application' && <details open><summary>Application</summary><p>Leave a Gift · uses the existing gift composer.</p></details>}
        {d.kind === 'folder' && <details open><summary>Folder contents</summary><ol>{draft.contents.map((id,i) => <li key={id}><span>{things.find(t=>t.id===id)?.data.name ?? 'Unavailable Thing'} · {things.find(t=>t.id===id)?.primaryFolder === draft.id ? 'Primary placement' : 'Shortcut'}</span><button aria-label="Move up" disabled={!i} onClick={() => {const ids=[...draft.contents]; [ids[i-1],ids[i]]=[ids[i],ids[i-1]];patchRecord({contents:ids});}}>↑</button><button aria-label="Remove from folder" onClick={() => patchRecord({contents:draft.contents.filter(x=>x!==id)})}>Remove</button></li>)}</ol><input type="search" aria-label="Find folder contents" placeholder="Find a Thing to add…" value={folderQuery} onChange={e=>setFolderQuery(e.target.value)} /><select aria-label="Add existing Thing" value="" onChange={e => e.target.value && patchRecord({contents:[...draft.contents,e.target.value]})}><option value="">Add a Thing…</option>{things.filter(t=>!draft.contents.includes(t.id)&&canAddToFolder(draft.id,t.id,things)&&t.data.name.toLowerCase().includes(folderQuery.toLowerCase())).map(t=><option key={t.id} value={t.id}>{t.data.name}</option>)}</select>
          <Button onClick={()=>setPicker('background_image')}>Choose background…</Button>{mediaUrl(d.background_image)&&<><img className="thing-background-preview" src={mediaUrl(d.background_image)!} alt="Folder background"/><Button onClick={()=>patch({background_image:null})}>Remove background</Button></>}
          {(['background_size','background_position','background_repeat'] as const).map(key=><label key={key}>{key.replace('background_','')}<select value={d[key]} onChange={e=>patch({[key]:e.target.value})}>{(key==='background_size'?['cover','contain','auto','100% 100%','50%','75%','150%','200%']:key==='background_position'?['center','top','bottom','left','right','top left','top right','bottom left','bottom right']:['no-repeat','repeat','repeat-x','repeat-y','round','space']).map(v=><option key={v}>{v}</option>)}</select></label>)}</details>}
        <details open><summary>Location</summary>{toggle('desktop','Show on homepage')}<div className="thing-pair">{number('spawn_x','Starting X (0–1)',0,1,0.001)}{number('spawn_y','Starting Y (0–1)',0,1,0.001)}</div>{number('sort_order','Homepage order',0,100000)}<label>URL slug<input value={draft.slug} onChange={e=>patchRecord({slug:e.target.value})}/></label><label>Primary folder<select value={draft.primaryFolder ?? ''} onChange={e=>patchRecord({primaryFolder:e.target.value||null})}><option value="">Site root</option>{things.filter(t=>t.id!==draft.id&&t.data.kind==='folder').map(t=><option key={t.id} value={t.id}>{t.data.name}</option>)}</select></label>{text('path_override','Custom path (optional)')}<output>{route}</output></details>
        {draft.id!=='new'&&<div className="thing-actions"><a href={`/_emdash/admin/content/things/${draft.id}`}>History & advanced settings</a><Button onClick={()=>act(()=>trash(draft.id))}>Move to trash</Button></div>}
      </fieldset>}
    </aside></div>
    <MediaPickerModal open={picker!==null} onOpenChange={v=>!v&&setPicker(null)} mediaKind="image" mimeTypeFilter="image/*" onSelect={(media: MediaItem)=>{ if(picker)patch({[picker]:{id:media.id,src:media.url,alt:media.alt??'',width:media.width,height:media.height}});setPicker(null); }}/>
  </div>;
}
export const pages = { '/workspace': Workspace };
export const contentEditorPanels = [{ id:'things-workspace', title:'Visual workspace', collections:['things'], component: ({entry})=><a href={`${STUDIO_PATH}?thing=${entry.id}`}>Edit this Thing beside the live site →</a> }] satisfies readonly ContentEditorPanelExtension[];
export const contentListColumns = [{ id:'thing-workspace',label:'Visual editor',collections:['things'],cell:({item})=><a href={`${STUDIO_PATH}?thing=${item.id}`}>Open workspace</a> }] satisfies readonly ContentListColumnExtension[];

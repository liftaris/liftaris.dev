import { expect, test } from 'bun:test';

// Isolate host-module doubles: other tests exercise the real EmDash runtime.
test('concurrent Thing reads preserve ordering, pagination, visibility and request context', () => {
  const script = `
    import {mock} from 'bun:test';
    let context={editMode:true,preview:{collection:'things',id:'folder'}}, active=0, peak=0;
    const options={},seenContexts=[];
    const data=(id,kind,page_source='content')=>({id,slug:id,name:id,kind,page_source,status:'published'});
    const entries=[data('folder','folder'),data('article','page','post'),data('hidden','page','post')];
    mock.module('emdash/request-context',()=>({getRequestContext:()=>context,runWithContext:async(next,fn)=>{const old=context;context=next;try{return await fn()}finally{context=old}}}));
    mock.module('emdash',()=>({
      getEmDashCollection:async(_,opts)=>{seenContexts.push({...context});return opts.cursor ? {entries:[{data:data('app','application')}]} : {entries:entries.map(data=>({data})),nextCursor:'more-things'}},
      getEmDashEntry:async(_,id,opts)=>{
        options[id]=opts.references;peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,1));active--;
        const value=entries.find(e=>e.id===id)??data('app','application');
        return {entry:{id,data:value,references:{
          contents:id==='folder'?{entries:[{data:{id:'article'}}],nextCursor:'more-contents'}:undefined,
          post:{entries:id==='article'?[{data:{id:'post-id'}}]:[]},
          primary_folder:{entries:id==='article'?[{data:{id:'folder'}}]:[]},
        }}};
      },
      getEmDashReferences:async(_,id,field,opts)=>{if(id!=='folder'||field!=='contents'||opts.cursor!=='more-contents')throw Error('Bad cursor');return {entries:[{data:{id:'app'}}]}},
    }));
    const {readThings}=await import(${JSON.stringify(new URL('./read.ts', import.meta.url).href)});
    const rows=await readThings('published');
    console.log(JSON.stringify({ids:rows.map(r=>r.id),contents:rows[0].contents,post:rows[1].postId,parent:rows[1].primaryFolder,peak,options,seenContexts,restored:context.editMode}));
  `;
  const process = Bun.spawnSync([Bun.argv[0], '--eval', script]);
  expect(process.exitCode).toBe(0);
  const result = JSON.parse(process.stdout.toString().trim());
  expect(result.ids).toEqual(['folder', 'article', 'app']);
  expect(result.contents).toEqual(['article', 'app']);
  expect(result.post).toBe('post-id');
  expect(result.parent).toBe('folder');
  expect(result.peak).toBe(3);
  expect(result.options.folder).toEqual({primary_folder:{limit:1},contents:{limit:100}});
  expect(result.options.article).toEqual({primary_folder:{limit:1},post:{limit:1}});
  expect(result.options.app).toEqual({primary_folder:{limit:1}});
  expect(result.seenContexts).toEqual([{editMode:false},{editMode:false}]);
  expect(result.restored).toBe(true);
});

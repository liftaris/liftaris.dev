import {mock} from 'bun:test';
mock.module('virtual:emdash/config',()=>({default:{}}));
const {EmDashRuntime}=await import('emdash/internal/plugin-test-runtime');
import {runWithContext} from 'emdash/request-context';
import type {Database} from 'emdash';
import type {Kysely} from 'kysely';
export function testRuntime(db:Kysely<Database>){return runWithContext({db,dbIsIsolated:true,editMode:false},()=>EmDashRuntime.create({config:{} as Parameters<typeof EmDashRuntime.create>[0]['config'],plugins:[],createDialect:()=>{throw new Error('Unexpected connection');},createStorage:null,sandboxEnabled:false,sandboxedPluginEntries:[],createSandboxRunner:null}));}

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  check: { type: 'boolean', default: false },
  'skip-build': { type: 'boolean', default: false },
  target: { type: 'string', default: 'production' },
  'preview-name': { type: 'string' }, origin: { type: 'string' },
} });
const targets = {
  production: { id: '0e886ca8-384e-4090-8035-c187268c7da7', origin: 'https://www.liftaris.dev' },
  preview: { id: '6bf414ef-c86a-4674-b7ab-e0dac70f7bf6', origin: values.origin },
};
if (values.target !== 'production' && values.target !== 'preview') throw new Error('Choose production or preview.');
const target = targets[values.target];
const preview = values.target === 'preview';
if (preview && !values.check && (!values['preview-name'] || !target.origin)) throw new Error('Preview deployment requires --preview-name and --origin.');
const account = '8df695f5ca97195e8c6f4896b81be028';
const fingerprint = createHash('sha256').update(JSON.stringify({ kind: 'd1', identity: [account, target.id] })).digest('hex');
const env: Record<string, string | undefined> = { ...process.env, CLOUDFLARE_ACCOUNT_ID: account, NO_COLOR: '1' };
async function run(args: string[], capture = false) {
  const child = Bun.spawn(args, { env, stdin: 'ignore', stdout: capture ? 'pipe' : 'inherit', stderr: 'inherit' });
  const output = capture ? await new Response(child.stdout).text() : '';
  if (await child.exited !== 0) throw new Error(`${args.slice(0, 3).join(' ')} failed; deployment stopped.`);
  return output;
}
if (!values['skip-build']) await run([process.execPath, 'run', 'build']);
const configPath = 'dist/server/wrangler.json';
const config = JSON.parse(await readFile(configPath, 'utf8'));
const bindings = preview ? config.previews?.d1_databases : config.d1_databases;
if (config.name !== 'liftaris-dev' || bindings?.length !== 1 || bindings[0].binding !== 'DB' || bindings[0].database_id !== target.id) {
  throw new Error('Built Worker database binding does not match the explicit migration target.');
}
const manifest = '.emdash/migrations.json';
const builtManifest = JSON.parse(await readFile(manifest, 'utf8'));
if (builtManifest.database.executorEntrypoint !== '@emdash-cms/cloudflare/internal/db/d1-migrations' || builtManifest.database.executorConfig.binding !== 'DB') {
  throw new Error('Unexpected migration executor or binding.');
}
async function artifactHash() {
  const hash = createHash('sha256');
  async function walk(path: string) {
    for (const name of (await readdir(path)).sort()) {
      const file = join(path, name);
      if ((await stat(file)).isDirectory()) await walk(file);
      else { hash.update(file); hash.update(await readFile(file)); }
    }
  }
  await walk('dist');
  hash.update(await readFile(manifest));
  return hash.digest('hex');
}
const artifact = await artifactHash();
if (!env.CLOUDFLARE_API_TOKEN) {
  // Reuse Wrangler's local login without exposing credentials in output/files.
  const auth = JSON.parse(await run(['node_modules/.bin/wrangler', 'auth', 'token', '--json'], true));
  if (!auth.token) throw new Error('Set CLOUDFLARE_API_TOKEN with D1 permissions.');
  env.CLOUDFLARE_API_TOKEN = auth.token;
}
const migrationArgs = ['node_modules/.bin/emdash', 'migrate', '--manifest', manifest,
  '--account-id', account, '--d1', target.id, '--expected-target-fingerprint', fingerprint, '--json'];
type Status = { target: { fingerprint: string }; pending: string[]; unknownApplied: string[]; lock?: unknown };
function verify(status: Status, requireCurrent = false) {
  if (status.target.fingerprint !== fingerprint || status.unknownApplied.length || status.lock || (requireCurrent && status.pending.length)) {
    throw new Error('Migration target, schema, or lock check failed; deployment stopped.');
  }
}
const before: Status = JSON.parse(await run([...migrationArgs, '--status'], true));
verify(before);
console.log(JSON.stringify({ target: values.target, database: target.id, fingerprint, artifact, pending: before.pending }, null, 2));
if (values.check) process.exit(0);
const auditDir = `.emdash/deployments/${new Date().toISOString().replaceAll(':', '-')}-${values.target}`;
await mkdir(auditDir, { recursive: true, mode: 0o700 });
if (before.pending.length) {
  // D1 SQL exports cannot include EmDash's FTS virtual tables. Record a Time
  // Travel restore point instead; retain this audit directory in CI artifacts.
  const backup = JSON.parse(await run(['node_modules/.bin/wrangler', 'd1', 'time-travel', 'info', target.id, '--json'], true));
  if (typeof backup.bookmark !== 'string' || !backup.bookmark) throw new Error('No database restore bookmark available.');
  await writeFile(`${auditDir}/restore-point.json`, JSON.stringify({ database: target.id, recordedAt: new Date().toISOString(), ...backup }, null, 2));
  verify(JSON.parse(await run(migrationArgs, true)), true);
}
verify(JSON.parse(await run([...migrationArgs, '--check'], true)), true);
if (await artifactHash() !== artifact) throw new Error('Build artifact changed after migration validation.');
await writeFile(`${auditDir}/artifact.json`, JSON.stringify({ artifact, fingerprint, target: values.target, manifest: builtManifest }, null, 2));
// Explicit built config prevents Wrangler from rebuilding a different artifact.
const output = await run(['node_modules/.bin/wrangler', preview ? 'preview' : 'deploy', '--config', configPath,
  ...(preview ? ['--name', values['preview-name']!, '--ignore-base-config', '--json'] : [])], true);
console.log(output);
await writeFile(`${auditDir}/deploy.log`, output);
const version = preview ? JSON.parse(output).deployment.id : output.match(/Current Version ID:\s*([a-f0-9-]{36})/i)?.[1];
if (!version) throw new Error('Deployment finished, but version could not be identified. Inspect deploy.log before warming.');
await run([process.execPath, 'tools/performance.ts', '--warm', '--origin', target.origin!, '--version', version, '--out', `${auditDir}/warm.json`]);

import { env } from 'cloudflare:workers';
import {
  getTransformFingerprint, isNotModified, matchInternalMediaKey,
  originalMediaHeaders, parseTransformParams, resolveTransformQuality, validatorHeaders,
} from 'emdash/media/image-endpoint';
import type { ThingSpec } from '../lib/things/scene';
import { readOnce } from './things/request-cache';

const VERSIONED_MEDIA = /^\/_media\/([a-f0-9]{32}(?:-\d+)?)\/([A-Za-z0-9._-]+)$/;
const FORMATS = { webp: 'image/webp', avif: 'image/avif', jpeg: 'image/jpeg', png: 'image/png' } as const;
const versionKey = (version: string, key: string) => `.liftaris-versions/${version}/${key}`;

export async function versionImage(src: string): Promise<string> {
  const key = matchInternalMediaKey(src);
  if (!key) return src;
  return readOnce(`media:${key}`, async () => {
    const current = await env.MEDIA.head(key);
    if (!current?.httpMetadata?.contentType?.startsWith('image/')) return src;
    if (await env.MEDIA.head(versionKey(current.etag, key))) return `/_media/${current.etag}/${key}`;
    const object = await env.MEDIA.get(key);
    if (!object) return src;
    if (!object.httpMetadata?.contentType?.startsWith('image/')) {
      await object.body.cancel();
      return src;
    }
    await env.MEDIA.put(versionKey(object.etag, key), object.body, { httpMetadata: object.httpMetadata });
    return `/_media/${object.etag}/${key}`;
  });
}

export async function versionThings(things: readonly ThingSpec[]): Promise<ThingSpec[]> {
  return Promise.all(things.map(async thing => {
    const [image, background_image] = await Promise.all([
      thing.image ? versionImage(thing.image) : null,
      thing.background_image ? versionImage(thing.background_image) : null,
    ]);
    return { ...thing, image, background_image };
  }));
}

export async function serveVersionedMedia(request: Request): Promise<Response> {
  const fail = (status: number) => new Response(null, { status, headers: {
    'Cache-Control': 'no-store', 'Cloudflare-CDN-Cache-Control': 'no-store',
  } });
  if (request.method !== 'GET' && request.method !== 'HEAD') return fail(405);
  const url = new URL(request.url);
  const match = VERSIONED_MEDIA.exec(url.pathname);
  const keys = [...url.searchParams.keys()];
  if (!match || new Set(keys).size !== keys.length || keys.some(key => !['w', 'h', 'f', 'q'].includes(key))) return fail(400);
  const transform = url.search ? parseTransformParams(url.searchParams) : null;
  if (transform && !transform.ok) return fail(400);
  const [, version, key] = match;
  const object = await env.MEDIA.get(versionKey(version, key));
  if (!object) return fail(404);
  const contentType = object.httpMetadata?.contentType ?? '';
  if (!contentType.startsWith('image/')) {
    await object.body.cancel();
    return fail(404);
  }
  const fingerprint = `${version}:${getTransformFingerprint(url.searchParams)}`;
  const headers = new Headers({
    ...originalMediaHeaders(contentType),
    ...validatorHeaders(object.size, object.uploaded, fingerprint),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000',
  });
  if (request.headers.has('Range')) {
    headers.set('Cache-Control', 'no-store');
    headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  }
  if (isNotModified(request, object.size, object.uploaded, fingerprint)) {
    await object.body.cancel();
    return new Response(null, { status: 304, headers });
  }
  let body = object.body;
  if (transform?.ok) {
    const { width, height, format, quality } = transform.options;
    const output = await env.IMAGES.input(body).transform({ width, height })
      .output({ format: FORMATS[format], quality: resolveTransformQuality(format, quality) });
    const response = output.response();
    if (!response.body) return fail(502);
    body = response.body;
    headers.set('Content-Type', response.headers.get('Content-Type') ?? FORMATS[format]);
    headers.set('Content-Disposition', 'inline');
  }
  if (request.method === 'HEAD') {
    await body.cancel();
    return new Response(null, { headers });
  }
  return new Response(body, { headers });
}

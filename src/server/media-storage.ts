import { R2Storage } from '@emdash-cms/cloudflare/storage/r2';
import { cache, env } from 'cloudflare:workers';
import { MEDIA_CACHE_TAG } from './cache-tags';

class MediaStorage extends R2Storage {
  override async upload(options: Parameters<R2Storage['upload']>[0]) {
    try {
      return await super.upload(options);
    } finally {
      if (import.meta.env.PROD && options.contentType.startsWith('image/')) await cache.purge({ tags: [MEDIA_CACHE_TAG] });
    }
  }

  override async delete(key: string) {
    const image = (await env.MEDIA.head(key))?.httpMetadata?.contentType?.startsWith('image/');
    try {
      await super.delete(key);
    } finally {
      if (import.meta.env.PROD && image) await cache.purge({ tags: [MEDIA_CACHE_TAG] });
    }
  }
}

export function createStorage() {
  return new MediaStorage(env.MEDIA);
}

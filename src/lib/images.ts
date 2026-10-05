/** URL adapter for Astro's image endpoint, wrapped by EmDash on Cloudflare.
 * CMS originals are read through R2; public assets through ASSETS. Keep this
 * browser-safe so live authoring and the public React renderer use the same path.
 * Leave remote providers, vector artwork and animations to their own delivery.
 */
export function normalizeImageSrc(src: string): string {
  if (!src || typeof src !== 'string') return '';
  if (/^https?:\/\//i.test(src)) {
    try {
      const url = new URL(src);
      if (url.pathname.startsWith('/_emdash/api/media/file/')) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {}
  }
  return src;
}

export function isOptimizableImage(src: string): boolean {
  if (!src || typeof src !== 'string') return false;
  const s = normalizeImageSrc(src);
  if (/^\/_emdash\/api\/media\/file\/[A-Za-z0-9._-]+(?:[?#].*)?$/i.test(s)) return true;
  return /^\/(?![/\\])[^?#]+\.(?:png|jpe?g|webp|avif)(?:[?#].*)?$/i.test(s);
}

export function imageUrl(src: string, width: number, quality = 80): string {
  const normalized = normalizeImageSrc(src);
  if (!isOptimizableImage(normalized)) return src;
  const params = new URLSearchParams({ href: normalized, w: String(Math.min(2400, Math.max(16, Math.round(width)))), f: 'webp', q: String(quality) });
  return `/_image?${params}`;
}

export function imageSources(src: string, width: number): string | undefined {
  const standard = imageUrl(src, width);
  return standard === src ? undefined : `${standard} 1x, ${imageUrl(src, width * 2)} 2x`;
}

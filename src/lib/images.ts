/** URL adapter for Astro's image endpoint, wrapped by EmDash on Cloudflare.
 * CMS originals are read through R2; public assets through ASSETS. Keep this
 * browser-safe so live authoring and the public React renderer use the same path.
 * Leave remote providers, vector artwork and animations to their own delivery.
 */
export function imageUrl(src: string, width: number, quality = 80): string {
  if (!/^\/(?![/\\])[^?#]+\.(?:png|jpe?g|webp|avif)(?:[?#].*)?$/i.test(src)) return src;
  const params = new URLSearchParams({ href: src, w: String(Math.min(2400, Math.max(16, Math.round(width)))), f: 'webp', q: String(quality) });
  return `/_image?${params}`;
}

export function imageSources(src: string, width: number): string | undefined {
  const standard = imageUrl(src, width);
  return standard === src ? undefined : `${standard} 1x, ${imageUrl(src, width * 2)} 2x`;
}

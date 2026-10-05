/** Embedded and full-page views use the same Astro route. */
export function windowPageUrl(href: string): string {
  const url = new URL(href, 'https://portfolio.invalid');
  url.searchParams.set('window', '1');
  return `${url.pathname}${url.search}${url.hash}`;
}

import { writeFile } from 'node:fs/promises';
import data from 'emojibase-data/en/data.json';

// Labels and search metadata come from CLDR; IDs are Unicode code points.
const normalize = (emoji: string) => emoji.replace(/\uFE0F/g, '');
const available = data.filter(emoji => emoji.group !== undefined && emoji.group !== 2)
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const byEmoji = new Map(available.map(emoji => [normalize(emoji.emoji), emoji]));
const selected = new Map<string, { id: string; emoji: string; name: string; keywords: string }>();
function add(emoji: typeof data[number], id = `u_${emoji.hexcode.toLowerCase().replaceAll('-', '_')}`) {
  const key = normalize(emoji.emoji);
  if (!selected.has(key)) selected.set(key, {
    id, emoji: key, name: emoji.label, keywords: (emoji.tags ?? []).join(' '),
  });
}
add(byEmoji.get('🎁')!); // Default guestbook icon.

// Fill remaining places across Unicode subgroups, rather than only smileys.
const groups = Map.groupBy(available, emoji => emoji.subgroup);
while (selected.size < 255) {
  const before = selected.size;
  for (const emojis of groups.values()) {
    const next = emojis.find(emoji => !selected.has(normalize(emoji.emoji)));
    if (next) add(next);
    if (selected.size === 255) break;
  }
  if (selected.size === before) throw new Error('Not enough emoji to fill the catalog');
}
if (new Set([...selected.values()].map(emoji => emoji.id)).size !== 255) throw new Error('Duplicate emoji ID');
const output = '[\n' + [...selected.values()].map(emoji => '  ' + JSON.stringify(emoji)).join(',\n') + '\n]\n';
await writeFile(new URL('../src/lib/house/emoji-catalog.json', import.meta.url), output);
console.log(`Generated ${selected.size} emojis from emojibase-data.`);

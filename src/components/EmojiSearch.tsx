import { useEffect, useId, useMemo, useState } from 'react';
import { EMOJI_CATALOG, findEmoji, normalizeEmojiPresentation, searchEmojiCatalog } from '../lib/house/emoji';
import type { EmojiOption } from '../lib/house/types';
import '@fontsource-variable/noto-emoji';
import './emoji-search.css';

/** Shared by the public guestbook and the native Things inspector. */
export function EmojiSearch({ value, onSelect, disabled = false, active = true }: {
  value?: string;
  onSelect: (emoji: EmojiOption) => void;
  disabled?: boolean;
  active?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<{ query: string; ids: string[]; source: 'clef' | 'local' }>();
  const id = useId();
  const text = query.trim();
  const local = useMemo(() => searchEmojiCatalog(text), [text]);
  const current = remote?.query === text ? remote : undefined;

  useEffect(() => {
    if (!text || disabled || !active) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch('/api/house/suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }), signal: controller.signal,
      }).then(async response => {
        if (!response.ok) throw new Error('Search unavailable');
        const result: { ids: string[]; source: 'clef' | 'local' } = await response.json();
        if (!Array.isArray(result.ids) || !result.ids.every(id => typeof id === 'string' && findEmoji(id)) || !['clef', 'local'].includes(result.source)) throw new Error('Invalid search result');
        if (!controller.signal.aborted) setRemote({ ...result, query: text });
      }).catch(() => {
        if (!controller.signal.aborted) setRemote({ query: text, ids: [], source: 'local' });
      });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [text, disabled, active]);

  const exact = local.filter(emoji => [emoji.id, emoji.name.toLowerCase(), normalizeEmojiPresentation(emoji.emoji)].includes(normalizeEmojiPresentation(text.toLowerCase())));
  const ids = new Set<string>();
  const options = [...exact, ...(current?.source === 'clef' ? current.ids.map(id => findEmoji(id)!) : []), ...local]
    .filter(emoji => {
      if (ids.has(emoji.id)) return false;
      ids.add(emoji.id);
      return true;
    });
  const status = !text ? `${EMOJI_CATALOG.length} icons` : !current ? 'Finding related icons…' : current.source === 'clef' ? 'Related icons first' : 'Showing name matches; smart search unavailable.';

  return <div className="emoji-search">
    <label htmlFor={id}>Search icons</label>
    <input id={id} type="search" maxLength={200} value={query} disabled={disabled} placeholder="An object, a feeling, an idea…" onChange={event => setQuery(event.target.value)} />
    <p role="status">{status}</p>
    <div className="emoji-search-grid">
      {options.map(emoji => <button key={emoji.id} type="button" disabled={disabled} title={emoji.name} aria-label={emoji.name} aria-pressed={normalizeEmojiPresentation(value ?? '') === normalizeEmojiPresentation(emoji.emoji)} onClick={() => onSelect(emoji)}>{normalizeEmojiPresentation(emoji.emoji)}</button>)}
      {!options.length && <p>No matching icons.</p>}
    </div>
  </div>;
}

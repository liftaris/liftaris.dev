import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { createGift, ensureVisitor, getGift, suggestEmoji } from "../../lib/house/client";
import { EMOJI_CATALOG, findEmoji, localSuggestions } from "../../lib/house/emoji";
import type { Audience, EmojiOption, GiftDetail, HouseSnapshot, Visitor } from "../../lib/house/types";

export function GiftComposer({ onGift, onSnapshot, onSavingChange }: {
  onGift: (gift: GiftDetail, bounds: DOMRect) => void;
  onSnapshot: (snapshot: HouseSnapshot) => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const [options, setOptions] = useState<EmojiOption[]>([]);
  const [selected, setSelected] = useState<EmojiOption>(() => findEmoji("gift")!);
  const [visibility, setVisibility] = useState<Audience>("public");
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const picker = useRef<HTMLButtonElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef<{ key: string; id: string } | null>(null);

  useEffect(() => {
    let active = true;
    void ensureVisitor().then((identity) => { if (active) setVisitor(identity); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Couldn’t create your visitor identity.");
    });
    return () => { active = false; };
  }, []);

  // Invalidated in onChange itself, so a previous response cannot win the debounce gap.
  const search = (value: string) => {
    generation.current++;
    controller.current?.abort();
    setQuery(value);
    setOptions(value.trim() ? localSuggestions(value).slice(0, 5) : []);
    setError("");
  };

  useEffect(() => {
    if (!query.trim() || !picking) return;
    const current = generation.current;
    const request = new AbortController();
    controller.current = request;
    const timeout = setTimeout(() => {
      void suggestEmoji(query, request.signal).then(({ options: candidates }) => {
        if (!request.signal.aborted && current === generation.current) setOptions(candidates.slice(0, 5));
      }).catch(() => { /* Local suggestions remain usable if Jev is temporarily unavailable. */ });
    }, 250);
    return () => { clearTimeout(timeout); request.abort(); };
  }, [query, picking]);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    onSavingChange(true);
    setError("");
    const draft = { emojiId: selected.id, ...(text.trim() ? { message: text.trim() } : {}), visibility: text.trim() ? visibility : "public" as Audience, ...(displayName.trim() ? { displayName: displayName.trim() } : {}) };
    const key = JSON.stringify(draft);
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
    try {
      setVisitor(await ensureVisitor());
      const snapshot = await createGift({ ...draft, requestId: pending.current.id });
      onSnapshot(snapshot);
      if (!snapshot.createdGiftId) throw new Error("This gift has already been taken back. Change your draft to leave a new one.");
      const gift = await getGift(snapshot.createdGiftId);
      onGift(gift, preview.current!.getBoundingClientRect());
      pending.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your gift couldn’t be left. Please try again.");
    } finally { setSaving(false); onSavingChange(false); }
  };

  return <form className="house-composer" onSubmit={(event) => { void submit(event); }} aria-label="Leave a gift" onKeyDown={(event) => {
    if (picking && event.key === "Escape") { event.stopPropagation(); event.nativeEvent.stopImmediatePropagation(); setPicking(false); picker.current?.focus(); }
  }}>
    <header className="gift-intro">
      <h2>Leave your mark on my site.</h2>
      <p>Choose an object to leave on the homepage, along with a message, an interesting link, a pun... anything you want!</p>
      <p>Gifts are fun, and anonymous by default.</p>
    </header>
    <div ref={preview} className="gift-preview">
      <div className="gift-preview-header">
        <button ref={picker} type="button" className="object-window-icon gift-preview-icon" aria-label="Change gift object" aria-expanded={picking} aria-controls="gift-picker" disabled={saving} onClick={() => setPicking(!picking)}>{selected.emoji}</button>
        <span>{selected.name}</span>
        <button className="gift-change-object" type="button" disabled={saving} onClick={() => setPicking(!picking)}>Change object</button>
      </div>
      <div className="gift-preview-body">
        {picking && <div id="gift-picker" className="gift-picker">
          <label htmlFor="gift-search">Find an object</label>
          <input id="gift-search" type="search" value={query} maxLength={600} disabled={saving} onChange={(event) => search(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder="Popcorn, good luck, a little sunshine…" />
          <div className="house-suggestions" role="group" aria-label="Choose an object">
            {(query.trim() ? options : EMOJI_CATALOG).map((option) => <button type="button" key={option.id} aria-label={option.name} title={option.name} disabled={saving} aria-pressed={selected.id === option.id} onClick={() => { setSelected(option); setPicking(false); setError(""); picker.current?.focus(); }}><span aria-hidden="true">{option.emoji}</span></button>)}
          </div>
        </div>}
        <label className="house-sr-only" htmlFor="gift-message">Your message, optional</label>
        <textarea id="gift-message" name="message" rows={5} maxLength={2000} placeholder="A message, a link, a terrible pun… (optional)" value={text} onChange={(event) => setText(event.target.value)} disabled={saving} />
        <label className="gift-from" htmlFor="gift-name"><span>From</span><input id="gift-name" aria-label="Your name, optional" name="nickname" autoComplete="nickname" type="text" placeholder={visitor?.name ?? "Anonymous animal"} value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} disabled={saving} /></label>
        <label className="house-audience"><span>Message visible to</span><select value={visibility} disabled={saving} onChange={(event) => setVisibility(event.target.value as Audience)}><option value="public">Everyone</option><option value="private">Only Kaio & you</option></select></label>
      </div>
    </div>
    <button className="house-send" type="submit" disabled={saving}>{saving ? "Leaving your gift…" : "Leave gift"} <span aria-hidden="true">↗</span></button>
    <p className="house-error" id="gift-error" role="alert">{error}</p>
  </form>;
}

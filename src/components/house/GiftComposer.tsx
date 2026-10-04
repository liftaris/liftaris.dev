import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { createGift, ensureVisitor, getGift, suggestEmoji } from "../../lib/house/client";
import type { HouseMutation } from "../../lib/house/client";
import { EMOJI_CATALOG, findEmoji, localSuggestions } from "../../lib/house/emoji";
import type { Audience, EmojiOption, GiftDetail, Visitor } from "../../lib/house/types";

export function GiftComposer({ onGift, mutate, onSavingChange }: {
  onGift: (gift: GiftDetail, bounds: DOMRect, form: HTMLFormElement) => void;
  mutate: HouseMutation;
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
    const form = event.currentTarget;
    setSaving(true);
    onSavingChange(true);
    setError("");
    const draft = { emojiId: selected.id, message: text.trim(), authorName: displayName.trim() || "Anonymous", visibility: text.trim() ? visibility : "public" as Audience };
    const key = JSON.stringify(draft);
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
    try {
      setVisitor(await ensureVisitor());
      const requestId = pending.current.id;
      const snapshot = await mutate(() => createGift({ ...draft, requestId }));
      if (!snapshot.createdGiftId) throw new Error("This gift has already been taken back. Change your draft to leave a new one.");
      const gift = await getGift(snapshot.createdGiftId);
      onGift(gift, preview.current!.getBoundingClientRect(), form);
      pending.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your gift couldn’t be left. Please try again.");
    } finally { setSaving(false); onSavingChange(false); }
  };

  return <form className="house-composer w-full font-mono text-sm leading-relaxed text-inherit" onSubmit={(event) => { void submit(event); }} aria-label="Leave a gift" onKeyDown={(event) => {
    if (picking && event.key === "Escape") { event.stopPropagation(); event.nativeEvent.stopImmediatePropagation(); setPicking(false); picker.current?.focus(); }
  }}>
    <header className="gift-intro">
      <h2 className="m-0 mb-4 font-serif font-normal text-[32px] leading-tight text-inherit">Leave your mark on my site.</h2>
      <p className="m-0 mb-3">Choose an object to leave on the homepage, along with a message, an interesting link, a pun... anything you want!</p>
      <p className="m-0 mb-3 text-xs">Gifts are fun, and anonymous by default.</p>
    </header>
    <div ref={preview} className="gift-preview relative mt-5 border border-current bg-paper text-blue">
      <div className="gift-preview-header relative flex items-center gap-1.5 h-6 px-2 text-paper bg-blue text-xs leading-6">
        <button ref={picker} type="button" className="object-window-icon gift-preview-icon font-emoji disabled:cursor-wait disabled:opacity-65" aria-label="Change gift object" aria-expanded={picking} aria-controls="gift-picker" disabled={saving} onClick={() => setPicking(!picking)}>{selected.emoji}</button>
        <span className="flex-1 truncate">{selected.name}</span>
        <button className="gift-change-object shrink-0 border-0 pl-2 text-inherit bg-transparent font-inherit underline cursor-pointer max-[480px]:text-[10px] disabled:cursor-wait disabled:opacity-65" type="button" disabled={saving} onClick={() => setPicking(!picking)}>Change object</button>
      </div>
      <div className="gift-preview-body p-6 max-sm:p-3 sm:p-6">
        {picking && <div id="gift-picker" className="gift-picker mb-5">
          <label className="block text-xs" htmlFor="gift-search">Find an object</label>
          <input id="gift-search" className="w-full min-h-11 mt-1.5 p-2 border border-current rounded-none bg-transparent text-inherit font-inherit text-base placeholder:text-inherit placeholder:opacity-60 disabled:cursor-wait disabled:opacity-65" type="search" value={query} maxLength={600} disabled={saving} onChange={(event) => search(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder="Popcorn, good luck, a little sunshine…" />
          <div className="house-suggestions grid [grid-template-columns:repeat(auto-fill,minmax(44px,1fr))] gap-1 max-h-[200px] overflow-y-auto overscroll-contain p-1 mt-2" role="group" aria-label="Choose an object">
            {(query.trim() ? options : EMOJI_CATALOG).map((option) => <button type="button" key={option.id} className="grid place-items-center size-full h-11 p-[5px] border border-transparent rounded-none text-inherit bg-transparent text-[27px] font-emoji leading-none cursor-pointer aria-pressed:border-current aria-pressed:bg-[color-mix(in_srgb,var(--color-blue)_7%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-blue)_7%,transparent)] transition-[scale,background-color] duration-150 ease-linear active:scale-[0.96] disabled:cursor-wait disabled:opacity-65 forced-colors:aria-pressed:border-[CanvasText]" aria-label={option.name} title={option.name} disabled={saving} aria-pressed={selected.id === option.id} onClick={() => { setSelected(option); setPicking(false); setError(""); picker.current?.focus(); }}><span className="pointer-events-none font-emoji" aria-hidden="true">{option.emoji}</span></button>)}
          </div>
        </div>}
        <label className="house-sr-only sr-only" htmlFor="gift-message">Your message, optional</label>
        <textarea id="gift-message" className="block w-full min-w-0 m-0 p-3 resize-y min-h-[144px] border border-dashed border-current rounded-none bg-transparent text-inherit font-inherit text-base leading-relaxed placeholder:text-inherit placeholder:opacity-60 disabled:cursor-wait disabled:opacity-65" name="message" rows={5} maxLength={2000} placeholder="A message, a link, a terrible pun… (optional)" value={text} onChange={(event) => setText(event.target.value)} disabled={saving} />
        <label className="gift-from flex items-baseline gap-2.5 mt-5" htmlFor="gift-name"><span className="shrink-0">From</span><input id="gift-name" className="w-full min-w-0 min-h-11 py-2 px-0 border-0 border-b border-dashed border-current rounded-none bg-transparent text-inherit font-inherit text-base placeholder:text-inherit placeholder:opacity-60 disabled:cursor-wait disabled:opacity-65" aria-label="Your name, optional" name="nickname" autoComplete="nickname" type="text" placeholder={visitor?.name ?? "Anonymous animal"} value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} disabled={saving} /></label>
        <label className="house-audience flex items-center flex-wrap gap-x-2 gap-y-0 mt-2 text-[11px]"><span>Message & name visible to</span><select className="min-h-11 max-w-full py-1.5 px-0 border-0 rounded-none text-inherit bg-transparent font-inherit cursor-pointer disabled:cursor-wait disabled:opacity-65 [&>option]:text-blue [&>option]:bg-paper" value={visibility} disabled={saving} onChange={(event) => setVisibility(event.target.value as Audience)}><option value="public" className="text-blue bg-paper">Everyone</option><option value="private" className="text-blue bg-paper">Only Kaio & you</option></select></label>
      </div>
    </div>
    <button className="house-send flex items-center justify-between gap-6 min-h-11 mt-5 ml-auto px-5 py-2.5 border border-blue bg-blue text-paper cursor-pointer font-inherit hover:bg-paper hover:text-blue transition-all active:scale-95 disabled:cursor-wait disabled:opacity-65" type="submit" disabled={saving}>{saving ? "Leaving your gift…" : "Leave gift"} <span aria-hidden="true">↗</span></button>
    <p className="house-error text-xs leading-relaxed mt-2.5 empty:hidden" id="gift-error" role="alert">{error}</p>
  </form>;
}

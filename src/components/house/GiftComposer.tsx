import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { createGift, ensureVisitor, suggestEmoji } from "../../lib/house/client";
import { localSuggestions } from "../../lib/house/emoji";
import type { Audience, EmojiOption, HouseSnapshot, Visitor } from "../../lib/house/types";

export function GiftComposer({ onGift }: { onGift: (snapshot: HouseSnapshot) => void }) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<EmojiOption[]>([]);
  const [selected, setSelected] = useState<EmojiOption | null>(null);
  const [includeText, setIncludeText] = useState(false);
  const [visibility, setVisibility] = useState<Audience>("public");
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [named, setNamed] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef<{ key: string; id: string } | null>(null);

  const identity = () => {
    void ensureVisitor().then(setVisitor).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Couldn’t create your visitor identity."));
  };

  // Invalidated in onChange itself, so a previous response cannot win the debounce gap.
  const changeText = (value: string) => {
    generation.current++;
    controller.current?.abort();
    setText(value);
    setOptions(value.trim() ? localSuggestions(value).slice(0, 5) : []);
    setError("");
    setStatus("");
  };

  useEffect(() => {
    if (!text.trim()) return;
    const current = generation.current;
    const request = new AbortController();
    controller.current = request;
    const timeout = setTimeout(() => {
      void suggestEmoji(text, request.signal).then(({ options: candidates }) => {
        if (!request.signal.aborted && current === generation.current) setOptions(candidates.slice(0, 5));
      }).catch(() => { /* Local suggestions remain usable if Jev is temporarily unavailable. */ });
    }, 250);
    return () => { clearTimeout(timeout); request.abort(); };
  }, [text]);

  useEffect(() => {
    if (input.current) {
      input.current.style.height = "auto";
      input.current.style.height = `${Math.min(input.current.scrollHeight, 144)}px`;
    }
  }, [text]);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (!selected) {
      setError("Choose an emoji to leave.");
      input.current?.focus();
      return;
    }
    if (includeText && !text.trim()) {
      setError("Write a message, or leave just the emoji.");
      input.current?.focus();
      return;
    }
    setSaving(true);
    setError("");
    const draft = { emojiId: selected.id, ...(includeText ? { message: text.trim() } : {}), visibility: includeText ? visibility : "public" as Audience, ...(named && displayName.trim() ? { displayName: displayName.trim() } : {}) };
    const key = JSON.stringify(draft);
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
    try {
      setVisitor(await ensureVisitor());
      const snapshot = await createGift({ ...draft, requestId: pending.current.id });
      onGift(snapshot);
      setStatus(`${selected.name} left. Thank you!`);
      generation.current++;
      controller.current?.abort();
      setText("");
      setOptions([]);
      setSelected(null);
      setIncludeText(false);
      setVisibility("public");
      pending.current = null;
      input.current?.focus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your gift couldn’t be left. Please try again.");
    } finally { setSaving(false); }
  };

  return <form className="house-composer" onSubmit={(event) => { void submit(event); }} aria-label="Leave a gift">
    <div className="house-input-row">
      <span className="house-selected" aria-hidden="true">{selected?.emoji ?? "+"}</span>
      <label className="house-sr-only" htmlFor="gift-draft">Find an emoji or write a message</label>
      <textarea ref={input} id="gift-draft" name="gift" rows={1} maxLength={600} placeholder="Leave a gift…" value={text} onFocus={identity} onChange={(event) => changeText(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "gift-error" : undefined} disabled={saving} />
      <button className="house-send" type="submit" disabled={saving} aria-label={saving ? "Leaving your gift" : "Leave gift"}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
      </button>
    </div>
    {options.length > 0 && <div className="house-suggestions" role="group" aria-label="Suggested emoji">
      {options.map((option) => <button type="button" key={option.id} aria-label={option.name} title={option.name} aria-pressed={selected?.id === option.id} onClick={() => { setSelected(option); setError(""); }}><span aria-hidden="true">{option.emoji}</span></button>)}
    </div>}
    {selected && <div className="house-gift-options">
      <label className="house-message-choice"><input type="checkbox" checked={includeText} disabled={saving} onChange={(event) => setIncludeText(event.target.checked)} /> Include the message</label>
      {includeText && <label className="house-audience"><span className="house-sr-only">Message visible to</span><select value={visibility} disabled={saving} onChange={(event) => setVisibility(event.target.value as Audience)}><option value="public">Everyone</option><option value="private">Only Kaio & you</option></select></label>}
      <button className="house-name-choice" type="button" aria-expanded={named} onClick={() => setNamed(!named)} disabled={saving}>{named ? "Use animal name" : `From ${visitor?.name ?? "an anonymous animal"}`}</button>
      {named && <div className="house-name-input"><label className="house-sr-only" htmlFor="gift-name">Your name, optional</label><input id="gift-name" name="nickname" autoComplete="nickname" type="text" placeholder="Your name (optional)" value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} disabled={saving} /></div>}
    </div>}
    <p className="house-error" id="gift-error" role="alert">{error}</p>
    <p className="house-sr-only" role="status">{status}</p>
  </form>;
}

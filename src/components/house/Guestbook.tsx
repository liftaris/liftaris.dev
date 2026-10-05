import { useEffect, useId, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { createGift, ensureVisitor, getHouse, houseMutations, reclaimGift, updateGift } from "../../lib/house/client";
import { DEFAULT_EMOJI, EMOJI_CATALOG, findEmoji, normalizeEmojiPresentation } from "../../lib/house/emoji";
import { EmojiSearch } from "../EmojiSearch";
import type { CreateGift, Gift, UpdateGift } from "../../lib/house/types";

const emptyMessage: UpdateGift = { emojiId: DEFAULT_EMOJI.id, message: "", authorName: "", location: "" };
const inputClass = "w-full min-w-0 border-0 border-b border-paper/30 bg-transparent pb-0.5 text-paper placeholder:text-paper/60 focus:border-paper";

function EmojiPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const popover = useRef<HTMLDivElement>(null);
  const selected = findEmoji(value) ?? DEFAULT_EMOJI;
  useEffect(() => { setOpen(Boolean(popover.current?.matches(":popover-open"))); }, []);

  return <div className="shrink-0">
    <button type="button" popoverTarget={id} className="flex size-16 cursor-pointer items-center justify-center font-emoji text-[52px] leading-none" aria-label={`Change icon. Current: ${selected.name}`}>
      {normalizeEmojiPresentation(selected.emoji)}
    </button>
    <div id={id} ref={popover} popover="auto" onToggle={event => setOpen(event.newState === "open")} onKeyDown={event => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        popover.current?.hidePopover();
      }
    }} className="fixed inset-0 m-auto w-72 max-w-[calc(100%-2rem)] border border-ink bg-paper p-3 text-ink shadow-2xl backdrop:bg-ink/30">
      <EmojiSearch active={open} value={selected.emoji} onSelect={option => {
        onChange(option.id);
        popover.current?.hidePopover();
      }} />
    </div>
  </div>;
}

/** One form for creating and editing; failed submissions retain their retry ID. */
function MessageForm({ gift, onSave, onCancel }: {
  gift?: Gift;
  onSave: (message: CreateGift) => Promise<void>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<UpdateGift>(() => gift ? { emojiId: EMOJI_CATALOG.find(e => e.emoji === normalizeEmojiPresentation(gift.emoji))?.id ?? DEFAULT_EMOJI.id, message: gift.message, authorName: gift.authorName, location: gift.location ?? "", updatedAt: gift.updatedAt } : emptyMessage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<{ payload: string; id: string } | null>(null);
  const busy = useRef(false);
  const id = useId();
  const change = (values: Partial<UpdateGift>) => setDraft(current => ({ ...current, ...values }));

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current) return;
    const message = { ...draft, message: draft.message.trim(), authorName: draft.authorName.trim(), location: draft.location?.trim() || undefined };
    if (!message.message || !message.authorName) return;
    const payload = JSON.stringify(message);
    if (pending.current?.payload !== payload) pending.current = { payload, id: crypto.randomUUID() };
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      await onSave({ ...message, requestId: pending.current.id });
      pending.current = null;
      if (!gift) setDraft(current => ({ ...current, message: "", location: "" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn’t save this message. Please try again.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return <form onSubmit={event => void submit(event)} className="border-b border-paper/20 py-3">
    <fieldset disabled={saving} className="flex min-w-0 gap-2 border-0 p-0 @sm:gap-3">
      <legend className="sr-only">{gift ? "Edit message" : "Sign guestbook"}</legend>
      <EmojiPicker value={draft.emojiId} onChange={emojiId => change({ emojiId })} />
      <div className="min-w-0 flex-1">
        <label htmlFor={`${id}-message`} className="sr-only">Message</label>
        <textarea id={`${id}-message`} required rows={2} maxLength={400} value={draft.message} onChange={event => change({ message: event.target.value.split("\n").slice(0, 7).join("\n") })} placeholder="Leave a message, an interesting link, a pun... anything you want!" className={`${inputClass} min-h-11 max-h-40 resize-y text-sm leading-relaxed`} />
        <p className="my-1 text-right text-[11px] text-paper/70 tabular-nums">{draft.message.length}/400</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          <label className="flex min-w-0 flex-1 basis-40 items-center gap-1.5">
            <span className="shrink-0 font-semibold text-paper/70">By:</span>
            <input required maxLength={60} value={draft.authorName} onChange={event => change({ authorName: event.target.value })} placeholder="Your name, or Anonymous" className={inputClass} />
          </label>
          <label className="flex min-w-0 flex-1 basis-32 items-center gap-1.5">
            <span className="shrink-0 font-semibold text-paper/70">From:</span>
            <input maxLength={60} value={draft.location ?? ""} onChange={event => change({ location: event.target.value })} placeholder="Where are you?" className={inputClass} />
          </label>
          <div className="ml-auto flex gap-2">
            {onCancel && <button type="button" onClick={onCancel} className="cursor-pointer border border-paper/30 px-3 py-1">Cancel</button>}
            <button type="submit" disabled={saving || !draft.message.trim() || !draft.authorName.trim()} className="cursor-pointer border border-paper bg-paper px-3 py-1 font-medium text-blue hover:bg-transparent hover:text-paper disabled:opacity-50">{saving ? "Saving…" : gift ? "Save" : "Sign guestbook ↗"}</button>
          </div>
        </div>
        {error && <p role="alert" className="mt-2 text-paper">{error}</p>}
      </div>
    </fieldset>
  </form>;
}

export function Guestbook() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const read = useRef<AbortController | null>(null);
  const deleting = useRef(false);
  const [mutate] = useState(() => houseMutations(snapshot => {
    read.current?.abort(); // A late initial read must not overwrite a completed write.
    setGifts(snapshot.gifts);
    setLoading(false);
    setError("");
  }));

  useEffect(() => {
    const controller = new AbortController();
    read.current = controller;
    void getHouse(controller.signal).then(snapshot => {
      if (!controller.signal.aborted) setGifts(snapshot.gifts);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Couldn’t load guestbook.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, []);

  const save = async (draft: CreateGift, id?: string) => {
    await ensureVisitor();
    await mutate(() => id ? updateGift(id, draft) : createGift(draft));
    if (id) setEditingId(null);
  };
  const remove = async (id: string) => {
    if (deleting.current || !confirm("Delete this message?")) return;
    deleting.current = true;
    setDeletingId(id);
    try {
      await ensureVisitor();
      await mutate(() => reclaimGift(id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn’t delete this message.");
    } finally {
      deleting.current = false;
      setDeletingId(null);
    }
  };

  return <div className="guestbook-view @container flex min-h-full flex-col p-4 font-mono text-sm leading-relaxed text-paper @sm:p-6">
    <p className="shrink-0 border border-ink/20 bg-paper p-3 text-xs text-ink shadow-sm">Choose an icon and leave a message. If you want, tell me who and where you&apos;re from! Authorship is tied to your device.</p>
    {error && <p role="alert" className="my-3 border border-paper/40 p-3">{error}</p>}
    <MessageForm onSave={draft => save(draft)} />
    {loading ? <p role="status" className="py-6 text-center text-xs text-paper/70">Loading guestbook…</p> : gifts.length === 0 ? <p className="py-8 text-center text-xs text-paper/70">No messages left yet. Be the first to leave one!</p> : gifts.map(gift => editingId === gift.id ?
      <MessageForm key={gift.id} gift={gift} onSave={draft => save(draft, gift.id)} onCancel={() => setEditingId(null)} /> :
      <div key={gift.id} className="flex items-start gap-3 border-b border-paper/15 py-5 @sm:gap-4">
        <span className="flex size-16 shrink-0 select-none items-center justify-center font-emoji text-[52px] leading-none" aria-hidden="true">{normalizeEmojiPresentation(gift.emoji)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="mb-3 min-w-0 flex-1 wrap-anywhere whitespace-pre-wrap">{gift.message}</p>
            {gift.canEdit && <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => setEditingId(gift.id)} className="cursor-pointer rounded p-1 text-paper/70 hover:bg-paper/10 hover:text-paper" aria-label={`Edit message by ${gift.authorName}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
              </button>
              <button type="button" disabled={deletingId !== null} onClick={() => void remove(gift.id)} className="cursor-pointer rounded p-1 text-paper/70 hover:bg-paper/10 hover:text-red-300 disabled:opacity-50" aria-label={`Delete message by ${gift.authorName}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M19 6v14H5V6M8 6V3h8v3" /></svg>
              </button>
            </div>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="wrap-anywhere"><span className="font-semibold text-paper/70">By: </span>{gift.authorName}</span>
            {gift.location && <span className="wrap-anywhere"><span className="font-semibold text-paper/70">From: </span>{gift.location}</span>}
            {gift.status === "pending" && <span className="border border-paper/40 bg-paper/20 px-1.5 text-[10px] tracking-wider uppercase">Pending review</span>}
          </div>
        </div>
      </div>)}
  </div>;
}

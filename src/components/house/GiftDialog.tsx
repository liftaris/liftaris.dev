import { useEffect, useId, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { getGift, HouseError, reclaimGift, updateGift } from "../../lib/house/client";
import type { HouseMutation } from "../../lib/house/client";
import { findEmoji } from "../../lib/house/emoji";
import { EmojiSearch } from "../EmojiSearch";
import type { Gift, GiftDetail, UpdateGift } from "../../lib/house/types";

export function GiftDialog({ gift, initialDetail, onClose, onDetail, mutate }: {
  gift: Gift; initialDetail?: GiftDetail; onClose: () => void; onDetail: (gift: GiftDetail) => void; mutate: HouseMutation;
}) {
  const [detail, setDetail] = useState<GiftDetail | null>(initialDetail ?? null);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<UpdateGift | null>(null);
  const [conflict, setConflict] = useState(false);
  const reading = useRef<AbortController | null>(null);
  const mutating = useRef(false);
  const fieldId = useId();

  useEffect(() => {
    const controller = new AbortController();
    reading.current = controller;
    void getGift(gift.id, controller.signal).then((next) => {
      if (!controller.signal.aborted) { setDetail(next); onDetail(next); }
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return;
      if (reason instanceof HouseError && reason.status === 404) setError("This gift has been taken back. You can finish looking before closing it.");
      else setError(reason instanceof Error ? reason.message : "Couldn’t open this gift. Please try again.");
    });
    return () => { controller.abort(); reading.current?.abort(); };
  }, [gift.id, onDetail]);

  const edit = () => {
    if (!detail?.canEdit || mutating.current || conflict) return;
    setDraft({ updatedAt: detail.updatedAt, emojiId: detail.emojiId, message: detail.message ?? "", authorName: detail.authorName ?? "Anonymous", location: detail.location ?? undefined });
    setError("");
  };
  const save = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || !detail?.canEdit || mutating.current || conflict) return;
    mutating.current = true;
    setSaving(true);
    setError("");
    reading.current?.abort();
    const controller = new AbortController();
    reading.current = controller;
    let saved = false;
    try {
      const next = await mutate(() => updateGift(gift.id, { ...draft, message: draft.message?.trim() ?? "", authorName: draft.authorName?.trim() || "Anonymous" }));
      saved = true;
      if (controller.signal.aborted) return;
      const visible = next.gifts.find((item) => item.id === gift.id);
      // Refresh permissions after moderation.
      if (visible) setDetail({ ...detail, ...visible, canEdit: false });
      setDraft(null);
      const refreshed = await getGift(gift.id, controller.signal);
      if (!controller.signal.aborted) { setDetail(refreshed); onDetail(refreshed); }
    } catch (reason) {
      if (!controller.signal.aborted) {
        if (!saved && reason instanceof HouseError && reason.status === 409) setConflict(true);
        else setError(saved ? "Your gift was saved, but its details couldn’t load. Close and reopen it to try again." : reason instanceof Error ? reason.message : "Couldn’t save this gift. Please try again.");
      }
    } finally { mutating.current = false; setSaving(false); }
  };
  const reload = async () => {
    if (mutating.current) return;
    mutating.current = true;
    setSaving(true);
    setError("");
    reading.current?.abort();
    const controller = new AbortController();
    reading.current = controller;
    try {
      const latest = await getGift(gift.id, controller.signal);
      if (controller.signal.aborted) return;
      setDetail(latest);
      onDetail(latest);
      setDraft(null);
      setConflict(false);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Couldn’t reload this gift. Please try again.");
    } finally { mutating.current = false; setSaving(false); }
  };
  const remove = async () => {
    if (mutating.current) return;
    mutating.current = true;
    reading.current?.abort();
    setRemoving(true);
    setError("");
    try {
      await mutate(() => reclaimGift(gift.id));
      onClose();
    } catch (reason) {
      if (reason instanceof HouseError && reason.status === 404) onClose();
      else setError(reason instanceof Error ? reason.message : "Couldn’t remove this gift. Please try again.");
    } finally { mutating.current = false; setRemoving(false); }
  };
  const current = detail ?? gift;
  const message = current.message;
  return <div className="house-gift-body flex flex-col items-start w-full min-h-0">
    {draft && detail?.canEdit ? <form className="house-gift-editor w-full text-xs leading-relaxed" aria-label="Edit gift" onSubmit={(event) => { void save(event); }}>
      <EmojiSearch value={findEmoji(draft.emojiId)?.emoji} disabled={saving || removing} onSelect={emoji => setDraft({ ...draft, emojiId: emoji.id })} />
      <label htmlFor={`${fieldId}-message`}>Your message</label>
      <textarea id={`${fieldId}-message`} className="block w-full min-w-0 mt-2 p-3 resize-y min-h-[144px] border border-dashed border-current rounded-none bg-transparent text-inherit font-inherit text-base leading-relaxed placeholder:text-inherit placeholder:opacity-60 disabled:cursor-wait disabled:opacity-65" name="message" rows={5} required maxLength={400} value={draft.message ?? ""} disabled={saving || removing} onChange={(event) => setDraft({ ...draft, message: event.target.value })} />
      <label className="gift-from flex items-baseline gap-2.5 mt-5" htmlFor={`${fieldId}-name`}><span className="shrink-0">From</span><input id={`${fieldId}-name`} className="w-full min-w-0 min-h-11 py-2 px-0 border-0 border-b border-dashed border-current rounded-none bg-transparent text-inherit font-inherit text-base placeholder:text-inherit placeholder:opacity-60 disabled:cursor-wait disabled:opacity-65" aria-label="Your name" name="nickname" autoComplete="nickname" required maxLength={60} value={draft.authorName ?? ""} disabled={saving || removing} onChange={(event) => setDraft({ ...draft, authorName: event.target.value })} /></label>
      <div className="house-gift-actions flex flex-wrap items-center gap-3 mt-6 [&_.house-send]:m-0 [&_.house-reclaim]:m-0">
        <button className="house-reclaim min-h-11 px-5 py-2.5 border border-current rounded-lg text-inherit bg-transparent font-inherit text-xs cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-blue)_7%,transparent)] transition-all duration-150 active:scale-[0.96] disabled:cursor-wait disabled:opacity-65" type="button" disabled={saving || removing} onClick={() => { setDraft(null); setError(""); }}>Cancel</button>
        <button className="house-send flex items-center justify-between gap-6 min-h-11 px-5 py-2.5 border border-blue bg-blue text-paper cursor-pointer font-inherit hover:bg-paper hover:text-blue transition-all active:scale-95 disabled:cursor-wait disabled:opacity-65" type="submit" disabled={saving || removing || conflict}>{saving ? "Saving…" : "Save changes"}</button>
      </div>
    </form> : <>
    {message && <p className="house-gift-message m-0 mb-6 text-lg leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{message}</p>}
    {current.authorName !== null && <p className="house-attribution text-sm m-0 mb-1.5 [overflow-wrap:anywhere]">From {current.authorName}</p>}
    <time className="house-gift-date text-[11px]" dateTime={current.createdAt}>{new Date(current.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</time>
    <div className="house-gift-actions flex flex-wrap items-center gap-3 mt-6 [&_.house-send]:m-0 [&_.house-reclaim]:m-0">
      {detail?.canEdit && <button className="house-reclaim min-h-11 px-5 py-2.5 border border-current rounded-lg text-inherit bg-transparent font-inherit text-xs cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-blue)_7%,transparent)] transition-all duration-150 active:scale-[0.96] disabled:cursor-wait disabled:opacity-65" type="button" disabled={saving || removing || conflict} onClick={edit}>{saving ? "Saving…" : "Edit gift"}</button>}
      {(detail?.canReclaim || detail?.canRemove) && <button className="house-reclaim min-h-11 px-5 py-2.5 border border-current rounded-lg text-inherit bg-transparent font-inherit text-xs cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-blue)_7%,transparent)] transition-all duration-150 active:scale-[0.96] disabled:cursor-wait disabled:opacity-65" type="button" disabled={saving || removing} onClick={() => { void remove(); }}>{removing ? "Removing…" : detail.canReclaim ? "Take back" : "Remove gift"}</button>}
    </div>
    </>}
    {conflict && <div role="alert" className="mt-4 text-xs leading-relaxed">
      <p>This gift changed elsewhere. Your draft hasn’t been saved. Copy anything you want to keep, then reload the latest gift before editing again. Reloading discards this draft.</p>
      <button className="house-reclaim mt-7 min-h-11 px-5 py-2.5 border border-current rounded-lg text-inherit bg-transparent font-inherit text-xs cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-blue)_7%,transparent)] transition-all duration-150 active:scale-[0.96] disabled:cursor-wait disabled:opacity-65" type="button" disabled={saving || removing} onClick={() => { void reload(); }}>Reload latest gift</button>
    </div>}
    <p className="house-error text-xs leading-relaxed mt-2.5 empty:hidden" role="alert">{error}</p>
  </div>;
}

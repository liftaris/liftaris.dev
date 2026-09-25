import { useEffect, useId, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { getGift, HouseError, reclaimGift, updateGift } from "../../lib/house/client";
import { EMOJI_CATALOG } from "../../lib/house/emoji";
import type { Audience, Gift, GiftDetail, HouseSnapshot, UpdateGift } from "../../lib/house/types";

export function GiftDialog({ gift, initialDetail, onClose, onSnapshot }: {
  gift: Gift; initialDetail?: GiftDetail; onClose: () => void; onSnapshot: (snapshot: HouseSnapshot) => void;
}) {
  const [detail, setDetail] = useState<GiftDetail | null>(initialDetail ?? null);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<UpdateGift | null>(null);
  const reading = useRef<AbortController | null>(null);
  const mutating = useRef(false);
  const fieldId = useId();

  useEffect(() => {
    const controller = new AbortController();
    reading.current = controller;
    void getGift(gift.id, controller.signal).then((next) => {
      if (!controller.signal.aborted) setDetail(next);
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return;
      if (reason instanceof HouseError && reason.status === 404) setError("This gift has been taken back. You can finish looking before closing it.");
      else setError(reason instanceof Error ? reason.message : "Couldn’t open this gift. Please try again.");
    });
    return () => { controller.abort(); reading.current?.abort(); };
  }, [gift.id]);

  const edit = () => {
    if (!detail?.canEdit || mutating.current) return;
    setDraft({ emojiId: detail.emojiId, message: detail.message ?? "", visibility: detail.visibility, displayName: detail.authorName });
    setError("");
  };
  const save = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || !detail?.canEdit || mutating.current) return;
    mutating.current = true;
    setSaving(true);
    setError("");
    reading.current?.abort();
    const controller = new AbortController();
    reading.current = controller;
    let saved = false;
    try {
      const next = await updateGift(gift.id, { ...draft, message: draft.message?.trim() ?? "", displayName: draft.displayName?.trim() ?? "" });
      saved = true;
      onSnapshot(next);
      if (controller.signal.aborted) return;
      const visible = next.gifts.find((item) => item.id === gift.id);
      // Public snapshots redact private text; don't reopen an incomplete draft.
      if (visible) setDetail({ ...detail, ...visible, canEdit: false });
      setDraft(null);
      const refreshed = await getGift(gift.id, controller.signal);
      if (!controller.signal.aborted) setDetail(refreshed);
    } catch (reason) {
      if (!controller.signal.aborted) setError(saved ? "Your gift was saved, but its details couldn’t load. Close and reopen it to try again." : reason instanceof Error ? reason.message : "Couldn’t save this gift. Please try again.");
    } finally { mutating.current = false; setSaving(false); }
  };
  const remove = async () => {
    if (mutating.current) return;
    mutating.current = true;
    reading.current?.abort();
    setRemoving(true);
    setError("");
    try {
      onSnapshot(await reclaimGift(gift.id));
      onClose();
    } catch (reason) {
      if (reason instanceof HouseError && reason.status === 404) onClose();
      else setError(reason instanceof Error ? reason.message : "Couldn’t remove this gift. Please try again.");
    } finally { mutating.current = false; setRemoving(false); }
  };
  const current = detail ?? gift;
  const message = current.message;
  return <div className="house-gift-body">
    {draft && detail?.canEdit ? <form className="house-gift-editor" aria-label="Edit gift" onSubmit={(event) => { void save(event); }}>
      <label className="house-edit-object" htmlFor={`${fieldId}-object`}>Object
        <select id={`${fieldId}-object`} name="emojiId" value={draft.emojiId} disabled={saving || removing} onChange={(event) => setDraft({ ...draft, emojiId: event.target.value })}>
          {EMOJI_CATALOG.map((option) => <option key={option.id} value={option.id}>{option.emoji} {option.name}</option>)}
        </select>
      </label>
      <label htmlFor={`${fieldId}-message`}>Your message, optional</label>
      <textarea id={`${fieldId}-message`} name="message" rows={5} maxLength={2000} value={draft.message ?? ""} disabled={saving || removing} onChange={(event) => setDraft({ ...draft, message: event.target.value })} />
      <label className="gift-from" htmlFor={`${fieldId}-name`}><span>From</span><input id={`${fieldId}-name`} aria-label="Your name, optional" name="nickname" autoComplete="nickname" maxLength={40} value={draft.displayName ?? ""} disabled={saving || removing} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label>
      <label className="house-audience"><span>Message visible to</span><select name="visibility" value={draft.visibility} disabled={saving || removing} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as Audience })}><option value="public">Everyone</option><option value="private">Only Kaio & you</option></select></label>
      <div className="house-gift-actions">
        <button className="house-reclaim" type="button" disabled={saving || removing} onClick={() => { setDraft(null); setError(""); }}>Cancel</button>
        <button className="house-send" type="submit" disabled={saving || removing}>{saving ? "Saving…" : "Save changes"}</button>
      </div>
    </form> : <>
    {message && <p className="house-gift-message">{message}</p>}
    {current.visibility === "private" && <p className="house-private">{message ? "A private note" : "A private note for Kaio"}</p>}
    <p className="house-attribution">From {current.authorName}</p>
    <time className="house-gift-date" dateTime={current.createdAt}>{new Date(current.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</time>
    <div className="house-gift-actions">
      {detail?.canEdit && <button className="house-reclaim" type="button" disabled={saving || removing} onClick={edit}>{saving ? "Saving…" : "Edit gift"}</button>}
      {(detail?.canReclaim || detail?.canRemove) && <button className="house-reclaim" type="button" disabled={saving || removing} onClick={() => { void remove(); }}>{removing ? "Removing…" : detail.canReclaim ? "Take back" : "Remove gift"}</button>}
    </div>
    </>}
    <p className="house-error" role="alert">{error}</p>
  </div>;
}

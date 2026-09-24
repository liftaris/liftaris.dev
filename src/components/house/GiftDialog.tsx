import { useEffect, useRef, useState } from "react";
import { getGift, HouseError, reclaimGift } from "../../lib/house/client";
import { findEmoji } from "../../lib/house/emoji";
import type { Gift, GiftDetail, HouseSnapshot } from "../../lib/house/types";

export function GiftDialog({ gift, origin, onClose, onSnapshot }: {
  gift: Gift; origin: DOMRect; onClose: () => void; onSnapshot: (snapshot: HouseSnapshot) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const artwork = useRef<HTMLSpanElement>(null);
  const [detail, setDetail] = useState<GiftDetail | null>(null);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const emoji = findEmoji(gift.emojiId);

  useEffect(() => {
    const element = dialog.current!;
    const trigger = document.activeElement as HTMLElement | null;
    element.showModal();
    if (artwork.current && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const target = artwork.current.getBoundingClientRect();
      const dx = origin.left + origin.width / 2 - target.left - target.width / 2;
      const dy = origin.top + origin.height / 2 - target.top - target.height / 2;
      artwork.current.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${origin.width / target.width})` },
        { transform: "translate(0, 0) scale(1)" },
      ], { duration: 300, easing: "cubic-bezier(0.2, 0, 0, 1)" });
    }
    return () => {
      element.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else document.getElementById("gift-draft")?.focus({ preventScroll: true });
    };
  }, [origin]);

  useEffect(() => {
    const controller = new AbortController();
    void getGift(gift.id, controller.signal).then(setDetail).catch((reason: unknown) => {
      if (controller.signal.aborted) return;
      if (reason instanceof HouseError && reason.status === 404) setError("This gift has been taken back. You can finish looking before closing it.");
      else setError(reason instanceof Error ? reason.message : "Couldn’t open this gift. Please try again.");
    });
    return () => controller.abort();
  }, [gift.id, onClose]);

  const remove = async () => {
    setRemoving(true);
    setError("");
    try {
      onSnapshot(await reclaimGift(gift.id));
      onClose();
    } catch (reason) {
      if (reason instanceof HouseError && reason.status === 404) onClose();
      else setError(reason instanceof Error ? reason.message : "Couldn’t remove this gift. Please try again.");
    } finally { setRemoving(false); }
  };
  const message = detail?.message ?? gift.message;
  return <dialog ref={dialog} className="house-dialog" aria-labelledby="gift-attribution" onCancel={onClose} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="house-gift-card">
      <button className="house-close" type="button" aria-label="Close gift" onClick={onClose}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
      <span ref={artwork} className="house-card-emoji" aria-label={emoji?.name}>{emoji?.emoji}</span>
      <div className="house-gift-body">
        {message && <p className="house-gift-message">{message}</p>}
        {gift.visibility === "private" && <p className="house-private">{message ? "A private note" : "A private note for Kaio"}</p>}
        <p className="house-attribution" id="gift-attribution">From {gift.authorName}</p>
        <time className="house-gift-date" dateTime={gift.createdAt}>{new Date(gift.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</time>
        {(detail?.canReclaim || detail?.canRemove) && <button className="house-reclaim" type="button" disabled={removing} onClick={() => { void remove(); }}>{removing ? "Removing…" : detail.canReclaim ? "Take back" : "Remove gift"}</button>}
        <p className="house-error" role="alert">{error}</p>
      </div>
    </div>
  </dialog>;
}

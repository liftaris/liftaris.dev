import { useEffect, useState } from "react";
import { getGift, HouseError, reclaimGift } from "../../lib/house/client";
import type { Gift, GiftDetail, HouseSnapshot } from "../../lib/house/types";

export function GiftDialog({ gift, onClose, onSnapshot }: {
  gift: Gift; onClose: () => void; onSnapshot: (snapshot: HouseSnapshot) => void;
}) {
  const [detail, setDetail] = useState<GiftDetail | null>(null);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void getGift(gift.id, controller.signal).then(setDetail).catch((reason: unknown) => {
      if (controller.signal.aborted) return;
      if (reason instanceof HouseError && reason.status === 404) setError("This gift has been taken back. You can finish looking before closing it.");
      else setError(reason instanceof Error ? reason.message : "Couldn’t open this gift. Please try again.");
    });
    return () => controller.abort();
  }, [gift.id]);

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
  return <div className="house-gift-body">
    {message && <p className="house-gift-message">{message}</p>}
    {gift.visibility === "private" && <p className="house-private">{message ? "A private note" : "A private note for Kaio"}</p>}
    <p className="house-attribution">From {gift.authorName}</p>
    <time className="house-gift-date" dateTime={gift.createdAt}>{new Date(gift.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</time>
    {(detail?.canReclaim || detail?.canRemove) && <button className="house-reclaim" type="button" disabled={removing} onClick={() => { void remove(); }}>{removing ? "Removing…" : detail.canReclaim ? "Take back" : "Remove gift"}</button>}
    <p className="house-error" role="alert">{error}</p>
  </div>;
}

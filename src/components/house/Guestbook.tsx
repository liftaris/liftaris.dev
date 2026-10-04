import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createGift, ensureVisitor, getHouse, reclaimGift, updateGift } from "../../lib/house/client";
import type { HouseMutation } from "../../lib/house/client";
import { EMOJI_CATALOG, findEmoji, localSuggestions } from "../../lib/house/emoji";
import type { EmojiOption, Gift, HouseSnapshot } from "../../lib/house/types";

interface GuestbookProps {
  initialSnapshot?: HouseSnapshot | null;
  mutate?: HouseMutation;
  onGiftsChange?: (gifts: Gift[]) => void;
}

function SemicircleIndicator({ max, current }: { max: number; current: number }) {
  const remaining = Math.max(0, max - current);
  const radius = 10;
  const strokeWidth = 2.5;
  const perimeter = Math.PI * radius; // ~31.416
  const fractionRemaining = remaining / max;
  const strokeDashoffset = perimeter * (1 - fractionRemaining);

  const strokeColor =
    remaining <= 20 ? "#f87171" : remaining <= 60 ? "#fbbf24" : "var(--color-paper, #fffbed)";

  return (
    <div className="flex items-center gap-1.5 select-none" title={`${remaining} characters left`}>
      <svg
        width="26"
        height="15"
        viewBox="0 0 26 15"
        className="overflow-visible"
        aria-hidden="true"
      >
        {/* Background track */}
        <path
          d="M 3 13 A 10 10 0 0 1 23 13"
          fill="none"
          stroke="rgba(255, 251, 237, 0.2)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress arc showing characters left */}
        <path
          d="M 3 13 A 10 10 0 0 1 23 13"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={perimeter}
          strokeDashoffset={strokeDashoffset}
          className="transition-[stroke-dashoffset,stroke] duration-150"
        />
      </svg>
      <span
        className="text-[10px] font-mono tabular-nums leading-none"
        style={{ color: strokeColor }}
      >
        {remaining}
      </span>
    </div>
  );
}

export function Guestbook({ initialSnapshot, mutate, onGiftsChange }: GuestbookProps) {
  const [gifts, setGifts] = useState<Gift[]>(() => initialSnapshot?.gifts ?? []);
  const [loading, setLoading] = useState(!initialSnapshot);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusNotice, setStatusNotice] = useState("");

  // Composer state
  const [message, setMessage] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [location, setLocation] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState<EmojiOption>(() => findEmoji("gift")!);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [editAuthorName, setEditAuthorName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editEmoji, setEditEmoji] = useState<EmojiOption>(() => findEmoji("gift")!);
  const [showEditPicker, setShowEditPicker] = useState(false);
  const [editPickerQuery, setEditPickerQuery] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const pickerRef = useRef<HTMLDivElement>(null);
  const editPickerRef = useRef<HTMLDivElement>(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
      if (editPickerRef.current && !editPickerRef.current.contains(e.target as Node)) {
        setShowEditPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch initial snapshot if not passed
  useEffect(() => {
    if (initialSnapshot) {
      setGifts(initialSnapshot.gifts);
      setLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    void getHouse(controller.signal)
      .then((snapshot) => {
        if (!active) return;
        setGifts(snapshot.gifts);
        onGiftsChange?.(snapshot.gifts);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Couldn’t load gifts.");
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [initialSnapshot, onGiftsChange]);

  // Update gifts when initialSnapshot prop changes
  useEffect(() => {
    if (initialSnapshot?.gifts) {
      setGifts(initialSnapshot.gifts);
      setLoading(false);
    }
  }, [initialSnapshot]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !message.trim() || !authorName.trim()) return;

    setSubmitting(true);
    setError("");
    setStatusNotice("");

    const draft = {
      requestId: crypto.randomUUID(),
      emojiId: selectedEmoji.id,
      message: message.trim().slice(0, 400),
      authorName: authorName.trim().slice(0, 60),
      location: location.trim().slice(0, 60) || undefined,
    };

    try {
      await ensureVisitor();
      const execute = () => createGift(draft);
      const snapshot = mutate ? await mutate(execute) : await execute();

      setGifts(snapshot.gifts);
      onGiftsChange?.(snapshot.gifts);

      // Check if newly created gift was auto-approved or held for review
      const createdItem = snapshot.gifts.find((g) => g.id === snapshot.createdGiftId);
      if (createdItem && createdItem.status === "pending") {
        setStatusNotice("Your gift has been submitted and is pending review!");
      } else {
        setStatusNotice("Your gift has been published!");
      }

      // Reset form fields
      setMessage("");
      setLocation("");
      setShowPicker(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t leave your gift. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (gift: Gift) => {
    setEditingId(gift.id);
    setEditMessage(gift.message);
    setEditAuthorName(gift.authorName);
    setEditLocation(gift.location || "");
    setEditEmoji(findEmoji(gift.emojiId) || findEmoji("gift")!);
    setShowEditPicker(false);
  };

  const handleUpdate = async (id: string, e: FormEvent) => {
    e.preventDefault();
    if (savingEdit || !editMessage.trim() || !editAuthorName.trim()) return;

    setSavingEdit(true);
    setError("");

    const draft = {
      emojiId: editEmoji.id,
      message: editMessage.trim().slice(0, 400),
      authorName: editAuthorName.trim().slice(0, 60),
      location: editLocation.trim().slice(0, 60) || undefined,
    };

    try {
      await ensureVisitor();
      const execute = () => updateGift(id, draft);
      const snapshot = mutate ? await mutate(execute) : await execute();

      setGifts(snapshot.gifts);
      onGiftsChange?.(snapshot.gifts);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t update gift. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this gift?")) return;
    setError("");

    try {
      await ensureVisitor();
      const execute = () => reclaimGift(id);
      const snapshot = mutate ? await mutate(execute) : await execute();

      setGifts(snapshot.gifts);
      onGiftsChange?.(snapshot.gifts);
      if (editingId === id) setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t delete gift. Please try again.");
    }
  };

  const filteredEmojis = pickerQuery.trim()
    ? localSuggestions(pickerQuery.trim()).slice(0, 16)
    : EMOJI_CATALOG.slice(0, 24);

  const editFilteredEmojis = editPickerQuery.trim()
    ? localSuggestions(editPickerQuery.trim()).slice(0, 16)
    : EMOJI_CATALOG.slice(0, 24);

  return (
    <div
      className="guestbook-view flex flex-col size-full overflow-y-auto p-4 sm:p-5 font-mono text-sm leading-relaxed"
      style={{ backgroundColor: "var(--color-blue, #1313ba)", backgroundImage: "none", color: "var(--color-paper, #fffbed)" }}
    >
      {/* Top Explanation Banner: --ink text on --paper background */}
      <div className="bg-paper text-ink p-3.5 mb-5 border border-ink/20 font-mono text-xs leading-relaxed shadow-sm shrink-0">
        <p className="m-0 font-medium">
          Anyone can leave a gift! Authorship is tied to your device — you can edit and delete your
          message as long as you revisit from the same device and don’t clear your browser session.
          Messages are reviewed by Kaio, though they might be auto-approved.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-2.5 bg-red-900/60 border border-red-400 text-red-200 text-xs font-mono">
          {error}
        </div>
      )}

      {statusNotice && (
        <div className="mb-4 p-2.5 bg-paper/20 border border-paper/40 text-paper text-xs font-mono">
          {statusNotice}
        </div>
      )}

      {/* Leave a Gift Form */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="mb-6 border border-paper/30 bg-blue/80 p-3.5 flex flex-col gap-3 shrink-0"
      >
        <div className="flex items-start gap-3">
          {/* Icon First */}
          <div ref={pickerRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              className="size-11 flex items-center justify-center text-2xl font-emoji border border-paper/40 bg-paper/10 hover:bg-paper/20 cursor-pointer active:scale-95 transition-transform"
              aria-label={`Change icon. Current: ${selectedEmoji.name}`}
              title="Click to change icon"
            >
              {selectedEmoji.emoji}
            </button>

            {showPicker && (
              <div className="absolute top-12 left-0 z-30 w-64 bg-paper text-ink border border-ink p-2 shadow-xl">
                <input
                  type="search"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Search emoji..."
                  className="w-full p-1.5 mb-2 text-xs font-mono bg-paper border border-ink/40 text-ink placeholder:text-ink/50 focus:border-ink focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setShowPicker(false);
                  }}
                />
                <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto p-1">
                  {filteredEmojis.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedEmoji(opt);
                        setShowPicker(false);
                        setPickerQuery("");
                      }}
                      className="size-8 flex items-center justify-center text-lg font-emoji hover:bg-ink/10 rounded cursor-pointer"
                      title={opt.name}
                    >
                      {opt.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Message (400 chars max) with semicircle indicator in bottom right */}
          <div className="flex-1 min-w-0 relative">
            <textarea
              required
              rows={3}
              maxLength={400}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Leave a message, an interesting link, a pun... anything you want!"
              className="w-full bg-blue border border-paper/40 p-2.5 pb-7 text-sm font-mono text-paper placeholder:text-paper/40 focus:border-paper focus:outline-none resize-none"
            />
            {/* Semicircle indicator in bottom right showing how many characters the writer has left */}
            <div className="absolute bottom-2 right-2.5 pointer-events-none select-none">
              <SemicircleIndicator max={400} current={message.length} />
            </div>
          </div>
        </div>

        {/* User message lies on top of these two fields in the same row, xs tailwind font size */}
        <div className="flex flex-col sm:flex-row gap-3 text-xs pl-0 sm:pl-14">
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <span className="text-paper/70 font-semibold whitespace-nowrap">By:</span>
            <input
              type="text"
              required
              maxLength={60}
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="What's your name? Anonymous is fine."
              className="w-full bg-transparent border-b border-paper/30 pb-0.5 text-xs text-paper placeholder:text-paper/40 focus:border-paper focus:outline-none"
            />
          </div>
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <span className="text-paper/70 font-semibold whitespace-nowrap">From:</span>
            <input
              type="text"
              maxLength={60}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Where are you?"
              className="w-full bg-transparent border-b border-paper/30 pb-0.5 text-xs text-paper placeholder:text-paper/40 focus:border-paper focus:outline-none"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-1 pl-0 sm:pl-14">
          <button
            type="submit"
            disabled={submitting || !message.trim() || !authorName.trim()}
            className="px-4 py-1.5 border border-paper bg-paper text-blue hover:bg-transparent hover:text-paper text-xs font-mono font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Leaving gift…" : "Leave gift ↗"}
          </button>
        </div>
      </form>

      {/* Gifts List */}
      <div className="flex flex-col gap-3 flex-1 min-h-0">
        <div className="flex items-center justify-between text-xs font-mono text-paper/70 pb-1.5 border-b border-paper/20 shrink-0">
          <span>Gifts left by visitors ({gifts.length})</span>
        </div>

        {loading ? (
          <p className="text-xs font-mono text-paper/60 py-4 text-center">Loading guestbook…</p>
        ) : gifts.length === 0 ? (
          <p className="text-xs font-mono text-paper/60 py-8 text-center">
            No gifts left yet. Be the first to leave one!
          </p>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {gifts.map((gift) => {
              const isEditing = editingId === gift.id;

              if (isEditing) {
                return (
                  <form
                    key={gift.id}
                    onSubmit={(e) => void handleUpdate(gift.id, e)}
                    className="p-3 border border-paper/40 bg-blue/90 flex flex-col gap-2.5"
                  >
                    <div className="flex items-start gap-3">
                      <div ref={editPickerRef} className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowEditPicker(!showEditPicker)}
                          className="size-10 flex items-center justify-center text-xl font-emoji border border-paper/40 bg-paper/10 hover:bg-paper/20 cursor-pointer"
                        >
                          {editEmoji.emoji}
                        </button>
                        {showEditPicker && (
                          <div className="absolute top-11 left-0 z-30 w-64 bg-paper text-ink border border-ink p-2 shadow-xl">
                            <input
                              type="search"
                              value={editPickerQuery}
                              onChange={(e) => setEditPickerQuery(e.target.value)}
                              placeholder="Search emoji..."
                              className="w-full p-1.5 mb-2 text-xs font-mono bg-paper border border-ink/40 text-ink placeholder:text-ink/50 focus:border-ink focus:outline-none"
                            />
                            <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto p-1">
                              {editFilteredEmojis.map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => {
                                    setEditEmoji(opt);
                                    setShowEditPicker(false);
                                    setEditPickerQuery("");
                                  }}
                                  className="size-8 flex items-center justify-center text-lg font-emoji hover:bg-ink/10 rounded cursor-pointer"
                                >
                                  {opt.emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 relative">
                        <textarea
                          required
                          rows={2}
                          maxLength={400}
                          value={editMessage}
                          onChange={(e) => setEditMessage(e.target.value)}
                          className="w-full bg-blue border border-paper/40 p-2 pb-7 text-sm font-mono text-paper placeholder:text-paper/40 focus:border-paper focus:outline-none resize-none"
                        />
                        <div className="absolute bottom-1.5 right-2 pointer-events-none select-none">
                          <SemicircleIndicator max={400} current={editMessage.length} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 text-xs pl-0 sm:pl-13">
                      <div className="flex-1 flex items-center gap-1.5 min-w-0">
                        <span className="text-paper/70 font-semibold whitespace-nowrap">By:</span>
                        <input
                          type="text"
                          required
                          maxLength={60}
                          value={editAuthorName}
                          onChange={(e) => setEditAuthorName(e.target.value)}
                          placeholder="What's your name? Anonymous is fine."
                          className="w-full bg-transparent border-b border-paper/30 pb-0.5 text-xs text-paper placeholder:text-paper/40 focus:border-paper focus:outline-none"
                        />
                      </div>
                      <div className="flex-1 flex items-center gap-1.5 min-w-0">
                        <span className="text-paper/70 font-semibold whitespace-nowrap">From:</span>
                        <input
                          type="text"
                          maxLength={60}
                          value={editLocation}
                          onChange={(e) => setEditLocation(e.target.value)}
                          placeholder="Where are you?"
                          className="w-full bg-transparent border-b border-paper/30 pb-0.5 text-xs text-paper placeholder:text-paper/40 focus:border-paper focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 pl-0 sm:pl-13 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 text-paper/70 hover:text-paper underline cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingEdit || !editMessage.trim() || !editAuthorName.trim()}
                        className="px-3 py-1 border border-paper bg-paper text-blue hover:bg-transparent hover:text-paper font-medium cursor-pointer disabled:opacity-50"
                      >
                        {savingEdit ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </form>
                );
              }

              return (
                <div
                  key={gift.id}
                  className="p-3 border border-paper/20 bg-blue/50 flex items-start gap-3 hover:border-paper/40 transition-colors"
                >
                  {/* Icon first */}
                  <div className="shrink-0 text-2xl font-emoji pt-0.5" aria-hidden="true">
                    {gift.emoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* User's message */}
                    <p className="text-sm font-mono leading-relaxed whitespace-pre-wrap break-words text-paper m-0 mb-2">
                      {gift.message}
                    </p>

                    {/* User message lies on top of these two fields, xs tailwind font size */}
                    {/* First line: author name; second line: optional location */}
                    <div className="flex flex-col gap-0.5 text-xs font-mono text-paper/80">
                      <div className="flex items-center gap-2">
                        <span className="truncate">
                          <span className="font-semibold text-paper/60">By: </span>
                          <span className="text-paper">{gift.authorName}</span>
                        </span>
                        {gift.status === "pending" && (
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.2 bg-paper/20 text-paper border border-paper/40 self-start sm:self-auto font-semibold">
                            Pending review
                          </span>
                        )}
                      </div>
                      {gift.location && (
                        <div className="truncate">
                          <span className="font-semibold text-paper/60">From: </span>
                          <span className="text-paper">{gift.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Edit / Delete actions for the author on this device */}
                    {gift.canEdit && (
                      <div className="flex items-center gap-3 mt-2 text-xs font-mono">
                        <button
                          type="button"
                          onClick={() => startEditing(gift)}
                          className="text-paper/70 hover:text-paper underline cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(gift.id)}
                          className="text-paper/70 hover:text-red-300 underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

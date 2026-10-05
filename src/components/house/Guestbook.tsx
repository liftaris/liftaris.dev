import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { createGift, ensureVisitor, getHouse, reclaimGift, updateGift } from "../../lib/house/client";
import type { HouseMutation } from "../../lib/house/client";
import { EMOJI_CATALOG, findEmoji, searchEmojiCatalog } from "../../lib/house/emoji";
import type { EmojiOption, Gift, HouseSnapshot } from "../../lib/house/types";

interface GuestbookProps {
  initialSnapshot?: HouseSnapshot | null;
  mutate?: HouseMutation;
  onGiftsChange?: (gifts: Gift[]) => void;
}

export function Guestbook({ initialSnapshot, mutate, onGiftsChange }: GuestbookProps) {
  const [gifts, setGifts] = useState<Gift[]>(() => initialSnapshot?.gifts ?? []);
  const [loading, setLoading] = useState(!initialSnapshot);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        setError(err instanceof Error ? err.message : "Couldn’t load guestbook.");
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

  const handleMessageChange = (val: string) => {
    const newlines = (val.match(/\n/g) || []).length;
    if (newlines > 6) {
      const parts = val.split("\n");
      val = parts.slice(0, 7).join("\n");
    }
    setMessage(val);
  };

  const handleEditMessageChange = (val: string) => {
    const newlines = (val.match(/\n/g) || []).length;
    if (newlines > 6) {
      const parts = val.split("\n");
      val = parts.slice(0, 7).join("\n");
    }
    setEditMessage(val);
  };

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, currentText: string) => {
    if (e.key === "Enter") {
      const newlines = (currentText.match(/\n/g) || []).length;
      if (newlines >= 6) {
        e.preventDefault();
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !message.trim() || !authorName.trim()) return;

    setSubmitting(true);
    setError("");

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

      // Reset form fields
      setMessage("");
      setLocation("");
      setShowPicker(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t sign the guestbook. Please try again.");
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
      setError(err instanceof Error ? err.message : "Couldn’t update message. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    setError("");

    try {
      await ensureVisitor();
      const execute = () => reclaimGift(id);
      const snapshot = mutate ? await mutate(execute) : await execute();

      setGifts(snapshot.gifts);
      onGiftsChange?.(snapshot.gifts);
      if (editingId === id) setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t delete message. Please try again.");
    }
  };

  const filteredEmojis = pickerQuery.trim()
    ? searchEmojiCatalog(pickerQuery.trim())
    : EMOJI_CATALOG;

  const editFilteredEmojis = editPickerQuery.trim()
    ? searchEmojiCatalog(editPickerQuery.trim())
    : EMOJI_CATALOG;

  return (
    <div
      className="guestbook-view flex flex-col size-full overflow-y-auto p-4 sm:p-6 font-mono text-sm leading-relaxed"
      style={{ backgroundColor: "var(--color-blue, #1313ba)", backgroundImage: "none", color: "var(--color-paper, #fffbed)" }}
    >
      {/* Top Explanation Banner: --ink text on --paper background */}
      <div className="bg-paper text-ink p-3.5 mb-6 border border-ink/20 font-mono text-xs leading-relaxed shadow-sm shrink-0">
        <p className="m-0 font-medium">
          Choose an icon and leave a message. If you want, tell me who and where you&apos;re from! Authorship is tied to your device.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-2.5 bg-red-900/60 border border-red-400 text-red-200 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Guestbook Form: looks like the first item in the list */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex items-start gap-4 pb-6 border-b border-paper/20 shrink-0"
      >
        {/* Large icon (matching landing page icons) */}
        <div ref={pickerRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className="w-16 h-16 flex items-center justify-center shrink-0 font-emoji select-none cursor-pointer hover:scale-105 active:scale-95 transition-transform"
            style={{ fontSize: "52px", lineHeight: "1" }}
            aria-label={`Change icon. Current: ${selectedEmoji.name}`}
            title="Click to change icon"
          >
            {selectedEmoji.emoji}
          </button>

          {showPicker && (
            <div className="absolute top-18 left-0 z-30 w-72 bg-paper text-ink border border-ink p-2.5 shadow-2xl font-mono">
              <input
                type="search"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="search icons"
                className="w-full p-0 pb-1 mb-2.5 text-xs font-mono bg-paper border-0 border-b border-ink/30 text-ink placeholder:text-ink/50 focus:border-ink focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowPicker(false);
                }}
                autoFocus
              />
              <div className="grid grid-cols-6 gap-1 max-h-52 overflow-y-auto overscroll-contain">
                {filteredEmojis.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedEmoji(opt);
                      setShowPicker(false);
                      setPickerQuery("");
                    }}
                    className="size-9 flex items-center justify-center text-2xl font-emoji hover:bg-ink/10 rounded cursor-pointer"
                    title={opt.name}
                  >
                    {opt.emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Form message & inputs */}
        <div className="flex-1 min-w-0">
          <textarea
            required
            rows={2}
            maxLength={400}
            value={message}
            onChange={(e) => handleMessageChange(e.target.value)}
            onKeyDown={(e) => handleTextareaKeyDown(e, message)}
            placeholder="Leave a message, an interesting link, a pun... anything you want!"
            className="w-full bg-transparent border-0 border-b border-paper/30 focus:border-paper p-0 pb-1 text-sm font-mono text-paper placeholder:text-paper/40 focus:outline-none leading-relaxed"
            style={{ minHeight: "2.75rem", maxHeight: "10rem", resize: "vertical" }}
          />

          {/* Simple character count display under the textarea, not in it */}
          <div className="flex justify-end mt-1 mb-2.5">
            <span className="text-[11px] font-mono text-paper/60 tabular-nums select-none">
              {message.length}/400
            </span>
          </div>

          {/* By and From values in the same row, unless they don't both fit */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono">
            <div className="flex items-center gap-1.5 min-w-[200px] flex-1 sm:flex-initial">
              <span className="text-paper/70 font-semibold whitespace-nowrap">By:</span>
              <input
                type="text"
                required
                maxLength={60}
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="What's your name? Anonymous is fine."
                className="w-full sm:w-56 bg-transparent border-0 border-b border-paper/30 pb-0.5 text-xs text-paper placeholder:text-paper/40 focus:border-paper focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 min-w-[150px] flex-1 sm:flex-initial">
              <span className="text-paper/70 font-semibold whitespace-nowrap">From:</span>
              <input
                type="text"
                maxLength={60}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Where are you?"
                className="w-full sm:w-44 bg-transparent border-0 border-b border-paper/30 pb-0.5 text-xs text-paper placeholder:text-paper/40 focus:border-paper focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !message.trim() || !authorName.trim()}
              className="ml-auto px-3.5 py-1 border border-paper bg-paper text-blue hover:bg-transparent hover:text-paper text-xs font-mono font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Signing…" : "Sign guestbook ↗"}
            </button>
          </div>
        </div>
      </form>

      {/* Messages List */}
      <div className="flex flex-col flex-1 min-h-0">
        {loading ? (
          <p className="text-xs font-mono text-paper/60 py-6 text-center">Loading guestbook…</p>
        ) : gifts.length === 0 ? (
          <p className="text-xs font-mono text-paper/60 py-8 text-center">
            No messages left yet. Be the first to leave one!
          </p>
        ) : (
          <div className="flex flex-col">
            {gifts.map((gift) => {
              const isEditing = editingId === gift.id;

              if (isEditing) {
                return (
                  <form
                    key={gift.id}
                    onSubmit={(e) => void handleUpdate(gift.id, e)}
                    className="flex items-start gap-4 py-5 border-b border-paper/15"
                  >
                    {/* Large icon with picker */}
                    <div ref={editPickerRef} className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowEditPicker(!showEditPicker)}
                        className="w-16 h-16 flex items-center justify-center shrink-0 font-emoji select-none cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                        style={{ fontSize: "52px", lineHeight: "1" }}
                        aria-label={`Change icon. Current: ${editEmoji.name}`}
                        title="Click to change icon"
                      >
                        {editEmoji.emoji}
                      </button>
                      {showEditPicker && (
                        <div className="absolute top-18 left-0 z-30 w-72 bg-paper text-ink border border-ink p-2.5 shadow-2xl font-mono">
                          <input
                            type="search"
                            value={editPickerQuery}
                            onChange={(e) => setEditPickerQuery(e.target.value)}
                            placeholder="search icons"
                            className="w-full p-0 pb-1 mb-2.5 text-xs font-mono bg-paper border-0 border-b border-ink/30 text-ink placeholder:text-ink/50 focus:border-ink focus:outline-none"
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setShowEditPicker(false);
                            }}
                            autoFocus
                          />
                          <div className="grid grid-cols-6 gap-1 max-h-52 overflow-y-auto overscroll-contain">
                            {editFilteredEmojis.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setEditEmoji(opt);
                                  setShowEditPicker(false);
                                  setEditPickerQuery("");
                                }}
                                className="size-9 flex items-center justify-center text-2xl font-emoji hover:bg-ink/10 rounded cursor-pointer"
                                title={opt.name}
                              >
                                {opt.emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <textarea
                        required
                        rows={2}
                        maxLength={400}
                        value={editMessage}
                        onChange={(e) => handleEditMessageChange(e.target.value)}
                        onKeyDown={(e) => handleTextareaKeyDown(e, editMessage)}
                        className="w-full bg-transparent border-0 border-b border-paper/30 focus:border-paper p-0 pb-1 text-sm font-mono text-paper placeholder:text-paper/40 focus:outline-none leading-relaxed"
                        style={{ minHeight: "2.75rem", maxHeight: "10rem", resize: "vertical" }}
                      />
                      <div className="flex justify-end mt-1 mb-2.5">
                        <span className="text-[11px] font-mono text-paper/60 tabular-nums select-none">
                          {editMessage.length}/400
                        </span>
                      </div>

                      {/* By and From values in the same row, unless they don't both fit */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono">
                        <div className="flex items-center gap-1.5 min-w-[200px] flex-1 sm:flex-initial">
                          <span className="text-paper/70 font-semibold whitespace-nowrap">By:</span>
                          <input
                            type="text"
                            required
                            maxLength={60}
                            value={editAuthorName}
                            onChange={(e) => setEditAuthorName(e.target.value)}
                            placeholder="What's your name? Anonymous is fine."
                            className="w-full sm:w-56 bg-transparent border-0 border-b border-paper/30 pb-0.5 text-xs text-paper placeholder:text-paper/40 focus:border-paper focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 min-w-[150px] flex-1 sm:flex-initial">
                          <span className="text-paper/70 font-semibold whitespace-nowrap">From:</span>
                          <input
                            type="text"
                            maxLength={60}
                            value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                            placeholder="Where are you?"
                            className="w-full sm:w-44 bg-transparent border-0 border-b border-paper/30 pb-0.5 text-xs text-paper placeholder:text-paper/40 focus:border-paper focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 text-paper/70 hover:text-paper underline cursor-pointer text-xs font-mono"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingEdit || !editMessage.trim() || !editAuthorName.trim()}
                            className="px-3.5 py-1 border border-paper bg-paper text-blue hover:bg-transparent hover:text-paper font-medium cursor-pointer disabled:opacity-50 text-xs font-mono"
                          >
                            {savingEdit ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                );
              }

              return (
                <div
                  key={gift.id}
                  className="flex items-start gap-4 py-5 border-b border-paper/15"
                >
                  {/* Icon first - as large as landing page icons */}
                  <div
                    className="w-16 h-16 flex items-center justify-center shrink-0 font-emoji select-none"
                    style={{ fontSize: "52px", lineHeight: "1" }}
                    aria-hidden="true"
                  >
                    {gift.emoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      {/* User's message */}
                      <p className="text-sm font-mono leading-relaxed whitespace-pre-wrap break-words text-paper m-0 mb-3 flex-1">
                        {gift.message}
                      </p>

                      {/* Small icon buttons on the right side of the rendered item */}
                      {gift.canEdit && (
                        <div className="flex items-center gap-1 shrink-0 ml-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => startEditing(gift)}
                            className="p-1 text-paper/60 hover:text-paper cursor-pointer rounded hover:bg-paper/10 transition-colors"
                            title="Edit message"
                            aria-label="Edit message"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                              <path d="m15 5 4 4"/>
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(gift.id)}
                            className="p-1 text-paper/60 hover:text-red-300 cursor-pointer rounded hover:bg-paper/10 transition-colors"
                            title="Delete message"
                            aria-label="Delete message"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M3 6h18"/>
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* By and From values in the same row, unless they don't both fit */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-paper/80">
                      <span className="truncate">
                        <span className="font-semibold text-paper/60">By: </span>
                        <span className="text-paper">{gift.authorName}</span>
                      </span>
                      {gift.location && (
                        <span className="truncate">
                          <span className="font-semibold text-paper/60">From: </span>
                          <span className="text-paper">{gift.location}</span>
                        </span>
                      )}
                      {gift.status === "pending" && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.2 bg-paper/20 text-paper border border-paper/40 font-semibold">
                          Pending review
                        </span>
                      )}
                    </div>
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

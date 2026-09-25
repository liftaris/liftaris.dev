export type Audience = "public" | "private";
export interface Gift {
  id: string;
  emojiId: string;
  authorName: string;
  createdAt: string;
  visibility: Audience;
  /** Only public messages appear in scene snapshots. */
  message: string | null;
}
export interface HouseSnapshot {
  gifts: Gift[];
}
export interface CreatedGift extends HouseSnapshot {
  /** Null when a retry refers to a gift that has already been removed. */
  createdGiftId: string | null;
}
export interface Visitor {
  id: string;
  name: string;
}
export interface Viewer {
  visitor: Visitor | null;
  owner: boolean;
}
export interface GiftDetail extends Gift {
  canEdit: boolean;
  canReclaim: boolean;
  canRemove: boolean;
}
export interface CreateGift {
  requestId: string;
  emojiId: string;
  message?: string;
  visibility: Audience;
  /** Empty means the visitor's assigned animal name. */
  displayName?: string;
}

export type UpdateGift = Omit<CreateGift, "requestId">;

export interface EmojiOption {
  id: string;
  emoji: string;
  name: string;
  keywords: string;
}

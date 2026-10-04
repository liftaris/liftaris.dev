export type Audience = "public" | "private";

export interface Gift {
  id: string;
  emojiId: string;
  emoji: string;
  authorName: string;
  location?: string | null;
  createdAt: string;
  message: string;
  status: "approved" | "pending";
  canEdit?: boolean;
  canDelete?: boolean;
  visibility?: Audience;
}

export interface HouseSnapshot {
  gifts: Gift[];
}

export interface CreatedGift extends HouseSnapshot {
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
  version?: number;
  canEdit: boolean;
  canReclaim: boolean;
  canRemove: boolean;
}

export interface CreateGift {
  requestId: string;
  emojiId: string;
  message: string;
  authorName: string;
  location?: string;
  visibility?: Audience;
  displayName?: string;
}

export interface UpdateGift {
  emojiId: string;
  message: string;
  authorName: string;
  location?: string;
  version?: number;
  visibility?: Audience;
  displayName?: string;
}

export interface EmojiOption {
  id: string;
  emoji: string;
  name: string;
  keywords: string;
}

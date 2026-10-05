export interface Gift {
  id: string;
  emojiId: string;
  emoji: string;
  authorName: string;
  location?: string | null;
  createdAt: string;
  updatedAt: string;
  message: string;
  status: "approved" | "pending";
  canEdit?: boolean;
  canDelete?: boolean;
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

export interface CreateGift {
  requestId: string;
  emojiId: string;
  message: string;
  authorName: string;
  location?: string;
}

export interface UpdateGift {
  updatedAt?: string;
  emojiId: string;
  message: string;
  authorName: string;
  location?: string;
}

export interface EmojiOption {
  id: string;
  emoji: string;
  name: string;
  keywords: string;
}

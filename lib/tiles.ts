/**
 * Tile vocabulary — the complete set of visual primitives the assistant
 * can compose alongside a chat response. Every page is built from these.
 */

import type { RepoCard } from "@/lib/github";

export type TileSpec =
  | { kind: "project"; slug: string }
  | { kind: "experience"; company: string }
  | { kind: "stat"; value: string; label: string; sublabel?: string }
  | { kind: "image"; src: string; alt: string; aspect?: "square" | "video" | "wide" }
  | { kind: "map"; place: string }
  | { kind: "stack"; title?: string; items: string[] }
  | { kind: "link"; href: string; title: string; subtitle?: string }
  | { kind: "contact" }
  | { kind: "text"; title?: string; body: string }
  | { kind: "quote"; text: string; cite?: string }
  | { kind: "ghrepo"; repo: string; data?: RepoCard }
  | { kind: "ghgrid" }
  | { kind: "ghactivity" };

export interface RetrievalHit {
  id: string;
  title: string;
  type: string;
  similarity: number;
}

export interface TurnSurface {
  left: TileSpec[];
  right: TileSpec[];
  retrieval: RetrievalHit[];
}

export const EMPTY_SURFACE: TurnSurface = { left: [], right: [], retrieval: [] };

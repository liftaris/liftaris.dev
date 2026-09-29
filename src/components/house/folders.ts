import type { FolderSpec, FolderEntry } from "../folder/Folder";
import { isImageUrl, type ObjectSpec } from "../clump/model";

export type WritingPost = { id: string; slug: string; title: string; icon: string };
export type PostThing = ObjectSpec & { kind: "post"; href: string };
export type HouseThing = ObjectSpec | PostThing | ThingSpec;

export interface ThingSpec extends ObjectSpec {
  kind: "object" | "folder" | "link" | "action" | "page";
  desktop: boolean;
  parent_id?: string | null;
  action?: "none" | "projects" | "experience" | "leave-gift" | null;
  href?: string | null;
  tint_when_visited: boolean;
  default_open?: boolean;
  sort_order: number;
  body?: unknown;
}

export const DEFAULT_THINGS: readonly ThingSpec[] = [
  { id: "octopus", name: "Octopus", emoji: "🐙", kind: "object", desktop: true, parent_id: null, action: "none", href: null, tint_when_visited: true, shape: "circle", anchor: false, width: 68, height: 70, sort_order: 1 },
  { id: "computer", name: "Computer", emoji: "🖥️", kind: "object", desktop: true, parent_id: "portfolio-folder", action: "projects", href: null, tint_when_visited: true, shape: "rectangle", anchor: true, width: 64, height: 58, sort_order: 2 },
  { id: "shoes", name: "Walking shoes", emoji: "👟", kind: "object", desktop: true, parent_id: null, action: "none", href: null, tint_when_visited: true, shape: "rectangle", anchor: false, width: 54, height: 40, sort_order: 3 },
  { id: "globe", name: "Globe", emoji: "🌍", kind: "object", desktop: true, parent_id: null, action: "none", href: null, tint_when_visited: true, shape: "circle", anchor: false, width: 50, height: 50, sort_order: 4 },
  { id: "plant", name: "Plant", emoji: "🪴", kind: "object", desktop: true, parent_id: null, action: "none", href: null, tint_when_visited: true, shape: "rectangle", anchor: true, width: 56, height: 66, sort_order: 5 },
  { id: "cloud", name: "Cloud", emoji: "☁️", kind: "object", desktop: true, parent_id: null, action: "none", href: null, tint_when_visited: true, shape: "rectangle", anchor: false, width: 60, height: 42, sort_order: 6 },
  { id: "bike", name: "Bicycle", emoji: "🚲", kind: "object", desktop: true, parent_id: null, action: "none", href: null, tint_when_visited: true, shape: "rectangle", anchor: false, width: 74, height: 54, sort_order: 7 },
  { id: "boots", name: "Climbing shoes", emoji: "🥾", kind: "object", desktop: true, parent_id: null, action: "none", href: null, tint_when_visited: true, shape: "rectangle", anchor: false, width: 47, height: 54, sort_order: 8 },
  { id: "light", name: "Light", emoji: "💡", kind: "object", desktop: true, parent_id: null, action: "none", href: null, tint_when_visited: true, shape: "rectangle", anchor: true, width: 38, height: 52, sort_order: 9 },
  { id: "case", name: "Briefcase", emoji: "💼", kind: "object", desktop: true, parent_id: "portfolio-folder", action: "experience", href: null, tint_when_visited: true, shape: "rectangle", anchor: false, width: 52, height: 44, sort_order: 10 },
  { id: "leave-gift", name: "Leave a gift", emoji: "🎁", kind: "action", desktop: true, parent_id: null, action: "leave-gift", href: null, tint_when_visited: true, shape: "rectangle", anchor: false, width: 64, height: 64, sort_order: 11 },
  { id: "portfolio-folder", name: "Portfolio", emoji: "📁", kind: "folder", desktop: true, parent_id: null, action: "none", href: null, tint_when_visited: false, shape: "rectangle", anchor: false, width: 64, height: 56, sort_order: 12 },
  { id: "writing-folder", name: "Writing", emoji: "📂", kind: "folder", desktop: true, parent_id: null, action: "none", href: null, tint_when_visited: false, shape: "rectangle", anchor: false, width: 64, height: 56, sort_order: 13 },
];

export const WRITING_FOLDER_OBJECT: ObjectSpec = DEFAULT_THINGS.find((t) => t.id === "writing-folder") ?? {
  id: "writing-folder", name: "Writing", emoji: "📂", width: 64, height: 56, shape: "rectangle",
};

export const PORTFOLIO_FOLDER_OBJECT: ObjectSpec = DEFAULT_THINGS.find((t) => t.id === "portfolio-folder") ?? {
  id: "portfolio-folder", name: "Portfolio", emoji: "📁", width: 64, height: 56, shape: "rectangle",
};

export const GITHUB_THING: ThingSpec = {
  id: "github",
  name: "GitHub",
  emoji: "🐙",
  image: "/github.svg",
  kind: "object",
  desktop: true,
  parent_id: null,
  action: "none",
  tint_when_visited: true,
  shape: "circle",
  anchor: false,
  width: 58,
  height: 58,
  sort_order: 16,
};

export function buildFolder(
  folderThing: ThingSpec,
  allThings: readonly ThingSpec[] = DEFAULT_THINGS,
  posts: readonly WritingPost[] = []
): FolderSpec<HouseThing> {
  const children = allThings
    .filter((t) => t.parent_id === folderThing.id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const items: FolderEntry<HouseThing>[] = [];

  if (folderThing.id === "writing-folder") {
    for (const post of posts) {
      const isImg = isImageUrl(post.icon);
      const value: PostThing = {
        kind: "post",
        id: `post:${post.id}`,
        name: post.title,
        emoji: isImg ? "📝" : post.icon,
        image: isImg ? post.icon : undefined,
        href: `/blog/${encodeURIComponent(post.slug)}`,
        width: 56,
        height: 64,
        shape: "rectangle",
      };
      items.push({ kind: "item", id: value.id, name: value.name, emoji: value.emoji, image: value.image, value });
    }
  }

  for (const child of children) {
    if (child.kind === "folder") {
      items.push(buildFolder(child, allThings, posts));
    } else if (child.kind === "link") {
      const isImg = isImageUrl(child.image) ? child.image : isImageUrl(child.emoji) ? child.emoji : undefined;
      items.push({
        kind: "link",
        id: child.id,
        name: child.name,
        emoji: child.emoji,
        image: isImg,
        background_image: child.background_image,
        background_size: child.background_size,
        background_position: child.background_position,
        background_repeat: child.background_repeat,
        shape: child.shape,
        href: child.href ?? "#",
      });
    } else {
      const displayName =
        child.action === "projects" && child.name === "Computer"
          ? "Projects"
          : child.action === "experience" && child.name === "Briefcase"
            ? "Experience"
            : child.name;
      items.push({
        kind: "item",
        id: child.id,
        name: displayName,
        emoji: child.emoji,
        image: child.image,
        background_image: child.background_image,
        background_size: child.background_size,
        background_position: child.background_position,
        background_repeat: child.background_repeat,
        shape: child.shape,
        value: child,
      });
    }
  }

  return {
    ...folderThing,
    kind: "folder",
    items,
  };
}

export function writingFolder(posts: readonly WritingPost[], things: readonly ThingSpec[] = DEFAULT_THINGS): FolderSpec<HouseThing> {
  const writingThing = things.find((t) => t.id === "writing-folder") ?? (WRITING_FOLDER_OBJECT as ThingSpec);
  return buildFolder(writingThing, things, posts);
}

export const PORTFOLIO_FOLDER: FolderSpec<HouseThing> = buildFolder(
  DEFAULT_THINGS.find((t) => t.id === "portfolio-folder")!,
  DEFAULT_THINGS,
  []
);

/**
 * Recursively retrieves all items inside a folder that are marked default_open.
 * If a child is a folder with default_open, it and its default_open descendants are returned.
 */
export function getDefaultOpenChildren(
  folderId: string,
  allThings: readonly ThingSpec[],
  visitedFolders = new Set<string>([folderId])
): ThingSpec[] {
  const result: ThingSpec[] = [];
  const children = allThings
    .filter((t) => t.parent_id === folderId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  for (const thing of children) {
    if (thing.default_open && thing.kind !== "link") {
      result.push(thing);
      if (thing.kind === "folder" && !visitedFolders.has(thing.id)) {
        visitedFolders.add(thing.id);
        result.push(...getDefaultOpenChildren(thing.id, allThings, visitedFolders));
      }
    }
  }
  return result;
}

/**
 * Returns all windows that should be open on initial page load:
 * - Desktop or top-level things (desktop: true or !parent_id) with default_open: true.
 * - If any of those is a folder, its default_open descendants are also included.
 */
export function getInitialDefaultOpenThings(allThings: readonly ThingSpec[]): ThingSpec[] {
  const result: ThingSpec[] = [];
  const visitedFolders = new Set<string>();

  const topLevel = allThings
    .filter((t) => t.default_open && (t.desktop || !t.parent_id) && t.kind !== "link")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  for (const thing of topLevel) {
    result.push(thing);
    if (thing.kind === "folder" && !visitedFolders.has(thing.id)) {
      visitedFolders.add(thing.id);
      result.push(...getDefaultOpenChildren(thing.id, allThings, visitedFolders));
    }
  }

  const seen = new Set<string>();
  return result.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

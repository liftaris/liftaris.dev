import type { FolderSpec, FolderEntry } from "../folder/Folder";
import { isImageUrl, type ObjectSpec } from "../clump/model";

export type PostThing = ObjectSpec & { kind: "post"; href: string };
export type HouseThing = ObjectSpec | PostThing | ThingSpec;

export interface ThingSpec extends ObjectSpec {
  kind: "object" | "folder" | "link" | "action" | "page" | "application";
  slug?: string;
  contents?: string[];
  primaryFolder?: string | null;
  page_source?: 'content' | 'post' | 'projects' | 'experience' | 'github' | 'clump' | 'guestbook';
  application?: 'leave-gift';
  window_width?: number;
  window_height?: number;
  window_x?: number | null;
  window_y?: number | null;
  spawn_x?: number;
  spawn_y?: number;
  previewUrl?: string;
  desktop: boolean;
  parent_id?: string | null;
  action?: "none" | "projects" | "experience" | "leave-gift" | null;
  href?: string | null;
  default_open?: boolean;
  sort_order: number;
  body?: unknown;
}

export function buildFolder(
  folderThing: ThingSpec,
  allThings: readonly ThingSpec[],
  visited = new Set<string>()
): FolderSpec<HouseThing> {
  const nextVisited = new Set(visited).add(folderThing.id);
  const children = (folderThing.contents
    ? folderThing.contents.flatMap(id => allThings.find(t => t.id === id) ?? [])
    : allThings.filter(t => t.parent_id === folderThing.id || t.primaryFolder === folderThing.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
    .filter(t => !nextVisited.has(t.id));

  const items: FolderEntry<HouseThing>[] = [];

  for (const child of children) {
    if (child.kind === "folder") {
      items.push(buildFolder(child, allThings, nextVisited));
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
        width: child.width, height: child.height,
        background_image: child.background_image,
        background_size: child.background_size,
        background_position: child.background_position,
        background_repeat: child.background_repeat,
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
  const folder = allThings.find(f => f.id === folderId);
  const children = allThings
    .filter((t) => {
      return folder?.contents
        ? folder.contents.includes(t.id)
        : (t.parent_id === folderId || t.primaryFolder === folderId);
    })
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
 * - Desktop Things with default_open: true.
 * - If any of those is a folder, its default_open descendants are also included.
 */
export function getInitialDefaultOpenThings(allThings: readonly ThingSpec[]): ThingSpec[] {
  const result: ThingSpec[] = [];
  const visitedFolders = new Set<string>();

  const topLevel = allThings
    .filter((t) => t.default_open && t.desktop && t.kind !== "link")
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

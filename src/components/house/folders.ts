import type { FolderSpec } from "../folder/Folder";
import type { ObjectSpec } from "../clump/model";
import type { ThingData, ThingRecord } from "../../lib/things/model";

export type ThingSpec = ObjectSpec & Omit<ThingData, "image" | "background_image"> &
  Pick<ThingRecord, "slug" | "contents" | "primaryFolder"> & {
    href?: string | null;
    previewUrl?: string;
  };
export type HouseThing = ObjectSpec | ThingSpec;

export function buildFolder(
  folderThing: ThingSpec,
  allThings: readonly ThingSpec[],
  visited = new Set<string>()
): FolderSpec<HouseThing> {
  const nextVisited = new Set(visited).add(folderThing.id);
  const children = folderThing.contents
    .flatMap(id => allThings.find(t => t.id === id) ?? [])
    .filter(t => !nextVisited.has(t.id));

  const items: FolderSpec<HouseThing>["items"][number][] = [];

  for (const child of children) {
    if (child.kind === "folder") {
      items.push(buildFolder(child, allThings, nextVisited));
    } else {
      items.push({
        kind: "item",
        id: child.id,
        name: child.name,
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
  const children = (folder?.contents ?? []).flatMap(id => allThings.find(t => t.id === id) ?? []);

  for (const thing of children) {
    if (thing.default_open) {
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
    .filter((t) => t.default_open && t.desktop)
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

import type { ThingSpec } from './scene';

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

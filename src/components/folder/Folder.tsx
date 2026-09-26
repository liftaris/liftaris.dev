import type { ComponentProps } from "react";
import { isImageUrl } from "../clump/model";
import { ObjectWindow } from "../window/ObjectWindow";
import "./folder.css";

type FolderIcon = { id: string; name: string; emoji: string; image?: string | null };
export type FolderSpec<T> = FolderIcon & { kind: "folder"; items: readonly FolderEntry<T>[] };
export type FolderEntry<T> = FolderSpec<T> | (FolderIcon & (
  | { kind: "item"; value: T }
  | { kind: "link"; href: string }
));

type FolderProps<T> = Omit<ComponentProps<typeof ObjectWindow>, "title" | "icon" | "children"> & {
  folder: FolderSpec<T>;
  openedIds?: readonly string[];
  visitedIds?: ReadonlySet<string>;
  thingsConfig?: Record<string, { tint_when_visited?: boolean }>;
  onVisit?: (id: string) => void;
  onOpen: (item: T, source: HTMLButtonElement) => void;
  onOpenFolder: (folder: FolderSpec<T>, source: HTMLButtonElement) => void;
};

export type FolderContentProps<T> = {
  folder: FolderSpec<T>;
  openedIds?: readonly string[];
  visitedIds?: ReadonlySet<string>;
  thingsConfig?: Record<string, { tint_when_visited?: boolean }>;
  monochrome?: boolean;
  onVisit?: (id: string) => void;
  onOpen?: (item: T, source: HTMLButtonElement) => void;
  onOpenFolder?: (folder: FolderSpec<T>, source: HTMLButtonElement) => void;
};

export function FolderContent<T>({
  folder,
  openedIds = [],
  visitedIds,
  thingsConfig,
  monochrome,
  onVisit,
  onOpen,
  onOpenFolder,
}: FolderContentProps<T>) {
  return (
    <>
      <ul className="folder" aria-label={`${folder.name} contents`} data-monochrome={monochrome}>
        {folder.items.map((entry) => {
          const isFolder = entry.kind === "folder" || entry.id === "lab-folder" || entry.id.endsWith("-folder");
          const shouldTint = thingsConfig?.[entry.id]?.tint_when_visited ?? true;
          const visited = !isFolder && shouldTint && (visitedIds?.has(entry.id) ?? false);
          const iconImage = entry.image || (isImageUrl(entry.emoji) ? entry.emoji : null);
          const artwork = (
            <>
              <span className="folder-entry-art" aria-hidden="true">
                {iconImage ? (
                  <img
                    src={iconImage}
                    alt=""
                    className="folder-entry-image"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  entry.emoji
                )}
              </span>
              <span>{entry.name}</span>
            </>
          );
          return (
            <li key={entry.id}>
              {entry.kind === "link" ? (
                <a className="folder-entry" data-visited={visited} href={entry.href} onClick={() => onVisit?.(entry.id)}>
                  {artwork}
                </a>
              ) : (
                <button
                  type="button"
                  className="folder-entry"
                  data-folder-entry={entry.id}
                  data-visited={visited}
                  aria-haspopup="dialog"
                  aria-expanded={openedIds.includes(entry.id)}
                  aria-disabled={openedIds.includes(entry.id) || undefined}
                  tabIndex={openedIds.includes(entry.id) ? -1 : 0}
                  onClick={(event) => {
                    if (openedIds.includes(entry.id)) return;
                    if (entry.kind === "folder") onOpenFolder?.(entry, event.currentTarget);
                    else {
                      onVisit?.(entry.id);
                      onOpen?.(entry.value, event.currentTarget);
                    }
                  }}
                >
                  {artwork}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {folder.items.length === 0 && <p className="folder-empty">This folder is empty.</p>}
    </>
  );
}

/** The caller owns folder and item windows as independent peers. */
export function Folder<T>({ folder, openedIds = [], visitedIds, thingsConfig, onVisit, onOpen, onOpenFolder, ...windowProps }: FolderProps<T>) {
  const folderIcon = folder.image || (isImageUrl(folder.emoji) ? folder.emoji : folder.emoji);
  return (
    <ObjectWindow {...windowProps} title={folder.name} icon={folderIcon}>
      <FolderContent
        folder={folder}
        openedIds={openedIds}
        visitedIds={visitedIds}
        thingsConfig={thingsConfig}
        monochrome={windowProps.monochrome}
        onVisit={onVisit}
        onOpen={onOpen}
        onOpenFolder={onOpenFolder}
      />
    </ObjectWindow>
  );
}


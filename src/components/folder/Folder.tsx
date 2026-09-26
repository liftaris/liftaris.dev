import type { ComponentProps } from "react";
import { ObjectWindow } from "../window/ObjectWindow";
import "./folder.css";

type FolderIcon = { id: string; name: string; emoji: string };
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

/** The caller owns folder and item windows as independent peers. */
export function Folder<T>({ folder, openedIds = [], visitedIds, thingsConfig, onVisit, onOpen, onOpenFolder, ...windowProps }: FolderProps<T>) {
  return <ObjectWindow {...windowProps} title={folder.name} icon={folder.emoji}>
    <ul className="folder" aria-label={`${folder.name} contents`} data-monochrome={windowProps.monochrome}>
      {folder.items.map((entry) => {
        const isFolder = entry.kind === "folder" || entry.id === "lab-folder" || entry.id.endsWith("-folder");
        const shouldTint = thingsConfig?.[entry.id]?.tint_when_visited ?? true;
        const visited = !isFolder && shouldTint && (visitedIds?.has(entry.id) ?? false);
        const artwork = <><span className="folder-entry-art" aria-hidden="true">{entry.emoji}</span><span>{entry.name}</span></>;
        return <li key={entry.id}>
          {entry.kind === "link" ? <a className="folder-entry" data-visited={visited} href={entry.href} onClick={() => onVisit?.(entry.id)}>{artwork}</a> :
            <button type="button" className="folder-entry" data-folder-entry={entry.id} data-visited={visited} aria-haspopup="dialog" aria-expanded={openedIds.includes(entry.id)}
              aria-disabled={openedIds.includes(entry.id) || undefined} tabIndex={openedIds.includes(entry.id) ? -1 : 0}
              onClick={(event) => {
                if (openedIds.includes(entry.id)) return;
                if (entry.kind === "folder") onOpenFolder(entry, event.currentTarget);
                else {
                  onVisit?.(entry.id);
                  onOpen(entry.value, event.currentTarget);
                }
              }}>
              {artwork}
            </button>}
        </li>;
      })}
    </ul>
    {folder.items.length === 0 && <p className="folder-empty">This folder is empty.</p>}
  </ObjectWindow>;
}

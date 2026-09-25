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
  onOpen: (item: T, source: HTMLButtonElement) => void;
  onOpenFolder: (folder: FolderSpec<T>, source: HTMLButtonElement) => void;
};

/** The caller owns folder and item windows as independent peers. */
export function Folder<T>({ folder, openedIds = [], onOpen, onOpenFolder, ...windowProps }: FolderProps<T>) {
  return <ObjectWindow {...windowProps} title={folder.name} icon={folder.emoji}>
    <ul className="folder" aria-label={`${folder.name} contents`} data-monochrome={windowProps.monochrome}>
      {folder.items.map((entry) => {
        const artwork = <><span className="folder-entry-art" aria-hidden="true">{entry.emoji}</span><span>{entry.name}</span></>;
        return <li key={entry.id}>
          {entry.kind === "link" ? <a className="folder-entry" href={entry.href}>{artwork}</a> :
            <button type="button" className="folder-entry" data-folder-entry={entry.id} aria-haspopup="dialog" aria-expanded={openedIds.includes(entry.id)}
              aria-disabled={openedIds.includes(entry.id) || undefined} tabIndex={openedIds.includes(entry.id) ? -1 : 0}
              onClick={(event) => {
                if (openedIds.includes(entry.id)) return;
                if (entry.kind === "folder") onOpenFolder(entry, event.currentTarget);
                else onOpen(entry.value, event.currentTarget);
              }}>
              {artwork}
            </button>}
        </li>;
      })}
    </ul>
    {folder.items.length === 0 && <p className="folder-empty">This folder is empty.</p>}
  </ObjectWindow>;
}

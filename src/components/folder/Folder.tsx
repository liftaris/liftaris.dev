import type { ComponentProps } from "react";
import { getBackgroundStyle, isImageUrl, type BackgroundProps } from "../clump/model";
import { ObjectWindow } from "../window/ObjectWindow";

type FolderIcon = BackgroundProps & {
  id: string;
  name: string;
  emoji: string;
  image?: string | null;
  shape?: "circle" | "rectangle";
};
export type FolderSpec<T> = FolderIcon & { kind: "folder"; items: readonly FolderEntry<T>[] };
export type FolderEntry<T> = FolderSpec<T> | (FolderIcon & (
  | { kind: "item"; value: T }
  | { kind: "link"; href: string }
));

type FolderProps<T> = Omit<ComponentProps<typeof ObjectWindow>, "title" | "icon" | "children"> & {
  folder: FolderSpec<T>;
  openedIds?: readonly string[];
  visitedIds?: ReadonlySet<string>;
  thingsConfig?: Record<string, { tint_when_visited?: boolean; default_open?: boolean }>;
  onVisit?: (id: string) => void;
  onOpen: (item: T, source: HTMLButtonElement) => void;
  onOpenFolder: (folder: FolderSpec<T>, source: HTMLButtonElement) => void;
};

export type FolderContentProps<T> = {
  folder: FolderSpec<T>;
  openedIds?: readonly string[];
  visitedIds?: ReadonlySet<string>;
  thingsConfig?: Record<string, { tint_when_visited?: boolean; default_open?: boolean }>;
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
  const folderBg = getBackgroundStyle(folder);
  return (
    <>
      <ul
        className="folder grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,96px),1fr))] content-start gap-x-3 gap-y-4 m-0 p-0 list-none w-full box-border data-[has-bg=true]:rounded"
        style={folderBg}
        data-has-bg={folderBg ? true : undefined}
        aria-label={`${folder.name} contents`}
        data-monochrome={monochrome}
      >
        {folder.items.map((entry) => {
          const isFolder = entry.kind === "folder" || entry.id === "lab-folder" || entry.id.endsWith("-folder");
          const shouldTint = thingsConfig?.[entry.id]?.tint_when_visited ?? true;
          const visited = !isFolder && shouldTint && (visitedIds?.has(entry.id) ?? false);
          const iconImage = entry.image || (isImageUrl(entry.emoji) ? entry.emoji : null);
          const entryBg = getBackgroundStyle(entry);
          const artwork = (
            <>
              <span
                className="folder-entry-art grid place-items-center size-14 text-5xl leading-none pointer-events-none select-none [transform:translateZ(0)] data-[has-bg=true]:rounded-lg data-[has-bg=true]:overflow-hidden data-[shape=circle]:rounded-full"
                style={entryBg}
                data-has-bg={entryBg ? true : undefined}
                data-shape={entry.shape}
                aria-hidden="true"
              >
                {iconImage ? (
                  <img
                    src={iconImage}
                    alt=""
                    className="folder-entry-image block size-12 max-w-full max-h-full object-contain pointer-events-none select-none"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  entry.emoji
                )}
              </span>
              <span className="group-hover:not-[[aria-disabled=true]]:underline group-hover:underline-offset-4 group-hover:decoration-2 group-focus-visible:not-[[aria-disabled=true]]:underline group-focus-visible:underline-offset-4 group-focus-visible:decoration-2 group-data-[visited=true]:group-hover:decoration-visited-purple group-data-[visited=true]:group-focus-visible:decoration-visited-purple">
                {entry.name}
              </span>
            </>
          );
          return (
            <li key={entry.id} className="min-w-0">
              {entry.kind === "link" ? (
                <a
                  className="folder-entry group flex flex-col items-center gap-2 w-full min-h-24 px-1.5 py-2.5 border border-transparent bg-transparent text-inherit font-inherit text-xs leading-[1.4] text-center no-underline [overflow-wrap:anywhere] cursor-pointer touch-manipulation outline-none hover:no-underline hover:bg-blue/7 focus-visible:no-underline focus-visible:outline-none focus-visible:border-transparent aria-disabled:cursor-default aria-disabled:opacity-65"
                  data-visited={visited}
                  href={entry.href}
                  onClick={() => onVisit?.(entry.id)}
                >
                  {artwork}
                </a>
              ) : (
                <button
                  type="button"
                  className="folder-entry group flex flex-col items-center gap-2 w-full min-h-24 px-1.5 py-2.5 border border-transparent bg-transparent text-inherit font-inherit text-xs leading-[1.4] text-center no-underline [overflow-wrap:anywhere] cursor-pointer touch-manipulation outline-none hover:no-underline hover:bg-blue/7 focus-visible:no-underline focus-visible:outline-none focus-visible:border-transparent aria-disabled:cursor-default aria-disabled:opacity-65"
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
      {folder.items.length === 0 && <p className="folder-empty m-0 text-xs">This folder is empty.</p>}
    </>
  );
}

/** The caller owns folder and item windows as independent peers. */
export function Folder<T>({ folder, openedIds = [], visitedIds, thingsConfig, onVisit, onOpen, onOpenFolder, className, ...windowProps }: FolderProps<T>) {
  const folderIcon = folder.image || (isImageUrl(folder.emoji) ? folder.emoji : folder.emoji);
  const folderBg = getBackgroundStyle(folder);
  return (
    <ObjectWindow
      {...windowProps}
      className={["folder-window", className].filter(Boolean).join(" ")}
      title={folder.name}
      icon={folderIcon}
      backgroundStyle={folderBg}
    >
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


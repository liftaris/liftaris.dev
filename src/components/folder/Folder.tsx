import { ThingControls } from '../house/ThingAuthoring';
import { type ComponentProps } from "react";
import { getBackgroundStyle, isImageUrl, type BackgroundProps } from "../clump/model";
import { ObjectWindow } from "../window/ObjectWindow";
import { prefetchThing } from "../../lib/house/prefetch";
import { ThingLabel } from "../house/ThingLabel";

type FolderIcon = BackgroundProps & {
  id: string;
  name: string;
  emoji: string;
  image?: string | null;
  width?: number;
  height?: number;
};
export type FolderSpec<T> = FolderIcon & { kind: "folder"; items: readonly FolderEntry<T>[] };
export type FolderEntry<T> = FolderSpec<T> | (FolderIcon & (
  | { kind: "item"; value: T }
  | { kind: "link"; href: string }
));

type FolderProps<T> = Omit<ComponentProps<typeof ObjectWindow>, "title" | "icon" | "children"> & {
  folder: FolderSpec<T>;
  openedIds?: readonly string[];
  thingsConfig?: Record<string, { default_open?: boolean }>;
  onOpen: (item: T, source: HTMLButtonElement) => void;
  onOpenFolder: (folder: FolderSpec<T>, source: HTMLButtonElement) => void;
};

export type FolderContentProps<T> = {
  folder: FolderSpec<T>;
  openedIds?: readonly string[];
  thingsConfig?: Record<string, { default_open?: boolean }>;
  monochrome?: boolean;
  onOpen?: (item: T, source: HTMLButtonElement) => void;
  onOpenFolder?: (folder: FolderSpec<T>, source: HTMLButtonElement) => void;
};

export function FolderContent<T>({
  folder,
  openedIds = [],
  monochrome,
  onOpen,
  onOpenFolder,
}: FolderContentProps<T>) {
  const folderBg = getBackgroundStyle(folder);
  return (
    <>
      <ul
        className="folder grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,96px),1fr))] content-start gap-x-3 gap-y-4 m-0 p-0 list-none w-full box-border data-[has-bg=true]:rounded"
        data-has-bg={folderBg ? true : undefined}
        aria-label={`${folder.name} contents`}
        data-monochrome={monochrome}
      >
        {folder.items.map((entry) => {
          const iconImage = entry.image || (isImageUrl(entry.emoji) ? entry.emoji : null);

          const artwork = (
            <>
              <span
                className="folder-entry-art grid place-items-center size-14 text-5xl font-emoji leading-none pointer-events-none select-none [transform:translateZ(0)] data-[has-bg=true]:rounded-lg data-[has-bg=true]:overflow-hidden"
                style={{width:entry.width ?? 60,height:entry.height ?? 60,fontSize:Math.min(entry.width ?? 60,entry.height ?? 60)*.85}}
                data-is-emoji={!iconImage ? "true" : undefined}
                aria-hidden="true"
              >
                {iconImage ? (
                  <img
                    src={iconImage}
                    alt=""
                    className="folder-entry-image block size-full max-w-full max-h-full object-contain pointer-events-none select-none"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  entry.emoji.replace(/\uFE0F/g, "")
                )}
              </span>
              <ThingLabel name={entry.name} className="folder-entry-label w-full" />
            </>
          );
          return (
            <li key={entry.id} className="min-w-0">
              <ThingControls id={entry.id} name={entry.name} />
              {entry.kind === "link" ? (
                <a
                  className="folder-entry group flex flex-col items-center gap-2 w-full min-h-24 px-1.5 py-2.5 border border-transparent bg-transparent text-inherit font-inherit text-xs leading-[1.4] text-center no-underline [overflow-wrap:anywhere] cursor-pointer touch-manipulation outline-none hover:no-underline hover:bg-blue/7 focus-visible:no-underline focus-visible:outline-none focus-visible:border-transparent aria-disabled:cursor-default aria-disabled:opacity-65"
                  href={entry.href}
                  onPointerEnter={() => prefetchThing(entry)}
                  onFocus={() => prefetchThing(entry)}
                  onPointerDown={() => prefetchThing(entry)}
                >
                  {artwork}
                </a>
              ) : (
                <button
                  type="button"
                  className="folder-entry group flex flex-col items-center gap-2 w-full min-h-24 px-1.5 py-2.5 border border-transparent bg-transparent text-inherit font-inherit text-xs leading-[1.4] text-center no-underline [overflow-wrap:anywhere] cursor-pointer touch-manipulation outline-none hover:no-underline hover:bg-blue/7 focus-visible:no-underline focus-visible:outline-none focus-visible:border-transparent aria-disabled:cursor-default aria-disabled:opacity-65"
                  data-folder-entry={entry.id}
                  aria-haspopup="dialog"
                  aria-expanded={openedIds.includes(entry.id)}
                  aria-disabled={openedIds.includes(entry.id) || undefined}
                  tabIndex={openedIds.includes(entry.id) ? -1 : 0}
                  onPointerEnter={() => prefetchThing(entry.kind === "item" ? (entry.value as { id?: string; action?: string; href?: string | null; kind?: string }) : entry)}
                  onFocus={() => prefetchThing(entry.kind === "item" ? (entry.value as { id?: string; action?: string; href?: string | null; kind?: string }) : entry)}
                  onPointerDown={() => prefetchThing(entry.kind === "item" ? (entry.value as { id?: string; action?: string; href?: string | null; kind?: string }) : entry)}
                  onClick={(event) => {
                    if (openedIds.includes(entry.id)) return;
                    if (entry.kind === "folder") onOpenFolder?.(entry, event.currentTarget);
                    else {
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
      {folder.items.length === 0 && !folderBg && <p className="folder-empty m-0 text-xs">This folder is empty.</p>}
    </>
  );
}

/** The caller owns folder and item windows as independent peers. */
export function Folder<T>({ folder, openedIds = [], thingsConfig, onOpen, onOpenFolder, className, ...windowProps }: FolderProps<T>) {
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
        thingsConfig={thingsConfig}
        monochrome={windowProps.monochrome}
        onOpen={onOpen}
        onOpenFolder={onOpenFolder}
      />
    </ObjectWindow>
  );
}


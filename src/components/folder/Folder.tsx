import { ThingControls } from '../house/ThingAuthoring';
import { getBackgroundStyle } from "../clump/model";
import { ThingArtwork } from "../house/ThingArtwork";
import { ThingLabel } from "../house/ThingLabel";

import type { ThingSpec } from '../../lib/things/scene';

type FolderProps = {
  folder: ThingSpec;
  contents: readonly ThingSpec[];
  openedIds: readonly string[];
  onOpen: (thing: ThingSpec, source: HTMLButtonElement) => void;
  onWarm: (thing: ThingSpec, source: HTMLButtonElement) => void;
};

export function Folder({ folder, contents, openedIds, onOpen, onWarm }: FolderProps) {
  const folderBg = getBackgroundStyle(folder);
  return (
    <>
      <ul
        className="folder grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,96px),1fr))] content-start gap-x-3 gap-y-4 m-0 p-0 list-none w-full box-border data-[has-bg=true]:rounded"
        data-has-bg={folderBg ? true : undefined}
        aria-label={`${folder.name} contents`}
      >
        {contents.map((entry) => {
          const artwork = (
            <>
              <ThingArtwork thing={entry} className="folder-entry-art" imageClassName="folder-entry-image" />
              <ThingLabel name={entry.name} className="folder-entry-label w-full" />
            </>
          );
          return (
            <li key={entry.id} className="min-w-0">
              <ThingControls id={entry.id} name={entry.name} />
                <button
                  type="button"
                  className="folder-entry group flex flex-col items-center gap-2 w-full min-h-24 px-1.5 py-2.5 border border-transparent bg-transparent text-inherit font-inherit text-xs leading-[1.4] text-center no-underline [overflow-wrap:anywhere] cursor-pointer touch-manipulation outline-none hover:no-underline hover:bg-blue/7 focus-visible:no-underline focus-visible:outline-none focus-visible:border-transparent aria-disabled:cursor-default aria-disabled:opacity-65"
                  data-folder-entry={entry.id}
                  aria-haspopup="dialog"
                  aria-expanded={openedIds.includes(entry.id)}
                  aria-disabled={openedIds.includes(entry.id) || undefined}
                  tabIndex={openedIds.includes(entry.id) ? -1 : 0}
                  onPointerEnter={event => onWarm(entry, event.currentTarget)}
                  onFocus={event => onWarm(entry, event.currentTarget)}
                  onPointerDown={event => onWarm(entry, event.currentTarget)}
                  onClick={(event) => {
                    if (openedIds.includes(entry.id)) return;
                    onOpen(entry, event.currentTarget);
                  }}
                >
                  {artwork}
                </button>
            </li>
          );
        })}
      </ul>
      {contents.length === 0 && !folderBg && <p className="folder-empty m-0 text-xs">This folder is empty.</p>}
    </>
  );
}

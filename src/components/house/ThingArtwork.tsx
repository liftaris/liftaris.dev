import type { ThingSpec } from '../../lib/things/scene';
import { normalizeEmojiPresentation } from '../../lib/house/emoji';

/** Shared artwork; desktop movement and folder layout belong to the caller. */
export function ThingArtwork({ thing, className, imageClassName }: {
  thing: ThingSpec; className: string; imageClassName: string;
}) {
  return <span className={`${className} grid place-items-center font-emoji leading-none pointer-events-none select-none [transform:translateZ(0)]`}
    style={{ width: thing.width, height: thing.height, fontSize: Math.min(thing.width, thing.height) * .85 }}
    data-is-emoji={!thing.image ? 'true' : undefined} aria-hidden="true">
    {thing.image ? <img src={thing.image} alt="" width={thing.width} height={thing.height}
      className={`${imageClassName} block size-full max-w-full max-h-full object-contain`} loading="lazy" decoding="async" />
      : normalizeEmojiPresentation(thing.emoji)}
  </span>;
}

export type Scene = "clump" | "structure" | "apartment";
export type CollisionMode = "outline" | "peg";
export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Pose = Point & { id: string; angle: number };

import type { CSSProperties } from "react";

export interface BackgroundProps {
  background_image?: string | null;
  background_size?: string | null;
  background_position?: string | null;
  background_repeat?: string | null;
}

export interface ObjectSpec extends Size, BackgroundProps {
  id: string;
  name: string;
  emoji: string;
  image?: string | null;
  anchor?: boolean;
  isGift?: boolean;
}

export function getBackgroundStyle(props?: BackgroundProps | null): CSSProperties | undefined {
  if (!props?.background_image) return undefined;
  const image = props.background_image.trim();
  if (!image) return undefined;

  const bgImage = image.startsWith("url(") || image.startsWith("linear-gradient(")
    ? image
    : `url("${image}")`;

  const rawRepeat = props.background_repeat?.toLowerCase().trim();
  const isTile = rawRepeat === "tile" || rawRepeat === "repeat";
  const bgRepeat = isTile
    ? "repeat"
    : rawRepeat === "repeat-x" || rawRepeat === "tile-x"
      ? "repeat-x"
      : rawRepeat === "repeat-y" || rawRepeat === "tile-y"
        ? "repeat-y"
        : rawRepeat === "round"
          ? "round"
          : rawRepeat === "space"
            ? "space"
            : rawRepeat || "no-repeat";

  const rawSize = props.background_size?.trim();
  const bgSize = rawSize === "tile"
    ? "auto"
    : rawSize === "scale"
      ? "contain"
      : rawSize || (isTile ? "auto" : "cover");

  const rawPos = props.background_position?.trim();
  const bgPos = rawPos || "center";

  return {
    backgroundImage: bgImage,
    backgroundSize: bgSize,
    backgroundPosition: bgPos,
    backgroundRepeat: bgRepeat,
  };
}

export function isImageUrl(value?: string | null): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:image/") ||
    /\.(gif|webp|avif|png|jpe?g|svg)(\?.*)?$/i.test(trimmed)
  );
}

export const OBJECTS: readonly ObjectSpec[] = [
  { id: "octopus", name: "Octopus", emoji: "🐙", width: 68, height: 70 },
  { id: "computer", name: "Computer", emoji: "🖥️", width: 64, height: 58, anchor: true },
  { id: "shoes", name: "Walking shoes", emoji: "👟", width: 54, height: 40 },
  { id: "globe", name: "Globe", emoji: "🌍", width: 50, height: 50 },
  { id: "plant", name: "Plant", emoji: "🪴", width: 56, height: 66, anchor: true },
  { id: "cloud", name: "Cloud", emoji: "☁️", width: 60, height: 42 },
  { id: "bike", name: "Bicycle", emoji: "🚲", width: 74, height: 54 },
  { id: "boots", name: "Climbing shoes", emoji: "🥾", width: 47, height: 54 },
  { id: "light", name: "Light", emoji: "💡", width: 38, height: 52, anchor: true },
  { id: "case", name: "Briefcase", emoji: "💼", width: 52, height: 44 },
];

// Normalized centers, with intentionally different starting compositions.
const SEEDS: Record<Scene, readonly [number, number, number][]> = {
  clump: [
    [.43, .76, -.12], [.5, .49, .03], [.29, .55, -.3], [.63, .73, .1],
    [.46, .25, -.1], [.63, .17, .12], [.67, .39, .15], [.28, .33, -.2],
    [.33, .13, -.12], [.68, .56, .2],
  ],
  structure: [
    [.38, .78, -.16], [.53, .53, 0], [.29, .55, -.4], [.66, .75, .12],
    [.49, .24, 0], [.69, .17, .15], [.7, .39, -.15], [.3, .35, .3],
    [.29, .2, 0], [.6, .64, .12],
  ],
  apartment: [
    [.23, .3, -.12], [.22, .7, .05], [.68, .72, -.4], [.78, .25, .2],
    [.12, .51, -.12], [.52, .16, .15], [.76, .52, -.25], [.46, .79, .5],
    [.15, .17, .25], [.45, .48, -.15],
  ],
};

export function initialPoses(scene: Scene, size: Size): Pose[] {
  return OBJECTS.map((object, index) => {
    const [x, y, angle] = SEEDS[scene][index];
    return { id: object.id, x: x * size.width, y: y * size.height, angle };
  });
}

export function isFixed(object: ObjectSpec, scene: Scene): boolean {
  return scene === "structure" && Boolean(object.anchor);
}

export function isGift(object: ObjectSpec): boolean {
  return Boolean(object.isGift || object.id.startsWith("gift-"));
}

export interface SceneEngine {
  getPoses(): Pose[];
  /** Add/remove gifts while preserving the existing simulation bodies. */
  syncObjects(objects: readonly ObjectSpec[], poses?: readonly Pose[]): void;
  /** Advances one fixed time step. Returns true while work remains. */
  step(deltaMs: number): boolean;
  beginDrag(id: string, point: Point): boolean;
  moveDrag(point: Point): void;
  endDrag(cancel?: boolean): void;
  /** Freezes an item in place, making it static and optionally placing it at targetPoint. */
  freeze(id: string, targetPoint?: Point): void;
  /** Restores a frozen item to dynamic simulation, optionally resetting to its pre-drag pose. */
  unfreeze(id: string, resetToBefore?: boolean): void;
  /** Keyboard moves and rotations preserve the same input contract. */
  nudge(id: string, dx: number, dy: number, angle?: number): void;
  /** Growing a shared collection's local stage need not move bodies or release its handle. */
  resize(size: Size, preservePositions?: boolean): void;
  getDebugShapes(): { id: string; vertices: Point[] }[];
  dispose(): void;
}

export interface EngineOptions {
  scene: Scene;
  collision: CollisionMode;
  size: Size;
  poses?: Pose[];
  reducedMotion?: boolean;
  objects?: readonly ObjectSpec[];
}

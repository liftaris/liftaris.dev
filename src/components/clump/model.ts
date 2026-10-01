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
    [.43, .76, 0], [.5, .49, 0], [.29, .55, 0], [.63, .73, 0],
    [.46, .25, 0], [.63, .17, 0], [.67, .39, 0], [.28, .33, 0],
    [.33, .13, 0], [.68, .56, 0],
  ],
  structure: [
    [.38, .78, 0], [.53, .53, 0], [.29, .55, 0], [.66, .75, 0],
    [.49, .24, 0], [.69, .17, 0], [.7, .39, 0], [.3, .35, 0],
    [.29, .2, 0], [.6, .64, 0],
  ],
  apartment: [
    [.23, .3, 0], [.22, .7, 0], [.68, .72, 0], [.78, .25, 0],
    [.12, .51, 0], [.52, .16, 0], [.76, .52, 0], [.46, .79, 0],
    [.15, .17, 0], [.45, .48, 0],
  ],
};

export function initialPoses(scene: Scene, size: Size): Pose[] {
  return OBJECTS.map((object, index) => {
    const [x, y] = SEEDS[scene][index];
    return { id: object.id, x: x * size.width, y: y * size.height, angle: 0 };
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

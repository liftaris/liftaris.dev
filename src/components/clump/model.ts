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
  spawn_x?: number;
  spawn_y?: number;
}

export function getBackgroundStyle(props?: BackgroundProps | null): CSSProperties | undefined {
  if (!props?.background_image) return undefined;
  const image = props.background_image.trim();
  if (!image) return undefined;

  return {
    backgroundImage: `url(${JSON.stringify(image)})`,
    backgroundSize: props.background_size || 'cover',
    backgroundPosition: props.background_position || 'center',
    backgroundRepeat: props.background_repeat || 'no-repeat',
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

export interface SceneEngine {
  getPoses(): Pose[];
  /** Add/remove Things while preserving the existing simulation bodies. */
  syncObjects(objects: readonly ObjectSpec[], poses?: readonly Pose[]): void;
  /** Advances one fixed time step. Returns true while work remains. */
  step(deltaMs: number): boolean;
  beginDrag(id: string, point: Point): boolean;
  moveDrag(point: Point): void;
  endDrag(cancel?: boolean): void;
  resize(size: Size): void;
  dispose(): void;
}

export interface EngineOptions {
  layoutEditing?: boolean;
  size: Size;
  reducedMotion?: boolean;
  objects: readonly ObjectSpec[];
}

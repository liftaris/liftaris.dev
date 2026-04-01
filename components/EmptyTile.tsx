import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function EmptyTile({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn("rounded-2xl border border-border", className)}>{children}</div>;
}

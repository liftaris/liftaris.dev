import { cn } from "@/lib/utils";

interface SideColumnProps {
  side: "left" | "right";
  children: React.ReactNode;
  className?: string;
}

export function SideColumn({ side, children, className }: SideColumnProps) {
  return (
    <div
      className={cn(
        // mobile: share space equally within the row wrapper, no scroll
        "tile-stagger flex min-h-0 flex-1 flex-col gap-4 overflow-hidden",
        // desktop: grid-positioned columns
        side === "left" ? "lg:col-start-1" : "lg:col-start-3",
        "lg:row-start-1 lg:flex-none lg:overflow-y-auto",
        className
      )}
    >
      {children}
    </div>
  );
}

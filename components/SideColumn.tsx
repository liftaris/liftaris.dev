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
        "row-start-1 flex flex-col gap-4 overflow-y-auto",
        side === "left" ? "col-start-1" : "col-start-3",
        className
      )}
    >
      {children}
    </div>
  );
}

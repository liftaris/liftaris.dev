import Image from "next/image";
import { cn } from "@/lib/utils";

interface ImageTileProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function ImageTile({ src, alt, className, priority }: ImageTileProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border", className)}>
      <Image src={src} alt={alt} fill className="object-cover" priority={priority} />
    </div>
  );
}

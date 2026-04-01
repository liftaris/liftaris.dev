import { SideColumn } from "@/components/SideColumn";
import { ImageTile } from "@/components/ImageTile";
import { EmptyTile } from "@/components/EmptyTile";
import { Card } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | KAIO",
};

export default function AboutPage() {
  return (
    <>
      <SideColumn side="left">
        {/* Timeline tabs placeholder */}
        <div className="flex gap-2">
          <EmptyTile className="flex-1 py-3 text-center text-sm text-muted-foreground">1</EmptyTile>
          <EmptyTile className="flex-1 py-3 text-center text-sm text-muted-foreground">2</EmptyTile>
          <EmptyTile className="flex-1 py-3 text-center text-sm text-muted-foreground">3</EmptyTile>
        </div>

        {/* Bio card */}
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            Born in the Bay Area. My family moved to Natal, Brazil when I was two.
          </p>
          <p className="mt-2 text-xs text-primary">1999</p>
        </Card>

        {/* Map tile */}
        <ImageTile src="/images/natal-map.jpg" alt="Natal, Brazil" className="aspect-[3/4]" />
      </SideColumn>

      <SideColumn side="right">
        {/* Portrait photo */}
        <ImageTile src="/images/portrait.jpg" alt="Kaio Barbosa-Chifan" className="aspect-square" priority />

        {/* Hobbies grid */}
        <div className="grid grid-cols-2 gap-4">
          <EmptyTile className="aspect-square" />
          <EmptyTile className="aspect-square" />
          <EmptyTile className="aspect-square" />
          <EmptyTile className="aspect-square" />
        </div>

        {/* Placeholder */}
        <EmptyTile className="flex-1" />
      </SideColumn>
    </>
  );
}

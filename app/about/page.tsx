import type { Metadata } from "next";
import { SideColumn } from "@/components/SideColumn";
import type { TileSpec } from "@/lib/tiles";

export const metadata: Metadata = { title: "About | KAIO" };

const LEFT: TileSpec[] = [
  { kind: "image", src: "profile", alt: "Kaio Barbosa-Chifan", aspect: "square" },
  { kind: "map", place: "seattle" },
  { kind: "map", place: "natal" },
];

const RIGHT: TileSpec[] = [
  {
    kind: "text",
    title: "About",
    body: "Software engineer at Moderna. Born in the Bay Area, raised in Natal, Brazil. I like building things that are fun to use and shipping them before they're perfect.",
  },
  {
    kind: "stack",
    title: "Interests",
    items: [
      "Web platform",
      "AI engineering",
      "Computer vision",
      "Graphics / shaders",
      "Dev tooling",
    ],
  },
  {
    kind: "quote",
    text: "Learning how to make something AI — Actually Interesting.",
  },
  { kind: "contact" },
];

export default function AboutPage() {
  return (
    <>
      <SideColumn side="left" fallback={LEFT} />
      <SideColumn side="right" fallback={RIGHT} />
    </>
  );
}

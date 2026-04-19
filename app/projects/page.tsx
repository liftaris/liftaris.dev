import type { Metadata } from "next";
import { SideColumn } from "@/components/SideColumn";
import { PROJECTS } from "@/data/portfolio";
import type { TileSpec } from "@/lib/tiles";

export const metadata: Metadata = { title: "Projects | KAIO" };

const featured = Object.values(PROJECTS).filter((p) => p.featured);
const rest = Object.values(PROJECTS).filter((p) => !p.featured);

const LEFT: TileSpec[] = featured.map((p) => ({
  kind: "project" as const,
  slug: p.slug,
}));

const RIGHT: TileSpec[] = [
  { kind: "ghgrid" },
  {
    kind: "text",
    title: "Side projects",
    body: "Everything here is open source. Most of it started as a curiosity that got out of hand.",
  },
  ...rest.map((p) => ({ kind: "project" as const, slug: p.slug })),
  {
    kind: "link",
    href: "https://github.com/liftaris",
    title: "More on GitHub",
    subtitle: "github.com/liftaris",
  },
];

export default function ProjectsPage() {
  return (
    <>
      <SideColumn side="left" fallback={LEFT} />
      <SideColumn side="right" fallback={RIGHT} />
    </>
  );
}

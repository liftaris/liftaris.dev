import { SideColumn } from "@/components/SideColumn";
import { EmptyTile } from "@/components/EmptyTile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects | KAIO",
};

const PROJECTS = [
  {
    slug: "bazaarghost",
    name: "BazaarGhost",
    description: "Stream matchup tracker for Bazaar",
    tags: ["Next.js", "Python", "TypeScript"],
  },
] as const;

export default function ProjectsPage() {
  return (
    <>
      <SideColumn side="left">
        {PROJECTS.map((project) => (
          <Link key={project.slug} href={`/projects/${project.slug}`}>
            <Card className="p-4 transition-colors hover:border-primary/50">
              <h3 className="font-semibold">{project.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </Card>
          </Link>
        ))}
        <EmptyTile className="flex-1" />
      </SideColumn>

      <SideColumn side="right">
        <EmptyTile className="aspect-square" />
        <EmptyTile className="flex-1" />
      </SideColumn>
    </>
  );
}

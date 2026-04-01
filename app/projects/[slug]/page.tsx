import { SideColumn } from "@/components/SideColumn";
import { ImageTile } from "@/components/ImageTile";
import { EmptyTile } from "@/components/EmptyTile";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface ProjectData {
  name: string;
  description: string;
  tags: string[];
  screenshot?: string;
  blogPost?: string;
}

const PROJECTS: Record<string, ProjectData> = {
  bazaarghost: {
    name: "BazaarGhost",
    description: "Stream matchup tracker for Bazaar",
    tags: ["Next.js", "Python", "TypeScript", "AWS"],
    screenshot: "/images/bazaarghost-screenshot.png",
    blogPost: "/blog/bazaar-ghost",
  },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = PROJECTS[slug];
  return { title: project ? `${project.name} | KAIO` : "Project | KAIO" };
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const project = PROJECTS[slug];
  if (!project) notFound();

  return (
    <>
      <SideColumn side="left">
        {project.screenshot && (
          <ImageTile src={project.screenshot} alt={project.name} className="aspect-video" />
        )}
        <div className="flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <Badge key={tag} variant="secondary">{tag}</Badge>
          ))}
        </div>
        <EmptyTile className="flex-1" />
      </SideColumn>

      <SideColumn side="right">
        <EmptyTile className="aspect-[2/1]" />
        <EmptyTile className="flex-1" />
        {project.blogPost && (
          <Card className="p-4">
            <Link href={project.blogPost} className="text-sm text-primary hover:underline">
              Read my blog post about it!
            </Link>
          </Card>
        )}
      </SideColumn>
    </>
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SideColumn } from "@/components/SideColumn";
import { PROJECTS } from "@/data/portfolio";
import type { TileSpec } from "@/lib/tiles";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return Object.keys(PROJECTS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const p = PROJECTS[slug];
  return { title: p ? `${p.name} | KAIO` : "Project | KAIO", description: p?.tagline };
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const p = PROJECTS[slug];
  if (!p) notFound();

  const left: TileSpec[] = [
    { kind: "project", slug },
    ...(p.image
      ? [{ kind: "image" as const, src: p.image, alt: p.name, aspect: "video" as const }]
      : []),
    { kind: "text", title: "Overview", body: p.blurb },
  ];

  const right: TileSpec[] = [
    ...(p.stat ? [{ kind: "stat" as const, ...p.stat }] : []),
    { kind: "stack", title: "Built with", items: p.stack },
    ...(p.links.site
      ? [{ kind: "link" as const, href: p.links.site, title: "Live site", subtitle: p.links.site.replace(/^https?:\/\//, "") }]
      : []),
    ...(p.links.github
      ? [{ kind: "link" as const, href: p.links.github, title: "Source", subtitle: "GitHub" }]
      : []),
    ...(p.links.npm
      ? [{ kind: "link" as const, href: p.links.npm, title: "Package", subtitle: "npm" }]
      : []),
    ...(p.links.blog
      ? [{ kind: "link" as const, href: p.links.blog, title: "Read the write-up", subtitle: "Blog post" }]
      : []),
  ];

  return (
    <>
      <SideColumn side="left" fallback={left} />
      <SideColumn side="right" fallback={right} />
    </>
  );
}

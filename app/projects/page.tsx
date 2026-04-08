import { SideColumn } from "@/components/SideColumn";
import { EmptyTile } from "@/components/EmptyTile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects | KAIO",
};

const PROJECTS = [
  {
    slug: "bazaarghost",
    name: "BazaarGhost",
    description:
      "See how your ghost performs against Twitch streamers in The Bazaar. Computer vision pipeline processing 30+ streamers' VODs.",
    tags: ["Computer Vision", "Python", "Next.js"],
    stats: "18,000+ users",
    featured: true,
    logo: "/icons/bazaarghost-logo.svg",
  },
  {
    slug: "shaderweb",
    name: "ShaderWeb",
    description:
      "Interactive GLSL learning platform with AI-powered assistance and visual knowledge graphs.",
    tags: ["GLSL", "AI", "Education"],
    featured: true,
  },
  {
    slug: "hnswlib-wasm",
    name: "hnswlib-wasm",
    description:
      "WebAssembly bindings for high-performance vector search. Enables client-side RAG and semantic search.",
    tags: ["WASM", "C++", "Vector Search"],
    npm: "@kaiobarb/hnswlib-wasm",
  },
  {
    slug: "lsystems",
    name: "LSystems",
    description:
      "Fractal art generator using L-Systems. Built with C and SDL2 for algorithmic plant modeling.",
    tags: ["C", "SDL2", "Creative Coding"],
  },
  {
    slug: "solarescape",
    name: "Solarescape",
    description:
      "Reinforcement learning satellite simulation. Deep Q-Network agent navigating physics-based orbital mechanics.",
    tags: ["RL", "PyTorch", "Physics"],
    academic: true,
  },
] as const;

export default function ProjectsPage() {
  const featuredProjects = PROJECTS.filter((p) => p.featured);
  const otherProjects = PROJECTS.filter((p) => !p.featured);

  return (
    <>
      <SideColumn side="left">
        {/* Featured Projects */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Featured Projects
          </h2>
          {featuredProjects.map((project) => (
            <Link key={project.slug} href={`/projects/${project.slug}`}>
              <Card className="p-4 transition-all hover:border-primary/50 hover:shadow-md">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    {project.logo && (
                      <Image
                        src={project.logo}
                        alt={`${project.name} logo`}
                        width={32}
                        height={32}
                        className="flex-shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold">{project.name}</h3>
                      {project.stats && (
                        <p className="text-xs text-primary">{project.stats}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {project.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="accent"
                        className="text-xs rounded-full px-3"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Other Projects */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            More Projects
          </h2>
          {otherProjects.map((project) => (
            <Link key={project.slug} href={`/projects/${project.slug}`}>
              <Card className="p-4 transition-colors hover:border-primary/50">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {project.logo && (
                        <Image
                          src={project.logo}
                          alt={`${project.name} logo`}
                          width={24}
                          height={24}
                          className="flex-shrink-0"
                        />
                      )}
                      <h3 className="font-semibold">{project.name}</h3>
                    </div>
                    <div className="flex gap-2">
                      {project.npm && (
                        <Badge variant="outline" className="text-xs">
                          npm
                        </Badge>
                      )}
                      {project.academic && (
                        <Badge variant="outline" className="text-xs">
                          UCSC
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {project.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="accent"
                        className="text-xs rounded-full px-3"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <EmptyTile className="flex-1" />
      </SideColumn>

      <SideColumn side="right">
        {/* Project Stats Overview */}
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Project Highlights</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Open Source Projects
              </span>
              <span className="font-semibold">5</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Users</span>
              <span className="font-semibold">18,000+</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Primary Languages</span>
              <span className="font-semibold">TS, Python, C++</span>
            </div>
          </div>
        </Card>

        {/* Current Focus */}
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Current Focus</h3>
          <p className="text-sm text-muted-foreground">
            Actively maintaining BazaarGhost with regular feature updates.
            Exploring RAG architectures and vector search optimizations for this
            portfolio site.
          </p>
        </Card>

        <EmptyTile className="flex-1" />
      </SideColumn>
    </>
  );
}

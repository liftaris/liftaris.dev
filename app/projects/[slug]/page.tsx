import { SideColumn } from "@/components/SideColumn";
import { EmptyTile } from "@/components/EmptyTile";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  GitHubLogoIcon,
  GlobeIcon,
  DiscordLogoIcon,
} from "@radix-ui/react-icons";

interface ProjectData {
  name: string;
  tagline: string;
  description: string[];
  highlights: string[];
  techStack: {
    backend: string[];
    frontend: string[];
    infrastructure: string[];
    cv: string[];
  };
  tags: string[];
  links: {
    website?: string;
    github?: string;
    blog?: string;
  };
  stats?: {
    users?: string;
    activity?: string;
  };
  timeline?: string;
  logo?: string;
}

const PROJECTS: Record<string, ProjectData> = {
  bazaarghost: {
    name: "BazaarGhost",
    tagline:
      "See how your ghost performs against Twitch streamers in The Bazaar",
    description: [
      "BazaarGhost is a tool that lets players of The Bazaar, an asynchronous auto-battler game, look up how their ghost (a snapshot of their board) performed against Twitch streamers.",
      "The system works by indexing archived Twitch VODs, detecting matchup screens via computer vision, and extracting player usernames via OCR. When a streamer encounters your username in a match, BazaarGhost captures it and links directly to that moment in the VOD.",
      "I identified the need from community demand on r/PlayTheBazaar, prototyped it in March 2025, and launched publicly on November 2, 2025. The Reddit announcement went viral relative to the community size.",
    ],
    highlights: [
      "18,000+ unique visitors in the first month",
      "~550 daily active users sustained",
      "Zero hosting costs using GitHub Actions for compute",
      "120+ commits across two open-source repositories",
      "Processes 30+ streamers' VODs automatically",
      "Discord bot for match notifications",
      "Fuzzy username search with confidence scores",
    ],
    techStack: {
      backend: [
        "Python",
        "Docker",
        "GitHub Actions",
        "Supabase",
        "PostgreSQL",
        "Edge Functions",
        "Twitch Helix API",
        "Twitch GraphQL",
        "Twitch EventSub",
      ],
      frontend: [
        "Next.js",
        "TypeScript",
        "React",
        "Vercel",
        "shadcn/ui",
        "MDX",
      ],
      infrastructure: [
        "GitHub Actions",
        "Supabase",
        "PostgreSQL",
        "Docker",
        "Twitch EventSub",
      ],
      cv: [
        "OpenCV",
        "PaddleOCR",
        "FFmpeg",
        "Streamlink",
        "Multi-threaded Pipeline",
      ],
    },
    tags: [
      "Computer Vision",
      "OCR",
      "Next.js",
      "Python",
      "TypeScript",
      "Supabase",
      "Docker",
      "GitHub Actions",
    ],
    links: {
      website: "https://bazaarghost.stream",
      github: "https://github.com/kaiobarb/bazaar-ghost",
      blog: "/posts/bazaar-ghost",
    },
    stats: {
      users: "18,000+ visitors",
      activity: "~550 daily users",
    },
    timeline: "March 2025 - Present",
    logo: "/icons/bazaarghost-logo.svg",
  },
  shaderweb: {
    name: "ShaderWeb",
    tagline: "Interactive GLSL learning platform with AI assistance",
    description: [
      "ShaderWeb is a personalized GLSL learning platform that combines interactive shader editing with AI-powered assistance.",
      "Features include a knowledge graph visualization with WebGL heatmap, real-time shader compilation, and Claude-powered validation and practice problems.",
      "Built to make shader programming more accessible through visual learning and intelligent tutoring.",
    ],
    highlights: [
      "Interactive GLSL editor with live preview",
      "AI-powered practice problems and validation",
      "D3.js knowledge graph with WebGL heatmap overlay",
      "Personalized learning paths",
      "Real-time compilation feedback",
    ],
    techStack: {
      backend: ["Supabase", "Vercel AI SDK", "Claude API"],
      frontend: ["React", "TypeScript", "D3.js", "WebGL", "GLSL"],
      infrastructure: ["Vercel", "Supabase"],
      cv: [],
    },
    tags: ["GLSL", "WebGL", "AI", "Education", "React", "TypeScript", "D3.js"],
    links: {
      github: "https://github.com/kaiobarb/ShaderWeb",
    },
  },
  "hnswlib-wasm": {
    name: "hnswlib-wasm",
    tagline: "WebAssembly bindings for high-performance vector search",
    description: [
      "WASM bindings for the hnswlib C++ library, enabling approximate nearest neighbor search directly in the browser.",
      "Provides a TypeScript-friendly API for building and querying HNSW indexes with support for various distance metrics.",
      "Enables client-side vector search for RAG applications, semantic search, and recommendation systems.",
    ],
    highlights: [
      "Full hnswlib API surface in WebAssembly",
      "TypeScript definitions included",
      "Comprehensive test coverage with Jest",
      "Support for L2, Inner Product, and Cosine distance",
      "Efficient memory management with emnapi",
    ],
    techStack: {
      backend: ["C++", "Emscripten", "emnapi"],
      frontend: ["TypeScript", "WASM"],
      infrastructure: ["npm", "GitHub Actions"],
      cv: [],
    },
    tags: ["WASM", "C++", "Vector Search", "TypeScript", "Machine Learning"],
    links: {
      github: "https://github.com/kaiobarb/hnswlib-wasm",
    },
  },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = PROJECTS[slug];
  return {
    title: project ? `${project.name} | KAIO` : "Project | KAIO",
    description: project?.tagline,
  };
}

export async function generateStaticParams() {
  return Object.keys(PROJECTS).map((slug) => ({ slug }));
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const project = PROJECTS[slug];
  if (!project) notFound();

  return (
    <>
      <SideColumn side="left">
        {/* Hero Image or Logo */}
        {project.logo && (
          // <Card className="p-8 flex items-center justify-center">
          <Image
            className="self-center"
            src={project.logo}
            alt={`${project.name} logo`}
            width={128}
            height={128}
          />
          // </Card>
        )}

        {/* Tech Stack Breakdown */}
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wide">
            Tech Stack
          </h3>

          {project.techStack.backend.length > 0 && (
            <div>
              <h4 className="text-xs text-muted-foreground mb-2">Backend</h4>
              <div className="flex flex-wrap gap-2">
                {project.techStack.backend.map((tech) => (
                  <Badge
                    key={tech}
                    variant="accent"
                    className="text-xs rounded-full px-3"
                  >
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {project.techStack.frontend.length > 0 && (
            <div>
              <h4 className="text-xs text-muted-foreground mb-2">Frontend</h4>
              <div className="flex flex-wrap gap-2">
                {project.techStack.frontend.map((tech) => (
                  <Badge
                    key={tech}
                    variant="accent"
                    className="text-xs rounded-full px-3"
                  >
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {project.techStack.cv.length > 0 && (
            <div>
              <h4 className="text-xs text-muted-foreground mb-2">
                Computer Vision
              </h4>
              <div className="flex flex-wrap gap-2">
                {project.techStack.cv.map((tech) => (
                  <Badge
                    key={tech}
                    variant="accent"
                    className="text-xs rounded-full px-3"
                  >
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {project.techStack.infrastructure.length > 0 && (
            <div>
              <h4 className="text-xs text-muted-foreground mb-2">
                Infrastructure
              </h4>
              <div className="flex flex-wrap gap-2">
                {project.techStack.infrastructure.map((tech) => (
                  <Badge
                    key={tech}
                    variant="accent"
                    className="text-xs rounded-full px-3"
                  >
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Quick Stats */}
        {project.stats && (
          <Card className="p-4 grid grid-cols-2 gap-4">
            {project.stats.users && (
              <div>
                <div className="text-2xl font-bold">{project.stats.users}</div>
                <div className="text-xs text-muted-foreground">Total Users</div>
              </div>
            )}
            {project.stats.activity && (
              <div>
                <div className="text-2xl font-bold">
                  {project.stats.activity}
                </div>
                <div className="text-xs text-muted-foreground">
                  Daily Active
                </div>
              </div>
            )}
          </Card>
        )}

        <EmptyTile className="flex-1" />
      </SideColumn>

      <SideColumn side="right">
        {/* Project Header */}
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground">{project.tagline}</p>
            {project.timeline && (
              <p className="text-sm text-muted-foreground">
                {project.timeline}
              </p>
            )}
          </div>

          {/* Links */}
          <div className="flex gap-3">
            {project.links.website && (
              <Link
                href={project.links.website}
                target="_blank"
                className="inline-flex items-center gap-2 text-sm hover:text-primary transition-colors"
              >
                <GlobeIcon className="h-4 w-4" />
                Visit Site
              </Link>
            )}
            {project.links.github && (
              <Link
                href={project.links.github}
                target="_blank"
                className="inline-flex items-center gap-2 text-sm hover:text-primary transition-colors"
              >
                <GitHubLogoIcon className="h-4 w-4" />
                View Code
              </Link>
            )}
            {slug === "bazaarghost" && (
              <Link
                href="https://discord.gg/bazaarghost"
                target="_blank"
                className="inline-flex items-center gap-2 text-sm hover:text-primary transition-colors"
              >
                <DiscordLogoIcon className="h-4 w-4" />
                Discord
              </Link>
            )}
          </div>
        </Card>

        {/* Description */}
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">About</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            {project.description.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </Card>

        {/* Highlights */}
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Key Features</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {project.highlights.map((highlight, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Blog Link */}
        {project.links.blog && (
          <Card className="p-4">
            <Link
              href={project.links.blog}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              Read my detailed blog post →
            </Link>
          </Card>
        )}

        <EmptyTile className="flex-1" />
      </SideColumn>
    </>
  );
}

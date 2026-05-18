"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Github,
  Globe,
  Package,
  Mail,
  Linkedin,
  Quote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useChatContext } from "@/components/ChatProvider";
import { GridPattern } from "@/components/ui/grid-pattern";
import { GhRepoTile, GhGridTile, GhActivityTile } from "@/components/tiles/GithubTiles";
import type { TileSpec } from "@/lib/tiles";
import {
  PROJECTS,
  EXPERIENCE,
  PLACES,
  SOCIAL,
  IMAGE_CATALOG,
} from "@/data/portfolio";

// ─────────────────────────────────────────────────────────────
// Base tile frame — every tile shares this shell

function Frame({
  className,
  onClick,
  children,
  label,
}: {
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
  label?: string;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border/20 bg-card/40 p-4 text-left backdrop-blur-sm transition-all",
        onClick &&
          "hover:border-border/60 hover:bg-card/60 hover:shadow-[0_0_30px_-10px] hover:shadow-secondary/40",
        className,
      )}
    >
      {label && (
        <span className="pointer-events-none absolute right-3 top-2.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50">
          {label}
        </span>
      )}
      {children}
    </Comp>
  );
}

// ─────────────────────────────────────────────────────────────

function ProjectTile({ slug }: { slug: string }) {
  const p = PROJECTS[slug];
  const { sendMessage } = useChatContext();
  if (!p) return null;

  return (
    <Frame
      label="project"
      onClick={() => sendMessage({ text: `Tell me more about ${p.name}` })}
    >
      <div className="flex items-start gap-3">
        {p.logo && (
          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-border/20 bg-background/50 p-1.5">
            <Image src={p.logo} alt="" fill className="object-contain p-1" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate font-semibold text-foreground">{p.name}</h3>
            <span className="font-mono text-[10px] text-muted-foreground">
              {p.year}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{p.tagline}</p>
        </div>
      </div>

      {p.stat && (
        <div className="mt-3 flex items-baseline gap-2 border-t border-border/10 pt-3">
          <span className="font-mono text-xl font-bold text-foreground">
            {p.stat.value}
          </span>
          <span className="text-[10px] text-muted-foreground">{p.stat.label}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.stack.slice(0, 5).map((s) => (
          <Badge key={s} variant="accent" className="text-[10px]">
            {s}
          </Badge>
        ))}
        {p.stack.length > 5 && (
          <Badge variant="outline" className="text-[10px]">
            +{p.stack.length - 5}
          </Badge>
        )}
      </div>

      <ArrowUpRight className="absolute bottom-3 right-3 size-4 text-muted-foreground/30 transition-all group-hover:text-foreground" />
    </Frame>
  );
}

function ExperienceTile({ company }: { company: string }) {
  const e = EXPERIENCE[company];
  const { sendMessage } = useChatContext();
  if (!e) return null;

  return (
    <Frame
      label="work"
      onClick={() =>
        sendMessage({ text: `What did Kaio work on at ${e.company}?` })
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-foreground">{e.company}</h3>
        <span className="font-mono text-[10px] text-muted-foreground">
          {e.period}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{e.role}</p>
      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-foreground/70">
        {e.summary}
      </p>
    </Frame>
  );
}

function StatTile({
  value,
  label,
  sublabel,
}: {
  value: string;
  label: string;
  sublabel?: string;
}) {
  return (
    <Frame label="stat" className="relative justify-center overflow-hidden">
      <GridPattern
        width={24}
        height={24}
        className="absolute inset-0 fill-transparent stroke-border/10 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]"
      />
      <span className="relative font-mono text-3xl font-bold leading-none text-foreground">
        {value}
      </span>
      <span className="relative mt-1 text-xs text-muted-foreground">{label}</span>
      {sublabel && (
        <span className="relative text-[10px] text-muted-foreground/60">
          {sublabel}
        </span>
      )}
    </Frame>
  );
}

function ImageTileR({
  src,
  alt,
  aspect = "video",
}: {
  src: string;
  alt: string;
  aspect?: "square" | "video" | "wide";
}) {
  if (!src) return null;
  const resolved = IMAGE_CATALOG[src] ?? src;
  const ratio =
    aspect === "square"
      ? "aspect-square"
      : aspect === "wide"
        ? "aspect-[21/9]"
        : "aspect-video";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/20",
        ratio,
      )}
    >
      <Image src={resolved} alt={alt} fill className="object-cover" />
      {alt && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
          <p className="text-[10px] font-medium text-white/90">{alt}</p>
        </div>
      )}
    </div>
  );
}

function MapTileR({ place }: { place: string }) {
  const p = PLACES.find((x) => x.key === place) ?? PLACES[0];
  const { sendMessage } = useChatContext();
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const url = key
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${p.coords[0]},${p.coords[1]}&zoom=${p.zoom}&size=600x400&scale=2&maptype=satellite&key=${key}`
    : null;

  return (
    <button
      onClick={() => sendMessage({ text: p.prompt })}
      className="group relative aspect-video overflow-hidden rounded-xl border border-border/20 transition-all hover:border-border/60"
    >
      {url ? (
        <Image src={url} alt={p.label} fill unoptimized className="object-cover" />
      ) : (
        <div className="absolute inset-0 bg-muted">
          <GridPattern width={20} height={20} className="stroke-border/20" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          {p.coords[0].toFixed(2)}, {p.coords[1].toFixed(2)}
        </p>
        <p className="text-sm font-semibold text-foreground">{p.label}</p>
      </div>
    </button>
  );
}

function StackTile({ title, items }: { title?: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <Frame label="stack">
      {title && (
        <h4 className="mb-2 text-xs font-medium text-foreground">{title}</h4>
      )}
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <Badge key={s} variant="accent" className="text-[10px]">
            {s}
          </Badge>
        ))}
      </div>
    </Frame>
  );
}

function LinkTile({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle?: string;
}) {
  if (!href) return null;
  const Icon = href.includes("github")
    ? Github
    : href.includes("npmjs")
      ? Package
      : Globe;
  const external = href.startsWith("http");

  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="group flex items-center gap-3 rounded-xl border border-border/20 bg-card/40 p-3 transition-all hover:border-border/60 hover:bg-card/60"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/20 bg-background/50">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {subtitle && (
          <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <ArrowUpRight className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
    </Link>
  );
}

function ContactTile() {
  return (
    <Frame label="contact" className="gap-2">
      <p className="text-xs text-muted-foreground">Get in touch</p>
      <div className="flex gap-2">
        <a
          href={SOCIAL.email}
          className="flex size-9 items-center justify-center rounded-lg border border-border/20 bg-background/50 transition-colors hover:border-border/60 hover:text-foreground"
        >
          <Mail className="size-4" />
        </a>
        <a
          href={SOCIAL.github}
          target="_blank"
          rel="noreferrer"
          className="flex size-9 items-center justify-center rounded-lg border border-border/20 bg-background/50 transition-colors hover:border-border/60 hover:text-foreground"
        >
          <Github className="size-4" />
        </a>
        <a
          href={SOCIAL.linkedin}
          target="_blank"
          rel="noreferrer"
          className="flex size-9 items-center justify-center rounded-lg border border-border/20 bg-background/50 transition-colors hover:border-border/60 hover:text-foreground"
        >
          <Linkedin className="size-4" />
        </a>
      </div>
    </Frame>
  );
}

function TextTile({ title, body }: { title?: string; body: string }) {
  return (
    <Frame>
      {title && (
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
      )}
      <p className="text-sm leading-relaxed text-foreground/80">{body}</p>
    </Frame>
  );
}

function QuoteTile({ text, cite }: { text: string; cite?: string }) {
  return (
    <Frame className="relative">
      <Quote className="absolute right-3 top-3 size-8 text-border/10" />
      <p className="font-serif text-sm italic leading-relaxed text-foreground/90">
        {text}
      </p>
      {cite && (
        <p className="mt-2 text-[10px] text-muted-foreground">— {cite}</p>
      )}
    </Frame>
  );
}

// ─────────────────────────────────────────────────────────────

export function Tile({ spec }: { spec: TileSpec }) {
  switch (spec.kind) {
    case "project":
      return <ProjectTile slug={spec.slug} />;
    case "experience":
      return <ExperienceTile company={spec.company} />;
    case "stat":
      return <StatTile {...spec} />;
    case "image":
      return <ImageTileR {...spec} />;
    case "map":
      return <MapTileR place={spec.place} />;
    case "stack":
      return <StackTile {...spec} />;
    case "link":
      return <LinkTile {...spec} />;
    case "contact":
      return <ContactTile />;
    case "text":
      return <TextTile {...spec} />;
    case "quote":
      return <QuoteTile {...spec} />;
    case "ghrepo":
      return <GhRepoTile repo={spec.repo} data={spec.data} />;
    case "ghgrid":
      return <GhGridTile />;
    case "ghactivity":
      return <GhActivityTile />;
  }
}

export function TileStack({ tiles }: { tiles: TileSpec[] }) {
  return (
    <>
      {tiles.map((t, i) => (
        <Tile key={`${t.kind}-${i}`} spec={t} />
      ))}
    </>
  );
}

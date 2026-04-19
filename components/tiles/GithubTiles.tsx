"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Github, Star, GitPullRequest, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { GridPattern } from "@/components/ui/grid-pattern";
import type {
  RepoCard,
  ContributionSnapshot,
  ActivityDigest,
} from "@/lib/github";

// Tiny client fetcher — leans on the route's `next.revalidate` cache.
// undefined = loading, null = fetch returned null/error, T = data
function useGh<T>(op: string, params = "", skip = false): T | null | undefined {
  const [data, setData] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    if (skip) return;
    let live = true;
    fetch(`/api/gh?op=${op}${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setData(d))
      .catch(() => live && setData(null));
    return () => {
      live = false;
    };
  }, [op, params, skip]);
  return data;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 14) return `${d}d ago`;
  if (d < 60) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

const LANG_COLOR: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  "C++": "#f34b7d",
  C: "#555555",
  GLSL: "#5686a5",
  GDScript: "#355570",
  PLpgSQL: "#336790",
  HTML: "#e34c26",
};

// ─────────────────────────────────────────────────────────────

function RepoSkeleton() {
  return (
    <div className="relative h-[120px] overflow-hidden rounded-xl border border-border/20 bg-card/30">
      <GridPattern
        width={18}
        height={18}
        className="stroke-border/10 [mask-image:linear-gradient(to_right,black,transparent)]"
      />
      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-foreground/5 to-transparent" />
    </div>
  );
}

export function GhRepoTile({
  repo,
  data: preloaded,
}: {
  repo: string;
  data?: RepoCard;
}) {
  const fetched = useGh<{ ok: boolean; repo?: RepoCard; reason?: string }>(
    "repo",
    `&name=${encodeURIComponent(repo)}`,
    !!preloaded,
  );

  const card = preloaded ?? (fetched?.ok ? fetched.repo : undefined);

  if (!preloaded && fetched === undefined) return <RepoSkeleton />;
  if (!card) return null; // blocklisted / private / 404 — silently drop

  return (
    <Link
      href={card.url}
      target="_blank"
      className="group relative flex flex-col gap-2 overflow-hidden rounded-xl border border-border/20 bg-card/40 p-4 transition-all hover:border-border/60 hover:bg-card/60"
    >
      <span className="pointer-events-none absolute right-3 top-2.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50">
        github
      </span>

      <div className="flex items-center gap-2">
        <Github className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono text-sm text-foreground">
          <span className="text-muted-foreground">{card.owner}/</span>
          <span className="font-semibold">{card.name}</span>
        </span>
      </div>

      {card.description && (
        <p className="line-clamp-2 text-xs leading-relaxed text-foreground/70">
          {card.description}
        </p>
      )}

      <div className="mt-auto flex items-center gap-3 pt-1 font-mono text-[10px] text-muted-foreground">
        {card.language && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ background: LANG_COLOR[card.language] ?? "#888" }}
            />
            {card.language}
          </span>
        )}
        {card.stars > 0 && (
          <span className="inline-flex items-center gap-1">
            <Star className="size-3" />
            {card.stars.toLocaleString()}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" />
          {relTime(card.pushedAt)}
        </span>
      </div>

      {card.topics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.topics.slice(0, 4).map((t) => (
            <Badge key={t} variant="accent" className="text-[9px]">
              {t}
            </Badge>
          ))}
        </div>
      )}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────

export function GhGridTile() {
  const snap = useGh<ContributionSnapshot>("snapshot");
  if (snap === undefined) return <RepoSkeleton />;
  if (!snap) return null;

  const max = Math.max(1, ...snap.weeks.flat());
  const level = (n: number) =>
    n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4));

  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border/20 bg-card/40 p-4">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          last 12 weeks
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {snap.total} / yr
        </span>
      </div>

      <div className="flex gap-[3px]">
        {snap.weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }).map((_, di) => (
              <div
                key={di}
                className={cn(
                  "size-[9px] rounded-[2px]",
                  [
                    "bg-border/10",
                    "bg-chart-5",
                    "bg-chart-4",
                    "bg-chart-3",
                    "bg-chart-2",
                  ][level(week[di] ?? 0)],
                )}
              />
            ))}
          </div>
        ))}
      </div>

      <p className="font-mono text-[10px] text-foreground/70">
        {snap.streakHint}
      </p>

      {snap.contributedTo[0] && (
        <Link
          href={snap.contributedTo[0].url}
          target="_blank"
          className="flex items-center justify-between border-t border-border/10 pt-2 text-[10px] transition-colors hover:text-foreground"
        >
          <span className="inline-flex items-center gap-1.5 truncate">
            <GitPullRequest className="size-3 shrink-0" />
            <span className="truncate font-mono text-foreground/70">
              {snap.contributedTo[0].nameWithOwner}
            </span>
          </span>
          <span className="shrink-0 font-mono text-muted-foreground">
            ★ {snap.contributedTo[0].stars.toLocaleString()}
          </span>
        </Link>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

export function GhActivityTile() {
  const digest = useGh<ActivityDigest>("activity");
  if (digest === undefined) return <RepoSkeleton />;
  if (!digest?.items.length) return null;

  return (
    <div className="flex flex-col gap-1.5 overflow-hidden rounded-xl border border-border/20 bg-card/40 p-4">
      <span className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        recent activity
      </span>
      {digest.items.map((it, i) => (
        <Link
          key={i}
          href={it.url}
          target="_blank"
          className="group flex items-baseline gap-2 text-[11px] transition-colors hover:text-foreground"
        >
          <span className="w-12 shrink-0 font-mono text-[9px] text-muted-foreground">
            {relTime(it.at)}
          </span>
          <span className="truncate text-muted-foreground">
            {it.label}{" "}
            <span className="font-mono text-foreground/80 group-hover:text-foreground">
              {it.repo}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

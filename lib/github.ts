/**
 * Curated, cached, public-only window onto Kaio's GitHub.
 *
 * Guardrails:
 *  - Unauthenticated fetch → cannot see private repos even by accident.
 *  - BLOCKLIST hides coursework / throwaway repos even though they're public.
 *  - OVERRIDES patch weak GitHub metadata (missing descriptions, misleading
 *    primary-language detection) with portfolio-controlled copy.
 *  - Activity is aggregated and phrased server-side; the LLM never sees raw
 *    counts it could frame unflatteringly.
 */

import { PROJECTS } from "@/data/portfolio";

export const GITHUB_LOGIN = "liftaris";
const API = "https://api.github.com";

const BLOCKLIST = new Set([
  "todo",
  "twitter-clone",
  "crud-app",
  "solo-technical-assessment",
  "assortedCoursework",
  "CMPM121",
  "GameGraphics",
  "WebGL-Egghead",
  "react-roguelike",
  "windowpanegame.com",
  "site",
  "kaiobarb.github.io",
  "liftaris",
  "WashingtonPopulation",
  "threeJS",
  "mystical-grove",
  "Final-Chess",
  "Babblesaurus",
  "Xplo",
  "dream-in-style",
]);

// Repo → portfolio slug, for description/language/stack enrichment.
const PORTFOLIO_SLUG: Record<string, string> = {
  "bazaar-ghost": "bazaarghost",
  "bazaarghost.stream": "bazaarghost",
  "liftaris.dev": "liftaris-dev",
  "hnswlib-wasm": "hnswlib-wasm",
  LSystems: "lsystems",
};

// GitHub's primary-language detection is often wrong for infra-heavy repos.
const LANGUAGE_OVERRIDE: Record<string, string> = {
  "bazaar-ghost": "Python",
  "bazaarghost.stream": "TypeScript",
};

export interface RepoCard {
  name: string;
  owner: string;
  description: string | null;
  language: string | null;
  stars: number;
  pushedAt: string;
  homepage: string | null;
  url: string;
  topics: string[];
  portfolioSlug?: string;
}

export interface ContributionSnapshot {
  total: number;
  weeks: number[][]; // 12 weeks × 7 days
  streakHint: string;
  contributedTo: { nameWithOwner: string; stars: number; url: string }[];
}

export interface ActivityDigest {
  items: { label: string; repo: string; url: string; at: string }[];
  since: string;
}

// ─────────────────────────────────────────────────────────────

async function gh<T>(
  path: string,
  { revalidate = 3600, graphql }: { revalidate?: number; graphql?: string } = {},
): Promise<T | null> {
  const url = graphql ? `${API}/graphql` : `${API}${path}`;
  const init: RequestInit & { next: { revalidate: number } } = {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(process.env.GITHUB_TOKEN && {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      }),
    },
    next: { revalidate },
  };
  if (graphql) {
    init.method = "POST";
    init.body = JSON.stringify({ query: graphql });
  }

  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────

interface RawRepo {
  name: string;
  owner: { login: string };
  description: string | null;
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
  homepage: string | null;
  html_url: string;
  topics: string[];
  private: boolean;
  fork: boolean;
  archived: boolean;
}

function curate(raw: RawRepo): RepoCard {
  const slug = PORTFOLIO_SLUG[raw.name];
  const p = slug ? PROJECTS[slug] : undefined;

  return {
    name: raw.name,
    owner: raw.owner.login,
    description: p?.tagline ?? raw.description,
    language:
      LANGUAGE_OVERRIDE[raw.name] ?? p?.stack[0] ?? raw.language,
    stars: raw.stargazers_count,
    pushedAt: raw.pushed_at,
    homepage: raw.homepage || p?.links.site || null,
    url: raw.html_url,
    topics: raw.topics?.length ? raw.topics : p?.stack.slice(0, 4) ?? [],
    portfolioSlug: slug,
  };
}

/** Fetch a single repo card. Accepts `name` or `owner/name`. */
export async function getRepo(
  ref: string,
): Promise<{ ok: true; repo: RepoCard } | { ok: false; reason: string }> {
  const clean = ref.trim().replace(/^https?:\/\/github\.com\//, "");
  const [owner, name] = clean.includes("/")
    ? clean.split("/")
    : [GITHUB_LOGIN, clean];

  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(name)) {
    return { ok: false, reason: "invalid" };
  }
  if (owner === GITHUB_LOGIN && BLOCKLIST.has(name)) {
    return { ok: false, reason: "not-featured" };
  }

  const raw = await gh<RawRepo>(`/repos/${owner}/${name}`, { revalidate: 3600 });
  if (!raw) return { ok: false, reason: "not-found" };
  if (raw.private) return { ok: false, reason: "private" };

  return { ok: true, repo: curate(raw) };
}

// ─────────────────────────────────────────────────────────────

interface CalendarGQL {
  data?: {
    user?: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: { contributionDays: { contributionCount: number }[] }[];
        };
      };
      repositoriesContributedTo: {
        nodes: { nameWithOwner: string; stargazerCount: number; url: string }[];
      };
    };
  };
}

export async function getContributionSnapshot(): Promise<ContributionSnapshot | null> {
  const gql = `{
    user(login: "${GITHUB_LOGIN}") {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { contributionCount } }
        }
      }
      repositoriesContributedTo(first: 5, contributionTypes: [COMMIT, PULL_REQUEST, ISSUE], privacy: PUBLIC, orderBy: {field: STARGAZERS, direction: DESC}) {
        nodes { nameWithOwner stargazerCount url }
      }
    }
  }`;

  const res = await gh<CalendarGQL>("", { revalidate: 21600, graphql: gql });
  const u = res?.data?.user;
  if (!u) return null;

  const cal = u.contributionsCollection.contributionCalendar;
  const weeks = cal.weeks
    .slice(-12)
    .map((w) => w.contributionDays.map((d) => d.contributionCount));

  const flat = weeks.flat();
  const recent = flat.slice(-14).reduce((a, b) => a + b, 0);
  const streakHint =
    recent > 40
      ? "shipping daily"
      : recent > 10
        ? "actively building"
        : "steady cadence";

  return {
    total: cal.totalContributions,
    weeks,
    streakHint,
    contributedTo: u.repositoriesContributedTo.nodes.map((n) => ({
      nameWithOwner: n.nameWithOwner,
      stars: n.stargazerCount,
      url: n.url,
    })),
  };
}

// ─────────────────────────────────────────────────────────────

interface RawEvent {
  type: string;
  repo: { name: string };
  created_at: string;
  payload: { action?: string };
  public: boolean;
}

const VERB: Record<string, string> = {
  PushEvent: "pushed to",
  PullRequestEvent: "opened a PR in",
  IssuesEvent: "opened an issue in",
  IssueCommentEvent: "discussed",
  CreateEvent: "created",
  ReleaseEvent: "released",
};

export async function getActivityDigest(): Promise<ActivityDigest> {
  const events = await gh<RawEvent[]>(
    `/users/${GITHUB_LOGIN}/events/public?per_page=100`,
    { revalidate: 900 },
  );

  const items: ActivityDigest["items"] = [];
  const seen = new Set<string>();

  for (const e of events ?? []) {
    if (!VERB[e.type]) continue;
    const [owner, name] = e.repo.name.split("/");
    if (owner === GITHUB_LOGIN && BLOCKLIST.has(name)) continue;

    const key = `${e.type}:${e.repo.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      label: VERB[e.type],
      repo: e.repo.name,
      url: `https://github.com/${e.repo.name}`,
      at: e.created_at,
    });
    if (items.length >= 5) break;
  }

  return {
    items,
    since: events?.[events.length - 1]?.created_at ?? new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────

export async function listShowcaseRepos(): Promise<RepoCard[]> {
  const raw = await gh<RawRepo[]>(
    `/users/${GITHUB_LOGIN}/repos?per_page=100&sort=pushed&type=owner`,
    { revalidate: 21600 },
  );
  if (!raw) return [];
  return raw
    .filter((r) => !r.private && !r.fork && !r.archived && !BLOCKLIST.has(r.name))
    .map(curate)
    .slice(0, 10);
}

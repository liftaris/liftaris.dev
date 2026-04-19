import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  tool,
  gateway,
  type UIMessage,
} from "ai";
import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import {
  PROJECTS,
  PROJECT_SLUGS,
  EXPERIENCE,
  EXPERIENCE_KEYS,
  PLACE_KEYS,
  IMAGE_CATALOG,
} from "@/data/portfolio";
import { getRepo, listShowcaseRepos, GITHUB_LOGIN } from "@/lib/github";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

// ─────────────────────────────────────────────────────────────
// Retrieval

interface Match {
  id: string;
  title: string;
  type: string;
  source: string;
  content: string;
  tags: string[];
  similarity: number;
}

async function retrieve(query: string): Promise<Match[]> {
  if (!query.trim()) return [];

  const { data: embedData, error: embedError } = await supabase.functions.invoke(
    "embed",
    { body: { input: query } },
  );

  if (embedError || !embedData?.embedding) {
    console.error("embed error", embedError);
    return localFallback();
  }

  const { data: matches, error: matchError } = await supabase
    .schema("liftaris")
    .rpc("match_chunks", {
      query_embedding: JSON.stringify(embedData.embedding),
      match_threshold: 0.7,
      match_count: 8,
      filter_type: null,
      filter_tags: null,
    });

  if (matchError || !matches?.length) {
    console.error("match error", matchError);
    return localFallback();
  }

  return matches as Match[];
}

async function localFallback(): Promise<Match[]> {
  const chunks = await import("@/lib/rag/chunks.json");
  return chunks.default.map((c: { id: string; title: string; source: string; content: string }) => ({
    id: c.id,
    title: c.title,
    type: "local",
    source: c.source,
    content: c.content,
    tags: [],
    similarity: 0,
  }));
}

// ─────────────────────────────────────────────────────────────
// Tile schema (mirrors lib/tiles.ts)

const tileSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("project"), slug: z.enum(PROJECT_SLUGS as [string, ...string[]]) }),
  z.object({ kind: z.literal("experience"), company: z.enum(EXPERIENCE_KEYS as [string, ...string[]]) }),
  z.object({ kind: z.literal("stat"), value: z.string(), label: z.string(), sublabel: z.string().optional() }),
  z.object({ kind: z.literal("image"), src: z.string(), alt: z.string(), aspect: z.enum(["square", "video", "wide"]).optional() }),
  z.object({ kind: z.literal("map"), place: z.enum(PLACE_KEYS as [string, ...string[]]) }),
  z.object({ kind: z.literal("stack"), title: z.string().optional(), items: z.array(z.string()).max(12) }),
  z.object({ kind: z.literal("link"), href: z.string(), title: z.string(), subtitle: z.string().optional() }),
  z.object({ kind: z.literal("contact") }),
  z.object({ kind: z.literal("text"), title: z.string().optional(), body: z.string().max(280) }),
  z.object({ kind: z.literal("quote"), text: z.string().max(200), cite: z.string().optional() }),
  z.object({ kind: z.literal("ghrepo"), repo: z.string().describe("repo name or owner/name; public only") }),
  z.object({ kind: z.literal("ghgrid") }),
  z.object({ kind: z.literal("ghactivity") }),
]);

// ─────────────────────────────────────────────────────────────
// System prompt

function buildSystemPrompt(context: string, showcase: string): string {
  const projectCatalog = Object.values(PROJECTS)
    .map((p) => `  - ${p.slug}: ${p.name} — ${p.tagline}`)
    .join("\n");
  const experienceCatalog = Object.values(EXPERIENCE)
    .map((e, i) => `  - ${EXPERIENCE_KEYS[i]}: ${e.company}, ${e.role} (${e.period})`)
    .join("\n");
  const imageCatalog = Object.keys(IMAGE_CATALOG)
    .map((k) => `  - ${k}`)
    .join("\n");

  return `You are the AI layer of Kaio Barbosa-Chifan's portfolio (liftaris.dev). You speak ABOUT Kaio in third person to visitors — recruiters, hiring managers, engineers. Be warm, precise, and concrete. Never invent facts not in the context.

THE INTERFACE
You control a three-column bento grid. Your text streams into the center. You populate the left and right columns by calling the \`showTiles\` tool. You may also call \`navigate\` to move the visitor to a dedicated page, and \`githubRepo\` to stream a live repo card. Call tools FIRST, then write your prose response.

TILE DISCIPLINE
- Always call showTiles exactly once per turn before responding.
- Left column: primary subject (project card, experience card, repo card, map, hero image). 1–3 tiles.
- Right column: supporting detail (stats, tech stack, links, contribution grid, activity feed, contact). 1–3 tiles.
- Tiles are visual anchors — your prose does the storytelling. Don't repeat tile content verbatim in text.
- If the visitor's question is broad ("who is Kaio?"), compose a sampler: one project, one experience, one stat, contact.
- If narrow ("tell me about BazaarGhost"), go deep: project tile left; stat + stack + link right.

AVAILABLE TILE KINDS
  project     { slug }          — curated project card with logo, tagline, stack preview
  experience  { company }       — work history card
  stat        { value, label }  — big number callout
  image       { src, alt }      — photo/diagram (src MUST be from image catalog below, or a full /path)
  map         { place }         — satellite tile of a place Kaio has lived
  stack       { title?, items } — badge cloud
  link        { href, title }   — CTA to repo / live site / blog post
  contact     {}                — email / github / linkedin buttons
  text        { title?, body }  — short prose card (≤280 chars)
  quote       { text, cite? }   — pull-quote
  ghrepo      { repo }          — live GitHub repo card (name or owner/name)
  ghgrid      {}                — 12-week contribution heatmap + top OSS contribution
  ghactivity  {}                — recent public GitHub activity feed

GITHUB
Kaio's handle is ${GITHUB_LOGIN}. Public, portfolio-worthy repos right now:
${showcase || "  (showcase unavailable)"}
Use the \`githubRepo\` tool when the visitor asks about code, a specific repo, "what's he building lately", or open-source work — it fetches live metadata and streams a card alongside your answer. You may reference repos Kaio has contributed to (e.g. NousResearch/hermes-agent) using owner/name. Pair it with ghgrid or ghactivity in showTiles for context. If a repo isn't in the list above, it may be private or not portfolio-grade — don't mention it; pivot to a curated project instead. Never speculate about star counts, commit volume, or popularity — the card renders real numbers.

CATALOGS
Projects (use slug):
${projectCatalog}

Experience (use company key):
${experienceCatalog}

Places (use key): ${PLACE_KEYS.join(", ")}

Images (use key as src):
${imageCatalog}

NAVIGATION
Use the navigate tool when the visitor wants to browse a section: /about, /work, /projects, /projects/{slug}, /posts. Navigate AND showTiles AND respond — all three.

PITCH MODE
If the visitor pastes a job description or asks "is Kaio a fit for X", synthesize a tailored pitch: surface the 2–3 most relevant projects/experiences as tiles, pull matching tech into a stack tile, and write a focused 3–4 sentence case.

RETRIEVED CONTEXT
${context || "(no chunks retrieved — answer from catalogs above only)"}

Answer in 2–5 sentences unless asked for depth. Conversational, specific, no filler.`;
}

// ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const query =
    lastUser?.parts
      ?.filter((p) => p.type === "text")
      .map((p) => p.text)
      .join(" ") ?? "";

  const [matches, showcase] = await Promise.all([
    retrieve(query),
    listShowcaseRepos(),
  ]);
  const context = matches
    .map(
      (m) =>
        `[${m.title}] (type:${m.type} tags:${m.tags?.join(",") || "—"} sim:${m.similarity.toFixed(2)})\n${m.content}`,
    )
    .join("\n\n---\n\n");

  const showcaseText = showcase
    .map((r) => `  - ${r.owner}/${r.name} (${r.language ?? "—"}) — ${r.description ?? ""}`)
    .join("\n");

  const system = buildSystemPrompt(context, showcaseText);
  const modelMessages = await convertToModelMessages(messages);

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      // Emit retrieval telemetry as a data part — consumed by RetrievalTile
      writer.write({
        type: "data-retrieval",
        data: matches.slice(0, 5).map((m) => ({
          id: m.id,
          title: m.title,
          type: m.type,
          similarity: m.similarity,
        })),
      });

      const result = streamText({
        model: gateway("anthropic/claude-haiku-4-5"),
        providerOptions: {
          gateway: {
            models: ["anthropic/claude-haiku-4-5", "google/gemini-2.5-flash"],
            byok: {
              anthropic: [{ apiKey: process.env.ANTHROPIC_API_KEY! }],
              google: [{ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! }],
            },
          } satisfies GatewayProviderOptions,
        },
        system,
        messages: modelMessages,
        maxOutputTokens: 1024,
        stopWhen: stepCountIs(4),
        tools: {
          navigate: tool({
            description:
              "Navigate the visitor to a page on the portfolio. Use alongside showTiles, not instead of it.",
            inputSchema: z.object({
              path: z.enum([
                "/",
                "/about",
                "/work",
                "/projects",
                "/posts",
                ...PROJECT_SLUGS.map((s) => `/projects/${s}` as const),
              ]),
            }),
            execute: async ({ path }) => ({ ok: true, path }),
          }),
          showTiles: tool({
            description:
              "Render contextual tiles in the left and right columns. Call exactly once per response, before your prose.",
            inputSchema: z.object({
              left: z.array(tileSchema).max(4),
              right: z.array(tileSchema).max(4),
            }),
            execute: async ({ left, right }) => ({
              ok: true,
              rendered: left.length + right.length,
            }),
          }),
          githubRepo: tool({
            description:
              "Fetch live metadata for a public GitHub repo and stream it as a card into the left column. Use for 'show me the code', 'what's he building', or when discussing a specific repository.",
            inputSchema: z.object({
              repo: z
                .string()
                .describe(
                  `Repo name (assumes owner ${GITHUB_LOGIN}) or owner/name for external contributions.`,
                ),
            }),
            execute: async ({ repo }) => {
              const result = await getRepo(repo);
              if (!("repo" in result)) {
                return {
                  ok: false,
                  reason: result.reason,
                  hint: "Repo is private, not found, or not portfolio-grade. Do not mention it; use a curated project tile instead.",
                };
              }
              writer.write({
                type: "data-ghrepo",
                id: result.repo.name,
                data: result.repo,
              });
              return {
                ok: true,
                name: `${result.repo.owner}/${result.repo.name}`,
                description: result.repo.description,
                language: result.repo.language,
                pushedAt: result.repo.pushedAt,
              };
            },
          }),
        },
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: (e) => {
      console.error(e);
      return e instanceof Error ? e.message : "stream error";
    },
  });

  return createUIMessageStreamResponse({ stream });
}

# liftaris.dev — Chat-Driven Portfolio

## Chunk: project-liftaris-dev-overview

**Type:** project
**Source:** liftaris/liftaris.dev
**Tags:** ["liftaris.dev", "portfolio", "next.js", "ai-sdk", "rag", "generative-ui", "tool-calling", "claude", "supabase", "pgvector", "tailwind", "typescript"]
**Date Start:** 2026-03-01
**Date End:** null

### Content

liftaris.dev is Kaio's personal portfolio, built as a demonstration of generative UI: the chatbot is the primary navigation surface, not a side widget. A three-column bento grid places the conversation in the center; the model populates the left and right columns each turn by calling a `showTiles` tool with a Zod-validated discriminated union of tile specs (project cards, work history, stats, maps, tech-stack badges, live GitHub repo cards, contribution heatmaps). Pages supply fallback tiles; the model's composition overrides them. A `navigate` tool lets the assistant move the visitor between routes while it responds, and a `githubRepo` tool streams live repo metadata into the grid mid-answer via AI SDK data parts. Retrieval hits from pgvector are rendered as a transparency tile so visitors can see which corpus chunks grounded the response.

### Metadata

```json
{
  "repo": "liftaris/liftaris.dev",
  "url": "https://liftaris.dev",
  "role": "Solo developer",
  "stack": ["Next.js 16", "React 19", "TypeScript", "Vercel AI SDK", "Claude", "Supabase", "pgvector", "Tailwind 4", "Zod"],
  "status": "active",
  "highlights": [
    "Tool-calling drives page composition (generative UI)",
    "13-kind tile vocabulary rendered from a single discriminated union",
    "Live GitHub integration with curation guardrails",
    "RAG over a structured personal corpus with visible retrieval"
  ]
}
```

---

## Chunk: project-liftaris-dev-architecture

**Type:** project
**Source:** liftaris/liftaris.dev
**Tags:** ["liftaris.dev", "architecture", "ai-sdk", "streaming", "tool-calling", "rag", "pgvector", "supabase", "github-api", "next.js", "react"]
**Date Start:** 2026-03-01
**Date End:** null

### Content

The liftaris.dev backend is a single Next.js route handler that wraps `streamText` in `createUIMessageStream`. On each turn it embeds the user query via a Supabase Edge Function (gte-small, 384-dim), runs cosine search against `liftaris.chunks` (HNSW index), emits the top hits as a custom `data-retrieval` stream part, then runs Claude Haiku with three tools (`showTiles`, `navigate`, `githubRepo`) under a multi-step stop condition. Tool results stream to the client as UI-message parts; a React provider derives the current tile surface from the last assistant message with `useMemo`, so there is no separate tile state — it's pure projection over the conversation. GitHub data comes through a curated layer (`lib/github.ts`) that fetches unauthenticated, applies a repo blocklist, overrides weak metadata from a portfolio catalog, and leans on Next's fetch-cache (`revalidate`) so the site stays fresh without manual updates.

### Metadata

```json
{
  "repo": "liftaris/liftaris.dev",
  "url": "https://liftaris.dev",
  "role": "Solo developer",
  "stack": ["Next.js 16", "Vercel AI SDK", "Claude Haiku", "Supabase Edge Functions", "pgvector", "GitHub REST/GraphQL API", "Zod"],
  "status": "active",
  "highlights": [
    "Custom data-stream parts for retrieval transparency and live repo cards",
    "Surface state derived from message parts — no parallel tile store",
    "Curated GitHub layer: blocklist, metadata overrides, revalidate cache",
    "Runs on Haiku with AI Gateway fallback to Gemini"
  ]
}
```

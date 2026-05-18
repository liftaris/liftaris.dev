# Personal Knowledge Corpus — Design Spec

## Purpose

A structured, queryable representation of Kaio Barbosa-Chifan's professional identity — skills, projects, experience, and background — stored in Supabase pgvector. Serves as a single source of truth for multiple downstream consumers.

## Consumers

| Consumer | Status | How it uses the corpus |
|----------|--------|----------------------|
| RAG chatbot (liftaris.dev) | Built | Vector search + LLM context |
| Resume builder | Future | Filter by type/tags, use metadata for structured details, match against job descriptions |
| Job application agents | Future | Same as resume, plus skill matching |
| "What's Kaio working on" queries | Future | `type=activity` chunks + live GitHub API fallback |
| MCP for Kaio | Future | Exposes corpus as MCP tools for any Claude Code session |

## Architecture

### Data Layer: `liftaris` schema in Supabase

Shared Supabase project with shaderweb (which uses `public` schema). All corpus data lives in `liftaris.chunks`.

**Schema:**

| Column | Type | Description |
|--------|------|-------------|
| id | text PK | `{type}-{slug}-{index}` |
| type | text | `project`, `experience`, `skill`, `bio`, `blog`, `activity` |
| source | text | Repo name, "manual", blog filename |
| title | text | Human-readable title |
| content | text | Prose for embedding + LLM context |
| tags | text[] | Filterable tags (tech stack, topics) |
| date_start | date | Nullable |
| date_end | date | Null = ongoing |
| metadata | jsonb | Type-specific structured data |
| embedding | vector(384) | Via Supabase Edge Function `embed` (gte-small) |

**Metadata shapes by type:**

- `project`: `{ repo, url, stack[], role, highlights[], status }` — status is `active`, `maintained`, or `archived`
- `experience`: `{ company, title, team, achievements[] }`
- `skill`: `{ category, proficiency, evidence_refs[] }` — category is `language`, `framework`, `tool`, or `concept`; proficiency is `expert`, `proficient`, or `familiar`
- `bio`: `{ topic }`
- `blog`: `{ slug, date }`
- `activity`: `{ repo, commit_range, summary }`

**Indexes:** HNSW on embedding (cosine), GIN on tags, B-tree on type and dates.

### Query Layer: Postgres functions

- `match_chunks(query_embedding, threshold, count, filter_type, filter_tags)` — vector similarity with optional type/tag filtering. Built.
- `get_by_type(type, limit)` — fetch chunks by type, ordered by date. Build when needed.
- `get_recent_activity(since, limit)` — fetch recent activity chunks. Build when needed.

### Embedding Layer: Supabase Edge Function

- Function: `embed` (deployed)
- Model: `gte-small` (384 dimensions, built into Supabase Edge Runtime)
- No external API key required
- Called at chunk ingestion time and at query time

### Corpus Agent

A Claude Code agent (`.claude/agents/corpus.md`) that helps curate and populate the corpus.

**Tiered review model:**
- **Requires approval:** `project`, `experience`, `skill`, `bio` — the agent drafts and presents for Kaio's review before inserting
- **Automatic:** `activity` — auto-generated summaries of recent work go in without explicit review

**Workflow for curated content:**
1. Research the source (repo, README, commits, manual input)
2. Draft structured chunks with content, metadata, tags, dates
3. Present to Kaio for review
4. On approval: generate embedding via Edge Function, upsert to Supabase

**Content quality guidelines:**
- Third person ("Kaio built...")
- Specific and quantified where possible
- Tech stack details included (matters for keyword matching)
- No fluff — every sentence carries information
- Chunks stay under ~1500 chars for gte-small quality
- One chunk per major aspect (overview, architecture, impact) not one giant blob

### Content Sources

**From GitHub (via `gh` CLI):**
- READMEs, repo descriptions, language stats
- Commit history (summarized, not raw)
- Code structure and architecture (analyzed, not embedded verbatim)

**From local content:**
- Blog posts (`content/posts/*.md`)
- About page (`content/about.md`)

**Manual contributions:**
- Work experience (Moderna, Parsons, Health Note, etc.)
- Skills and proficiencies
- Context that can't be derived from code

### Consumers: How they query

**RAG chatbot (today):**
1. Embed user question via Edge Function
2. `match_chunks` with threshold 0.3, count 8
3. Pass matched chunks as context to Claude
4. Stream response

**Resume builder (future):**
1. Parse job description for required skills/keywords
2. `match_chunks` filtered by `type IN (project, experience, skill)` with tags matching job requirements
3. Use `metadata` fields for structured resume formatting
4. LLM generates tailored resume sections

**Live "what's Kaio working on" (future):**
1. Check `type=activity` chunks for recent entries
2. If stale or missing, hit GitHub API for recent commits
3. Synthesize into an answer

## Repo Curation Plan

Repos to process through the corpus agent (Tier 1 first):

**Tier 1 — Flagship:**
- bazaar-ghost + bazaarghost.stream (OCR pipeline + frontend)
- liftaris.dev (this site, RAG feature)
- ShaderWeb (GLSL learning platform)
- hnswlib-wasm (WASM vector search bindings)

**Tier 2 — Show range:**
- LSystems (C, algorithmic art)
- howsweet (web game)
- Infinimuse (ThreeJS museum)
- bullshot (Godot game)
- madruga (YouTube discovery)
- dream-in-style (if AI-related)

**Skip:** Forks, class assignments, old sites, boilerplate, todo apps.

## What this design does NOT include (deferred)

- Cron jobs for automatic activity ingestion
- MCP server
- Resume builder UI
- Job application automation
- GitHub webhooks
- Any consumer beyond the RAG chatbot

These are natural extensions of this foundation but are out of scope for now.

# Chat-Centric Portfolio Redesign

## Overview

Redesign liftaris.dev so the RAG chat is the central interface. The site uses a three-column bento grid layout with the chat in the center column and contextual tiles on either side. Each route (about, projects, posts, blog/[slug]) has a preset tile layout. The chat persists across navigations via the root layout and can trigger route changes. A collapsible sidebar holds chat history.

Desktop-first. Mobile deferred.

## Wireframe Reference

Wireframes are in `docs/diagrams/`:
- `landing.png` — idle state, name/header in center
- `landing_chat-active.png` — after first message, chat takes center
- `Aboutme.png` — about view
- `project.png` — projects view
- `posts.png` — posts view
- `article.png` — blog article view (chat moves to left column)

## Shell Layout

The root `app/layout.tsx` renders the entire page shell:

```
┌──────────────────────────────────────────────────┐
│  [KAIO]   Projects  Posts  About  Contact    [=] │  navbar
├───────┬──────────────────────────────────────────┤
│       │  left tiles  │  chat center  │  right    │
│ side  │              │               │  tiles    │  bento grid
│ bar   │              │               │           │
│       │              │    [input]    │           │
├───────┴──────────────┴───────────────┴───────────┤
│                  BARBOSA-CHIFAN                   │  footer
└──────────────────────────────────────────────────┘
```

### Components

- **Navbar** — top bar with page links and a sidebar toggle button. Always visible.
- **Sidebar** — collapsible panel (off by default). Contains "KAIO" branding, chat session history list, "New Session" button. Toggled from the navbar.
- **Main grid** — CSS Grid, three columns (`grid-cols-[1fr_2fr_1fr]`), fills remaining viewport height. Chat is rendered by the layout in `col-start-2`. `{children}` (the page) provides `SideColumn` components that place themselves in columns 1 and 3.
- **Footer** — "BARBOSA-CHIFAN", centered.

### How pages provide side content

Each page returns a React fragment containing two `SideColumn` components:

```tsx
export default function AboutPage() {
  return (
    <>
      <SideColumn side="left">
        {/* tiles */}
      </SideColumn>
      <SideColumn side="right">
        {/* tiles */}
      </SideColumn>
    </>
  );
}
```

The fragment dissolves so both `SideColumn` divs become direct CSS Grid children alongside `ChatPanel`. Each positions itself via `col-start-1` or `col-start-3`.

`SideColumn` is a flex column container with a gap. Tiles inside it are regular React components using shadcn primitives.

## Routing

```
app/
  layout.tsx                ← shell: navbar, sidebar, bento grid, footer, ChatProvider
  page.tsx                  ← landing page (idle → chat active)
  about/page.tsx            ← about layout
  projects/page.tsx         ← projects list
  projects/[slug]/page.tsx  ← individual project
  posts/page.tsx            ← posts list
  blog/[slug]/page.tsx      ← article (exception layout)
  blog/[slug]/layout.tsx    ← overrides grid: chat left, article center, tiles right
  api/ask/route.ts          ← existing RAG API (already built)
```

Next.js experimental `viewTransition` is used for animated transitions between routes.

## Chat System

### State management

A `ChatProvider` context in `app/layout.tsx` wraps the entire app. It manages:

- **messages** — conversation array via AI SDK's `useChat` hook
- **status** — streaming/idle state
- **sendMessage / stop** — chat controls
- **sessions** — array of `{ id, title, createdAt }` for chat history
- **startNewSession()** — archives current messages, starts fresh

Both messages and sessions persist to `localStorage`.

### Chat-triggered navigation

The API route defines a `navigate` tool using the AI SDK tool mechanism:

```ts
tools: {
  navigate: {
    description: "Navigate to a page on the portfolio site when the user asks about a specific topic",
    parameters: z.object({
      path: z.enum(["/about", "/projects", "/projects/bazaarghost", "/posts"]),
    }),
  }
}
```

The client-side `useChat` receives the tool call result and executes `router.push(path)`. The text response streams normally alongside the navigation.

### ChatPanel component

Refactored from the existing `ChatWidget.tsx`. Renders in the center column by default. Accepts a `compact` prop for the article view where it renders in a narrower left-column style.

The chat input is always visible at the bottom of the chat area, regardless of center mode.

## Page Layouts

### Landing page (`/`)

**Idle state:** Center column shows hero content — "KAIO", subtitle "BARBOSA-CHIFAN", horizontal decorative lines. Chat input visible at bottom. Side columns show placeholder/decorative tiles.

**Active state:** On first message send, hero content fades out and chat messages appear in its place. Side tiles remain unchanged. The transition is local state driven by `messages.length > 0` from the chat context.

### About page (`/about`)

Center: ChatPanel.

Left column:
- Numbered tab buttons (timeline chapters)
- Bio text card with year marker
- Map/satellite image tile

Right column:
- Portrait photo (ImageTile)
- Hobbies/interests icon grid (small tiles with icons and text)
- Placeholder tile

### Projects page (`/projects`, `/projects/[slug]`)

Center: ChatPanel. Suggested prompt: "Tell me about Bazaarghost."

Left column:
- Project image/screenshot (ImageTile)
- Tech stack pills (shadcn Badge components)
- App screenshot (ImageTile)

Right column:
- GitHub commit grid visualization
- Description tiles with text
- "Read my blog post about it!" link tile

### Posts page (`/posts`)

Center: ChatPanel.

Left column:
- Writing excerpt text card

Right column:
- "POSTS" heading
- Stacked blog post cards with hero images, titles, dates

### Article page (`/blog/[slug]`)

**Exception layout.** `blog/[slug]/layout.tsx` overrides the default grid arrangement.

Left column (narrow):
- "KAIO / BARBOSA-CHIFAN" branding tile
- ChatPanel in compact mode
- Chat input at bottom of left column

Center column (wide):
- Hero image
- Article title
- Article body (rendered markdown)

Right column (narrow):
- Related content tile
- Small icon tiles
- Additional related tiles

## Tile Components

Minimal component extraction. Most tile content is composed inline using shadcn primitives.

Dedicated components:
- **SideColumn** — flex column container, positions itself via `col-start`
- **ChatPanel** — refactored from `ChatWidget.tsx`, supports default and `compact` mode
- **ImageTile** — rounded image in a card. Used for photos, screenshots, maps, etc.
- **Navbar** — top navigation bar with page links and sidebar toggle
- **Sidebar** — collapsible panel with chat history

Everything else uses shadcn directly:
- `Card` for tile containers
- `Badge` for tech pills
- `Button` for tab buttons, actions
- `Separator` for decorative lines

`EmptyTile` (a styled empty `Card`) fills layout gaps where content isn't defined yet.

## Chat Session Persistence

- Messages stored in `localStorage` under a session ID key
- Session list (id, title, timestamp) stored separately
- Title auto-generated from first user message (truncated)
- "New Session" in sidebar archives current and starts fresh
- On page load, the most recent session is restored

## View Transitions

Next.js experimental `viewTransition` handles route change animations. No additional animation library needed. Tiles that share a `viewTransitionName` across routes will animate between positions (e.g., the chat panel sliding from center to left when entering an article).

## Out of Scope

- **Mobile layout** — deferred to a future iteration
- **Level 2 dynamic tiles** — AI responses influencing tile content (future goal, not in this build)
- **Chat settings/preferences** — no settings UI for now
- **Search** — no search functionality beyond the chat

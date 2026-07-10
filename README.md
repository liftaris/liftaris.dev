# liftaris.dev

Kaio Barbosa-Chifan's portfolio, built with Next.js, React, TypeScript, and TinaCMS.

## Setup

Install dependencies:

```bash
bun install
```

Create `.env` with the Tina credentials required to edit and build content:

```bash
NEXT_PUBLIC_TINA_CLIENT_ID=
TINA_TOKEN=
```

Start the development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
bun test
bun run lint
bunx tsc --noEmit
bun run knip
bun run build
```

# liftaris.dev

Kaio Barbosa's portfolio, built with Astro, React, and EmDash CMS on Cloudflare
Workers. Posts live in D1, uploads in R2, and login sessions in Workers KV.
Publishing and editing posts does not require a build or Git commit.

## Local development

```bash
bun install --frozen-lockfile
bun run dev
```

Open the URL printed by Astro (normally `http://localhost:4321`). The CMS is at
`/_emdash/admin`; `/admin` redirects there. On a fresh local database, use the
**Dev bypass** link printed by EmDash to import the seed content and sign in as a
local development administrator. This bypass is disabled in production.

Cloudflare bindings are emulated locally. No Tina Cloud credentials are used.
A local `.dev.vars` file can hold Worker secrets; it is ignored by Git.

## Homepage gifts

The homepage contains the shared Matter.js clump. Visitors can leave emoji gifts,
optionally attach a public or private message, and take back their own gifts.
Jev suggests emoji while they type. Anonymous animal identities use Better Auth
and localStorage with a 100-year bearer lifetime; clearing storage loses ownership.
Gift additions and withdrawals synchronize through PartySync. Movement and physics
stay local to each visitor, with a fresh arrangement on reload. A remotely deleted
gift stays available while inspected or dragged, then fades away on close or release.

The gift backend uses Effect, a SQLite Durable Object, and a separate visitor D1
database. Set `VISITOR_AUTH_SECRET` and `JEV_API_KEY` in ignored `.dev.vars`, then
run `bun run db:visitor:local`. Set `HOUSE_OWNER_ID` to your EmDash user ID for
private-message access and moderation while signed into the CMS.

See the [gift specification](docs/portfolio-gifts-spec.md) and
[deployment guide](docs/portfolio-deployment.md). GitHub branch previews use the
`previews` bindings in `wrangler.jsonc`. Preview and production share the same
EmDash database and media library; visitor identities, runtime sessions, and House
state remain separate. No second CMS setup or content copy is needed. Production
still needs a real visitor database ID and Worker secrets before deployment; its
checked-in visitor database ID is a local development sentinel.

## Portfolio interaction lab

Open `/lab/clump` on the development server to compare the springy clump,
fixed-anchor structure, and top-down apartment. The physics scenes can switch
between object-sized bodies and small collision pegs with overlapping artwork.
Use **Show bodies** to see the collision shapes.

Drag objects with a mouse or touch. With an object focused, arrows pick up and
move, Q/E rotate, Enter places, and Escape cancels. Arrangements are retained
when switching scenes during the visit; **Start again** resets the current scene.
This experiment has no shared storage or object navigation yet.

The [prototype plan](docs/portfolio-clump-plan.md) and
[library research](docs/physics-library-research.md) record the design direction
and alternatives.

## Checks

```bash
bun test
bun run lint
bun run typecheck
bun run knip
bun run build
```

`bun run start` serves the production build through Wrangler.

## Content and migration

The `posts` collection contains title, date, and rich-text body fields. Its
public URLs remain `/blog/<slug>`, including the existing mixed-case
`Understanding-L-Systems` URL. The Theme Image editor block keeps separate light
and dark image URLs and alternative text.

When editing a published post, **Save** keeps a draft revision. Use **Publish
changes** to make that revision visible on the site.

`content/posts/*.md` is the preserved import archive, not the live CMS. The
conversion script creates `seed/seed.json`, preserving original text, dates,
URLs, nested lists, links, code, and images:

```bash
bun run migrate:posts
```

This command only prepares the import. EmDash initializes the schema on first
request; content is imported by the setup wizard with seed content enabled (or
the local dev bypass). Existing content is not overwritten on redeploy. Do not
use the archive or seed to edit published content: use EmDash.

The existing blog images have been imported into EmDash's media library. Live
posts reference those media records (or their media URLs for the Theme Image
block), and the files are served from the private R2 bucket through EmDash's
media API. New uploads use the same library.

Original files remain under `public/` to preserve existing direct image links
and keep the initial seed portable. The seed is a one-time copy of the original
posts, including their historical references to TinaCMS; it is not the live CMS
or an ongoing backup. Importing the seed alone does not register its static
images in the media library.

## Production setup and deployment

`wrangler.jsonc` contains the production Worker, custom domains, D1, R2, session
KV, and a Cron Trigger for EmDash scheduled publishing and maintenance.

```bash
bunx wrangler login
bun run deploy
```

The first-admin setup flow is protected by the `EMDASH_SETUP_KEY` Worker secret.
Open the private setup link supplied during deployment, then create your admin
account and register your own passkey. The browser receives an hour-long,
HttpOnly setup cookie; the key is removed from the address bar. Once setup is
complete, EmDash's regular authentication applies. Keep the setup key private.
The local `.emdash/` directory is ignored by Git and can hold this handoff link.

To set the secret manually, use `bunx wrangler secret put EMDASH_SETUP_KEY` and
enter a cryptographically random value. Never commit it. The setup URL is
`https://www.liftaris.dev/_emdash/admin/setup?setup_key=YOUR_VALUE`.

The site's original `/work` and `/posts` redirects are configured in Astro.
Both `liftaris.dev` and `www.liftaris.dev` are attached to the production Worker.

## GitHub builds

Connect `liftaris/liftaris.dev` in **Workers & Pages → liftaris-dev → Settings →
Builds → Connect**:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | `bun run build` |
| Deploy command | `bunx wrangler deploy` |
| Bun version | `1.3.13` |

Commit the source, `bun.lock`, seed, generated EmDash types, and Wrangler config.
No Tina build variables or CMS build tokens are needed. `EMDASH_SETUP_KEY` is a
Worker runtime secret, not a build variable. D1/R2/KV persist across deployments;
automatic builds update the application without resetting CMS content.

## Backups

Use Cloudflare D1 backups/Time Travel for the database, and retain R2 media.
EmDash's content export can also be used for a portable backup. The Markdown
archive is only the original migration snapshot; it is not a backup of later
editor changes. Export current content before deliberately replacing the D1
binding or making a destructive schema change.

References: [EmDash](https://github.com/emdash-cms/emdash),
[Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/).

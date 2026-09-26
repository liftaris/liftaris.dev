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
optionally attach a public or private message, and edit or take back their own gifts.
All icons remain visible. Private messages and attribution are visible only to
that gift's sender and the owner; icon-only gifts are public. The signed-in owner
uses their CMS name rather than an anonymous visitor name.
Jev suggests emoji while they type. Visitors receive an automatic native EmDash
account with an animal name, without a signup form. Native HttpOnly session cookies
authorize ownership; names and public gift IDs do not. Losing that session can
lose access to earlier gifts.

Gifts are EmDash content in the existing CMS `DB`. The Effect-backed API uses
ordinary HTTP reads and mutations: no realtime connection, shared physics, or
separate visitor auth database. Movement stays local, with a fresh arrangement
on reload. Set `JEV_API_KEY` in ignored `.dev.vars` for suggestions, and set
`HOUSE_OWNER_ID` to the exact EmDash user ID allowed to administer the CMS, read
private messages, and moderate gifts. After setup, this is required for CMS admin
access; empty configuration fails closed. The signed-in owner's ID is available
at `/_emdash/api/auth/me`. No visitor database migration or auth secret is needed.

See the [gift specification](docs/portfolio-gifts-spec.md) and
[deployment guide](docs/portfolio-deployment.md). GitHub branch previews use the
`previews` bindings in `wrangler.jsonc`. Preview has its own EmDash database,
media bucket, and session KV, separate from production. Its native users, gifts,
and content stay in that environment. Complete a separate owner/passkey setup,
optionally import the repository seed, then configure the preview owner's ID.
Production content and credentials are not copied automatically.

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

`scripts/` is ignored local development tooling, not a checkout requirement.
Builds, lint, typechecking, and default test discovery do not depend on it.

## Content

The `posts` collection contains title, icon, date, and rich-text body fields. Its
public URLs remain `/blog/<slug>`, including the existing mixed-case
`Understanding-L-Systems` URL. The Theme Image editor block keeps separate light
and dark image URLs and alternative text.

When editing a published post, **Save** keeps a draft revision. Use **Publish
changes** to make that revision visible on the site.

`content/posts/*.md` preserves the original posts; `seed/seed.json` supplies their
initial CMS content and schema. Neither is the live CMS. EmDash initializes the
schema on first request; content is imported by the setup wizard with seed
content enabled (or the local dev bypass). Existing content is not overwritten on redeploy. Do not
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
The historical `house-v1` migration and inert `House` export preserve old storage;
the application does not bind or call it. Do not remove the history or add a
class-deletion migration as a cleanup shortcut.

`bun run deploy` targets production, not preview:

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

# The shared house: homepage clump and visitor gifts

Current architecture: native EmDash accounts, CMS-stored gifts, and HTTP-only
interactions. Scene 01, the clump with object-sized collision bodies, remains the
homepage experience. See [deployment setup](portfolio-deployment.md).

## Confirmed experience

The clump is the homepage's central interaction, with viewport gutters and a separate identity row. Portfolio and Writing folders contain objects that open independent windows. There is no header navigation or writing sidebar. The lab's heading, explanatory copy, scene selectors, collider controls, and reset controls do not become homepage UI.

Personal objects remain in the clump. Visitors can leave emoji gifts that join the same pile. Gifts have a distinct color treatment from Kaio's objects; there are no author badges, names, dates, or message captions attached to objects in the resting scene. Permitted attribution and text appear when a gift is opened. Preserve emergent arrangements and the ability to make a mess.

Use the prototype's object-sized footprints rather than small peg colliders. Gifts appear immediately after successful submission, with no approval queue. Every gift remains until its sender or Kaio removes it: no automatic expiry or archival.

Visitors receive real native EmDash accounts automatically, without a signup
form. A returning authenticated browser keeps its anonymous animal name, in the
spirit of Google Docs. A visitor may use a chosen display name for attribution;
names are neither verified identities nor proof of ownership. Anonymous accounts
must not receive CMS editorial or administrative permissions.

A gift consists of one chosen emoji, optional text, an attribution name, and a creation date. The sender chooses whether its message and attribution are public or visible only to Kaio and the sender. Its emoji remains in the public pile in either case. Icon-only gifts are always public. The signed-in owner uses their CMS name; anonymous naming applies to visitors, not Kaio.

Visitors can reclaim gifts they created. Kaio needs an owner-only removal path for unwanted gifts. Visible presence counts, cursors, and sign-in for visitors remain outside this feature's scope. The computer and briefcase open the existing Projects and Experience content in object windows.

## Composer

A dedicated present-box object in the clump is the entrypoint. Like the other objects, it opens a non-modal WinBox window. The homepage has no inline form or permanent introductory copy around the pile. The composer window says:

> Leave your mark on my site.
> Choose an object to leave on the homepage, along with a message, an interesting link, a pun... anything you want!
> Gifts are fun, and anonymous by default.

Inside that window, a static, editable gift-window preview has the same thin blue title bar, paper body, and upper-left corner icon as the real gift. The default object is 🎁. Clicking its icon or Change object opens a catalog/search picker. Search surfaces about five candidates related to the words and their meaning or sentiment, with the existing short debounce. Selecting a candidate fixes the emoji; subsequent edits never replace it. Enter in the search field does not submit a gift, and Escape closes the picker before the outer window.

Object search and message entry are separate. Search text is never saved as a message. Writing in the preview's optional message field explicitly attaches that text; leaving it blank sends only the object. Messages default to public, with a sender-and-Kaio-only option. An editable From line uses the browser's assigned animal name when left blank; choosing a name changes attribution for this gift only.

Keep the audience clear before submission, using concise functional controls. Icon-only actions have accessible names; placeholders are not the inputs' only labels. The submit button sits below the inner preview. Narrow or short screens scroll the window body without horizontal overflow.

Choosing a suggestion does not publish a gift. A deliberate submit sends it. Preserve the draft and idempotency key on failure, and prevent duplicate submission or dismissal while saving. The server returns the exact created gift ID, including on retries; never infer it from the latest item or a collection diff. After authorized detail readback, open the real gift at the preview's bounds, then fade away the outer composer. The real window collapses to the newly created clump object. Reduced-motion users get an immediate handoff. Private text and attribution remain only in authorized open cards, never the public collection. The handoff belongs only to the composer that submitted the gift; later gift edits must not remount its window or close a new composer.

## Jev suggestions

Jev is the TypeSafe AI model the user requested. Two verified examples match the idea: [Emoji Jev](https://github.com/colinmcdermott/emoji-jev) and [Jevmoji](https://github.com/cheeaun/jevmoji). The exact X post has not been identified.

Use TypeSafe's API or typed SDK in a server-side Effect service. Its credentials stay in Worker secrets. A suggestions request contains the draft needed for ranking, not the visitor's ownership secret or attribution. Suggestions do not create gifts or persist drafts.

Jev Choice returns probabilities for a defined set of at most 255 options. Emoji selection therefore uses catalog IDs, with exact/local name matches and a bounded semantic candidate set. A broad Unicode catalog needs category or shortlist selection rather than passing thousands of emoji to one Choice. Benchmark that design against the demos before fixing the catalog size. [Choice documentation](https://docs.typesafe.ai/primitives/choice), [TypeSafe SDKs](https://docs.typesafe.ai/sdk).

Invalidate old results immediately whenever the draft changes, cancel prior requests, and ignore stale responses even during the debounce gap. Provide local keyword matches when Jev is unavailable. Do not replace a visitor's selected emoji in response to an old request. Store and render catalog values rather than arbitrary model-provided HTML or glyph strings.

## Opening and reclaiming a gift

A tap or click opens the gift; dragging rearranges it. A small movement threshold distinguishes the two so releasing a dragged gift does not unexpectedly open a card.

The selected emoji sits at the upper-left corner of a draggable window containing its permitted message, attribution, and date. This is a local viewing interaction: opening a gift does not change shared membership. Hide its resting artwork while the window is open, preserving its local physics body and place in the clump.

The card includes a reclaim action only when the server recognizes the current
native user as the creator. Owner removal is separately authorized. Reclaiming
removes the gift and its associated message through HTTP, then updates the local
view. There is no broadcast to other browsers: their view can remain stale until
another read or reload. Missing-gift responses must be handled without exposing
deleted private text or disrupting an active local interaction.

Use a non-modal WinBox window: the page remains interactive and multiple objects can stay open together. Clicking the corner icon, minimize, ×, and Escape collapse the window back to its source icon; none of these actions reclaims a gift. Return keyboard focus to that icon, or to the composer if the gift has departed. The emoji in the pile has an accessible name identifying it as a gift; visible attribution is confined to the window. No new adjacent author icon is introduced. Color is the requested resting visual distinction; focus and screen-reader semantics still communicate interactivity.

### Object windows

[WinBox](https://github.com/nextapps-de/winbox) owns mouse/touch dragging and window stacking. Customize its template and stylesheet for thin borders, text-height blue title bars, paper bodies, and an oversized corner icon, following the TypeSafe reference and supplied wireframe. Both the title bar and corner icon drag the open window. Clicking or tapping the icon without dragging collapses it; releasing a drag leaves it open. A small movement threshold tolerates click jitter, and Enter/Space still activate the icon's collapse action. The unsent inner gift preview remains static; its icon changes the draft object instead. Keep the existing typefaces; do not introduce a taskbar, maximize control, or another window manager.

`ObjectWindow` mounts React content into WinBox's body and loads the library only in the browser. Titlebar arrows provide keyboard movement. Windows stay within the viewport, with a scrollable body on narrow or short screens; reduced-motion users skip the collapse animation. The computer and briefcase reuse the existing content components. Other personal objects have empty window bodies until their content is defined.

Check window behavior and HTTP gift flows against a disposable local server, not
the shared hosted CMS. Realtime-reconnect checks from the prior architecture are
not acceptance criteria for this version.

## Browser identity and ownership

EmDash's native user repository and Astro/EmDash sessions establish the visitor
identity with an animal name.
Identity is established when needed for the gift interaction, not through a
separate Better Auth database or a signup form. Preserve an existing valid CMS
session instead of replacing it with an anonymous account. Bootstrap must not
bypass first-admin setup or grant the first passive visitor administrative access.

Ownership is the gift's native EmDash author ID, authorized by the current native
session. HttpOnly cookies carry the credential; no bearer token belongs in
localStorage, URLs, rendered attributes, or analytics. A different origin/profile,
cookie expiry, or cleared site data can lose access. Do not promise permanent
ownership, a 100-year lifetime, or cross-device recovery without a supported
native authentication flow.

Cookie-authorized mutations require same-origin/CSRF checks. Gift attribution is
a snapshot: choosing a different display name later does not change ownership or
retroactively identify older gifts. The public gift API remains narrower than the
CMS admin API; an anonymous account must not gain collection-writing privileges
outside the authorized gift commands.

## Public and private data

Public gift data contains its opaque ID, emoji ID, server-created date, and
visibility. Public gifts include their attribution and message. For private
gifts, both `authorName` and `message` are null in public snapshots and unrelated
visitors' detail responses; the icon still contributes to the visible pile.
Private text and attribution never appear in page HTML, hydration data, generic
public CMS responses, search results, or shared caches.

Retrieve private text and attribution through an authorized, non-cacheable endpoint. Both sender
and owner use native EmDash sessions; sender access compares the stored author ID,
and owner access additionally matches the exact configured `HOUSE_OWNER_ID`.
Being another authenticated CMS user is not sufficient. Empty owner configuration
grants nobody owner privileges. This does not introduce signup UI for visitors.

EmDash middleware provides native authentication on public routes. Verify cookie
scope, owner checks, first-admin protection, and generic CMS API exposure. Restrict
editorial access to the gift collection so a secondary CMS account cannot bypass
gift privacy through admin routes. Render visitor names and messages as plain text.

## State, storage, and concurrent visitors

EmDash's `gifts` collection in the existing `DB` is authoritative. Use native
content records and native author IDs, not a parallel custom gift store or a
Durable Object copy. The native `liftaris-gifts` plugin validates commands,
enforces ownership and privacy, and projects only the fields each caller is
allowed to read. Its exact native routes are `snapshot` and `public-gift` (public
GET), `create` (private POST), `update` (private PATCH), and `gift` (private GET or
DELETE). Private routes require EmDash's subscriber-level `content:read`
permission plus gift-specific authorization, not CMS write permissions.

The frontend consumes native response envelopes and sends `X-EmDash-Request: 1`.
An unauthenticated detail read uses the explicitly public, redacted endpoint;
this does not create an account. The Astro `/api/house/me` adapter remains solely
for native session bootstrap/cookie persistence, which plugin contexts cannot
mutate. `/api/house/suggest` remains the bounded suggestion adapter. Retired gift
Astro endpoints have no aliases.

Core repositories retain content persistence, deterministic gift IDs, author
linkage and trash. The deletion-resistant submission receipt/trigger and the
single-statement version/ownership/lifecycle edit fence remain deliberate bridge
code. EmDash 0.40.1 supports native revision staging and publishing, but combining
those into immediate gift edits requires a separately verified failure/retry
migration. A read-check followed by `ctx.content.update` is not a safe replacement
on D1. This transport refactor does not enable drafts, rewrite existing gift
records, or equate private audience with unpublished content.

Original portfolio objects and visitor gifts have distinct kinds, so reclaiming
cannot delete a built-in object. Preserve atomic create/delete semantics and safe
duplicate-submit behavior without introducing another identity service or a
realtime replication system. Deleted private text must not survive in public
responses or retry payloads.

All visitors can rearrange their own local clump. The database stores shared gift
membership, not poses. Fetch the collection through ordinary HTTP and refresh the
current browser after its successful mutations. Serialize create/edit/revoke and
their snapshot application per scene so delayed responses cannot restore removed
gifts. Edits carry the detail record's version; storage applies them atomically
only if that version still matches. A 409 preserves the draft and requires an
explicit latest-record reload before editing again. Other browsers see changes on a
subsequent read or reload, not a push. No WebSockets, SSE, polling loop, presence
counts, cursors, placement commands, or shared physics are needed.

Each local scene follows the measured viewport and grows with the pile; overflow remains inside its scrollable viewport. Resizing remaps existing poses. Membership reconciliation preserves unaffected bodies and active grabs, and deleting gifts does not shrink the expanded stage. Reloading starts a fresh local arrangement.

The inert `House` export and applied deployment history preserve existing
infrastructure; neither serves gift requests.

## Effect and Alchemy boundary

Effect owns command validation, authorization, TypeSafe calls, storage services, concurrency errors, and retry/cancellation boundaries. Matter retains its imperative numerical loop and transform rendering.

Wrangler describes the active Worker, `DB` / `MEDIA` / `SESSION`, setup and Jev
secrets, and owner ID. Hosted preview uses separate D1, R2, and session KV from
production. Preview CMS users, gifts, content, and media never write into production.
Its owner/passkey setup and `HOUSE_OWNER_ID` are environment-specific; do not clone
production credentials or automatically copy content. Preserve EmDash's request
and scheduled handlers, custom domains, media access, and image plugin. Only
production runs the publishing cron.

The Alchemy stack still consumes the prebuilt Worker and references CMS/media
without managing their lifecycle. Its temporary unbound `Visitors` declaration
and inert `HOUSE` binding are preservation holds, not app dependencies. Removing
them can delete remote storage; see the [deployment guide](portfolio-deployment.md).
Do not plan/deploy this stack as a build check.

## Confirmed product decisions

| Choice | Decision |
| --- | --- |
| Scene and collision | Scene 01, the clump; object-sized bodies |
| Text inclusion | Blank message leaves only the default present; optional message entry is separate from object search |
| Message and attribution audience | Public by default; sender can choose Kaio and sender only; icons always visible, icon-only gifts public |
| Publishing | Immediate; Kaio can remove unwanted gifts |
| Retention | Keep every gift until its sender or Kaio removes it |
| Shared membership | CMS-backed HTTP snapshots; no realtime sync; movement and physics stay local |

Retaining all gifts means crowding is a layout and performance constraint, not permission to hide or expire older gifts. Prototype growth with larger piles and choose a spatial treatment that preserves access to every gift. Any later capacity limit or archival policy is a separate product decision.

## Verification requirements

- Native anonymous user/session creation, cookie security, restoration across
  reloads, existing CMS session preservation, and protected first-admin setup.
- Real CMS gift persistence and author linkage, private/public projection, exact
  owner authorization, CSRF rejection, and denial of other users' reclaim/detail
  requests, including direct generic CMS API attempts.
- Safe submit/retry and delete behavior, atomic stale-edit rejection, ordered
  mutation snapshots, stable gift windows and source-scoped composer handoff;
  no deleted private text in responses, independent local arrangements, and
  HTTP-only network traffic.
- Debounced Jev suggestions with local fallback, cancellation and stale-result
  protection; credentials and drafts must not leak into public records.
- Desktop/mobile layout, click-versus-drag, keyboard completion, window focus and
  stacking, reduced motion, and no new horizontal overflow.
- Existing CMS pages, media, request/scheduled handlers, and static preview-config
  checks. Passing old Better Auth/socket tests is not evidence for this version.

Prefer disposable local storage for behavioral checks. Preview is isolated from
production, but hosted checks must still respect its users and content. Verify
its deployed binding IDs before any preview mutation. Legacy migration must verify
actual source/import counts and ownership mappings; retaining resources alone is
not migration verification.

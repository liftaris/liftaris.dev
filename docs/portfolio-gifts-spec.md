# The shared house: homepage clump and visitor gifts

Current architecture: native EmDash accounts, CMS-stored gifts, and HTTP-only
interactions. Scene 01, the clump with object-sized collision bodies, remains the
homepage experience. See [deployment setup](portfolio-deployment.md) and the
[legacy-data cutover gate](legacy-gift-retirement.md). This branch does not deploy
itself or automatically migrate old identities, ownership, or House gifts.

## Confirmed experience

The clump becomes the central interaction in the existing homepage's empty blue desktop space. Keep the current identity, navigation, writing rail, and overall visual character. The lab's heading, explanatory copy, scene selectors, collider controls, frame, and reset controls do not become homepage UI.

Personal objects remain in the clump. Visitors can leave emoji gifts that join the same pile. Gifts have a distinct color treatment from Kaio's objects; there are no author badges, names, dates, or message captions attached to objects in the resting scene. Attribution and text appear when a gift is opened. Preserve emergent arrangements and the ability to make a mess.

Use the prototype's object-sized footprints rather than small peg colliders. Gifts appear immediately after successful submission, with no approval queue. Every gift remains until its sender or Kaio removes it: no automatic expiry or archival.

Visitors receive real native EmDash accounts automatically, without a signup
form. A returning authenticated browser keeps its anonymous animal name, in the
spirit of Google Docs. A visitor may use a chosen display name for attribution;
names are neither verified identities nor proof of ownership. Anonymous accounts
must not receive CMS editorial or administrative permissions.

A gift consists of one chosen emoji, optional text, an attribution name, and a creation date. The sender chooses whether included text is public or visible only to Kaio and the sender. The emoji remains in the public pile in either case.

Visitors can reclaim gifts they created. Kaio needs an owner-only removal path for unwanted gifts. Visible presence counts, cursors, and sign-in for visitors remain outside this feature's scope. The computer and briefcase open the existing Projects and Experience content in object windows.

## Composer

A dedicated present-box object in the clump is the entrypoint. Like the other objects, it opens a non-modal WinBox window. The homepage has no inline form or permanent introductory copy around the pile. The composer window says:

> Leave your mark on my site.
> Choose an object to leave on the homepage, along with a message, an interesting link, a pun... anything you want!
> Gifts are fun, and anonymous by default.

Inside that window, a static, editable gift-window preview has the same thin blue title bar, paper body, and upper-left corner icon as the real gift. The default object is 🎁. Clicking its icon or Change object opens a catalog/search picker. Search surfaces about five candidates related to the words and their meaning or sentiment, with the existing short debounce. Selecting a candidate fixes the emoji; subsequent edits never replace it. Enter in the search field does not submit a gift, and Escape closes the picker before the outer window.

Object search and message entry are separate. Search text is never saved as a message. Writing in the preview's optional message field explicitly attaches that text; leaving it blank sends only the object. Messages default to public, with a sender-and-Kaio-only option. An editable From line uses the browser's assigned animal name when left blank; choosing a name changes attribution for this gift only.

Keep the audience clear before submission, using concise functional controls. Icon-only actions have accessible names; placeholders are not the inputs' only labels. The submit button sits below the inner preview. Narrow or short screens scroll the window body without horizontal overflow.

Choosing a suggestion does not publish a gift. A deliberate submit sends it. Preserve the draft and idempotency key on failure, and prevent duplicate submission or dismissal while saving. The server returns the exact created gift ID, including on retries; never infer it from the latest item or a collection diff. After authorized detail readback, open the real gift at the preview's bounds, then fade away the outer composer. The real window collapses to the newly created clump object. Reduced-motion users get an immediate handoff. Private text remains only in the sender's local open card, never the public collection.

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

### Legacy identity cutoff

Old Better Auth users and House gifts remain in their original storage until a
separate migration is approved and verified. Native cookies do not recover old
localStorage bearer ownership. A credential-verified identity bridge or an
explicitly approved legacy-auth cutoff is required before claiming continuity.
Names and submitted old IDs cannot serve as the bridge. See the retirement notes;
this refactor provides neither an importer nor permission to delete old data.

## Public and private data

Public gift data contains its opaque ID, emoji ID, displayed author name,
server-created date, and public text when applicable. Private text never appears
in page HTML, hydration data, public snapshots, generic public CMS responses,
search results, or shared caches.

Retrieve private text through an authorized, non-cacheable endpoint. Both sender
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
Durable Object copy. The HTTP service validates commands, enforces ownership and
privacy, and projects only the fields each caller is allowed to read.

Original portfolio objects and visitor gifts have distinct kinds, so reclaiming
cannot delete a built-in object. Preserve atomic create/delete semantics and safe
duplicate-submit behavior without introducing another identity service or a
realtime replication system. Deleted private text must not survive in public
responses or retry payloads.

All visitors can rearrange their own local clump. The database stores shared gift
membership, not poses. Fetch the collection through ordinary HTTP and refresh the
current browser after its successful mutations. Other browsers see changes on a
subsequent read or reload, not a push. No WebSockets, SSE, polling loop, presence
counts, cursors, placement commands, or shared physics are needed.

Each local scene starts at 500 × 600 and grows with the pile; a scrollable viewport preserves access to gifts as it grows. Membership reconciliation adds/removes only the affected bodies, without rewriting existing transforms, scaling the arrangement, shrinking the stage, or canceling an active grab. Reloading starts a fresh local arrangement.

PartySync, PartyServer, PartySocket, and the active House service are retired.
Keep only the inert class export and deployment history needed to retain legacy
storage pending migration. Do not build a notification relay as a replacement.

## Effect and Alchemy boundary

Effect owns command validation, authorization, TypeSafe calls, storage services, concurrency errors, and retry/cancellation boundaries. Matter retains its imperative numerical loop and transform rendering.

Wrangler describes the active Worker, `DB` / `MEDIA` / `SESSION`, setup and Jev
secrets, and owner ID. Hosted previews share production CMS users, gifts, content,
and media; only their session KV binding stays environment-specific. Do not run a
second setup or use preview for destructive tests. Preserve EmDash's request and
scheduled handlers, custom domains, media access, and image plugin. Only production
runs the publishing cron.

The Alchemy stack still consumes the prebuilt Worker and references CMS/media
without managing their lifecycle. Its temporary unbound `Visitors` declaration
and inert `HOUSE` binding are preservation holds, not app dependencies. Removing
them without the [staged retirement](legacy-gift-retirement.md) can destroy legacy
data. Do not plan/deploy this transitional stack as a build check.

## Confirmed product decisions

| Choice | Decision |
| --- | --- |
| Scene and collision | Scene 01, the clump; object-sized bodies |
| Text inclusion | Blank message leaves only the default present; optional message entry is separate from object search |
| Included-message audience | Public by default; sender can choose Kaio and sender only |
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
- Safe submit/retry and delete behavior, no deleted private text in responses,
  independent local arrangements, and HTTP-only network traffic.
- Debounced Jev suggestions with local fallback, cancellation and stale-result
  protection; credentials and drafts must not leak into public records.
- Desktop/mobile layout, click-versus-drag, keyboard completion, window focus and
  stacking, reduced motion, and no new horizontal overflow.
- Existing CMS pages, media, request/scheduled handlers, and static preview-config
  checks. Passing old Better Auth/socket tests is not evidence for this version.

Exercise mutations only on disposable local storage. Hosted checks require
separate approval because preview shares the live CMS. Legacy migration must
verify actual source/import counts and ownership mappings; retaining resources
alone is not migration verification.

# The shared house: homepage clump and visitor gifts

Implementation specification, September 24, 2026. Scene 01, the clump, with object-sized collision bodies is integrated into the homepage. The gift UI, Better Auth anonymous visitors, Effect services, SQLite House Durable Object, Jev suggestions, and Alchemy preview stack are implemented. See [deployment setup](portfolio-deployment.md) for hosted bindings, secrets, and local verification commands.

## Confirmed experience

The clump becomes the central interaction in the existing homepage's empty blue desktop space. Keep the current identity, navigation, writing rail, and overall visual character. The lab's heading, explanatory copy, scene selectors, collider controls, frame, and reset controls do not become homepage UI.

Personal objects remain in the clump. Visitors can leave emoji gifts that join the same pile. Gifts have a distinct color treatment from Kaio's objects; there are no author badges, names, dates, or message captions attached to objects in the resting scene. Attribution and text appear when a gift is opened. Preserve emergent arrangements and the ability to make a mess.

Use the prototype's object-sized footprints rather than small peg colliders. Gifts appear immediately after successful submission, with no approval queue. Every gift remains until its sender or Kaio removes it: no automatic expiry or archival.

Visitors are not accounts. A returning browser gets a stable anonymous animal name by default, in the spirit of Google Docs. A visitor may use a chosen display name instead. Those names are attribution, not verified identities.

A gift consists of one chosen emoji, optional text, an attribution name, and a creation date. The sender chooses whether included text is public or visible only to Kaio and the sender. The emoji remains in the public pile in either case.

Visitors can reclaim gifts they created. Kaio needs an owner-only removal path for unwanted gifts. Visible presence counts, cursors, sign-in for visitors, and navigation through Kaio's original objects are outside this feature's first scope.

## Composer

A compact text input belongs near the clump. It opens the gift interaction without adding a new hero, section heading, onboarding paragraph, or permanent instructions around the pile. On narrow screens, it stays reachable above the virtual keyboard and remains clear of the existing site content.

Typing surfaces about five emoji candidates related to the words and their meaning or sentiment. Use a short debounce, initially approximately 250 ms. Selecting a candidate fixes the emoji; subsequent edits do not silently replace that selection.

Text finds an emoji by default; it is not automatically saved as a message. A separate inclusion choice makes it possible to type “popcorn,” choose 🍿, and leave only the emoji. Another visitor can choose 🍿 and deliberately attach “For the next movie night.” Included messages default to public. The sender can instead choose visibility limited to Kaio and the sender.

Progressively reveal only the controls needed to finish the gift: message inclusion, visibility when there is a message, and anonymous animal name or chosen name. Keep the audience clear before submission, using concise functional controls. Icon-only actions still have accessible names; a placeholder is not the input's only label.

Choosing a suggestion does not publish a gift. A deliberate placement action submits it. Preserve the draft on failure, prevent duplicate submissions, and insert the confirmed gift into the clump with a short settle animation. Reduced-motion users get a static placement or crossfade.

## Jev suggestions

Jev is the TypeSafe AI model the user requested. Two verified examples match the idea: [Emoji Jev](https://github.com/colinmcdermott/emoji-jev) and [Jevmoji](https://github.com/cheeaun/jevmoji). The exact X post has not been identified.

Use TypeSafe's API or typed SDK in a server-side Effect service. Its credentials stay in Worker secrets. A suggestions request contains the draft needed for ranking, not the visitor's ownership secret or attribution. Suggestions do not create gifts or persist drafts.

Jev Choice returns probabilities for a defined set of at most 255 options. Emoji selection therefore uses catalog IDs, with exact/local name matches and a bounded semantic candidate set. A broad Unicode catalog needs category or shortlist selection rather than passing thousands of emoji to one Choice. Benchmark that design against the demos before fixing the catalog size. [Choice documentation](https://docs.typesafe.ai/primitives/choice), [TypeSafe SDKs](https://docs.typesafe.ai/sdk).

Invalidate old results immediately whenever the draft changes, cancel prior requests, and ignore stale responses even during the debounce gap. Provide local keyword matches when Jev is unavailable. Do not replace a visitor's selected emoji in response to an old request. Store and render catalog values rather than arbitrary model-provided HTML or glyph strings.

## Opening and reclaiming a gift

A tap or click opens the gift; dragging rearranges it. A small movement threshold distinguishes the two so releasing a dragged gift does not unexpectedly open a card.

The selected emoji appears enlarged at the center of the screen above the homepage, associated with a compact card containing its permitted message, attribution, and date. This is a local viewing interaction: opening a gift must not move it in the shared house for everyone else. Keep its place reserved in the clump while a visual copy transitions into the overlay.

The card includes a reclaim action only when the server recognizes the current browser as the creator. Owner removal is separately authorized. Reclaiming removes the gift and its associated message and broadcasts the public removal. If another device removes a gift while its card is open, retain the already loaded card and local object until that visitor closes it, then fade and remove the object. A dragged gift is likewise retained until release. Server deletion is immediate; deleted private text is not fetched again or added to public caches.

Use a native modal dialog or equivalent focus trapping, background inertness, Escape dismissal, and focus restoration. The emoji in the pile has an accessible name identifying it as a gift; visible attribution is confined to the card. No new adjacent author icon is introduced. Color is the requested resting visual distinction; focus and screen-reader semantics still communicate interactivity.

## Browser identity and ownership

Better Auth's anonymous plugin creates the visitor and generates an animal name. The bearer session token is saved in localStorage. Public gift IDs and animal names do not grant ownership. Returning visits and other tabs on the same origin reuse the browser identity; Web Locks serialize initialization across supported browsers. Identity is created when the visitor first engages with the composer or places an object, rather than registering every passive page view.

Ownership is scoped to the browser profile and site origin, not the physical device. A different browser, private session, or cleared storage creates a new visitor. No cross-device recovery or sign-in is implied. If storage is unavailable, do not quietly claim that the gift will remain reclaimable on a future visit.

The bearer credential authorizes creation, reclaiming, and access to the sender's private messages. It travels in an Authorization header, never a URL, rendered attribute, public payload, or analytics event. Gift attribution is a snapshot, so choosing a name for a later gift does not retroactively identify older anonymous gifts. Visitor routes strip incoming and outgoing cookies; clearing localStorage does not silently restore visitor identity from a cookie. EmDash owner cookies are handled separately.

### Anonymous identity library research

**Better Auth is the closest library fit.** Its [Anonymous plugin](https://better-auth.com/docs/plugins/anonymous) creates an identity and session without asking visitors for an email, password, or OAuth sign-in. Its `generateName` hook can produce animal aliases. Internally it creates a user record and a generated placeholder email; the public experience remains a visitor with no account UI. It is [MIT licensed](https://github.com/better-auth/better-auth), has [official Astro integration](https://better-auth.com/docs/integrations/astro), and [native D1 support](https://better-auth.com/blog/1-5#cloudflare-d1-support).

The [Bearer plugin](https://better-auth.com/docs/plugins/bearer) supports localStorage tokens and Authorization headers, matching the user's storage preference. Conventional HttpOnly cookie sessions are the simpler default library integration and keep the credential inaccessible to page JavaScript; choosing them would be a deliberate change from the user's localStorage preference. Neither storage method provides recovery after the only credential is removed.

The user accepted losing ownership when browser storage is cleared and requested no practical expiry. Better Auth requires a finite date: stored bearer sessions last 100 years, renewed near expiry through supported database hooks. Its temporary cookie serializer limits Max-Age to 400 days; that internal cookie uses the shorter lifetime and is discarded by the visitor route. Regression tests cover the stored 100-year lifetime and renewal. No recovery code, sign-in flow, or account upgrade UI is included.

Better Auth handles visitor identities/sessions in the separate `VISITOR_DB` D1 database; the House Durable Object stores gifts. Object positions and physics remain local to each page. Visitor routes and identity resolution remain separate from EmDash's owner authentication and do not overwrite the CMS's `locals.user`. Effect resolves the authenticated visitor and configured CMS owner for each protected command.

[Supabase anonymous auth](https://supabase.com/docs/guides/auth/auth-anonymous) and [Firebase anonymous auth](https://firebase.google.com/docs/auth/web/anonymous-auth) were also considered. Better Auth keeps the implementation on Cloudflare.

## Public and private data

Public gift data contains its opaque ID, emoji ID, displayed author name, server-created date, and public text when applicable. Private text never appears in the page HTML, hydration data, public snapshots, WebSocket events, or a shared cache.

Retrieve private text through an authorized, non-cacheable endpoint. The sender proves ownership with the chosen visitor credential; Kaio uses the existing EmDash session plus an explicit configured owner identity. Being another authenticated CMS user is not sufficient. This does not introduce sign-in for portfolio visitors.

The installed EmDash middleware performs soft authentication on public routes, providing an integration point for the owner view. Verify cookie scope, owner checks, and API behavior during implementation. Cookie-authorized owner mutations retain origin/CSRF protection. Render visitor names and messages as plain text.

## State, storage, and concurrent visitors

One `House` Durable Object coordinates this portfolio's shared scene and stores its authoritative records in its own SQLite-backed storage. Keep EmDash's existing D1 database for CMS content. D1 and Durable Object SQLite are separate storage choices; the gift feature does not need duplicate writes to both. [Cloudflare storage comparison](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/#sql-in-durable-objects-vs-d1).

Records include gifts, optional messages, a monotonic collection revision, rate limits, and creation receipts. Identity credentials live in separate visitor auth storage. Original portfolio objects and visitor gifts have distinct kinds, so a reclaim command cannot delete a built-in object. Gift creation and deletion are transactional. Creation receipts retain a payload hash after withdrawal so retrying a lost response cannot resurrect a removed gift or retain its deleted message.

All visitors can rearrange their own local clump. Only collection membership is shared: new gifts and withdrawals eventually propagate to other visitors. There are no placement commands, shared poses, movement conflicts, live multiplayer physics, presence counts, or cursors.

Each local scene starts at 500 × 600 and grows with the pile; a scrollable viewport preserves access to gifts as it grows. Membership reconciliation adds/removes only the affected bodies, without rewriting existing transforms, scaling the arrangement, shrinking the stage, or canceling an active grab. Reloading starts a fresh local arrangement.

Pinned experimental `partysync@2.1.0` runs over PartyServer hibernation WebSockets and PartySocket. The server emits one permanent collection record containing the public gift snapshot, assembled from individual SQL rows in JavaScript rather than a size-limited SQLite aggregate. Replacing this whole row also replaces collection membership, so missed deletions do not survive PartySync’s incremental record merge. Reconnect requests the authoritative collection; returning to the foreground starts a fresh connection even if the old socket appears open, and clients ignore older revisions. WebSocket clients can only request this channel, never execute actions, submit updates, or query private tables. Creation and reclaiming remain authenticated HTTP commands. Send private message bodies through their separate authorized endpoint, not the shared room broadcast. [Cloudflare WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

## Effect and Alchemy boundary

Effect owns command validation, authorization, TypeSafe calls, storage services, concurrency errors, and retry/cancellation boundaries. Matter retains its imperative numerical loop and transform rendering.

Alchemy describes the House Durable Object, Worker integration, bindings, migrations, and secrets. Hosted previews share production's EmDash CMS database and media library, while visitor, session, and House state remain separate. Do not clone or adopt the shared CMS resources, run another first-admin setup, or use preview CMS access for destructive testing. Preserve the EmDash request handler, scheduled publishing handler, DB/MEDIA/SESSION bindings, media access, custom domains, and image plugin. Only production runs the CMS publishing cron. The current Alchemy Astro integration supplies its own adapter, so adopting it requires deliberate integration rather than adding a second adapter. [Alchemy Astro integration](https://alchemy.run/cloudflare/frontend/astro/).

Pinned dependencies are Effect 4.0.0-rc.117, Alchemy 2.0.0-beta.79, Better Auth 1.7.5, and TypeSafe SDK 0.6.0. The Alchemy stack consumes the current adapter's prebuilt Worker, preserving EmDash's request and scheduled handlers without changing production CMS ownership.

## Confirmed product decisions

| Choice | Decision |
| --- | --- |
| Scene and collision | Scene 01, the clump; object-sized bodies |
| Text inclusion | Emoji only by default; explicitly include a message |
| Included-message audience | Public by default; sender can choose Kaio and sender only |
| Publishing | Immediate; Kaio can remove unwanted gifts |
| Retention | Keep every gift until its sender or Kaio removes it |
| Shared membership | Additions and deletions sync; movement and physics stay local |

Retaining all gifts means crowding is a layout and performance constraint, not permission to hide or expire older gifts. Prototype growth with larger piles and choose a spatial treatment that preserves access to every gift. Any later capacity limit or archival policy is a separate product decision.

## Implementation sequence and verification

1. Integrate the selected clump into the existing blue homepage, with site-scoped styles and the minimal composer/card flow. Keep the lab available for tuning. Parameterize the engine's object collection so gifts can be added and removed without rebuilding the whole scene.
2. Add Effect schemas and services for browser identity, public gift data, private message access, creation, and reclaiming. Establish migrations and a working local Durable Object boundary.
3. Integrate debounced Jev suggestions behind a server endpoint with local fallback and stale-result protection.
4. Synchronize public collection membership, refresh on reconnect, and preserve active inspection/dragging through deletion. Keep movement local.
5. Verify desktop/mobile layout, click-versus-drag, keyboard completion of the entire flow, modal focus, reduced motion, and the existing color-sprite fix. Check actual private/public payloads and cross-visitor permissions, not just hidden UI controls.

Required cases include duplicate-submit retries, independent local arrangements, gift withdrawal while another visitor reads it, identity persistence across reloads/tabs, stale suggestion responses, disconnected reconnection, and attempts to reclaim another browser's gift or read its private message. Validate the existing CMS and scheduled handler after any deployment integration change.

## Initial implementation verification (before collection-only sync)

The 47-test suite passes, including real Better Auth session creation/restoration/renewal against the checked-in SQLite schema, exact CMS owner identity matching, privacy, reclaim authorization, transactional rollback, idempotency, revision conflicts, and dynamic gift physics.

Live local API checks used two anonymous visitors and the actual Durable Object. They verified the stored 100-year lifetime, cookie-free visitor responses, private detail access, public snapshot/socket redaction, unauthorized removal rejection, duplicate creation, withdrawal retry, placement conflicts, and Jev suggestions using the supplied key.

Chromium checks covered desktop/mobile creation, public/private cards, reclaiming, modal focus, reduced motion, keyboard placement, real touch dragging, and another browser receiving the accepted pose. Responsive and short-window checks found no horizontal overflow or covered composer. Authoritative placements interpolate for 360 ms; grabbing during interpolation starts from the visible pose. Reduced motion skips that interpolation. The dialog artwork moves independently of its scrollable message body.

Owner policy and owner operations pass isolated tests. A full signed-in EmDash owner browser check was not performed: automatic approval review rejected obtaining a local CMS session cookie for that test. The local `HOUSE_OWNER_ID` was subsequently configured from the existing local CMS administrator record using a read-only ID lookup, without obtaining a session cookie. Hosted environments need their own exact administrator ID. This test limitation does not affect visitor creation, private access to their own messages, or reclaiming.

The compiled production Worker also passed the two-visitor integration checks under local Wrangler. Its local upstream must be explicit when testing with production custom-domain routes, otherwise Wrangler can forward a canonical-host redirect. Tests used `--local-upstream 127.0.0.1:8787 --upstream-protocol http`, and rejected redirects.

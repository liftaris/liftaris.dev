# Portfolio: a house made of things

Research and working plan, updated September 24, 2026, incorporating the interaction questions and answers. The first `/lab/clump` prototype is implemented and verified locally. This document records its behavior, acceptance criteria, and the longer-term direction.

**Selected direction:** scene 01, the clump, with object-sized collision bodies will occupy the existing homepage's empty blue space. The [homepage and visitor gifts specification](portfolio-gifts-spec.md) records the next phase, including anonymous attribution, optional public/private messages, reclaiming gifts, and shared final placements after release. The other scenes remain lab experiments.

## Creative brief

A personal collection becomes the portfolio's interface: an octopus, computer, walking shoes, globe, plants, clouds, bicycle, and climbing shoes. Expressiveness comes from the objects, composition, and response to visitors. The eventual artwork uses a restrained palette, line drawings, and consistent monochrome marks.

The first direction is a roughly tall, close, nested clump like the line-drawing sketch. The second uses fixed objects to establish an abstract structure, with loose objects arranged around them. The third is an apartment scene: a one-bedroom, one-bathroom home with objects strewn around a stable spatial layout. The second reference image explores an object opening into a content view while other objects move to the perimeter. Neither drawing locks in an implementation.

Ordinary Voronoi construction takes points as input. The useful mechanism for this prototype is attraction and local collision response between bodies, with positions kept separate from the drawings attached to them. The former Voronoi scene is replaced by the fixed-structure hybrid; there is no Voronoi or D3 runtime dependency.

The complete concept has three layers:

- **Things:** personal objects visitors can rearrange, with gifts and borrowing later.
- **Anchors:** a few fixed objects provide structure and eventually open portfolio sections; a briefcase can open experience and a light switch can change the theme.
- **Traces of visitors:** arrangements and messages persist, with anonymous or attributed contributions.

The first experiment isolates the feel of moving the things. Navigation, expanding content, shared persistence, gifts, borrowing, and messages follow after choosing a layout behavior. During a prototype session, arrangements must survive settling; reset is an explicit action.

**Emergence is a requirement in all three directions.** Visitors can organize, make patterns, rotate objects, create piles, or make a mess. Automatic motion must not erase every intentional arrangement. The clump variants return stray objects to the group and preserve their new neighborhood; the apartment variant leaves objects where they are dropped with no central attraction.

## Current prototype: one object lab, three scenes

An isolated `/lab/clump` page in the existing Astro application hosts a small React island. Its minimal page shell keeps the experiment independent of the current portfolio layout's CMS queries.

All scenes share the same renderer, object definitions, dimensions, and input conventions. Each physics scene/collision-model pair has an in-memory arrangement, including rotation; the apartment has one independent arrangement. Switching away and back restores that arrangement during the mounted page session. Reloading starts fresh: this is not durable or shared persistence. Reset restores deterministic starting poses for the current combination. The apartment has its own floorplan and starting positions; it is not a sortable-grid control.

The fixture has ten varied-size emoji objects: 🐙 🖥️ 👟 🌍 🪴 ☁️ 🚲 🥾 💡 💼. The boot temporarily stands in for climbing-shoe artwork. The plant, computer, and light are fixed only in the structure scene. The briefcase remains an inert movable object, with no navigation. Emoji appearance is provisional; grayscale is the default, with an optional color toggle.

The stage targets approximately one third of viewport width and height, with a **360 × 330 px** starting minimum. Width fits the available space on narrow phones; the surrounding page can scroll on short screens. These dimensions can change through use.

The stage is an interaction region built from focusable HTML objects positioned with transforms. SVG draws the optional collider overlay and the apartment floorplan. Later SVG artwork can replace the emoji without changing the scene-engine boundary.

| Scene | Current implementation | Distinct behavior to evaluate |
| --- | --- | --- |
| The clump | Matter.js bodies, gentle attraction outside a tall resting region, damping, and bounds | Objects rotate and tumble, neighbors yield, and released strays find a new spot in the tall group. There is no assigned home or restoring force inside the resting region. |
| A little structure | Fixed plant, computer, and light, with Matter.js loose bodies attracted toward the nearest fixed object's neighborhood | The fixed objects establish an abstract shape. Visitors arrange the other objects around them; each neighborhood leaves room for arrangements to survive settling. |
| The apartment | A top-down SVG floorplan and direct placement, without simulation stepping | Pick up an object and drop it somewhere else. Its position and angle stay there; no attraction, drift, collision response, or automatic slot reordering. |

Both physics scenes offer **Their shape** and **A small peg** collision models. The shape model approximates artwork-sized footprints using circles or rounded rectangles; it does not trace emoji silhouettes. In the peg model, a smaller solid body carries a larger illustration, which can overlap neighboring illustrations like a poster pinned to a peg. The peg's angular inertia is tuned for the larger artwork. Show bodies exposes the distinction. Collision controls are disabled for the apartment.

Controls include the three scene buttons, collision-model radios, Show bodies, A little color, and Start again. Mouse and touch use pointer capture. Keyboard arrows move, Q/E rotate, Enter places, and Escape cancels; Shift increases movement steps. The display supplies movement hints, visible focus, and status announcements. Navigation and click-to-expand behavior are outside this prototype.

## Libraries and implementation reasoning

**Matter.js is the only new runtime library for the lab**, with its TypeScript types added for development. The confirmed desire for free rotation and tumbling makes rigid bodies useful for the physics scenes. The engine uses zero downward gravity, local contact response, damping, and a grab constraint attached at the picked point so off-center grabs can turn objects. The view owns the fixed-step animation clock, input, and rendering; the numerical engine does not own DOM events. [Matter bodies](https://brm.io/matter-js/docs/classes/Body.html), [constraints](https://brm.io/matter-js/docs/classes/Constraint.html).

**Fixed structure replaces the geometric experiment.** The plant, computer, and light establish the authored composition; loose objects respond to nearby bodies and return toward an anchor's neighborhood when pulled away. The force-free area around each anchor is deliberate: the simulation should keep a coherent house without continuously tidying it. This is the main new concept to compare with the wholly movable clump.

**Compare footprint size independently of the scene.** The same Matter implementation supports both artwork-sized bodies and small pegs. Large artwork may intentionally overlap in peg mode; that is a design variable, not a collision bug. These simplified footprints cannot prove the final interlocking quality of bicycle and plant drawings. A later artwork pass can introduce compound footprints if silhouette-aware collisions are desirable. No weighted Voronoi layer is planned.

**Apartment: structure belongs to the home; placement belongs to the visitor.** The top-down one-bedroom, one-bathroom floorplan has mostly empty room outlines and scattered objects. Direct dragging preserves the picked-point offset and stops at the dropped position and angle, within the outer stage bounds. Q/E provides rotation. Room outlines are visual structure; objects can be carried between rooms or placed over outlines. Wall collision simulation is not part of this first pass.

The physics implementation uses a regular grab constraint, a force-free resting region, sleeping, and a quiet-motion threshold to stop work after settling. The animation clock restarts on input or resize. Rotation-aware outer bounds contain the visible artwork, including its overhang beyond a small peg. Reduced-motion preferences increase damping and remove decorative transitions. [Constraint source](https://github.com/liabru/matter-js/blob/master/src/constraint/Constraint.js), [sleeping source](https://github.com/liabru/matter-js/blob/master/src/core/Sleeping.js).

**Alternative library research:** D3 force was the initial point-layout hypothesis; free rotation led to Matter, and the later clarification replaced the Voronoi scene with fixed structure and local forces. The [physics and interaction research](physics-library-research.md) covers Rapier, Planck, Verlet.js, Moveable/Selecto, Excalidraw, and Rough.js, including primary sources and licenses. Matter remains the current engine; no paid SDK is introduced. Current tldraw production use requires a license key and its discretionary hobby terms are not assumed to cover this portfolio. [Official tldraw key requirements](https://tldraw.dev/sdk-features/license-key).

The three scenes and the two physics collision models are implemented on the shared renderer/input contract. Choose through interaction before adding another engine or expanding the visual scope.

## Confirmed interaction direction

- Released objects are pulled back toward the clump.
- Dragging primarily displaces nearby objects.
- Objects fit close together and nest like the line-drawing sketch.
- The resting composition is roughly tall.
- Returning objects find a new spot; the arrangement changes rather than restoring original homes.
- Objects can freely rotate and tumble.
- The fixed-structure scene keeps the plant, computer, and light preplaced while other objects gather around them.
- Artwork-sized footprints and smaller peg colliders are both worth trying; the latter intentionally allow artwork overlap.
- The apartment mode is an exception to attraction: objects stay where dropped.
- The apartment is viewed from above, with mostly empty room outlines and scattered objects.
- All three modes support emergent arrangements and messes that survive settling.

The outer stage stays rectangular in all scenes. The clump uses an elongated resting region with no restoring force inside it; the structure scene uses neighborhoods around its fixed objects. The apartment uses its floorplan instead. Local motion should dominate; reserve wholesale rearrangement for a later navigation transition.

Remaining tuning decisions belong in the prototypes: the size of the accepted clump and anchor neighborhoods, how strongly strays return, damping, peg size, artwork overlap, and the smallest comfortable gap. The house should not keep tidying itself after the visitor stops interacting.

## Prototype acceptance criteria

- An object does not jump when picked up. A physical grab stays close to the picked point with only small intentional spring lag; direct apartment dragging follows the picked point exactly.
- Pointer capture handles release outside the stage and cancellation without leaving an item stuck.
- Touch dragging works while scrolling remains available outside the interactive region.
- Keyboard users can select, move, and rotate objects, commit a pose, and cancel a move.
- Visible artwork remains inside the stage for supported dimensions. Shape mode resolves its approximate physical footprints; peg mode allows deliberate artwork overlap while the pegs collide.
- Clump, fixed-structure, and apartment behaviors are visibly distinguishable.
- Animation stops after settling; reduced-motion preferences reduce oscillation while preserving rearrangement.
- Resizing preserves a useful relative arrangement, and the tall composition in clump modes, then resolves spacing against the new bounds.
- Repeated dragging, reset, and mode switching do not accumulate simulation loops or event listeners.
- The plant, computer, and light stay fixed in the structure scene while loose objects move around them; those same objects are movable in the other scenes.
- Switching scene or collision model restores its session arrangement; reset affects only the current combination.
- The apartment retains a dropped pose exactly after release, with no post-drop drift.

Assess responsiveness, predictability, neighborhood changes, and enjoyment by repeating the same gestures in each mode: drag the octopus through the middle, move the bicycle to a corner, pull the cloud away, and tighten a gap between two items. In the first two modes, confirm released objects return to a new neighborhood in the group and disturbances stay mainly local. In the apartment, confirm the bicycle remains at its drop position. In all modes, create a recognizable arrangement and a deliberate mess, then verify both survive after motion settles.

Local verification passed: 31 Bun tests, Astro typecheck, ESLint, Knip, and the production build. Focused engine tests cover return forces, fixed anchors, rotation, cancellation, bounds, sleeping, restored arrangements, and exact apartment drops. Chromium checks exercised actual pointer dragging, keyboard movement/rotation, Escape cancellation during dragging, immediate reversal at an edge, scene switching, reset, resize, and collision overlays. Touch input was checked with a 320 px mobile viewport and reduced-motion preference; 390 px and desktop layouts were also inspected. No browser runtime errors or horizontal overflow were observed. Shape and motion tuning still need the user's hands-on comparison; these checks do not establish aesthetic preference. No deployment was performed.

## Stack and existing application

The repository already uses Astro, React, EmDash, and Cloudflare. `astro.config.mjs` integrates the CMS with D1 (`DB`) and R2 (`MEDIA`); `wrangler.jsonc` also configures session KV, custom domains, and scheduled publishing. `src/worker.ts` preserves EmDash's request handler and scheduled handler. The clump experiment fits inside this architecture.

Use Effect for typed domain operations, service boundaries, validation, and asynchronous state synchronization when those enter scope. Keep the numerical layout loop directly callable TypeScript. Adding an infrastructure runtime is not a prerequisite for testing drag feel.

Adopt Alchemy through a separate compatibility experiment. Current upstream is Effect-based and identifies itself as alpha; verify and pin a compatible published Alchemy/Effect pair when implementation starts. [Official Alchemy repository](https://github.com/alchemy-run/alchemy).

There is a concrete integration boundary: Alchemy's Astro integration supplies its own adapter and rejects an existing adapter. Verify the EmDash custom Worker entrypoint, scheduled handler, plugin integration, storage bindings, admin sessions, and media serving in a preview environment before switching deployments. [Astro guide](https://alchemy.run/cloudflare/frontend/astro/), [integration implementation](https://github.com/alchemy-run/alchemy/blob/main/packages/frontend-frameworks/src/astro/integration.ts).

Map existing resources before adoption; matching names alone do not establish ownership. The Cloudflare state backend can bootstrap resources even on an initial `plan`, so infrastructure commands need to be treated according to their actual effects. [Resource adoption](https://alchemy.run/cli/adopting-resources/), [state store](https://alchemy.run/state-store/).

## Iteration sequence after the clump lab

1. **Choose the motion and spacing.** Compare all three working modes, then iterate on the preferred behavior or a deliberate hybrid.
2. **Introduce the visual language.** Replace emoji with monochrome drawings, tune visual footprints, and compose the fixed anchors. Refine the chosen clump silhouette or apartment setting through the artwork.
3. **Open one portfolio section.** Implement the briefcase-to-experience transition, including pushing objects to the perimeter, restoring their positions on close, keyboard focus, browser history, and direct links.
4. **Introduce persistent arrangements.** First establish the state contract and persistence behavior; add simultaneous visitor updates only if desired.
5. **Add gifts, borrowing, and messages.** Define which objects are movable, fixed, giftable, or borrowable, and how items return. Include reset/undo and moderation controls appropriate to a shared public space.

For a shared house, a Durable Object is a candidate coordinator and persistent store. Its stable identity, attached storage, and WebSocket support fit clients interacting with the same collection. This is an architectural recommendation to validate later. [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/).

Persist meaningful actions and settled arrangements rather than animation frames. Use stable object IDs and normalized positions with a layout version; different viewport shapes can locally resolve spacing while preserving the visitor's intended neighborhood. Keep authored content and media in EmDash, and give live house interactions a separate application state boundary.

## Skill setup

- Installed the official `effect-ts` skill from `Effect-TS/skills`.
- Cloudflare, Wrangler, Workers best practices, and Durable Objects skills were already available.
- Installed a custom `alchemy-iac` skill routing to the current official docs and source, since no official Alchemy IaC skill package was found. Validated its frontmatter and structure with the bundled skill validator. Its installation is separate from application dependencies.

The lab adds Matter.js and its development types. CMS content, cloud resources, and deployment ownership remain outside this prototype work.

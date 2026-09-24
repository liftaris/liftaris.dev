# Physics and interaction experiments

Research checked September 24, 2026. These are candidates for later experiments; the current prototype stays with Matter.js. Recommendations and implementation tradeoffs below are project-specific judgments, distinguished from documented capabilities by their proposed uses.

The most promising directions are **Moveable for arranging the apartment**, **Rapier for a more elaborate physical world**, and **Verlet constraints for organic details** such as octopus arms, dangling cables, or swaying plants. None requires a paid SDK. A tiny collision peg with larger, overlapping artwork can already be implemented in Matter.js; it does not require changing engines.

## Physics and layout

| Library | What makes it interesting here | Tradeoff / experiment | License and primary sources |
| --- | --- | --- | --- |
| **Rapier 2D** | Rigid bodies, joints, sensors, scene queries, world snapshots. Its JavaScript/WASM implementation supports cross-platform deterministic simulation under matching initialization, version, construction order, and timestep conditions. | Try hinged objects, dangling items, more demanding contacts, or repeatable scene replay. Replacing Matter means adapting bodies, joints, and tuning; WASM adds asynchronous initialization. Determinism does not provide multiplayer synchronization by itself. | Apache-2.0. [Overview](https://rapier.rs/docs/), [JS/WASM setup](https://rapier.rs/docs/user_guides/templates/getting_started_js/), [determinism conditions](https://rapier.rs/docs/user_guides/javascript/determinism/), [snapshots](https://rapier.rs/docs/user_guides/javascript/serialization/). |
| **Planck.js** | JavaScript/TypeScript rewrite of Box2D. Joint types include revolute, rope, pulley, wheel, gear, and mouse joints. | Strong candidate if the portfolio develops mechanical toys: a bicycle with turning wheels, hanging planter, pulley, or hinged door. No WASM initialization, but bodies/fixtures and simulation tuning still need migration. | MIT. [Repository and license](https://github.com/piqnt/planck.js), [documentation and joint catalog](https://piqnt.com/planck.js/docs/). |
| **d3-force** | Particle simulation with attraction, repulsion, links, positional forces, and configurable soft circle collision. Rendering is independent. | A small peg can control the position of a much larger illustration. Particularly suitable if we want art-directed spacing more than convincing tumbles. Angular motion would need separate handling. Keep the existing Matter peg comparison first so the collider change is evaluated independently of an engine change. | ISC. [Forces](https://d3js.org/d3-force), [soft circle collisions](https://d3js.org/d3-force/collide), [license](https://github.com/d3/d3-force/blob/main/LICENSE). |
| **Verlet.js** | Particles with distance and angular constraints; examples include cloth, trees, and spiderwebs. | The playful outlier: flexible octopus tentacles, a cable you can tug, or leaves that wobble. Evaluate it as an isolated sketch before adopting it; repository examples and packaging are simple and would need integration work. It supplies a different kind of motion from a rigid-body pile. | MIT. [Source and interactive-example links](https://github.com/subprotocol/verlet-js), [license](https://github.com/subprotocol/verlet-js/blob/master/LICENSE). |

**Also considered:** [p2-es](https://github.com/pmndrs/p2-es) is a TypeScript-friendly JavaScript rigid-body engine with springs, motors, constraints, and modern ESM/CJS builds under [MIT](https://github.com/pmndrs/p2-es/blob/master/packages/p2-es/LICENSE). It is a plausible Matter alternative, but does not yet give this prototype a distinctive experiment beyond the options above.

## Interaction and drawing

| Library | What it supplies | Fit for this portfolio | License and primary sources |
| --- | --- | --- | --- |
| **Moveable + Selecto** | DOM/SVG drag, rotation, resize, pinch, snapping, group transforms; selection by mouse/touch drag area. | The most direct alternative to adopting an entire canvas editor. Useful if visitors should rotate a poster, select several items, or arrange the apartment precisely. We still own scene state, undo, persistence, and any physics. Route gesture targets through the simulation rather than letting two systems write the same transforms. | MIT. [Moveable capabilities](https://daybrush.com/moveable/release/latest/doc/), [Moveable license](https://github.com/daybrush/moveable/blob/master/LICENSE), [Selecto source/license](https://github.com/daybrush/selecto). |
| **Excalidraw** | Embeddable React drawing editor with its own scene model and customization API. | A credible free option if the house becomes a shared doodle board with drawing and annotation. Adopting its editor and element model would be a larger design commitment than using pointer events or Moveable; it is not a physics engine. | MIT. [Embedding](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/integration), [API](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api), [license](https://github.com/excalidraw/excalidraw/blob/master/LICENSE). |
| **Rough.js** | Sketch-style lines, curves, shapes, and SVG paths; SVG and Canvas output. | Can give the room outlines, navigation drawings, and interactive doodles a coherent hand-drawn style without adopting an editor. It draws geometry; it does not supply interaction or physics. | MIT. [Capabilities, examples, and license](https://github.com/rough-stuff/rough). |

## tldraw and the no-paid-SDK constraint

The current tldraw SDK is source-available under its own license, not permissively open source. Default use is development only. Production requires a valid license key: a time-limited trial, a commercial license, or a discretionary hobby license for noncommercial projects. Hobby licenses retain the watermark. We should not assume that a professional portfolio qualifies for the hobby program. [Official licensing documentation](https://tldraw.dev/community/license), [current key requirements](https://tldraw.dev/sdk-features/license-key), [SDK license](https://github.com/tldraw/tldraw/blob/main/LICENSE.md).

Given the user's preference, tldraw is excluded from the implementation baseline. Moveable is the closer fit for arranging existing objects; Excalidraw becomes interesting if freehand creation becomes a core activity.

## Suggested order

1. Compare the current Matter body and small-peg variants using the same artwork, input, and forces.
2. Compare fixed structural objects with movable objects around them, and the apartment's drop-and-stay behavior.
3. If direct arrangement wins, evaluate Moveable for gestures and group manipulation. If expressive motion wins, make one small organic experiment with Verlet constraints or one mechanical experiment with Planck/Rapier.
4. Choose an engine only after the interaction demonstrates a need. Preserve the shared object data and input/render boundaries so physics experiments remain replaceable.

No bundle size or speed ranking is asserted here: those depend on the actual imports, packaging, rendering, and scene. Measure the built prototype if a candidate advances.

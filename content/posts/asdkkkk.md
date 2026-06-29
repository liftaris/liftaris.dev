---
title: asdkkkkkkk
date: 2026-06-29T04:57:40.300Z
hero_image: /LSystemN3.gif
---

I attended a two day Software Factory Intensive (SFI) workshop from April 21st - 22nd, organized by AI Tinkerers Seattle. I went seeking some insight into the "bleeding" edge of AI engineering, trying to parse for myself what's hype and what's useful innovation. So what is a software factory? 

\>A system of AI agents that can plan, architect, code, review, and deploy software continuously.

\=

AI orchestration is any system coordinating multiple AI agents toward a goal. A software factory is a narrower definition: agents laid out as a production line over the software development lifecycle. each a stage, artifacts flowing between them, optimizing for repeatable throughput rather than one-shot completion

\=

\## My perspective going into this

Some baselines of where I stand:

\- I don't think AI is a passing trend like NFTs.

\- We are in a massive bubble and it is being pushed way too hard onto the average person, like orders-of-magnitude way too hard.

\- I do enjoy programming \_with\_ LLMs and am eager to build things with them.

I don't know what I'd call myself, AI semi-skeptic doesn't quite roll off the tongue. In any case, I went into this workshop with one eyebrow half-raised. I am eager and open-minded, but far from being an AI evangelist.

\## First Impressions

This event was the first time AI Tinkerer's had hosted a workshop, and that became evident quickly. Relying on internet hotspots because the building's internet was down for the first half of the day was not the organizer's fault, but contributed to the early disarray. 

After the initial no-slide kick-off speech (laptop would not connect to the display, a classic), we dove into Workshop 1: Install a pre-canned factory, and get familiar with its components.

What actually happened was over half of the audience installed the latest version of gas city, not the version that was pinned to the workshop's content. The mismatch was not immediately caught, and many participants including myself could not understand why the pre-canned factory was not running as expected.

Okay, but extended setup debugging is not a unique experience, right? Par for the course, and I'm sure they'll smooth out the setup in future workshops they host. Fine, let's get into what was being taught.

\## Gas City

From 8am - 5pm, the workshop covered a series of workshops, labs, and short presentations on the \[Gas City]\(https\://github.com/gastownhall/gascity) agent orchestration SDK. Gas City sets out to be an un-opionionated reusable set of tools and infrastructure distilled from the opinionated \[Gas Town]\(https\://github.com/gastownhall/gastown) orchestration system. I won't go into it too much, but if you're unfamiliar with the latter it will sound like an AI-psychosis fueled fever dream. 

\=

For example, this is a valid sentence: The Mayor dispatches Polecats down a Convoy of beads, Dogs watch their heartbeats, the Deacon patrols for stalls, the Witness logs everything, and the Refinery merges the output, optionally federating with other Towns through the Wasteland.

\=

\*Gas City\*, on the other hand, acknowledges the wackiness of \*Gas Town\* while believing in its underlying structure and is (presumably) the engineer's antidote to a chaotic, steampunk, black box agent coordination system.

\# The Factory

\=

A Gas City software factory is a pull-based pipeline of LLM agents coordinated through a shared ticket queue (beads).

\=

Each stage — planner, architect, designer, builder, validator, reviewer, release-gate — is a long-lived agent with a role-specific prompt. Beads move through a git-backed database (\[Dolt]\(https\://github.com/dolthub/dolt)); each agent declares what it consumes, a reconciler matches and wakes it, and when work is done it updates labels so the next stage picks up. No central dispatcher; routing is emergent from label queries. Every artifact — PRD, ADRs, wireframes, code, tests, review reports, gate reports — commits to the same repo as the product, versioned alongside it. It is, roughly, GitHub Actions where each stage is an LLM.

\=

\# What I learned

{leave blank, I will fill in later}

***

\# What is it
AI Tinkerers Workshop - Build a software factory in two days.
\\\[Describe the event and gas city\\] 

\# Why I went
Curious about software factories and agentic workflows
Anthropic, OpenAi, Google and their mothers are all releasing multi-agent products. People Giving talks on agent harnesses, sometimes sounds like AI psychosis gone wild, sometimes sounds like hard engineering. I wanted to be in a room with people thinking about these kinds of problems and learn from them. 
Startups, CTOs, tech leads and principles in the workshop list--strong signal of technical prowess.

\# First Impressions
No internet in the building for first half, wresting with issues of version differences. flashbanged by the gc commands and esoteric concepts.
Workshop was running on gc v0.14.1, and by the end of day one I could see why it wasn't v1.
Bead databases getting deleted, \\\[ insert list of issues on day 1\\]

\# Understanding
packs - the set of agents, including their prompts, mcps, behaviors
beads
signals - 

\# Conclusion
It's something.
It's early, and this ain't it in my opinion. 
Is it skill issue? some of it yes, other is definitely no.
Multi-agent workflows are real, and they will only become more prevalent, this workshop didn't dissuade me from that.

\---

\# What is it

AI Tinkerers Workshop — Build a software factory in two days.

\- \*\*Event\*\*: AI Tinkerers Seattle chapter, hosted April 21–22 2026. Hands-on workshop format (not talks-only).

\- \*\*Premise\*\*: each attendee runs a working "software factory" — a persistent set of AI agents that plan, design, build, review, and gate-release software against a real project, orchestrated by a shared harness.

\- \*\*Harness\*\*: \[Gas City]\(https\://github.com/gastownhall/gascity) (\`gc\`), v0.14.1 (curriculum-pinned). Orchestration-builder SDK extracted from \[Gas Town]\(https\://github.com/gastownhall/gastown), Steve Yegge's opinionated multi-agent workspace manager. Town = the product; City = the SDK the product was refactored into.

\- \*\*Curriculum\*\*: ten activities across two days.

\- \*\*Workshops (W1–W4)\*\* — short, prescribed exercises. Install a factory, ship a canned project, map your own project onto the pipeline, measure.

\- \*\*Labs (L1–L4)\*\* — longer feature builds on your real project. You carry artifacts (schema, scaffold) forward between labs.

\- \*\*Capstone (C1)\*\* — full run: pick a meaningful feature on your project, run it through every stage end-to-end, produce a run report.

\- \*\*Baseline (B1)\*\* — control run for comparison (non-factory baseline, same feature).

\- \*\*Project\*\*: everyone brings their own. Mine was \*\*ShaderWeb\*\* — a GLSL-learning app: browse modules → live WebGL editor → submit attempts → AI validates.

  

\# Why I went

Curious about software factories and agentic workflows.

  

Anthropic, OpenAI, Google and their mothers are all releasing multi-agent products. People giving talks on agent harnesses, sometimes sounds like AI psychosis gone wild, sometimes sounds like hard engineering. I wanted to be in a room with people thinking about these kinds of problems and learn from them.

  

Startups, CTOs, tech leads and principals in the workshop list — strong signal of technical prowess.

  

\# First Impressions

\- No internet in the building for the first half; wrestling with issues of version differences.

\- Flashbanged by the \`gc\` commands and esoteric concepts — Mayor, Polecat, Deacon, Dog, Witness, beads, convoys, formulas, molecules, refinery, seance, wasteland. Naming is aggressive.

\- Workshop was running on gc v0.14.1, and by the end of day one I could see why it wasn't v1.

\- Day 1 issues (to fill in — some of these might be mine, some Kaio-specific):

\- Bead databases getting deleted / overwritten between activity installs (the \`delete\` command nukes \`\~/Projects/factory/\<slug>/\*\`).

\- \[gc version mismatch between attendees]

\- \[dolt/supabase port collisions?]

\- \[other day-1 issues]

\- Day 2 issues are enumerated in \`factory-bugs-observed.md\` — routing stalls, identity-format mismatches (\`rig/agent\` vs \`rig--agent\`), template vars rendering empty, orphaned vitest at 4.3 GB, gate FAIL on a path-convention bug, etc.

  

\# Understanding

  

\*Core primitives gc actually gives you — the nouns you have to know to read the config.\*

  

\- \*\*rig\*\* — a project directory gc operates on. Has its own \`bd\` ticket database. Agents' work products land here.

\- \*\*city\*\* (\`city.toml\`) — the top-level factory config. Declares which rigs exist, which packs to load, session limits, model defaults.

\- \*\*pack\*\* — the unit of agent configuration.

\- A bundle: \`pack.toml\` + \`prompts/\<agent>.md.tmpl\` + overlays (\`.mcp.json\`, \`.claude/\`, etc.).

\- Declares the agent's \`work\_query\` (what beads it intakes), \`wake\_mode\` (fresh vs resume session on wake), and metadata.

\- Composition: \`packs/actual/all/pack.toml\` includes all the stage packs so the city picks them up together.

\- \*\*overlay\*\* — files merged into the agent's working dir at session start (e.g., \`.mcp.json\` files that configure which MCP servers the agent connects to).

\- \*\*bead\*\* (\`bd\` CLI) — a work ticket.

\- Fields: \`id\`, \`title\`, \`status\` (open / in\_progress / closed), \`labels\`, \`assignee\`, \`notes\`, arbitrary \`metadata\`.

\- Every handoff between stages is: update labels → update status → optionally create a new bead. The label is the thing downstream intake filters on.

\- \*\*work\_query\*\* — the declarative filter in a pack that says "wake this agent when a bead matches this."

\- Example: the reviewer's query matches \`--label=needs-review --status=open\`.

\- Stages communicate by agreeing on labels. There is no central dispatcher.

\- \*\*session\*\* — a running agent process (tmux-backed by default, pluggable providers: subprocess, exec, ACP, Kubernetes).

\- States: \`active\` (running) / \`asleep\` (idle, ready to be woken).

\- Prompt is baked at session start. Editing a prompt requires killing the session to reload.

\- \*\*reconciler\*\* — the background process that polls \`work\_query\`s and wakes matching agents. The "dispatcher" is emergent from queries + labels, not a central router.

\- \*\*order\*\* — cron-like periodic task (e.g., \`dolt-health\`, \`gate-sweep\`, \`cross-rig-deps\`). Runs on a cooldown. Used for infra/maintenance, not feature work.

\- \*\*formula\*\* / \*\*molecule\*\* — TOML workflow templates. A formula is a reusable recipe (\`mol-tdd-build\` = write tests → make them pass → refactor). A molecule is an instantiated formula attached to a bead, with step tracking.

\- \*\*mail\*\* — inter-agent messaging (\`gc mail send \<agent> "..."\`). Notification, not protocol — actual handoff goes through beads.

\- \*\*hooks\*\* — git-worktree-backed persistent storage so agent work survives session crashes. More emphasized in Gas Town; gc uses them via pack config.

  

\*Roles — the stages my ShaderWeb factory had, in pipeline order.\*

  

\- \*\*planner\*\* → writes the PRD, decomposes the feature into sub-beads.

\- \*\*architect\*\* → writes ADRs, produces architecture docs, generates guardrail rules.

\- \*\*designer\*\* → produces wireframes (Excalidraw) and a design spec.

\- \*\*pm\*\* → further decomposes into build + test sub-beads. (This one appeared in C1 but not in L3/L4 — origin unclear.)

\- \*\*builder\*\* → implements on \`feat/\<slug>\`, commits code.

\- \*\*validator\*\* → writes test suites for what the builder shipped.

\- \*\*reviewer\*\* → runs lint/tests, reviews diff against Review Standards, produces a review report, APPROVE or REQUEST\_CHANGES.

\- \*\*deployer\*\* (release-gate) → runs a binary criteria table (\`npm run build\`, bundle size, clean merge, etc.), produces a gate report, PASS or FAIL.

  

\*Governance artifacts the curriculum adds on top of gc.\*

  

\- \*\*PROJECT\_MANIFEST.md\*\* — rig-level doc declaring Review Standards (what the reviewer flags) and Release Criteria (the deployer's binary checklist).

\- \*\*improvement-criteria.md\*\* (W4) — five measurable signals for iterating on the factory itself: stale-artifact gate FAILs, Correctness findings at first review, schema mismatches, review loop-backs, bundle headroom.

\- \*\*factory-iterations.md\*\* (W4) — running log of every config-level change to the factory: date, stage, file, change, expected criterion impact.

  

\*Relationship to Gas Town (the opinionated parent).\*

  

\- Town bakes in a protocol: Mayor coordinates, Polecats do work, three-tier watchdog (Witness/Deacon/Dogs) keeps agents healthy, Refinery merges, Seance recovers context, Wasteland federates.

\- City gives you the substrate — sessions, beads, packs, reconciler, orders — and you build the protocol yourself in prompt templates.

\- The curriculum has you build directly on City, so you're hand-authoring what Town would otherwise provide.

  

\# Conclusion

It's something.

  

It's early, and this ain't it in my opinion.

  

Is it skill issue? Some of it yes, other is definitely no.

\- Skill issue side: prompt-authoring precision, understanding the label→status→assignee contract, knowing when to restart vs reload, operator discipline around carry-forward between labs.

\- Not skill issue side: dual identity encoding (\`rig/agent\` vs \`rig--agent\`) across the tool's own surfaces, template variables that silently expand to empty, no subprocess supervision, no pipeline-level observability command, no handoff primitive — all structural gaps in gc v0.14.1.

  

Multi-agent workflows are real, and they will only become more prevalent. This workshop didn't dissuade me from that.

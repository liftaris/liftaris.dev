---
title: "I Didn't Know What I Didn't Know About Docker"
author: Kaio
date: '2026-04-19T00:00:00.000Z'
hero_image: /BazaarGhost/web-app-manifest-512x512.png
---

There's a specific kind of blissful ignorance you can have about a part of your project that *just works.* You don't poke it, you don't question it, and you definitely don't open it up and look inside. For me and BazaarGhost, that part was Docker.

I knew enough to write a Dockerfile. I knew that GitHub Actions builds it, runs it, and the VODs get processed. I knew the word "caching" and that it was in there somewhere doing something good. Beyond that? I was largely going off vibes.

That changed recently when I sat down and actually audited the container setup end to end — the Dockerfile, the `build.sh` script, and how the whole thing integrates with the `process-vod.yml` workflow. What I found wasn't catastrophic, but it was illuminating. Some of it was "oh that's actually fine", and some of it was "oh no, that's been quietly wrong this whole time."

Here's what I found.

---

## A Quick Recap: How SFDE Runs

If you've read the [BazaarGhost post](/posts/bazaar-ghost), you know the gist. The SFDE container is the workhorse of the VOD processing pipeline. It takes a chunk ID, streams the relevant segment from Twitch via Streamlink, extracts frames with FFmpeg, runs OpenCV template matching to find matchup screens, and extracts usernames via PaddleOCR.

When a VOD needs processing, a GitHub Actions workflow (`process-vod.yml`) fans out into a matrix of parallel jobs — one job per chunk. Each chunk job builds the SFDE Docker image, then runs it. This is the part that needed a closer look.

---

## Finding #1: The Image Rebuilds on Every Single Job

This was the biggest one, and honestly kind of embarrassing in hindsight.

When `process-vod.yml` uses a matrix strategy, GitHub spins up a **separate runner** for each chunk. Each runner independently runs the full `docker/build-push-action` step. So if a VOD has ten chunks, the Docker image is being built — or at least reconstructed from cache — ten separate times, on ten separate machines.

The GHA layer cache (`cache-from: type=gha, cache-to: type=gha,mode=max`) softens this, but it's not a free lunch. Each runner still has to pull cache layers, verify them, and load the image into its local Docker daemon. That's not nothing.

The correct pattern for this kind of setup is:

```
build-image job (runs once, pushes image to GHCR)
      ↓
process-chunk matrix (each runner pulls the pre-built image — seconds)
```

Here's the funny part: I already have a `build.sh` script that does exactly this — builds and pushes to `ghcr.io/bazaar-ghost/sfde`. It's just... completely disconnected from the workflow. The workflow builds a local image tagged `bazaar-ghost-sfde`. `build.sh` pushes to GHCR. They've never met. Two parallel realities of the same idea, and only one of them is actually running.

---

## Finding #2: OpenTelemetry Is Being Installed Twice (And the Second One Ignores My Pins)

This one is a proper bug.

My `requirements.txt` pins:

```
opentelemetry-distro>=0.60b1,<0.61
opentelemetry-exporter-otlp>=1.39.1,<2.0
```

But then, a few lines later in the Dockerfile:

```dockerfile
RUN --mount=type=cache,target=/root/.cache/pip \
      python -m pip install --upgrade pip \
   && python -m pip install --prefer-binary -r requirements.txt \
   && pip install opentelemetry-distro opentelemetry-exporter-otlp \
   && opentelemetry-bootstrap --action=install
```

See that third `pip install`? It reinstalls `opentelemetry-distro` and `opentelemetry-exporter-otlp` with zero version constraints — right after `requirements.txt` just pinned them. Whatever pip resolves to in that moment could be anything. I'm spending effort pinning dependencies in one place and then immediately undermining it in the next.

The `opentelemetry-bootstrap --action=install` part is actually the only reason this line exists — it installs instrumentation libraries for frameworks it detects in your environment. The fix is simple: drop the redundant install and just call the bootstrap:

```dockerfile
RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install --upgrade pip \
 && python -m pip install --prefer-binary -r requirements.txt \
 && opentelemetry-bootstrap --action=install
```

Three lines instead of four. The pinning actually sticks now. Easy win.

---

## Finding #3: The PaddleOCR Models Are Living in the Image Twice

PaddleOCR models are large — we're talking hundreds of megabytes. I bake them into the image at build time so they don't need to download at runtime (smart). But the way I'm doing it is accidentally keeping two copies of them in the image.

Here's the sequence:

```dockerfile
# Step 1: Download runs as root → lands in /root/.paddlex
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(...)"

# Step 2: Create user, then COPY the models to their home dir
RUN echo "ok" > /app/health && \
    useradd -m -u 1000 sfde && \
    cp -r /root/.paddlex /home/sfde/.paddlex && \
    chown -R sfde:sfde /app /home/sfde/.paddlex
```

Docker layers are additive and immutable. That `cp` command creates a *new* layer with the copied files — but the files in `/root/.paddlex` are still sitting in the earlier layer, taking up space. The image silently carries the models in two places.

The fix is to create the `sfde` user *before* the download step and download as that user, so the copy is never necessary. One set of models, no duplication. Potentially hundreds of MB saved from the image size.

---

## Finding #4: `git` and `wget` Are in the Runtime Image for No Reason

Both are installed as OS dependencies. And both have legitimate reasons to be there *during the build* — pip uses `git` when installing packages from git URLs, and `wget` may be used during the PaddleOCR model download.

But at runtime, `sfde.py` doesn't need either of them. The models are already baked in. Streamlink, FFmpeg, PaddleOCR, and OpenCV are all it's actually calling. Removing them would slim the image by 35-50MB and shrink the attack surface.

The "proper" way to handle this is a multi-stage Docker build:

```dockerfile
FROM python:3.11-slim-bookworm AS builder
# Install build tools, download models, install packages
RUN apt-get install -y git wget ...

FROM python:3.11-slim-bookworm AS runtime
# Copy only the installed packages and models from builder
# No git, no wget in the final image
```

Multi-stage builds are one of those Docker patterns I'd heard about but never actually implemented. This would be the right place to do it. It's a bigger change than the others, but it's the kind of thing that cleans up the image properly.

---

## Finding #5: The Health Check Always Passes

```dockerfile
HEALTHCHECK CMD [ -f /app/health ] || exit 1
```

The file `/app/health` is written at *build time* (`RUN echo "ok" > /app/health`) and never deleted. It will always exist. The health check will always pass, regardless of whether `sfde.py` is even running.

For a short-lived batch container like this one — not a long-running server — health checks are less critical. But it's still misleading. A health check that always returns healthy isn't providing any signal. The honest options are: replace it with something real (like checking for the Python process with `pgrep -f sfde.py`), or remove it entirely.

---

## What I'm Actually Fixing

In order of impact:

**First:** The double OpenTelemetry install. This is a real bug affecting dependency pinning and it's a two-line change. Doing this immediately.

**Second:** Build-once-push-to-GHCR. This is the highest-leverage change, and `build.sh` already has most of the logic — I just need to wire it into the workflow properly as a pre-matrix job. This will meaningfully speed up processing runs.

**Third:** Model layer deduplication. Create `sfde` user earlier, download as that user, no copy needed. Worth doing alongside the GHCR work since I'll be touching the Dockerfile anyway.

**Later:** Multi-stage build. This is a bigger refactor but the right long-term direction. Smaller, cleaner runtime image.

---

## The Broader Lesson

The Dockerfile itself was actually reasonably well-structured — BuildKit cache mounts on apt and pip, non-root user, layers ordered so the pip layer is cached when only source code changes. The problems were mostly at the *workflow* level: treating the image as something to build fresh per-job rather than as an artifact to build once and share.

It's a distinction I wouldn't have understood without digging into it. And that's exactly why I think it's worth writing about. "It works" is not the same as "it's working well." Sometimes those two things look identical from the outside, and you only find out the difference when you look.

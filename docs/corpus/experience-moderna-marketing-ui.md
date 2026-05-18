# Moderna — Marketing UI Platform

## Chunk: experience-moderna-marketing-ui-0

**Type:** experience
**Source:** github/modernatx-internal
**Tags:** ["moderna", "marketing-ui", "next.js", "react", "ssr", "hydration", "typescript"]
**Date Start:** 2024-09-01
**Date End:** null

### Content

Kaio is a key contributor to Moderna's Marketing UI platform, a Next.js application that powers multiple public-facing websites including Moderna's disease education portal, product information sites, and healthcare provider engagement portals. The platform serves content across multiple countries and languages, with server-side rendering and content sourced from Contentful CMS. Kaio's contributions span feature development, hydration bug resolution, content page creation, and architectural improvements. He resolved multiple React hydration errors — on one set of Japanese product pages, he traced the issue to a softgating component that accessed localStorage during server-side rendering, and fixed it by deferring that component to client-only rendering. On a UK health engagement page, he fixed a Suspense boundary error by wrapping a quiz component in React.Suspense to defer state updates that were occurring during hydration. He also built localized content pages, including a French dosing and administration page and a UK consent form with a newsletter signup integrated with Marketo.

### Metadata

```json
{
  "company": "Moderna",
  "title": "Software Development Engineer II",
  "team": "CDIE",
  "achievements": [
    "Resolved React hydration errors across multiple localized pages",
    "Built localized content pages for French and UK markets",
    "Contributed to Next.js platform serving multiple countries and languages"
  ]
}
```

---

## Chunk: experience-moderna-marketing-ui-1

**Type:** experience
**Source:** github/modernatx-internal
**Tags:** ["moderna", "marketing-ui", "next.js", "contentful", "content-v2", "consent-forms", "atlas"]
**Date Start:** 2025-12-01
**Date End:** 2026-02-28

### Content

In late 2025 and early 2026, Kaio expanded his Marketing UI work into Moderna's Atlas platform — the healthcare professional engagement portal hosted at connect.atlas.modernatx.com. He implemented a UK consent form that integrated with Moderna's existing newsletter infrastructure, building a NewsletterForm component with UK-specific specialty options matching the fields expected by the marketing automation platform. The form included consent requirement handling and was served through Atlas navigation and footer components. He also fixed a 500 error on the Vaccine Finder that was caused by accessing a property on an undefined request header — a niche case triggered when Google's mobile browser prefetched a cached version of the page through a stale proxy server. Although few users were directly impacted, the fix reduced noise in error logs and improved observability. His Marketing UI contributions total 17 merged pull requests spanning September 2024 through February 2026, making it his second most active repository.

### Metadata

```json
{
  "company": "Moderna",
  "title": "Software Development Engineer II",
  "team": "CDIE",
  "achievements": [
    "Built UK consent form with newsletter integration for Atlas HCP portal",
    "Fixed edge-case 500 error caused by Google mobile browser prefetching",
    "17 merged PRs across the Marketing UI platform over 18 months"
  ]
}
```

---

## Chunk: experience-moderna-marketing-ui-2

**Type:** experience
**Source:** github/modernatx-internal
**Tags:** ["moderna", "search", "typesense", "contentful", "terraform", "cloudfront"]
**Date Start:** 2025-10-01
**Date End:** 2025-11-30

### Content

Kaio built the search infrastructure for Moderna's marketing websites, implementing a Typesense-based search service with content synchronized from Contentful CMS. He wrote scripts to export Contentful space data and transform it into Typesense-compatible collections, supporting multi-locale search across all of Moderna's content. He set up a temporary CloudFront distribution to enable HTTPS connections to the Typesense instance before a dedicated domain was provisioned, and configured AWS resource tagging for cost tracking. Prior to building the production service, Kaio conducted an exploration comparing Algolia and Typesense, building prototype search UIs and seeding test collections from both Contentful exports and Algolia data to evaluate query performance, faceting capabilities, and cost. The exploration work directly informed the team's decision to proceed with Typesense, and the production search service he subsequently built supports multi-collection search across different content types with geo-location filtering for the Vaccine Finder.

### Metadata

```json
{
  "company": "Moderna",
  "title": "Software Development Engineer II",
  "team": "CDIE",
  "achievements": [
    "Built Typesense search service with Contentful CMS content synchronization",
    "Conducted Algolia vs Typesense evaluation that informed platform decision",
    "Implemented multi-locale, multi-collection search with geo-location filtering",
    "Provisioned CloudFront and AWS infrastructure for search service"
  ]
}
```

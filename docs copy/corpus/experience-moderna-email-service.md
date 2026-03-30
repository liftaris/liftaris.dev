# Moderna — Email Integration Service

## Chunk: experience-moderna-email-0

**Type:** experience
**Source:** github/modernatx-internal
**Tags:** ["moderna", "email", "typescript", "npm-packages", "github-packages", "ci-cd"]
**Date Start:** 2026-01-01
**Date End:** 2026-02-28

### Content

Kaio contributed to Moderna's email integration service, a backend service that handles transactional email delivery triggered by form submissions across marketing websites (such as inquiry forms on Japanese product pages). His primary contribution was designing and publishing a TypeScript types package to GitHub Packages, making the service's type definitions available to consuming applications. The exported types — including SupportedEmailEvents, EmailData, EmailEventConfig, and EmailHandlerBody — allow frontend applications to get compile-time validation when constructing email trigger payloads. He set up the build and publish workflow in GitHub Actions, configuring it to auto-version and publish on changes to the types file, with support for both stable releases (main branch) and pre-release tags (dev branch via @next tag). Getting the publish pipeline working required iterating through several attempts — dealing with repository branch protection rules that prevented publish workflows from running outside PR contexts, fixing type import paths, and adding a manual trigger option as a fallback. The result is a clean developer experience where consuming apps install the package and get autocomplete and type safety for email event configuration.

### Metadata

```json
{
  "company": "Moderna",
  "title": "Software Development Engineer II",
  "team": "CDIE",
  "achievements": [
    "Published shared TypeScript types package to GitHub Packages for email service",
    "Built auto-versioning publish workflow with stable and pre-release channels",
    "Enabled compile-time type safety for consuming applications"
  ]
}
```

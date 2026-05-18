# Moderna — Fair Market Value (FMV) Platform

## Chunk: experience-moderna-fmv-0

**Type:** experience
**Source:** github/modernatx-internal/fmv
**Tags:** ["moderna", "fmv", "angular", "nestjs", "typescript", "compliance", "full-stack"]
**Date Start:** 2025-04-01
**Date End:** 2025-09-30

### Content

Kaio was a core engineer on Moderna's Fair Market Value (FMV) platform, an internal compliance tool used to track and manage compensation for healthcare professionals (HCPs), government officials, patient organizations, and other stakeholders. The application is an Angular frontend backed by a NestJS API server connected to a SQL Server database, deployed on AWS ECS via Maglev (Moderna's deployment platform). Over a six-month period from April to September 2025, Kaio authored 32 pull requests — the highest volume contribution of any repository in his Moderna tenure. His work spanned the full stack: frontend form improvements, backend service refactoring, audit system implementation, authentication upgrades, and deployment pipeline maintenance. The FMV platform is critical to Moderna's regulatory compliance, ensuring the company meets legal requirements around fair market value determination for healthcare stakeholder compensation across multiple countries and currencies.

### Metadata

```json
{
  "company": "Moderna",
  "title": "Software Development Engineer II",
  "team": "CDIE",
  "achievements": [
    "32 merged PRs in 6 months — highest volume contribution across all repos",
    "Full-stack ownership of Angular + NestJS compliance application",
    "Maintained critical regulatory compliance tooling"
  ]
}
```

---

## Chunk: experience-moderna-fmv-1

**Type:** experience
**Source:** github/modernatx-internal/fmv
**Tags:** ["moderna", "fmv", "architecture", "nestjs", "typeorm", "refactoring", "dto"]
**Date Start:** 2025-06-01
**Date End:** 2025-09-30

### Content

One of Kaio's most significant contributions to the FMV platform was a large-scale architectural refactor that migrated the application from a monolithic service pattern to a DTO-first architecture. The main service file had grown to over 1,500 lines, mixing responsibilities for reviews, user profiles, FMV exceptions, and form submissions. The application also suffered from data model inconsistency: the database used UPPER_SNAKE_CASE, the API contracts used camelCase, and forms mirrored database columns instead of API contracts, requiring constant transformation logic. Kaio decomposed the monolithic service into focused, single-responsibility services and introduced a DTO layer to normalize data representation between the database schema and API contracts. This refactor improved testability, reduced the risk of unintended side effects when modifying business logic, and established patterns the team could follow for future service decomposition.

### Metadata

```json
{
  "company": "Moderna",
  "title": "Software Development Engineer II",
  "team": "CDIE",
  "achievements": [
    "Decomposed 1,500+ line monolithic service into focused DTO-first architecture",
    "Resolved data model inconsistency across database, API, and form layers",
    "Established architectural patterns for future service decomposition"
  ]
}
```

---

## Chunk: experience-moderna-fmv-2

**Type:** experience
**Source:** github/modernatx-internal/fmv
**Tags:** ["moderna", "fmv", "jwt", "okta", "audit", "typeorm", "security", "authentication"]
**Date Start:** 2025-07-01
**Date End:** 2025-09-30

### Content

Kaio designed and implemented a comprehensive JWT-based authentication and audit tracking system for the FMV platform. The system integrates with Okta for identity, using an Angular HTTP interceptor to attach JWT tokens to API requests and server-side validation via NestJS guards. He built an automatic audit field system using TypeORM entity subscribers: a base AuditBase entity provides standardized CREATED_BY, CREATED_DATE, MODIFIED_BY, and MODIFIED_DATE fields, and a subscriber uses AsyncLocalStorage-based request context to automatically populate these fields on every database write. This replaced manual tracking and ensured every data modification is attributed to a specific user. He initially implemented tracking using UPN (email) format but later changed to readable usernames (e.g., "Kaio Barbosa-Chifan" instead of "kbarbosachifan@modernatx.com") for better usability. He also added database connection pooling and built an event-based history tracking system using TypeORM subscribers that logs changes to stakeholder profiles, compensation rate ranges, and tiering results into dedicated history tables.

### Metadata

```json
{
  "company": "Moderna",
  "title": "Software Development Engineer II",
  "team": "CDIE",
  "achievements": [
    "Implemented JWT authentication with Okta integration (Angular interceptor + NestJS guards)",
    "Built automatic audit field tracking via TypeORM subscribers and AsyncLocalStorage",
    "Created event-based entity history tracking for compliance-critical tables",
    "Configured database connection pooling for production performance"
  ]
}
```

---

## Chunk: experience-moderna-fmv-3

**Type:** experience
**Source:** github/modernatx-internal/fmv
**Tags:** ["moderna", "fmv", "angular", "bug-fixes", "forms", "ux", "security"]
**Date Start:** 2025-04-01
**Date End:** 2025-09-30

### Content

Across his FMV work, Kaio resolved numerous frontend and backend issues that improved the application's reliability and user experience. He fixed currency selection bugs where saved currency values failed to display in stakeholder forms, tracing the issue to how dropdown options were being referenced. He improved government official compensation forms by adding loading states to prevent premature rendering and standardizing all dropdowns to use computed signal-based options methods. He fixed a cross-border warning bug where the warning persisted after conditions were corrected, caused by unclean country string values in the form service. He addressed a security code scanning alert for externally-controlled format strings in Node.js logging by refactoring console.error calls to use comma-separated arguments instead of template literals. He also handled verbiage updates across the application for stakeholder-facing content, managed production deployments, established Prettier formatting standards across the codebase, and reverted problematic changes (like a clustering attempt that was merged prematurely) to keep the development branch stable.

### Metadata

```json
{
  "company": "Moderna",
  "title": "Software Development Engineer II",
  "team": "CDIE",
  "achievements": [
    "Fixed currency selection and form rendering bugs in compliance forms",
    "Resolved format string security vulnerability in Node.js logging",
    "Established code formatting standards with Prettier across the codebase",
    "Managed production deployments and branch stability"
  ]
}
```

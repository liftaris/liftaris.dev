# Moderna — Vaccine Finder

## Chunk: experience-moderna-vfp-0

**Type:** experience
**Source:** github/modernatx-internal/marketing-ui
**Tags:** ["moderna", "vaccine-finder", "react", "next.js", "google-maps", "geolocation", "typescript"]
**Date Start:** 2025-01-01
**Date End:** 2025-04-30

### Content

Kaio was one of the primary engineers behind Moderna's Vaccine Finder, an interactive map-based tool embedded in Moderna's disease education website that helps users locate nearby vaccination providers. He built the "Search This Area" feature, which introduced a reverse geocoding endpoint and allowed users to pan the map and search for providers within the visible area. This required refactoring the Google Maps context architecture — lifting map state management higher in the component hierarchy by creating a dedicated GoogleMapsProvider, separating map instance management from UI/styling concerns in the FinderMap component. He also implemented the Walgreens location data integration, which involved fetching partner pharmacy locations through a new JWT-authenticated partner API, filtering out duplicate CDC locations, and merging the results into the existing search flow. The frontend work was paired with infrastructure changes across separate service and Helm chart repositories to provision the partner API Lambda, configure API Gateway, and inject environment variables into Kubernetes deployments.

### Metadata

```json
{
  "company": "Moderna",
  "title": "Software Development Engineer II",
  "team": "CDIE",
  "achievements": [
    "Built 'Search This Area' with reverse geocoding for map-based vaccine location search",
    "Integrated Walgreens pharmacy location data via JWT-authenticated partner API",
    "Refactored Google Maps context architecture for better separation of concerns",
    "Provisioned partner API Lambda and API Gateway infrastructure via Terraform"
  ]
}
```

---

## Chunk: experience-moderna-vfp-1

**Type:** experience
**Source:** github/modernatx-internal/marketing-ui
**Tags:** ["moderna", "vaccine-finder", "bug-fixes", "google-maps", "ux", "amplitude", "analytics"]
**Date Start:** 2025-01-01
**Date End:** 2025-04-30

### Content

Beyond feature development, Kaio fixed several critical UX bugs in the Vaccine Finder. He resolved an issue where map markers were hidden offscreen or behind the search results overlay — the root cause was that Google Maps' fitBounds created viewport bounds that were too wide horizontally, and his fix adjusted the bounds calculation to account for the overlay panel offset. He fixed a blank search bar bug where the search input cleared after the first query due to a stale ref guard in the useEffect that synced the selected place to the search value. He also added map drag event tracking to Amplitude via Moderna's analytics library, implementing a mousedown + mouseup combo with a 10px threshold rather than using the native drag API, which is designed for drag-and-drop interactions rather than map panning. On the infrastructure side, he codified CORS behavior for the partner API gateway in Terraform, moving configuration that had been manually set in the AWS console into version-controlled IaC files, and separating partner API resources from product location API resources for cleaner deployment management.

### Metadata

```json
{
  "company": "Moderna",
  "title": "Software Development Engineer II",
  "team": "CDIE",
  "achievements": [
    "Fixed map marker visibility bug affecting search result display",
    "Resolved search bar clearing bug caused by stale React ref",
    "Implemented map drag analytics tracking in Amplitude",
    "Moved CORS configuration from manual AWS console setup to Terraform IaC"
  ]
}
```

---

## Chunk: experience-moderna-vfp-2

**Type:** experience
**Source:** github/modernatx-internal/product-locations-service
**Tags:** ["moderna", "vaccine-finder", "terraform", "aws-lambda", "api-gateway", "jwt", "walgreens"]
**Date Start:** 2025-01-01
**Date End:** 2025-03-31

### Content

Kaio designed and implemented the partner location API infrastructure that powers the Vaccine Finder's pharmacy data integration. The system works as follows: Marketing UI and the partner API Lambda share a JWT secret; when a user searches for vaccine locations on the unbranded finder, the Marketing UI server issues a 1-hour JWT token, which is then sent to the partner API Gateway endpoint with the user's latitude and longitude. The Lambda validates the token and fetches location data from partner pharmacy APIs (starting with Walgreens, with CVS staged behind a feature flag). He wrote the full Terraform configuration for both dev and prod environments, including API Gateway resources, Lambda function definitions, and IAM roles. He also separated the partner API Terraform into dedicated files (partner_api_gateway_dev.tf and partner_api_gateway_prod.tf) to enable file-change-based deployment triggers and clearer separation from the existing product location API resources. The Helm chart changes in marketing-ui-helm-charts added the JWT secret and partner API endpoint as environment variables across all disease.education preview, PR, and production environments.

### Metadata

```json
{
  "company": "Moderna",
  "title": "Software Development Engineer II",
  "team": "CDIE",
  "achievements": [
    "Designed JWT-based authentication flow between Marketing UI and partner API",
    "Wrote Terraform IaC for partner API Lambda and API Gateway (dev + prod)",
    "Implemented Walgreens location fetching with CVS staged behind feature flag",
    "Updated Helm charts for disease.education environment variable injection"
  ]
}
```

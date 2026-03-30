# Moderna — Infrastructure & Security

## Chunk: experience-moderna-infra-0

**Type:** experience
**Source:** github/modernatx-internal
**Tags:** ["moderna", "terraform", "aws", "waf", "cloudfront", "security", "infrastructure"]
**Date Start:** 2026-01-01
**Date End:** null

### Content

Kaio took on infrastructure ownership for Moderna's marketing platform, managing AWS WAF (Web Application Firewall) rules protecting the CloudFront distributions that serve Moderna's public websites. After observing sustained security-probe noise — including automated scanner traffic that inflated edge and origin costs and created operational noise in error dashboards — he proposed and implemented a phased WAF hardening strategy. He first deployed three new AWS-managed rule groups (AdminProtectionRuleSet, PHPRuleSet, and BotControlRuleSet) in COUNT mode to monitor traffic patterns over a weekend without blocking anything. After analyzing sampled requests, he documented his findings in an internal analysis page and promoted specific rules to BLOCK mode: known bot datacenter signals, automated browser signals, admin protection rules, and PHP-specific rules. He kept the remaining bot control signals in COUNT mode for continued observation. This systematic approach — monitor first, document findings, then selectively enforce — reduced junk traffic while avoiding false positives against legitimate users.

### Metadata

```json
{
  "company": "Moderna",
  "title": "Software Development Engineer II",
  "team": "CDIE",
  "achievements": [
    "Designed and executed phased WAF hardening strategy for marketing CDN",
    "Deployed and tuned AWS-managed WAF rule groups to block scanner traffic",
    "Documented traffic analysis and block/allow recommendations for the team"
  ]
}
```

---

## Chunk: experience-moderna-infra-1

**Type:** experience
**Source:** github/modernatx-internal
**Tags:** ["moderna", "accessibility", "ci-cd", "github-actions", "playwright", "axe", "automation"]
**Date Start:** 2026-02-01
**Date End:** 2026-03-31

### Content

Kaio built an automated accessibility scanning gate that runs as part of the CI/CD pipeline for Moderna's marketing websites. The tool uses a headless browser to scan preview deployments with the axe accessibility engine, reporting WCAG violations as part of the pull request workflow. When the WAF blocked headless browser requests (since they matched automated browser detection rules), he solved it by adding a WAF ALLOW rule for requests containing a trusted header, ensuring the accessibility scanner could authenticate against preview environments without being blocked by the very security rules he had previously implemented. He also added a delay before running the axe scanner to ensure pages were fully rendered, removed local testing dependencies on the `act` CLI tool, and fixed a bug where the GitHub Actions run attempt number in the workflow context prevented re-running the accessibility step without retriggering the entire calling workflow. Additionally, Kaio ran formatters across the entire infrastructure repository and added Prettier and Terraform formatting to Husky pre-commit hooks to enforce consistent code style going forward.

### Metadata

```json
{
  "company": "Moderna",
  "title": "Software Development Engineer II",
  "team": "CDIE",
  "achievements": [
    "Built automated accessibility scanning gate (axe + headless browser) in CI/CD",
    "Resolved WAF vs. accessibility scanner conflict with targeted ALLOW rule",
    "Enforced code formatting standards with Husky pre-commit hooks across infra repo"
  ]
}
```

---

## Chunk: experience-moderna-infra-2

**Type:** experience
**Source:** github/modernatx-internal
**Tags:** ["moderna", "terraform", "aws", "helm", "kubernetes", "devops", "ci-cd"]
**Date Start:** 2024-07-01
**Date End:** 2026-03-31

### Content

Throughout his Moderna tenure, Kaio's infrastructure contributions extended beyond the WAF and accessibility work into broader cloud and deployment concerns. He wrote Terraform configurations for AWS Lambda functions, API Gateway endpoints, CloudFront distributions, and IAM roles across multiple repositories. He managed Helm chart configurations for Kubernetes deployments, adding environment variables and secrets across preview, PR, and production environments for Moderna's disease education platform. He configured AWS resource tagging strategies to enable cost tracking and attribution across services. He also contributed to CI/CD pipeline improvements, including updating GitHub Actions workflows to use correct Node.js versions, configuring deployment pipelines for Moderna's internal deployment platform, and managing infrastructure for ancillary services like an HCC (Healthcare Compliance) interaction tracking system. His infrastructure work demonstrates a trajectory from frontend-focused feature delivery into platform engineering, where he increasingly owned the reliability, security, and deployment concerns of the systems his team builds.

### Metadata

```json
{
  "company": "Moderna",
  "title": "Software Development Engineer II",
  "team": "CDIE",
  "achievements": [
    "Wrote Terraform IaC for Lambda, API Gateway, CloudFront, and IAM across multiple services",
    "Managed Helm charts for Kubernetes deployments across preview and production environments",
    "Implemented AWS resource tagging for cost tracking and attribution",
    "Grew from frontend engineer into infrastructure and platform ownership"
  ]
}
```

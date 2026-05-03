## 16. SEO & Growth Engine

1. Extend `/dashboard/seo` shell with growth-engine navigation grouping audits, rank tracking, content, backlinks, outreach, and CRO under one plan-gated workspace.
2. Add `seo_projects` Mongo collection scoped by tenant, storing domain, default location, device targets, competitor list, and credit-meter pointers for usage tracking.
3. Wire RBAC roles `seo.viewer`, `seo.editor`, `seo.admin` into existing guard middleware so feature flags gate suite modules per workspace plan tier.
4. Build site-audit worker in `src/workers/seo/audit/` running headless Lighthouse plus custom rules for crawlability, schema, hreflang, mobile, and Core Web Vitals.
5. Persist audit issues with severity, category, fix-recommendation, and example-element selector into `seo_audit_findings` for trend charts and exportable reports.
6. Schedule recurring audits via existing PM2 cron worker, honoring plan-tier frequency caps and emitting Redis pub/sub events for downstream notifications.
7. Implement rank-tracker worker pulling SERP data daily across desktop/mobile and chosen geo locations, capturing position, URL, SERP features, and pixel rank.
8. Render rank-tracking dashboard with sparkline charts, share-of-voice metric, visibility index, and CSV/Looker export gated by plan credits.
9. Add keyword-research module hitting third-party providers via `lib/seo-tools/`, returning volume, difficulty, CPC, and trend with cached responses keyed by tenant.
10. Classify keyword intent (informational, navigational, commercial, transactional) using LLM-based prompt cached in Redis to keep classifier costs bounded.
11. Cluster keywords into topical groups using embedding similarity and store cluster graphs for topical-authority planning views.
12. Build topical-authority planner showing pillar pages, supporting clusters, coverage gaps, and recommended publishing cadence per cluster.
13. Add content-gap analysis comparing tenant domain ranking keywords against up to five competitors, surfacing missing terms and quick-win opportunities.
14. Track competitor metadata (titles, descriptions, schema, content length, last-modified) via scheduled crawler with diff alerts on significant changes.
15. Implement backlink monitor pulling from provider API into `seo_backlinks` collection with source authority, anchor text, do/nofollow, first/last seen.
16. Detect lost-link events by diffing previous snapshot, queuing alerts to email and SabFlow webhook trigger `seo.backlink.lost`.
17. Add disavow-file builder generating Google-compliant TXT export from flagged toxic backlinks with reason codes and reviewer signoff trail.
18. Build AI content engine pipeline brief to outline to draft to optimize using Anthropic via existing AI gateway, charging credits per stage.
19. Add brief generator capturing target keyword, intent, persona, SERP analysis summary, recommended headings, entities, and word-count target.
20. Implement outline editor with drag-reorder headings, FAQ suggestions, and entity coverage scorecard updated in real time.
21. Stream draft generation to client using existing streaming response helper, persisting partial state so reloads resume from last token.
22. Add on-page optimizer scoring drafts on title, meta, headings, internal links, keyword density, readability, and schema completeness.
23. Wire publish step to push final markdown to SabFlow node `seo.content.publish` enabling routing to WordPress, Webflow, or custom CMS connectors.
24. Add programmatic-SEO landing-page generator templating from spreadsheet rows or Mongo dataset, producing slug, content, schema, and sitemap entry per row.
25. Provide template variable validation and dry-run preview so authors catch missing values before bulk publishing thousands of pages.
26. Implement schema generator UI for Article, Product, FAQ, HowTo, LocalBusiness, Event types with JSON-LD output and validation against Schema.org.
27. Add sitemap auto-submit worker pinging Google and Bing IndexNow endpoints when new URLs publish or change, logging response codes per URL.
28. Build internal-link automation suggesting contextually relevant outbound links per draft based on cluster graph and existing-page embedding similarity.
29. Add bulk-apply mode that opens pull-request-style review of suggested internal links so editors approve or reject before site-wide rollout.
30. Implement A/B testing framework for landing pages and CTAs using cookie-based variant assignment and edge-middleware routing.
31. Track experiment exposures and conversions in `seo_experiments` with sequential-testing math and auto-stop on confident winner detection.
32. Add CRO heatmap collector capturing clicks, scroll depth, and rage-clicks via lightweight script with sampling tied to plan tier.
33. Build session-replay viewer with privacy masking of inputs and PII redaction, retention windows tied to billing plan.
34. Surface CRO insights dashboard correlating heatmap zones, experiment results, and Core Web Vitals to flag friction hotspots per page.
35. Add link-building outreach module managing prospect lists, contact enrichment, sequence templates, and reply tracking via existing email worker.
36. Implement template library with merge tags pulling competitor data, broken-link target, and personalized openers generated by LLM.
37. Track outreach KPIs (sent, opened, replied, link-acquired) with attribution back to originating prospect list and template version.
38. Add reply-classification worker labeling responses as positive, negative, neutral, bounce, OOO with auto-routing into next sequence step.
39. Build social-media calendar with cross-channel scheduling for X, LinkedIn, Facebook, Instagram, Threads via existing connector framework.
40. Implement asset library shared across channels with auto-resize variants, alt-text generation, and approval workflow before publish.
41. Add UTM-builder integrated with calendar so every social post gets normalized tracking params landing in unified analytics warehouse.
42. Wire growth-engine events into SabFlow triggers (`seo.audit.completed`, `seo.rank.changed`, `seo.content.published`) for cross-module automation.
43. Add credit-metering middleware on every external API call, debiting `wallet.seoCredits` and short-circuiting when balance is exhausted.
44. Implement plan-tier feature flags so Free sees teaser data, Pro unlocks rank tracking, Business unlocks AI content, Enterprise unlocks programmatic SEO.
45. Add weekly executive digest email summarizing visibility, top wins, top losses, audit health score, and recommended actions per project.
46. Build public read-only share links for client reports with optional password and expiry, useful for agency tenants serving end clients.
47. Add white-label theming on SEO reports allowing agency workspaces to swap logo, colors, and footer per project.
48. Provide REST and webhook API under `/api/v1/seo/*` for headless integrations, documented via existing OpenAPI generator.
49. Add unit tests for keyword clustering, intent classification, audit-rule engine, and backlink-diff worker reaching 80 percent coverage threshold.
50. Add Playwright end-to-end tests covering audit run, rank-track setup, AI draft creation, A/B experiment lifecycle, and outreach reply parsing.

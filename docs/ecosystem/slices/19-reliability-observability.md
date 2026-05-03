## 19. Reliability & Observability

1. Publish per-module SLOs targeting 99.9% availability for Wachat, SabFlow, CRM, SEO, SabChat with 99.95% for billing-critical paths.
2. Define explicit RTO of 15 minutes and RPO of 5 minutes for tenant data, encoded in DR runbooks under `docs/ops/dr/`.
3. Deploy multi-region active-active across Mumbai and Singapore with Mongo replica sets, Redis Sentinel, and DNS-based traffic steering.
4. Run quarterly DR game days that fail over a region, validate worker drain, and produce a signed restoration report.
5. Maintain immutable backups in cross-region S3 with 30-day retention, weekly restore tests, and tamper-evident object lock.
6. Autoscale BullMQ workers via PM2 ecosystem files keyed on queue depth, lag, and Redis CPU thresholds.
7. Shard Mongo by `tenantId` for high-volume collections (events, messages, campaign logs) once any shard exceeds 500GB.
8. Add Mongo time-series collections for `flow_executions`, `wachat_message_events`, and `seo_crawl_metrics` with automated TTL pruning.
9. Provision read replicas per region and route reporting queries through a `mongoReadPreference=secondaryPreferred` data layer.
10. Cap Redis memory usage at 70% with eviction alerts and automatic standby promotion via Sentinel quorum changes.
11. Instrument frontend with `@opentelemetry/sdk-trace-web` and propagate trace context across `/api/*` routes into BullMQ jobs.
12. Wire OpenTelemetry exporters to a managed OTLP backend (Honeycomb or Grafana Tempo) with tail-based sampling at 10%.
13. Ship a public status page at `status.sabnode.com` listing Wachat, SabFlow, CRM, SEO, SabChat, billing, and auth components.
14. Auto-update status components from synthetic probes plus PagerDuty incident state via the Atlassian Statuspage API.
15. Adopt monthly error budgets per SLO and freeze non-critical deploys when 75% of the budget is consumed mid-window.
16. Run chaos experiments monthly using Litmus or custom fault injectors targeting Redis latency, Mongo step-down, and worker kills.
17. Operate synthetic monitoring per module via Checkly running login, send-message, run-flow, crawl, and chat scenarios every 60 seconds.
18. Embed Real User Monitoring through Sentry Performance or Datadog RUM, capturing INP, LCP, CLS, and route-level errors.
19. Build p99 latency dashboards per Next.js route in Grafana sourced from OTel metrics, broken down by tenant tier.
20. Generate dependency heatmaps weekly from OTel service maps highlighting Mongo, Redis, Firebase, and external API hotspots.
21. Gate production deploys on smoke tests and auto-rollback via Vercel `vercel rollback` when error rate exceeds 2x baseline.
22. Adopt blue/green deploys for PM2 workers using paired ecosystem files and atomic queue handover via Redis ACL keys.
23. Roll out canaries to 5%, 25%, 50%, 100% cohorts driven by a `tenant_canary_bucket` feature flag in Edge Config.
24. Integrate PagerDuty with primary, secondary, and manager rotations, mapped to Wachat, SabFlow, CRM, SEO, and SabChat services.
25. Publish blameless postmortems within 5 business days at `docs/incidents/YYYY-MM-DD-slug.md` with timeline, impact, and corrective actions.
26. Track corrective-action SLAs in Jira with severity-based due dates: Sev1 in 2 weeks, Sev2 in 30 days, Sev3 in a quarter.
27. Implement structured logging via pino with `tenantId`, `userId`, `requestId`, and `traceId` enriched on every line.
28. Centralize logs in Loki or OpenSearch with 30-day hot retention and 1-year cold archive in object storage.
29. Configure Sentry projects per module using `@sentry/nextjs` and `@sentry/node` with release health and session replay enabled.
30. Define alert routing rules so noisy alerts collapse via PagerDuty event intelligence and tenant-impact alerts page primary on-call.
31. Track four golden signals (latency, traffic, errors, saturation) per service in a single Grafana folder owned by SRE.
32. Expose `/api/health` and `/api/ready` endpoints distinguishing liveness from dependency readiness for Mongo, Redis, and Firebase.
33. Add tenant-aware rate limiters via Upstash Redis with per-plan budgets and 429 responses surfaced on the customer dashboard.
34. Write circuit breakers around Meta WhatsApp Cloud API, OpenAI, and Razorpay using `opossum` with bulkheads sized per tenant tier.
35. Persist BullMQ dead-letter queues with 14-day retention, surface counts per queue, and require manual replay sign-off.
36. Tag every Mongo query and BullMQ job with `traceId` so OTel spans correlate end-to-end from browser click to webhook fan-out.
37. Add a `/admin/observability` console showing per-module SLO burn-down, error budget status, and active incidents in real time.
38. Instrument cost telemetry per worker job (Redis ops, Mongo reads, external API calls) and expose tenant-level cost dashboards.
39. Run quarterly load tests with k6 simulating 10x peak Wachat broadcasts and 5x SabFlow execution rate, archiving reports.
40. Maintain a service catalog in Backstage or `docs/services/*.yaml` with owner, SLO, runbook, dashboard, and on-call group references.
41. Enforce deploy windows that block production releases on Fridays after 14:00 IST and during published freeze windows.
42. Automate dependency upgrade testing via Renovate with Playwright and synthetic checks running before merge to `main`.
43. Capture browser-level performance budgets in `lighthouserc.json` and fail PRs that regress LCP by more than 15%.
44. Encrypt all telemetry in transit with mTLS and scrub PII via OTel processors before export to vendor backends.
45. Implement progressive feature flags with kill switches via LaunchDarkly or Edge Config, auditable from `/admin/flags`.
46. Run continuous backup verification jobs that restore a sample tenant nightly into an isolated namespace and diff schemas.
47. Track on-call health with metrics for pages per week, off-hours pages, and unresolved-after-30-minutes counts per rotation.
48. Stand up a war-room workflow in Slack triggered by PagerDuty Sev1 with auto-created Zoom bridge and incident commander assignment.
49. Run a monthly reliability review meeting reviewing SLO attainment, top incidents, chaos findings, and budget burn per module.
50. Maintain a public trust portal exposing uptime history, postmortems, security disclosures, and DR test summaries to enterprise prospects.

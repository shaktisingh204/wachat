## 06. Analytics & BI Suite

1. Audit every existing analytics surface (`src/app/dashboard/analytics`, `crm/analytics`, `email/analytics`, `telegram/analytics`, `sabchat/analytics`, `facebook/commerce/analytics`, `ad-manager/reports`) and catalogue dimensions, measures, and freshness SLAs into a single inventory document.
2. Define a canonical event envelope (`tenantId`, `userId`, `module`, `eventName`, `ts`, `props`, `traits`, `revenue`) and emit it from every server action including `whatsapp-analytics.actions.ts` and `crm-analytics.actions.ts`.
3. Stand up a lightweight `src/lib/analytics/track.ts` SDK with batched HTTP and in-process queueing so route handlers never block on analytics writes.
4. Add a Mongo `events` collection with TTL-tiered indexes (`tenantId+ts`, `tenantId+eventName+ts`) sized for 90-day hot retention before warehouse offload.
5. Replace ad-hoc per-module aggregations (e.g. `src/app/api/sabflow/[flowId]/analytics/route.ts`) with a shared `queryEvents()` helper that enforces tenant scoping.
6. Build a metric registry (`src/lib/analytics/metrics.ts`) mapping logical metrics like `mau`, `revenue`, `messagesSent` to source tables, formulas, and required permissions.
7. Introduce a dimensions registry alongside metrics so the report builder can offer `module`, `channel`, `segment`, `plan`, `country`, `utm_source` consistently.
8. Wire credit usage events from billing into the same envelope so `dashboard/credit-usage` and BI share one source of truth.
9. Ship a unified `/dashboard/insights` landing page that fans out to module dashboards via tabs, replacing the orphan `dashboard/analytics/page.tsx` shell.
10. Add a tenant-scoped "data health" widget showing event counts, last-ingested-at, and dropped-event reasons for ops triage.
11. Migrate `analytics-chart.tsx` and `sms-analytics-charts.tsx` to a shared `<MetricChart>` primitive that accepts a metric id plus dimension breakdown.
12. Standardise date-range, comparison, and granularity controls into `<AnalyticsToolbar>` and adopt across every existing analytics page.
13. Implement saved views (filters + breakdown + chart type) per user with sharing scopes (private, team, tenant) stored in Mongo.
14. Add CSV export to every chart and table via a shared `exportToCsv()` action that respects RBAC and current filters.
15. Backfill module-specific events (broadcasts, flows, ads, deals, tickets) by replaying production logs through the new envelope before cutover.
16. Build the drag-drop report builder UI with a left panel of dimensions/measures, drop zones for rows/columns/filters, and a live preview.
17. Persist reports as JSON specs (`{ metrics, dimensions, filters, viz, schedule }`) and version them so edits do not silently break embeds.
18. Add a SQL/MQL escape hatch for power users with a whitelisted, parameterised query interface gated behind `analytics:write_sql`.
19. Implement shared dashboards composed of report cards on a 12-col grid, with per-card filter overrides and dashboard-level filter pinning.
20. Add a query API at `/api/analytics/query` accepting a report spec, returning paginated rows, with rate limits and per-tenant cost accounting.
21. Build a materialized-view layer with refresh schedules per metric, stored in `src/lib/analytics/materialize/` and orchestrated by the existing PM2 worker.
22. Introduce a real-time vs batch tradeoff flag per metric so high-cardinality metrics use scheduled rollups while ops-critical ones stream.
23. Add a warehouse mirror service supporting BigQuery, Snowflake, and Postgres targets via per-tenant connection configs encrypted at rest.
24. Ship CDC from Mongo change streams to the warehouse with deduping, schema evolution, and a dead-letter queue for poison rows.
25. Provide a "bring your own warehouse" toggle that disables Mongo retention beyond 30 days once a verified mirror is healthy.
26. Build a funnel builder that accepts an ordered list of events with per-step filters and time windows, computing conversion and drop-off.
27. Build a cohort analysis view (acquisition cohort by signup week, retention by week-N active) reused across CRM, SabChat, and Wachat.
28. Add attribution models (last-touch, first-touch, linear, position-based, time-decay) configurable per workspace, applied to revenue events.
29. Build embedded analytics: signed JWT URLs (`/embed/dashboards/[id]?token=`) that lock filters, hide chrome, and respect a row-level filter claim.
30. Add a white-label client portal where agencies expose curated dashboards under their own subdomain and brand via existing tenant theming.
31. Add scheduled email digests (daily/weekly/monthly) rendering report snapshots to PNG via a headless worker and sending through the email module.
32. Add Slack and webhook destinations for digests and alerts using existing notification plumbing rather than new infra.
33. Build a metric alerting engine: thresholds, percent-change vs prior period, and absent-data alerts with mute windows and on-call routing.
34. Add anomaly detection per metric using STL decomposition plus a robust z-score, surfaced inline on charts as shaded bands.
35. Add forecasts (Prophet-style or simple Holt-Winters) for top metrics with confidence intervals shown on the chart.
36. Build the "ML insight" feed: narrative cards like "Revenue down 12% WoW driven by Pro-plan churn in IN" generated by an LLM over pre-computed slice diffs.
37. Add automatic root-cause slicing (which dimension value contributes most to a delta) before LLM narration to keep insights grounded.
38. Add a Google Sheets export and live-refresh connector reusing OAuth from existing Google integrations under `src/lib/google/`.
39. Add a "schedule to drive" option that drops CSV/XLSX snapshots into a tenant-configured Google Drive folder.
40. Add a Looker Studio / Metabase community connector that proxies the query API so customers can use familiar tools.
41. Add privacy-aware sampling: above-threshold tenants get adaptive sampling per event, with on-the-fly weight correction in queries.
42. Add PII tagging on the event envelope and a "BI-safe" view that masks tagged fields by default unless the role grants `analytics:view_pii`.
43. Add a per-tenant data-residency hint that pins warehouse mirroring region (US/EU/IN) for compliance with the existing tenant model.
44. Add row-level security on dashboards via filter claims embedded in the access token, enforced server-side in `/api/analytics/query`.
45. Add a "rate of change" SLA: ingest-to-queryable median <60s for streaming metrics, <15min for batch, exposed on the data-health widget.
46. Add cost guardrails per tenant (rows scanned/day, dashboards/tenant, embeds/tenant) tied to plan tiers via the existing entitlements layer.
47. Add cache layer (Redis) keyed by `(tenantId, reportSpecHash, dateRange)` with cache-tag invalidation on event ingestion for affected metrics.
48. Add an audit log for every dashboard view, export, embed-token mint, and SQL query so security can answer "who saw what when".
49. Add a benchmarking module that anonymises and aggregates cross-tenant medians (opt-in) so customers see how their funnel compares to peers.
50. Ship a marketplace of pre-built report packs per module (Wachat broadcast pack, Ad Manager ROAS pack, CRM pipeline pack, SabFlow run-health pack) installable in one click.

## 03. App Marketplace

1. Scaffold the marketplace storefront under `src/app/(app)/marketplace/page.tsx` with category filters, featured carousel, and search backed by a `marketplace_apps` Mongo collection.
2. Create the `marketplace_apps` schema in `src/lib/db/marketplace/apps.ts` with fields for slug, publisher, category, manifest, pricing, status, and version history.
3. Add app detail route `src/app/(app)/marketplace/[slug]/page.tsx` showing screenshots, scopes requested, pricing tiers, reviews, publisher card, and "Add to SabNode" CTA.
4. Define a JSON manifest spec at `src/lib/sabflow/marketplace/manifest.schema.ts` covering name, scopes, surfaces, webhooks, lifecycle endpoints, OAuth config, and pricing model.
5. Build a publisher portal at `src/app/(developer)/apps/page.tsx` for partners to create, version, and submit apps for review with draft autosave.
6. Implement a multi-stage submission pipeline (`draft → review → certified → published`) tracked in `marketplace_app_versions` with reviewer notes and changelog diff.
7. Wire OAuth scope declaration per app via `src/lib/auth/scopes.ts`, mapping marketplace scopes to existing module permissions used by Wachat, CRM, SabFlow.
8. Render a granular consent screen at `src/app/(app)/marketplace/[slug]/install/page.tsx` listing each requested scope with plain-language descriptions and risk badges.
9. Provision a sandbox install per workspace in `marketplace_installs` with `mode: 'sandbox' | 'live'`, isolating credentials and using ephemeral test data fixtures.
10. Add install lifecycle webhooks (`app.installed`, `app.upgraded`, `app.uninstalled`, `app.suspended`) dispatched via the existing SabFlow webhook infrastructure.
11. Build a certified-partner program admin tool at `src/app/admin/marketplace/partners/page.tsx` for vetting publishers, KYC docs, and badge issuance.
12. Implement a billing rev-share ledger in `marketplace_payouts` capturing 70/30 splits with monthly aggregation jobs run by a PM2 worker.
13. Integrate Stripe Connect Express onboarding for publishers under `src/app/(developer)/apps/payouts/page.tsx` with payout schedules and tax form collection.
14. Define canonical app categories (CRM extensions, Channels, AI, Analytics, Verticals, Productivity, DevTools) in `src/lib/marketplace/categories.ts` with i18n labels.
15. Add a permissions UI inside workspace settings at `src/app/(app)/settings/installed-apps/page.tsx` showing scopes granted, last-used timestamps, and a revoke button per app.
16. Persist install state machine (`pending → active → suspended → uninstalled`) in `marketplace_installs.status` with audit log entries written to `marketplace_audit_log`.
17. Trigger lifecycle hook `onUninstall` to call publisher endpoint, await ack, then enqueue a 30-day data deletion job in BullMQ for GDPR-compliant teardown.
18. Implement a customer review system in `marketplace_reviews` with 5-star ratings, verified-install gating, publisher reply threads, and abuse reporting.
19. Aggregate average ratings nightly into `marketplace_apps.aggregateRating` via a cron worker, plus weighted "trending" score using install velocity and rating recency.
20. Add publisher account model `marketplace_publishers` with team members, MFA enforcement, billing email, support URL, and verified-domain ownership flag.
21. Support four monetization models per app version: free, one-time, subscription, and usage-based, encoded in `manifest.pricing.model` with Stripe price IDs.
22. Meter usage-based apps through SabNode's existing credit system in `src/lib/credits/`, allowing apps to declare custom meters and bill workspaces in their currency.
23. Render the embedded UI surface via sandboxed iframe with `postMessage` bridge defined in `src/lib/marketplace/iframe-bridge.ts`, enforcing origin and capability allowlists.
24. Define extension points (CRM contact-detail panel, SabFlow node, Wachat inbox sidebar, Dashboard widget, Settings tab) registered through `src/lib/marketplace/extension-points.ts`.
25. Ship reusable "Add to SabNode" install button component at `src/components/marketplace/AddToSabnodeButton.tsx` with embeddable script for partner sites and deep-linked install flow.
26. Generate a public partner-hosted JS snippet (`/api/marketplace/embed.js`) that mounts the install button and handles auth redirect back to the marketplace.
27. Add route handler `src/app/api/marketplace/install/route.ts` performing OAuth handshake, scope validation, plan-gate check, and writing the install record atomically.
28. Plan-gate marketplace installs through `src/lib/billing/plan-gates.ts`, restricting paid apps and total install count per plan tier (Starter/Pro/Enterprise).
29. RBAC-guard install actions so only Workspace Owners and Admins (per existing `workspace_members.role`) can install, upgrade, or uninstall third-party apps.
30. Provide a developer CLI (`packages/sabnode-cli/`) for `sabnode app init`, `app dev` (tunnel), `app validate`, `app submit`, mirroring the manifest contract.
31. Build a manifest validator at `src/lib/marketplace/validate-manifest.ts` enforcing schema, scope reachability, URL HTTPS, semver, and screenshot dimensions before submission.
32. Run automated security scans (dependency CVEs, secret leakage, redirect URL allowlist) in a Vercel Sandbox microVM during the review pipeline before reviewer handoff.
33. Add a reviewer console at `src/app/admin/marketplace/review-queue/page.tsx` with diff view, scope-change highlights, test-install button, approve/reject with templated reasons.
34. Version apps with semver and immutable `marketplace_app_versions`, supporting staged rollouts (`rolloutPercent`) and instant rollback by toggling `currentVersion`.
35. Surface upgrade prompts inside `installed-apps` page when newer versions request additional scopes, requiring fresh consent before the upgrade applies.
36. Emit standardized audit events (install, upgrade, uninstall, scope-grant, scope-revoke) into `audit_log` with workspace, actor, app, and IP for compliance exports.
37. Expose a public marketplace REST API at `src/app/api/v1/marketplace/` for listing apps, fetching manifests, and triggering installs from external onboarding flows.
38. Generate per-install signed JWTs (`src/lib/marketplace/install-token.ts`) that apps exchange for short-lived workspace API tokens scoped to declared permissions.
39. Implement a webhook secret-rotation flow in publisher portal with overlapping validity window so partners can rotate without downtime.
40. Add featured/staff-pick curation by admins via a `marketplace_collections` collection (e.g., "Best for Agencies", "AI-Powered", "WhatsApp add-ons") on the storefront.
41. Build vertical bundles (Real-Estate, EdTech, Healthcare) as pre-configured app sets installed in one click, stored in `marketplace_bundles` with bundle-discount pricing.
42. Localize app listings (title, description, screenshots) via `marketplace_apps.translations` keyed by locale, integrated with the existing i18n infrastructure.
43. Track marketplace funnel analytics (impression, detail-view, install-start, install-complete, uninstall, churn) in `marketplace_events` with cohort dashboards for publishers.
44. Provide a publisher analytics page at `src/app/(developer)/apps/[appId]/analytics/page.tsx` with installs, MRR, churn rate, top workspaces, and review sentiment.
45. Enforce Trust & Safety policies via a violation flow that suspends apps automatically on critical CVEs or abuse reports, freezing installs with user-facing notices.
46. Add a sandboxed app-runtime for serverless extensions on Vercel Sandbox so simple JS apps can run without partners hosting infrastructure, billed via usage credits.
47. Support OAuth client federation where SabNode acts as IdP for partner apps, issuing scoped access tokens via PKCE flow at `/oauth/authorize` and `/oauth/token`.
48. Define a stable Webhooks Catalog (`messages.received`, `contact.created`, `workflow.completed`, etc.) with versioning, replay, and per-app subscription filters.
49. Build a partner dispute and refund workflow in `marketplace_disputes` with admin mediation, automated Stripe refund initiation, and rev-share clawback in payout ledger.
50. Publish a public Marketplace Developer Docs site at `/docs/marketplace` covering manifest reference, lifecycle hooks, UI extension points, monetization, review checklist, and brand guidelines.

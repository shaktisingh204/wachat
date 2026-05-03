## 09. Compliance, Security & Audit

1. Establish a SOC 2 Type 2 control matrix mapping each Trust Services Criterion to existing SabNode services like Wachat, SabFlow, CRM, and admin auth flows.
2. Implement a tamper-evident audit log collector at `src/lib/audit/` writing append-only records to a dedicated MongoDB collection with hash-chained integrity per workspace.
3. Build a `/api/audit/events` route that accepts query filters by actor, resource, action, and time window, paginated with cursor-based responses and RBAC enforcement.
4. Add per-resource history viewers under `/admin/audit/[resource]/[id]` rendering a timeline of mutations with diff previews using the existing zinc/amber dark UI.
5. Create a GDPR right-to-erasure pipeline at `/api/compliance/erasure` that fans out deletion jobs across Wachat messages, CRM contacts, SabFlow runs, and Firebase media.
6. Ship a customer-facing data portability endpoint `/api/compliance/export` producing a signed ZIP of JSON/CSV per module, retained for seven days in Vercel Blob.
7. Add a Data Processing Agreement signing flow on the billing settings page that records signature, IP, and timestamp into the workspace compliance document.
8. Gate HIPAA features behind a `phi_enabled` workspace flag that requires a countersigned BAA before unlocking Wachat PHI fields and SabChat encrypted rooms.
9. Implement PHI tagging on CRM custom fields so flagged columns trigger encryption-at-rest with a separate KMS key and exclude from analytics aggregations.
10. Document an ISO 27001 Statement of Applicability mapping Annex A controls to repo paths, runbooks, and PM2 worker policies for the auditor portal.
11. Add a residency selector on workspace creation persisting `region` in `workspaces` collection and routing reads/writes to US, EU, IN, or AU Mongo replica sets.
12. Build a region-aware Mongo client factory in `src/lib/db/regional.ts` resolving the connection string from workspace residency before any tenant query executes.
13. Implement BYOK via AWS KMS with a `kms_key_arn` per workspace, wrapping data encryption keys for Wachat media, CRM PII, and SabFlow credential payloads.
14. Add a key rotation worker that re-wraps DEKs when customers rotate their CMK, surfacing progress in `/admin/security/keys` with a per-resource rewrap counter.
15. Provide an end-to-end encrypted SabChat option using libsignal-style double ratchet, with public keys exchanged through `/api/sabchat/keys` and zero server plaintext.
16. Wire SIEM webhook delivery to Splunk HEC, Datadog Logs, and Elastic via a `siem_destinations` config, replaying audit events through a BullMQ queue with retries.
17. Sign every SIEM payload with HMAC-SHA256 using a per-destination secret and include a monotonic sequence number to let customers detect log drops.
18. Run quarterly third-party penetration tests scoped to Wachat APIs, SabFlow execution sandbox, billing webhooks, and admin auth, tracking findings in `/admin/security/pentests`.
19. Launch a bug bounty program on HackerOne with a published `/security.txt`, safe-harbor language, and tiered payouts for auth bypass and tenant isolation breaks.
20. Add Snyk and Trivy scanners to the CI pipeline blocking merges on critical CVEs in npm dependencies and the production Docker image used for PM2 workers.
21. Enable GitHub Advanced Security secret scanning plus a Gitleaks pre-commit hook to prevent leaks of Mongo URIs, Firebase service accounts, and Razorpay keys.
22. Generate CycloneDX SBOMs per release uploading them to the workspace compliance vault and exposing them at `/api/compliance/sbom?version=` for procurement reviews.
23. Deploy Falco runtime threat detection on the PM2 worker hosts, alerting on unexpected exec, outbound DNS, or writes outside `/var/sabnode/data`.
24. Build DLP rules for Wachat outbound messages scanning for credit card, Aadhaar, and SSN patterns, blocking or redacting based on the workspace `dlp_policy` document.
25. Enforce compliant data exports by encrypting download bundles with a customer-supplied passphrase and logging the export reason to the audit log before signed URL issuance.
26. Add per-data-type retention policies (messages 90d, runs 30d, audit 7y, billing 10y) configured in `/admin/compliance/retention` with a nightly purge worker.
27. Implement legal hold flags on workspaces, contacts, and conversations that block retention purges and erasure jobs until the hold is released by an admin auditor.
28. Add a customer-visible compliance dashboard at `/settings/compliance` summarizing SOC 2 status, last pentest, BAA state, residency, and active legal holds.
29. Capture every admin login, impersonation, and config change from `/admin/*` routes into the audit stream with a distinct `actor.kind = "platform_admin"` discriminator.
30. Provide a Vanta or Drata integration that pulls control evidence from `/api/compliance/evidence` to automate SOC 2 and ISO 27001 continuous monitoring.
31. Encrypt MongoDB at rest using field-level encryption for `users.email`, `contacts.phone`, and `messages.body` with deterministic vs random algorithms chosen per query needs.
32. Rotate Redis and BullMQ connection passwords every 90 days via a scheduled job recorded in audit logs and pushed through the secrets manager to PM2 workers.
33. Implement workspace-scoped IP allowlists on `/api/*` routes, enforced in the existing Next.js middleware ahead of session validation to reduce blast radius.
34. Add SCIM 2.0 provisioning at `/api/scim/v2/*` for enterprise Okta and Azure AD tenants, with audit events for every user create, update, deprovision, and group change.
35. Enforce step-up MFA via WebAuthn for sensitive operations like billing changes, workspace deletion, BYOK rotation, and SabFlow credential edits.
36. Build a privacy request inbox at `/admin/privacy/requests` ingesting GDPR, CCPA, and LGPD asks with SLA timers, assignee routing, and customer-visible status updates.
37. Tokenize payment instruments through Razorpay/Stripe vaults so SabNode never stores PAN, with PCI DSS SAQ-A scope confirmed in the compliance dashboard.
38. Add a data classification taxonomy (public, internal, confidential, restricted, PHI) applied as Mongo field metadata and surfaced in CRM column settings.
39. Stream all `audit.events` to an immutable S3 Object Lock bucket per region with seven-year WORM retention satisfying SOC 2 CC7.2 and HIPAA 164.312(b).
40. Run automated DAST scans (OWASP ZAP) against staging on every release candidate, posting findings to `/admin/security/scans` and gating production promotion on no high-severity issues.
41. Add a `/api/compliance/erasure/preview` endpoint that returns counts of affected records across modules so customers can confirm scope before committing erasure.
42. Implement break-glass admin access requiring a documented justification, dual approval, and a 60-minute auto-expiring elevated session logged to a separate vault.
43. Build a tenant isolation test harness in CI that spins two workspaces and asserts no cross-tenant reads via the Wachat, CRM, SabFlow, and audit APIs.
44. Add anomaly detection on auth events flagging impossible travel, brute-force, and credential-stuffing patterns into a `security_alerts` queue with Slack and email channels.
45. Encrypt SabFlow credential vault entries with envelope encryption, never decrypting in the browser and exposing only redacted previews to canvas node configs.
46. Provide a customer-managed audit log export at `/api/audit/export` producing JSONL chunks signed with the workspace KMS key for offline forensic analysis.
47. Add a vulnerability disclosure policy page at `/legal/vdp` and a triage workflow in `/admin/security/disclosures` tracking severity, owner, ETA, and public advisory drafts.
48. Implement granular consent receipts for marketing messages stored in `wachat_consents` with timestamp, channel, locale, and the exact opt-in copy shown to the contact.
49. Add a quarterly access review job that emails workspace owners a list of admins, integrations, and API keys, requiring confirmation logged to the compliance audit trail.
50. Publish a public Trust Center at `/trust` exposing certifications, subprocessor list, status page, recent pentest summaries, and downloadable SOC 2, ISO 27001, and HIPAA evidence packages.

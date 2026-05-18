# SabFlow Marketplace — Review Criteria

- **Track / Phase / Sub-task:** Track C · Phase 10 · #4
- **Status:** Proposed (partner-facing draft)
- **Owner:** SabFlow marketplace on-call (reviewers rotate per the `#sabflow-marketplace` schedule)
- **Related:** `docs/partners/marketplace-contributing.md` (the lifecycle this review sits inside), `docs/partners/marketplace-template-spec.md` (the schema the harness checks), `src/lib/sabflow/validation.ts` (the graph validator that backs the automated lint pass), `src/lib/marketplace/lifecycle.ts` (the install-side runtime that approved templates ultimately flow into).

> Scope. This document is the **objective bar** a SabFlow template must clear to ship in the marketplace. It is partner-facing — anything below is something a reviewer can point to when requesting changes or rejecting a submission. Reviewers do **not** apply unwritten standards; if a rejection cites something not on this page, escalate per `marketplace-contributing.md` §3.3 and the page will be updated.

---

## 1. How the review pipeline works

1. **Automated lint** — server-side run of `@sabnode/sabflow-template-cli verify` at the pinned version. Result is appended to the submission as a system comment within ~30 seconds.
2. **Reviewer assignment** — a human reviewer is auto-assigned within 1 business day. The reviewer's handle is shown on the submission page.
3. **Human review** — the reviewer walks the criteria below, in order, and either approves, requests changes, or rejects. Notes are added inline on the submission page.
4. **First response SLA** — **7 business days** from submission to first response. Re-submissions after a `changes_requested` are 5 business days. Both SLAs are measured from the partner's last action.

A rejection is **terminal** for the submission id, but the partner can submit a fresh template with the same content and an explanation of why the rejection reason no longer applies. Re-submitting an unchanged rejected template against the same submission id auto-closes as `duplicate_rejection`.

---

## 2. Categories of review

The reviewer walks five categories, top-to-bottom. A failure in any **must-fix** category gates approval; **soft** items produce `changes_requested` but a partner may dispute with rationale.

| Category | Sample weight | Gate |
| -------- | ------------- | ---- |
| §3 Identity & metadata | every submission | must-fix |
| §4 Structure & validation | every submission | must-fix |
| §5 Security & data handling | every submission | must-fix |
| §6 Usability & UX | every submission | mixed |
| §7 Documentation & support | every submission | mixed |

§8 lists outright disqualifiers (auto-reject without manual review).

---

## 3. Identity & metadata

What the reviewer checks against `template.json` top-level fields. Failures here are must-fix.

- [ ] **`id` uniqueness.** Auto-checked by the harness against the published registry. A collision with an unlisted template (within the 30-day grace window) is also a collision — wait the 30 days or pick a different slug.
- [ ] **`id` style.** Lowercase, kebab-case, `^[a-z0-9-]{3,48}$`. No vendor branding that misrepresents authorship (e.g. don't submit `slack-official-*` unless you are Slack).
- [ ] **`name` quality.** Title-cased English (localization is forward-ref Phase C.12). Length 4–60. Must describe the workflow's *outcome*, not the technology stack — "Lead → WhatsApp Welcome" is good; "Twilio + HubSpot Integration" is borderline; "v2 final final" is rejected.
- [ ] **`description` quality.** 40–280 chars, plain text. Must say (a) what triggers the flow, (b) what the flow does, (c) what the tenant ends up with. Reviewers reject descriptions that are pure marketing ("The best workflow ever!") or pure restatement of the name.
- [ ] **`category` correctness.** The category must match the dominant business function, not the integration. A "Stripe payment → CRM update" is `finance` if the value is the payment ledger, `crm` if the value is the deal record. When in doubt the reviewer picks the category most users will search under, and the partner may request a different one with rationale.
- [ ] **`tags` quality.** Useful, lowercase, no vendor stuffing ("hubspot-killer"), no `seo:*` keyword-spam patterns, no profanity. Max 8 tags; reviewers will trim and explain.
- [ ] **`version` discipline.** First submission must be `>=0.1.0`. Subsequent submissions must monotonically increase. Re-submissions after `changes_requested` should bump `PATCH` if the change is editorial-only, `MINOR` for new blocks/variables.

---

## 4. Structure & validation

These are largely covered by the automated lint, but the reviewer double-checks the *intent* behind warnings.

- [ ] **Verification harness clean.** Zero errors. Warnings allowed but each visible warning will surface as a yellow chip on the public listing — the reviewer asks the partner whether each warning is intentional. Common intentional warnings: empty default branch in a `condition`, deliberately-unused variable for tenant customization.
- [ ] **Single-purpose template.** The flow does **one** identifiable thing. A template that does "send email + sync CRM + post to Slack + create Notion page" is rejected with `multi_purpose_split_required` — the partner should split into multiple templates or use a leaner block list. Rule of thumb: if you can't describe the template in one sentence without "and then", it's multi-purpose.
- [ ] **Linear or simply-branched.** Templates should be readable on the canvas without scrolling at default zoom (1280×800 preview). Heavy branching (>4 condition items) is acceptable for support-routing templates; it's rejected for marketing flows.
- [ ] **Reasonable block count.** **2–25 blocks** is the comfort range. <2 is "this isn't really automating anything" and gets rejected. >25 is reviewed case-by-case; reviewers favour splitting into a parent + child workflow pattern (forward-ref Phase C.11 sub-flows).
- [ ] **Variable hygiene.** Every declared variable is referenced somewhere; every referenced token resolves to a declared variable or a standard runtime binding. The harness flags both as warnings; the reviewer promotes either to must-fix when the variable list is clearly aspirational ("variables I might use later").
- [ ] **No dead branches.** Every `condition.items[]` and `ab_test.items[]` entry has an outgoing edge. A literal `is_empty` default branch with no edge is rejected — at minimum wire it to a `text` block that says "no action taken" so the canvas reads cleanly.
- [ ] **Trigger sensibility.** `webhook` trigger paths under `/webhooks/<partner-suffix>/` (the platform rewrites the path at install but reviewers check for sensible suffixes). `schedule` triggers do not request sub-5-minute cadence. `app_event` triggers reference a valid event from the registered catalogue.

---

## 5. Security & data handling

Failures here are must-fix and several auto-reject (see §8). This is the strictest review section.

- [ ] **No real secrets.** No API keys, OAuth tokens, JWTs, signed URLs, or passphrases in the template. The harness's entropy heuristic catches most of these; reviewers spot-check the rest. Real secrets are an immediate `security_secret_leak` rejection and the partner profile is flagged for follow-up.
- [ ] **No hard-coded customer-PII.** No real names, emails, phone numbers, addresses, or payment card data. Demo data must be **obviously synthetic** (`example@example.com`, `+1 555 0100`, etc.).
- [ ] **No external file URLs.** Anywhere a file is referenced (email attachment, logo, OG image, document), the value is a `sabfile://` URI. Per SabFiles policy (`CLAUDE.md`), every file in SabNode lives in SabFiles. Free-text URLs to S3, R2, Google Drive, Dropbox, or any other host are rejected.
- [ ] **Credential references use the picker pattern.** Templates reference credentials by *id* via the SabFlow credential-picker pattern (`"credentialId": "{{credentials.<service>.<role>}}"`) — never by inlined value. The tenant binds the actual credential at install time.
- [ ] **No SSRF surfaces.** Outbound `webhook` blocks targeting `http://` (not `https://`), `localhost`, `127.0.0.1`, RFC-1918 private ranges, link-local (`169.254.0.0/16`), or `metadata.google.internal` are rejected. The harness blocks the obvious cases; the reviewer reads the URL field for templated injection (e.g. `https://api.example.com/{{user.input}}` is acceptable; `{{user.input}}` alone is rejected).
- [ ] **No raw DB / R2 access.** Templates do not use `forge_raw_sql`, raw R2 SDK calls, or direct Mongo URIs. These are not in the partner-safe block allowlist (§3.2 of the spec doc) and the harness rejects them at lint time — reviewers re-confirm by reading the block list.
- [ ] **Rate-limit awareness.** Templates that send messages (`forge_twilio`, `forge_slack`, `send_email`, etc.) in a tight loop without a `wait` block are reviewed for spam potential. A bulk-send pattern without rate limiting is rejected with `rate_limit_unsafe`; the partner adds a `wait` step or a per-recipient `condition`.
- [ ] **GDPR / consent.** Templates that send marketing communications (mass email, SMS, WhatsApp marketing) include a `condition` block that checks an `optedIn` variable, or include the consent check in the trigger filter. Reviewers reject "broadcast to every contact" templates that lack a consent gate.

---

## 6. Usability & UX

A mix of must-fix and soft items. Reviewers focus on what the tenant experiences on first install.

- [ ] **Setup is obvious.** A first-time tenant should be able to install, fill in variables, bind credentials, and run a test execution within **5 minutes**. The reviewer simulates this and rejects templates that require reading docs to figure out what each variable is for.
- [ ] **Variable names are self-explanatory.** `lead.email` is good; `v1` is rejected. Variables that *do* need explanation get a `defaultValue` that hints at the format (e.g. `+15551234567`).
- [ ] **Group titles are meaningful.** Even though the platform auto-titles groups as `Step 1`, `Step 2`, etc., partners can override with the canvas. If overridden, titles describe the **outcome** ("Send welcome email") not the **action** ("HTTP POST"). This is a soft item.
- [ ] **Preview image quality.** 1280×800 PNG, default canvas zoom, clean background, all nodes legible. Reviewers reject blurry, cropped, or post-processed previews (no fake annotations, no marketing overlays).
- [ ] **Icon (if supplied) renders at 64×64.** PNG or SVG. Single-colour or two-colour designs work better than photographic icons. Soft item — falls back to the category default if rejected.
- [ ] **Description matches the actual flow.** If the description says "sends an SMS", there's a Twilio block. Mismatches between marketing copy and implementation are a must-fix rejection.
- [ ] **Default values are safe.** A `defaultValue` for `recipient.email` should be empty (`""`), not `"test@example.com"` — accidental test deliveries after install are a common source of partner support tickets.

---

## 7. Documentation & support

The minimum-viable doc the partner ships *inside* the template.

- [ ] **Trigger documentation.** If the trigger is `webhook`, the description (or a hosted partner doc linked from `publisher.homepageUrl`) tells the tenant how to wire up the webhook on the upstream system. Reviewers spot-check the doc renders and links don't 404.
- [ ] **Credential documentation.** Each unique credential the template needs is mentioned by the third-party service's actual name (e.g. "HubSpot Private App token", not "the API key"). The link to where the tenant gets that credential is provided either in the description or in the partner's hosted docs.
- [ ] **Working `supportEmail`.** Reviewer sends a test ping; bouncing addresses are a soft rejection.
- [ ] **Homepage resolves.** Reviewer follows `publisher.homepageUrl`; broken links are a soft rejection. Domains under construction (`example.com`-style placeholder pages) are acceptable for the first submission but flagged.
- [ ] **Source repo (if listed).** `publisher.sourceRepoUrl` must be publicly accessible and contain at minimum the submitted `template.json`. Private repos are rejected — either remove the field or open the repo.

---

## 8. Auto-reject — disqualifying patterns

The following are **terminal** rejections at lint time and do not enter human review. Submissions in these categories are returned within 2 business days with the reason code below.

- [ ] **`security_secret_leak`** — real-looking credential material in the template. Profile is flagged; re-submissions are reviewed manually for 90 days.
- [ ] **`security_ssrf_surface`** — unrestricted `{{token}}`-only URL, or hostname targets blocked ranges.
- [ ] **`security_external_file_url`** — non-SabFiles file URLs.
- [ ] **`security_raw_sql`** — `forge_raw_sql` or direct DB URI present.
- [ ] **`block_type_not_allowed`** — `block.type` outside the partner-safe allowlist.
- [ ] **`id_reserved`** — `id` collides with an existing or grace-windowed template.
- [ ] **`multi_trigger`** — `events[]` exposed (partners specify `trigger` singular).
- [ ] **`partner_agreement_missing`** — Partner Program agreement not signed for the publishing account.
- [ ] **`copyright_violation`** — preview image, icon, or copy clearly copied from another publisher's listing or an unrelated brand without authorization. Manually triaged but rejection is terminal.
- [ ] **`malware_indicator`** — any indication the template is designed to ex-filtrate data (e.g. an outbound webhook to a known-bad host, base64-encoded payloads that decode to known C2 patterns). Profile is suspended pending security review.
- [ ] **`abuse_resubmission`** — same rejected content re-submitted under a different `id` >= 3 times.

---

## 9. Soft criteria — `changes_requested` rather than rejection

Items below typically yield a `changes_requested` note with a suggested fix, not an outright rejection.

- [ ] Description is too short, too long, or marketing-only.
- [ ] Variable list contains never-referenced entries.
- [ ] Some tokens reference undeclared variables (often a typo).
- [ ] Group titles are uninformative.
- [ ] Preview image is acceptable but blurry / cropped.
- [ ] `condition` block lacks a default branch (recommended even when not strictly required).
- [ ] No `wait` block between bulk-send steps (rate-limit nudge).
- [ ] Missing optional consent-gate `condition` for marketing-style flows.
- [ ] Test execution from the editor fails because of a third-party rate limit (reviewer will retry but ask the partner to investigate).

A partner may push back on any soft item with rationale; the reviewer either accepts the rationale (and the warning ships as a yellow chip on the listing) or escalates internally.

---

## 10. Re-review triggers — when an approved template gets re-reviewed

Approval is **not** permanent. The following trigger a re-review of an already-published template:

- [ ] **Major version bump.** Any `MAJOR` semver bump on update triggers a full re-review against §3–§9, not just the diff.
- [ ] **Block-type allowlist change.** When the platform adds or removes block types from the allowlist (§3.2 of the spec doc), all published templates referencing the affected types are re-reviewed within 30 days.
- [ ] **Security policy change.** A new entry in §5 / §8 triggers re-review of all currently-published templates within 30 days.
- [ ] **Incident report.** A confirmed `marketplace-incidents@sabnode.com` report against a published template triggers an immediate hotfix-unlist (within 1 business hour) and a re-review before the template is re-published.
- [ ] **Install-flow churn.** A published template with >5× the average uninstall rate over a 14-day window is flagged for re-review; reviewer reaches out to the partner with the install/uninstall ratio data.
- [ ] **Partner profile change.** Material changes to the partner's legal display name, support email, or homepage URL trigger re-attribution review on every published template — typically resolved within 2 business days.

Re-reviews follow the same SLA as new submissions (7 business days) but partners are notified up front, with the deadline by which the template must be brought back into compliance. Templates that fall out of compliance and are not fixed within the deadline are unlisted.

---

## 11. Appeals

Partners may appeal any rejection or `changes_requested` note that they believe applies a standard not on this page. Process:

- [ ] Reply to the submission with the rationale, citing the specific check that you believe was misapplied.
- [ ] The assigned reviewer responds within 2 business days. If the reviewer agrees, the submission is reopened.
- [ ] If the reviewer disagrees, the appeal is auto-escalated to the marketplace lead at `marketplace-escalation@sabnode.com`. Lead response within 3 business days.
- [ ] Lead's decision is final for the submission. If the appeal exposes a gap in this document, the document is updated and the partner is notified once the update lands.

There is no formal "appeals board" — escalation goes to the marketplace lead and stops there. Repeated frivolous appeals (≥3 in 30 days, all denied) trigger an `abuse_escalation` flag on the partner profile, which extends the review SLA to 14 days for that profile.

---

## Summary (≤200 words)

A SabFlow template is reviewed against five categories: **identity & metadata** (slug uniqueness, semver discipline, accurate category, useful name/description), **structure & validation** (clean harness run, single-purpose flow, 2–25 blocks, no dead branches, sensible trigger), **security & data handling** (no real secrets, no hard-coded PII, SabFiles-only file refs, credential-picker pattern, no SSRF surfaces, no raw SQL, rate-limit awareness, GDPR consent for marketing sends), **usability & UX** (5-minute first-install, self-explanatory variables, clean preview), and **documentation & support** (working `supportEmail`, resolving `homepageUrl`, trigger and credential docs). First-response SLA is **7 business days** new / **5 business days** re-submissions. Hard auto-rejects are: real secrets, SSRF surfaces, external file URLs, raw SQL, non-allowlisted block types, multi-trigger, missing Partner Agreement, copyright violation, malware indicators, abuse-pattern re-submission. Soft criteria yield `changes_requested` with a suggested fix; partners may push back with rationale. Approval is not permanent — major semver bumps, allowlist changes, policy updates, and confirmed incident reports trigger re-review on a 7-business-day SLA. Appeals go to the assigned reviewer first, then escalate to the marketplace lead — that decision is final.

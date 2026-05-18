# SabFlow Marketplace — Partner Contributing Guide

- **Track / Phase / Sub-task:** Track C · Phase 10 · #4
- **Status:** Proposed (partner-facing draft)
- **Owner:** SabFlow marketplace on-call
- **Related:** `docs/partners/marketplace-template-spec.md` (the `template.json` schema reference), `docs/partners/marketplace-review-criteria.md` (the approve / reject bar), `src/lib/sabflow/recipes/types.ts` (the in-repo `Recipe` shape this guide is layered on top of), `src/lib/sabflow/recipes/registry.ts` (`instantiateRecipe` — what runs when a tenant clicks "Use template").

> Scope. This guide covers the **SabFlow template marketplace** — workflow recipes that ship in the in-product gallery and instantiate into a tenant's `SabFlowDoc`. It does **not** cover the `src/lib/marketplace/` *app* marketplace (third-party UI/OAuth apps with manifests, scopes, and install callbacks) — that has its own developer flow.

---

## 1. What a SabFlow template is

A SabFlow template is a pre-built workflow that lands in the in-product template gallery (`/dashboard/sabflow` → "Use a template"). When a tenant picks one, the runtime calls `instantiateRecipe(recipeId, tenantId)` and writes a fresh `SabFlowDoc` into their workspace — with **new** ids for every block, group, and edge so two flows built from the same template never collide.

In the current shipping codebase a template is a TypeScript `Recipe` declared in `src/lib/sabflow/recipes/<your-slug>.ts`. This guide describes a **partner-facing wrapper** — `template.json` — that produces the same `Recipe` shape via a portable file. Partners do not edit TypeScript; they submit `template.json` and the marketplace ingestion job converts it to a registered recipe.

Every template carries:

- **Identity** — stable id, name, category, description, tags.
- **Trigger** — exactly one `SabFlowEvent` (webhook, schedule, manual, or app-event) that starts the flow.
- **Variables** — declared up front so the variable panel can render them and the validator can resolve `{{token}}` references.
- **Blocks** — the ordered step list. Each block has a `type` (must be in the supported-types allowlist — see §3 of `marketplace-template-spec.md`), a `groupId` (logical canvas step), and `options` (block-typed config).
- **Attribution** — publisher name, support email, and homepage / source link.

The full field-by-field schema lives in `marketplace-template-spec.md`. This document covers the **lifecycle around** that schema — how to author, verify, submit, and maintain a template.

---

## 2. Authoring workflow

The partner authoring loop is local-first: write the file, run the verification harness, screenshot the rendered flow, then submit. No marketplace credentials are needed until submission.

### 2.1 Pick the right category and slug

- [ ] Open the live category list in `src/lib/sabflow/templates/index.ts` (`CATEGORY_LABELS`). Categories are: `sales`, `marketing`, `support`, `ops`, `finance`, `crm`, `whatsapp`, `ecommerce`, `ads`, `onboarding`. The picker hides empty categories — new categories require a platform-side change and are not partner-modifiable.
- [ ] Choose a kebab-case slug: lowercase, `[a-z0-9-]{3,48}`, must not collide with any existing recipe id. Existing ids are listed in the public registry endpoint `GET /api/v1/marketplace/templates`. Reservation is first-come-first-serve at submission time.
- [ ] Pick exactly one **primary** category. Cross-category templates are fine — surface secondary categories through `tags[]`, not by listing more than one category.

### 2.2 Write `template.json`

- [ ] Start from one of the skeletons in `marketplace-template-spec.md` §6 (webhook-triggered, schedule-triggered, or manual-triggered). The skeletons mirror the in-repo recipes one-for-one — pick the shape closest to your use case.
- [ ] Keep the trigger **one event only**. Multi-trigger templates are a platform-side feature (forward-ref to Phase C.11) and partner-submitted templates with `events.length !== 1` are rejected by the harness.
- [ ] Use the standard `{{variable.name}}` token format for runtime substitution. The validator resolves every token against `variables[].name` — undeclared names produce a warning per `validateFlow` (`src/lib/sabflow/validation.ts`).
- [ ] **Credentials.** Templates must **not** embed real credentials, API keys, tokens, or OAuth secrets. Use placeholder values that the tenant will fill in during the post-install setup step (e.g. `"apiKey": "{{credentials.your-service.apiKey}}"`). Any blob that looks like a secret (matches the entropy heuristic in the harness) is auto-rejected.
- [ ] **SabFiles.** Anywhere your template needs a file (logo on an email, image attachment, PDF receipt), reference the SabFiles picker output as a path or `sabfile://` URI. Never paste a free-text URL — that path is rejected platform-wide (see `CLAUDE.md` → "SabFiles policy").

### 2.3 Run the verification harness locally

The harness is shipped as a CLI wrapper around the in-repo validator (`validateFlow`) plus a marketplace-specific overlay (allowlisted block types, attribution presence, no embedded secrets, no external HTTP URLs outside SabFiles).

- [ ] `npx @sabnode/sabflow-template-cli verify ./template.json`
- [ ] The CLI prints a stable diff-friendly report: errors (block submission), warnings (don't block submission but show on the public listing as a yellow badge), and an instantiation preview (the `SabFlowDoc` that would be persisted on first install).
- [ ] **Exit code semantics.** `0` = ready to submit. `1` = errors must be fixed. `2` = harness itself failed (network, missing toolchain) — file a bug, don't submit.
- [ ] Re-run on every edit until clean. The harness is the canonical pre-submission gate; reviewers run the **same** harness with the same version pin on the submission server, so a clean local run means a clean automated review.

### 2.4 Capture a preview asset

- [ ] Open the local SabFlow editor against the harness's instantiation output (`npx @sabnode/sabflow-template-cli preview ./template.json` opens `localhost:3000/dashboard/sabflow/preview?inline=<base64>`).
- [ ] Take **one** PNG of the canvas at default zoom. Dimensions: 1280×800, transparent or `#0a0a0a` background. Reviewers reject blurry screenshots and screenshots that crop the trigger node.
- [ ] Upload the preview through SabFiles (`__system/marketplace/previews/`) and reference the resulting `sabfile://` URI in `template.json.preview`. Do not host the preview anywhere else.

---

## 3. Submission flow

Submissions go through the marketplace API and surface in the partner dashboard at `/dashboard/marketplace/submissions`. Partners need a SabNode account; no separate partner account exists.

### 3.1 First-time submitter checklist

- [ ] Create a SabNode account if you don't have one.
- [ ] Sign the Partner Program agreement at `/dashboard/marketplace/partner-agreement`. Required once per publisher identity. Without a signed agreement, the submission endpoint returns `403 partner_agreement_missing`.
- [ ] Provide attribution metadata in your partner profile: legal display name, support email, homepage URL, optional logo (uploaded through SabFiles). This data is mirrored into every template you submit — see §5.

### 3.2 Submit

- [ ] `npx @sabnode/sabflow-template-cli submit ./template.json --asset ./preview.png`
- [ ] The CLI uploads `template.json`, the preview asset (through SabFiles), and the harness report. It returns a submission id (`tpl_sub_<24-char>`).
- [ ] The submission lands in `marketplace_template_submissions` with `status: 'pending_review'` and triggers the automated lint pass (re-runs the verification harness server-side at the pinned version) + queues human review.
- [ ] Track progress at `/dashboard/marketplace/submissions/<id>`. Status transitions: `pending_review` → `in_review` → (`approved` | `changes_requested` | `rejected`).
- [ ] If `changes_requested`, fix the items in the review note, bump `version` in `template.json`, and re-submit through the same CLI — re-submissions inherit the same submission id thread.

### 3.3 Review SLA

- [ ] **First response** within **7 business days** (Mon–Fri, excluding US public holidays). "First response" = either an approval, a rejection, or a `changes_requested` review note.
- [ ] Re-submissions after `changes_requested` re-enter the queue with **5 business days** SLA, not 7 (we already have context).
- [ ] If the SLA lapses without a first response, email `marketplace-escalation@sabnode.com` referencing your submission id. Escalations are responded to within 2 business days.

### 3.4 Approval → publish

- [ ] On approval the platform writes `marketplace_templates.<recipeId>` with `status: 'published'` and the recipe immediately appears in the in-product gallery for every tenant. There is no separate publish button — approval *is* the publish.
- [ ] A signed listing URL (`/marketplace/templates/<recipeId>`) is returned. Share it freely.
- [ ] Install metrics (install count, last-install timestamp, weekly delta) become visible in the partner dashboard. No PII is shared — only aggregate counts.

### 3.5 Updating a published template

- [ ] Edit `template.json`, bump `version` (semver — `MAJOR.MINOR.PATCH`). The harness rejects re-submissions that don't bump the version.
- [ ] `npx @sabnode/sabflow-template-cli submit ./template.json --update`
- [ ] Updates go through the same review pipeline. The previously-published version stays live in the gallery until the new version is approved, so there is no end-user-visible gap.
- [ ] **Breaking changes** — any change that alters the trigger event id, removes a variable, or changes a variable's `name` — require a `MAJOR` bump and trigger a re-review against the full criteria, not just the diff.

### 3.6 Deprecating / unlisting

- [ ] `npx @sabnode/sabflow-template-cli unlist <recipeId> --reason "<short string>"`
- [ ] Unlisted templates are hidden from the gallery within 5 minutes but remain installable via direct deep-link for **30 days** so existing tenants who bookmarked the URL aren't surprised.
- [ ] After 30 days the template is moved to `status: 'archived'` and direct-link installs return 404. Already-instantiated flows on tenant accounts are untouched — unlisting does not delete tenant data.

---

## 4. Verification harness — usage details

The harness is the contract between partner and reviewer. Everything below is what it runs.

### 4.1 Install

- [ ] `npm i -g @sabnode/sabflow-template-cli` (or use `npx` per command).
- [ ] Toolchain pin: the CLI version **must** match the marketplace's `cliVersion` returned by `GET /api/v1/marketplace/version`. Mismatched versions exit with code `2` and a `cli_out_of_date` error.
- [ ] No login required for `verify` / `preview`. Only `submit` / `unlist` need a SabNode auth token (`vercel env`-style: `SABNODE_TOKEN` env var, or `--token` flag).

### 4.2 Checks performed (in order)

| Phase | Check | Severity | Source |
| ----- | ----- | -------- | ------ |
| Schema | `template.json` parses as JSON | error | CLI |
| Schema | Every required field present (`id`, `name`, `version`, `category`, `description`, `trigger`, `variables`, `blocks`, `publisher`) | error | `marketplace-template-spec.md` §2 |
| Schema | `id` matches `^[a-z0-9-]{3,48}$` and is not reserved | error | CLI |
| Schema | `version` is valid semver | error | CLI |
| Schema | `category` is in the supported list | error | `src/lib/sabflow/templates/index.ts` |
| Block | Every `block.type` is in the allowlist (see spec §3) | error | CLI |
| Block | Every block's `options` validates against its per-type schema | error | per-block validators in `src/lib/sabflow/n8n/node-parameters/` |
| Graph | `validateFlow(instantiateRecipe(template))` returns no errors | error | `src/lib/sabflow/validation.ts` |
| Graph | `validateFlow` returns no warnings | warning | `src/lib/sabflow/validation.ts` |
| Tokens | Every `{{token}}` resolves to a declared variable or a standard runtime binding (`$now`, `$execution.id`, etc.) | error | CLI |
| Tokens | Variables declared but never referenced | warning | CLI |
| Security | No embedded secrets (Shannon-entropy heuristic over string values >= 24 chars) | error | CLI |
| Security | No external HTTP(S) URLs outside SabFiles for file inputs | error | CLI |
| Security | No raw R2 keys, S3 ARNs, or credential field shapes | error | CLI |
| Trigger | Exactly one `events[]` entry; type in `webhook` / `schedule` / `manual` / `app_event` | error | CLI |
| Attribution | `publisher.name`, `publisher.supportEmail`, `publisher.homepageUrl` all present | error | CLI |
| Attribution | Publisher matches the authenticated SabNode account (at submit time only) | error | server |
| Preview | `template.json.preview` resolves to a SabFiles object | error (at `submit`) | server |
| Preview | Preview image dimensions 1280×800 | warning | server |

### 4.3 Reading the report

The report is JSON-first; the CLI also pretty-prints it. JSON shape:

```json
{
  "ok": false,
  "errors": [
    { "id": "block:b_wa_send:invalid_options", "message": "...", "blockId": "b_wa_send" }
  ],
  "warnings": [
    { "id": "missing_variable:b_receipt:token:customer.id", "message": "...", "blockId": "b_receipt" }
  ],
  "preview": { "groups": [...], "edges": [...], "variables": [...] }
}
```

`ok: true` ⇒ exit code `0`. Errors map to in-product validation rules; warnings show up as yellow chips on the listing page after publish but don't block submission. The `preview` payload is the exact `SabFlowDoc` shape that `instantiateRecipe` would produce, with the partner-side `id` field replaced and ids re-keyed.

### 4.4 CI integration

Partners maintaining a public template repo should wire the harness into CI. Recommended GitHub Actions step:

```yaml
- name: SabFlow template verify
  run: npx @sabnode/sabflow-template-cli verify ./templates/*.json
```

A green CI run is *not* an approval — it's the same gate `submit` would hit, run earlier. Submission is still the only path that reaches human review.

---

## 5. Attribution & listing data

Every published template renders three attribution rows on its listing page:

- **Publisher** — display name from your partner profile (linkified to `publisher.homepageUrl`).
- **Support** — `mailto:` link to `publisher.supportEmail`.
- **Source** — optional `publisher.sourceRepoUrl` link to a public Git repo. Strongly recommended for open-source templates; helps reviewers diff updates faster.

Attribution rules:

- [ ] The publisher name shown on a template **must** match the legal display name on file in the partner profile. Co-branded listings (`"Acme + SabNode"`) require a written agreement — email `marketplace-partners@sabnode.com`.
- [ ] One template, one publisher. We don't support multi-publisher attribution on a single recipe today.
- [ ] Logos go through SabFiles (`__system/marketplace/publishers/<userId>/logo.png`). Recommended dimensions 512×512 PNG, transparent background.

---

## 6. Revenue share — TBD (deferred)

Revenue share is **deferred pending billing review**. The pricing/commission split, payment cadence, and reporting view are all open issues owned by the SabNode billing team (forward-ref to Phase C.11 + the billing-review roadmap item).

Until that lands:

- [ ] All partner-submitted templates ship **free-to-install** to end-tenants. There is no paid-template tier yet.
- [ ] Templates may reference paid third-party services (e.g. an OpenAI block), but that cost flows through the **tenant's** account with the third party — not through SabNode billing.
- [ ] When revenue share lands, every existing partner will receive a 30-day written notice and a one-click migration to opt in. No retroactive monetization will be applied to already-published templates without the publisher's explicit consent.
- [ ] Track the rollout in `docs/adr/sabflow-marketplace-revshare.md` (TBD, not yet written).

---

## 7. Versioning & deprecation policy

- [ ] **Semver, strictly.** `MAJOR` for breaking changes (variable removal, trigger swap, block-type removal). `MINOR` for additive changes (new blocks, new variables with safe defaults, new optional config). `PATCH` for fixes (copy edits, comment changes, escaped-token bugfix).
- [ ] **Existing installs** keep running on the version they were instantiated from — updating a template does **not** retro-modify tenant flows. Tenants who want the new version must re-install.
- [ ] The gallery always shows the latest published version. Older versions remain installable via `?version=<v>` query string for **180 days** after a newer version supersedes them.
- [ ] Templates with **zero installs over 90 days** are auto-flagged for the partner with a "consider unlisting" reminder. They are not auto-unlisted.

---

## 8. Communication channels

- [ ] **General questions:** `marketplace-partners@sabnode.com`. First response within 2 business days.
- [ ] **Submission help:** Comment on your submission at `/dashboard/marketplace/submissions/<id>`. The reviewer assigned to your submission is the right thread to use; this routes faster than email.
- [ ] **Incidents** (your published template is malfunctioning in production): `marketplace-incidents@sabnode.com` AND open a "Report a problem" link from the template's listing page. Reviewers can hotfix-unlist a template within 1 business hour of an incident report.
- [ ] **SLA escalation:** `marketplace-escalation@sabnode.com` (see §3.3).
- [ ] **Security issues** (a published template has a credential leak / SSRF surface / SabFiles bypass): `security@sabnode.com` per the project's responsible-disclosure policy. **Do not** post security issues in a submission thread.

---

## 9. What changes after launch — forward-refs

The items below are explicitly **out of scope** for Phase C.10 #4 and will be folded in later. Linking them here so partners know what is coming:

- [ ] Revenue share & paid templates — Phase C.11 + billing review (§6).
- [ ] Multi-trigger templates — Phase C.11 (only single-trigger today, §2.2).
- [ ] Template "collections" (curated bundles by publisher / use-case) — Phase C.12.
- [ ] Localized listings (template name / description in non-English languages) — owned by the i18n stream (`docs/i18n.md`).
- [ ] Marketplace analytics for partners (install funnel, search-impression-to-install rate) — Phase C.12.

---

## Summary (≤200 words)

The SabFlow marketplace ships partner-authored workflow templates that land in the in-product gallery and instantiate into a tenant's `SabFlowDoc` via `instantiateRecipe`. Partners write a portable `template.json` (schema in `marketplace-template-spec.md`), verify locally with `npx @sabnode/sabflow-template-cli verify`, and submit through the same CLI; the server runs the **identical** harness plus attribution and security overlays. First-response SLA on submission is **7 business days**; re-submissions are 5. Reviews approve, request changes, or reject against the criteria in `marketplace-review-criteria.md`. Approved templates publish immediately into the gallery for every tenant; updates require a semver bump and re-review. Templates carry publisher attribution (name, support email, homepage) but **no embedded credentials, no external file URLs (SabFiles only), and no real secrets** — those are auto-rejected. Revenue share is **deferred pending billing review** — every template ships free-to-install today, and any future monetization will require explicit publisher opt-in with 30-day notice. Deprecation keeps already-instantiated tenant flows untouched; the gallery hides unlisted templates within 5 minutes and archives them after 30 days.

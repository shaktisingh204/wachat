# SabFlow Marketplace — State Audit (Phase C.1.6)

**Phase:** `C.1` sub-task `#6` of `PLAN-sabflow-coverage.md`.
**Brief:** _"Audit current marketplace templates — list the 10, classify by category, identify gaps where users hit 'no template for X'."_
**Read-only audit** — no source code was modified.

> **Headline finding.** The `PLAN-sabflow-coverage.md` brief ("the 10 templates") under-counts what actually ships. Two **independent** template registries already live in the repo:
>
> 1. `src/components/sabflow/templates/` — **19 in-builder "Typebot-style chatbot" templates** (the visual-conversation flows the right-rail `TemplatesSheet` instantiates).
> 2. `src/lib/sabflow/recipes/` — **~100 "workflow-recipe" templates** (n8n-style trigger + blocks, registered into an in-memory map at module import time).
>
> Neither registry is what Phase C.10 calls a "marketplace" — both are **code-defined registries baked into the bundle**, not a Mongo-backed, partner-contributable, versioned catalogue. A separate `src/lib/marketplace/` exists for the **app** marketplace (Mongo-backed manifests, install lifecycle, audit, billing). C.10 explicitly wants to graft the marketplace pattern (Mongo + reviewer queue + partner program + versioning) onto **flow templates** — that infrastructure does not exist yet for templates.
>
> There is an empty top-level `claude-marketplace/` directory in the worktree — **unrelated to SabFlow**, not in `.gitignore`, contains no files; treat as cruft.

---

## 1. Where the marketplace lives

| Concern | Path | Notes |
| --- | --- | --- |
| **Chatbot templates registry** (the "10 templates" the plan refers to) | `src/components/sabflow/templates/index.ts` | Exports `TEMPLATES: TemplateDefinition[]` (19 entries) + `TEMPLATE_CATEGORIES` |
| Chatbot template type | `src/components/sabflow/templates/types.ts` | `TemplateDefinition = { id, name, description, emoji, color, bgColor, icon, category, build() }` — **no screenshot, no version, no requiredCredentials field** |
| Chatbot template builders | `src/components/sabflow/templates/builders.ts` | `makeBlock`, `makeGroup`, `linkStartToGroup`, etc. (Typebot-style graph helpers) |
| Chatbot template definitions | `src/components/sabflow/templates/definitions/{core,marketing,ecommerce,hrHealth}.ts` | 19 templates spread across 4 files |
| **Workflow-recipe registry** (the larger surface, ~100 templates) | `src/lib/sabflow/recipes/registry.ts` | `registerRecipe()` / `listRecipes()` / `instantiateRecipe(recipeId, tenantId)` in-memory Map |
| Recipe entrypoint (side-effect imports) | `src/lib/sabflow/recipes/index.ts` | Triggers `registerRecipe()` for every recipe file |
| Recipe type | `src/lib/sabflow/recipes/types.ts` | `Recipe = { id, name, category, description, trigger, blocks, variables, tags }` — **also no screenshot, no version, no credentials field; `tags: string[]` is the only filter beyond category** |
| Recipe gallery categoriser | `src/lib/sabflow/templates/index.ts` | Groups `listRecipes()` by `RecipeCategory`; used by the `/api/sabflow/recipes` GET handler |
| Recipe HTTP API | `src/app/api/sabflow/recipes/route.ts` | `GET` → flat list + categories; `POST { recipeId }` → `instantiateRecipe()` + `saveSabFlow()` for the session tenant |
| In-builder picker UI | `src/app/dashboard/sabflow/_components/templates-sheet.tsx` | Right-slide-over consuming `TEMPLATES` (chatbot registry only — does **NOT** read recipes today; this is one of the gaps) |
| **App marketplace (separate concern, Mongo-backed)** | `src/lib/marketplace/{index,registry,install,types,permissions,billing,lifecycle,usage-bridge}.ts` | This is the **infrastructure pattern** Phase C.10 will lift over to templates |
| App marketplace UI | `src/app/dashboard/marketplace/page.tsx` + `installed/page.tsx` | Lists `marketplace_apps` Mongo docs — apps, not flow templates |
| App marketplace APIs | `src/app/api/marketplace/{apps,installs}/` and `src/app/api/v1/marketplace/{installs,usage}/` | Manifest CRUD, install lifecycle, usage metering |
| **Empty / unrelated** | `claude-marketplace/` (repo root) | Empty directory; **not** related to SabFlow; not gitignored; ignore |

---

## 2. Current templates

### 2a. Chatbot-style templates (`src/components/sabflow/templates/`) — 19 total

These are conversational "Typebot-derived" flows (text/email/phone inputs, choice buttons, etc.). All ship as TS code; `build()` returns a fresh graph (groups/edges/variables/events) with new IDs.

| # | id | name | category | requiredCredentials | nodeCount¹ | screenshot |
| - | --- | --- | --- | --- | --- | --- |
| 1  | `lead-capture`          | Lead Capture                | Marketing  | none | 3 groups | none |
| 2  | `customer-support`      | Customer Support            | Support    | none | (multi-group) | none |
| 3  | `feedback-survey`       | Feedback Survey             | Support    | none | (multi-group) | none |
| 4  | `quiz`                  | Quiz                        | Support    | none | (multi-group) | none |
| 5  | `product-recommendation`| Product Recommendation      | E-commerce | none | (multi-group) | none |
| 6  | `newsletter-signup`     | Newsletter Signup           | Marketing  | none | (multi-group) | none |
| 7  | `customer-onboarding`   | Customer Onboarding         | Marketing  | none | (multi-group) | none |
| 8  | `saas-demo-request`     | SaaS Demo Request           | Sales      | none | (multi-group) | none |
| 9  | `mortgage-calculator`   | Mortgage Calculator         | Sales      | none | (multi-group) | none |
| 10 | `event-rsvp`            | Event RSVP                  | Marketing  | none | (multi-group) | none |
| 11 | `order-tracking`        | Order Tracking              | E-commerce | none | (multi-group) | none |
| 12 | `restaurant-menu`       | Restaurant Menu             | E-commerce | none | (multi-group) | none |
| 13 | `product-returns`       | Product Returns             | E-commerce | none | (multi-group) | none |
| 14 | `faq-bot`               | FAQ Bot                     | Support    | none | (multi-group) | none |
| 15 | `job-application`       | Job Application             | HR         | none | (multi-group) | none |
| 16 | `booking-appointment`   | Booking Appointment         | Sales      | none | (multi-group) | none |
| 17 | `fitness-coach-intake`  | Fitness Coach Intake        | Health     | none | (multi-group) | none |
| 18 | `legal-intake`          | Legal Intake                | Sales      | none | (multi-group) | none |
| 19 | `mental-health-checkin` | Mental Health Check-in      | Health     | none | (multi-group) | none |

¹ Exact node counts not enumerated — every template is a graph of 3+ groups with multiple blocks per group; the metric isn't currently surfaced. **Adding `nodeCount` to `TemplateDefinition` is itself a C.10 task.**

**Featured strip** (hardcoded in `templates-sheet.tsx` lines 36–43):
`lead-capture`, `customer-support`, `faq-bot`, `newsletter-signup`, `mortgage-calculator`, `product-recommendation`.

**Categories enumerated by `TEMPLATE_CATEGORIES`:** `Marketing`, `Support`, `Sales`, `HR`, `E-commerce`, `Health` (+ `'Other'` defined in the type union but unused).

### 2b. Workflow-recipe templates (`src/lib/sabflow/recipes/`) — 105 (per `grep -l registerRecipe`)

These are the **n8n-style automation flows** (trigger → blocks; `forge_slack`, `forge_twilio`, `webhook`, `set_variable`, etc.). Registered via `registerRecipe(recipe)` at module-import-time; `index.ts` does side-effect-imports for each one.

Each recipe declares: `{ id, name, category, description, trigger: SabFlowEvent, blocks: Block[], variables, tags }`. The `trigger.appEvent` tells you the integration (e.g. `crm_lead_created`, `stripe_event`, `shopify_order_created`, `webhook_received`, `schedule_tick`).

**Examples of representative recipes** (one per category band):

| id | name | category | trigger.appEvent | forge integration |
| --- | --- | --- | --- | --- |
| `lead-to-whatsapp-welcome`         | Lead → WhatsApp Welcome              | crm        | `crm_lead_created`          | `forge_twilio` |
| `slack-deal-won-alert`             | Slack: deal-won alert                | sales      | `crm_deal_won`              | `forge_slack` |
| `payment-received`                 | Payment received                     | finance    | `payment_succeeded`         | `forge_slack` |
| `shopify-order-sms`                | Shopify → order-status SMS           | ecommerce  | `webhook_received`          | `forge_twilio` |
| `ai-blog-draft-generator`          | AI blog-draft generator              | marketing  | `webhook_received`          | (LLM block) |
| `support-zendesk-to-linear`        | Support: Zendesk → Linear            | support    | `support_ticket_created`    | (webhook out) |
| `devops-github-deploy-discord`     | DevOps: GitHub → Discord deploy     | ops        | `webhook_received`          | (webhook out) |
| `finance-stripe-dunning`           | Finance: Stripe dunning              | finance    | `stripe_event`              | (webhook out) |
| `marketing-trial-drip-klaviyo`     | Marketing: trial drip (Klaviyo)      | marketing  | `trial_started`             | (webhook out) |
| `hr-new-hire-provision`            | HR: new-hire provisioning            | onboarding | `hr_new_hire`               | (webhook out) |

The full 105 are organised under the imports in `src/lib/sabflow/recipes/index.ts` (waves A → D, four "seed-pack" files plus per-recipe files). They expose **`tags: string[]`** (not credentials) — there is no machine-readable `requiredCredentials[]` field today, so the "works with my workspace" badge from C.10.5 has nothing to read.

> **Why the brief says "10"** — `seed-pack-2.ts` is documented as _"bringing the template count from 10 → 20"_ (line 2 of that file). The brief was written against the original 10 chatbot templates; the recipes registry exploded past that target in the meantime. C.10's "≥ 65 published templates" gate is **already exceeded** by raw count — what's missing is the **infrastructure** around them, not the volume.

---

## 3. Install flow

### 3a. Chatbot-template install (current production path)

```
User clicks "Use template" in TemplatesSheet (right slide-over in /dashboard/sabflow)
    │
    ▼
handleSelect(template) in src/app/dashboard/sabflow/_components/templates-sheet.tsx
    │
    ├─ template.build()                         // hydrates groups/edges/variables/events with NEW ids
    ├─ createSabFlow(template.name)             // server action — creates blank flow doc owned by session user
    ├─ saveSabFlow(created.id, { groups, edges, variables, theme, settings })
    │                                            // server action — writes the hydrated graph into the new doc
    └─ router.push(`/dashboard/sabflow/flow-builder/${created.id}`)
```

- **No credential prompts** — chatbot templates declare none, so there's nothing to ask for.
- **No "are you sure?" confirmation, no preview, no version pinning** — the user gets a blank-name flow titled exactly the template name; rename later.
- **No telemetry** — the install isn't recorded; we have no `installCount` for chatbot templates.

### 3b. Workflow-recipe install (current API path)

```
Client POST /api/sabflow/recipes  { recipeId }
    │
    ▼
src/app/api/sabflow/recipes/route.ts → POST handler
    │
    ├─ getSession() → 401 if no user
    ├─ getRecipe(recipeId) → 404 if missing
    ├─ instantiateRecipe(recipeId, session.user.id)
    │      └─ registry.ts re-keys every blockId / groupId / edgeId / triggerId
    │      └─ returns a SabFlowDoc with status='DRAFT', stamped userId
    ├─ saveSabFlow(doc) → persists to Mongo
    └─ NextResponse.json({ flowId, name, recipeId })
```

- **No credential prompts** — recipes embed credential placeholders (e.g. `{{enrichKey}}`, `{{slackWebhook}}`) as **variables with empty defaults**, expecting the user to fill them in post-install.
- **No client-side picker UI** — the `TemplatesSheet` reuses `TEMPLATES` (chatbot registry), not `listRecipes()`. The 100+ recipes are only reachable via raw API call today.
- **No install audit, no install counter** — `marketplace_audit` only fires for app installs.

### Comparison: what the app-marketplace install (`src/lib/marketplace/install.ts`) does that template install does not

1. Calls a developer-supplied `install_callback_url` with a signed payload.
2. Validates `grantedScopes ⊆ manifest.scopes`.
3. Upserts `marketplace_installs` (unique on `tenantId+appId`).
4. `$inc: { installCount }` on the catalogue doc.
5. `fireAuditEvent('app.installed', tenantId, { … })` into `marketplace_audit`.
6. Persists `lastCallbackError` for retry visibility.

C.10 should mirror that lifecycle for templates (steps 3, 4, 5 minimum).

---

## 4. Gaps for content-library status (mapped to C.10 sub-tasks)

| C.10 sub-task | Current gap | What must be built |
| --- | --- | --- |
| **C.10.1** Authoring CLI `npx sabnode-template init` | No CLI exists. Templates are hand-written `.ts` modules with `registerRecipe(...)` at the bottom — copy-paste-driven. | New CLI package that scaffolds `template.json` + screenshot + verification fixture + (optional) handwritten `.ts`. Decide: do partner templates ship as **JSON in Mongo** (new pattern) or as **code in the bundle** (current pattern)? Phase B.5 §9 already supports flow-import via JSON — partner templates almost certainly become Mongo-backed JSON. |
| **C.10.2** Verification pipeline (<60s, no errors, empty workspace) | **Nothing.** No CI job runs templates today. Recipes only smoke-test their registration (i.e. that `index.ts` imports compile). | Spin up an empty-tenant SabFlow sandbox in CI; `instantiateRecipe()` → `executeFlow()` against mocked credentials; assert no `NodeError` and `wall_time < 60s`. Gate publish on green. |
| **C.10.3** Review-queue admin UI `/dashboard/admin/marketplace/queue` | App marketplace already has `status: pending_review`, but no UI lists those. Template registries have no review concept at all — code-merged = published. | New admin page reading `marketplace_apps.status='pending_review'` (apps) and a parallel `marketplace_templates` collection (templates). RBAC-gated to internal reviewers. |
| **C.10.4** Versioning + upgrade diff | `Recipe` and `TemplateDefinition` have **no `version` field**. App manifests already carry semver — copy that pattern. | Add `version` to both registries; persist `installedVersion` on the user's flow doc; build `diffSabFlow()` against the new template version (Phase B uses `src/lib/sabflow/diff.ts` already — reuse it). |
| **C.10.5** Categories + filter UX | Two **mutually-exclusive** category enums today: chatbot `Marketing/Support/Sales/HR/E-commerce/Health` vs recipe `sales/marketing/support/ops/finance/crm/whatsapp/ecommerce/ads/onboarding`. The plan picks a third set: `Sales/Marketing/Ops/AI/Internal Tools/Developer`. | Pick one taxonomy (suggest the C.10.5 set + migrate both registries). Add filter-by-required-integrations and "works with my workspace" badge. The badge needs `requiredCredentials[]` on every template, which doesn't exist today. |
| **C.10.6** One-click install with credential prompts | Recipes embed credential placeholders as variables with empty string defaults — the user discovers them by opening the flow and finding broken blocks. | Extract `requiredCredentials[]` from blocks at template-author time; prompt user during install; map to existing credential picker (Phase B.5 already has this picker). Reuse `src/lib/sabflow/credentials/`. |
| **C.10.7** Versioning (semver, upgrade diff view) | (Same as C.10.4 above — kept here as a UI commitment: surface a "Template v1.2.0 is available" banner on flows installed from earlier versions.) | Builder banner + side-by-side diff view consuming `diff.ts` output. |
| **C.10.8** 40 first-party seed templates | **Recipes registry already has ~100 templates** across the right categories (CRM sync ✓, lead-routing ✓, AI content ✓, Slack alerts ✓, but **no shipped Shopify-ops set, weak GitHub release coverage**). C.10.8 has been functionally pre-done — the real work is **curating** which 40 to promote and **adding screenshots + verification fixtures** to each. | Audit pass: dedupe, retire low-quality recipes, write a screenshot + verification fixture for each of the curated 40. |
| **C.10.9** Partner contributions (5 partners × 5 templates) | Zero infrastructure. No `marketplace_templates` Mongo collection, no partner agreement doc, no submission API, no review queue. | Brand-new Mongo collection (parallel to `marketplace_apps`), submission endpoint, reviewer pipeline (C.10.3), contributor docs at `docs/partners/marketplace-contributing.md`. |
| **C.10.10** Telemetry — install/run counts, success/failure rates | App marketplace tracks `installCount` on the app doc + a `marketplace_audit` collection. Templates track **nothing**: not installs, not runs, not failures. The C.1.8 coverage dashboard has nowhere to read from. | Mirror the app pattern on `marketplace_templates`: `$inc: installCount` per install, fire `template.installed` / `template.run.success` / `template.run.failure` audit events, surface in `/dashboard/internal/sabflow-coverage` (built in C.1.8). |

### Schema gaps to make explicit

| Field needed by C.10 | Present in `TemplateDefinition` (chatbot)? | Present in `Recipe` (workflow)? |
| --- | --- | --- |
| `id` | yes | yes |
| `name` | yes | yes |
| `description` | yes | yes |
| `category` | yes (closed enum) | yes (closed enum, different) |
| `version` (semver) | **NO** | **NO** |
| `requiredCredentials[]` | n/a (none use credentials) | **NO** (implicit via `tags`) |
| `screenshot` / cover image | **NO** | **NO** |
| `nodeCount` | **NO** | derivable from `blocks.length` |
| `publisher` (first-party vs partner) | **NO** | **NO** |
| `status` (draft / pending / published / suspended) | **NO** (everything is published-on-merge) | **NO** (same) |
| `installCount` / `averageRating` | **NO** | **NO** |
| `tags[]` for search | **NO** | yes |

---

## 5. Category coverage table

Combined view across both registries. **Chatbot category labels normalised to Title-Case so the comparison is meaningful.**

| Plan category (C.10.5)        | Chatbot templates | Workflow recipes | Total | Coverage |
| ----------------------------- | ----------------: | ---------------: | ----: | -------- |
| Sales                         | 4                | 12 (`sales`) + 9 (`crm`) = 21 | 25 | strong |
| Marketing                     | 5                | 22 (`marketing`) | 27 | strong |
| Ops / Internal Tools          | 0                | 17 (`ops`)       | 17 | medium |
| AI                            | 0                | spread across `marketing` + `support` (see `ai-*` recipes) | ~6 | **WEAK** (no dedicated category bucket) |
| Internal Tools (HR / admin)   | 1 (`HR`)         | 8 (`onboarding`) | 9  | medium |
| Developer (DevOps / webhooks) | 0                | sub-category inside `ops` (~6 `devops-*` recipes) | 6 | **WEAK** |
| Support                       | 3                | 15 (`support`)   | 18 | strong |
| E-commerce                    | 4                | 6 (`ecommerce`)  | 10 | medium |
| Finance                       | 0                | 10 (`finance`)   | 10 | medium |
| Health                        | 2                | 0                | 2  | **WEAK** (niche, but still under-served) |
| WhatsApp / Messaging          | 0                | 1 (`whatsapp`)   | 1  | **CRITICALLY WEAK** (despite SabWa being a flagship module) |
| Ads                           | 0                | 1 (`ads`)        | 1  | **CRITICALLY WEAK** |

### n8n use-cases with ZERO matching SabFlow templates today

(Cross-referenced against typical n8n template-store categories.)

| n8n category | SabFlow template count | Notes |
| --- | ---: | --- |
| **Vector DBs / RAG** (Pinecone, Weaviate, Qdrant ingestion) | **0** | AI category exists conceptually but no RAG ingestion recipes |
| **Agent loops** (multi-step LLM agents with tool calling) | **0** | only single-shot LLM blocks today |
| **Image / vision** workflows (uploaded image → vision model → response) | **0** | despite `ai-image-caption-alt` being a single line item |
| **Document parsing** (PDF → extract → structured output) | **0** |
| **Knowledge-base sync** (Notion / Confluence → embedding store) | **0** |
| **Calendar power-flows beyond reminders** (proposing slots, rescheduling) | weak | `calendar-meeting-reminder` exists but no real scheduling logic |
| **Internal-tool dashboards** (form → DB write → return result) | **0** | the n8n "Internal Tools" category is essentially empty for us |
| **Voice / IVR** (Twilio voice, Vapi) | **0** |
| **GitHub release automation** (changelog generation, version bump, npm publish) | **0 outside of `devops-github-deploy-discord`** | C.10.8 calls this out as a target seed |
| **Shopify ops** (inventory reorder, bundle creation, pricing rules) | weak | only 1 Shopify recipe (`db-sync-shopify-to-hubspot`) + the seed-pack-2 SMS one |
| **HubSpot ops beyond lead capture** (deal-stage automation chains) | weak | `lead-capture-to-hubspot`, `marketing-lead-magnet-hubspot` exist; the deeper sales-cycle stuff doesn't |
| **Vercel / deployment alerts** | **0** (despite SabNode being Vercel-native) |
| **Database backups / nightly snapshots** | **0** |
| **OAuth-driven SaaS connectors** for: Asana, Monday, ClickUp, Jira Service Desk, Intercom, Front, Drift | **0** for most | n8n ships these out of the box |

**Recommendation for C.10.8 seed selection:** prioritise the **WEAK** categories above (AI/RAG, Vector DBs, Internal Tools, Voice/IVR, Vercel-native deployment alerts) rather than padding categories that already have 15+ recipes. Each high-leverage gap is worth 3 generic Marketing templates.

---

## 6. Open questions handed to C.10

1. **Two registries, one marketplace?** Should the chatbot-style (`src/components/sabflow/templates/`) and workflow-recipe (`src/lib/sabflow/recipes/`) registries merge into a single Mongo-backed `marketplace_templates` collection, or stay as two separate browse experiences ("Chatbots" vs "Automations")? The current `TemplatesSheet` only reads the chatbot registry — the 100+ recipes are unreachable from the UI.

2. **Mongo vs code-bundled.** The app marketplace is Mongo-backed (so partners can submit without a redeploy). Templates today are code-bundled. Phase C.10.9 (partner program) **forces** a Mongo collection — but do first-party templates also migrate, or do they stay in code? Recommendation: code-bundle first-party, Mongo-source partner. Risk: two code paths.

3. **Category taxonomy.** Three different category sets exist (`TemplateCategory`, `RecipeCategory`, C.10.5 plan). Pick one canonical list **before** the C.10.5 UX rebuild — otherwise every template needs a re-tag.

4. **`requiredCredentials[]` derivation.** Should this be hand-declared by the author (error-prone) or auto-extracted at publish time by walking the template's blocks for `forge_*` / `webhook` nodes (more work, but accurate)? Recommendation: auto-extract during the C.10.2 verification step.

5. **Versioning starting point.** Every existing template gets `v1.0.0` on the migration to a versioned model, or do we leave them un-versioned ("legacy") and only version templates published **after** C.10 lands? Recommendation: stamp every existing template `v1.0.0` to give the upgrade-diff UI something to render from day one.

6. **Recipes registry deduplication.** Some recipe IDs look thematically overlapping (e.g. `marketing-cart-abandon-7day` vs `abandoned-cart`, multiple `email-sequence-*`, multiple `data-enrich-*`). Before C.10.8 seeds 40 "curated" templates, do a dedupe pass to retire weak duplicates so we ship 40 **strong** entries rather than 40 of the existing 105.

7. **Screenshot policy.** None exist today. Are they (a) hand-authored PNGs in SabFiles, (b) auto-generated by the canvas serialiser, or (c) Vercel OG-image-rendered from template metadata? Recommendation: **(c)** — keeps the screenshot in sync with template changes for free and aligns with the Vercel-native deployment model.

8. **Telemetry storage.** Do template install/run counts live on a new `marketplace_templates` doc (mirroring `marketplace_apps.installCount`) or on the existing `marketplace_audit` collection rolled-up at query time? Recommendation: write **both** — denormalised counter on the doc for cheap reads, audit row for forensic queries.

9. **Featured strip lifecycle.** The current six featured chatbot templates are hardcoded in `templates-sheet.tsx` (FEATURED_TEMPLATE_IDS). After C.10, is "featured" editorial (admin-only flag on the catalogue doc) or algorithmic (top-N by install rate)? Recommendation: editorial flag + auto-fallback to top-installs.

10. **`claude-marketplace/` cleanup.** The empty top-level directory should be removed before C.10 work begins so nobody confuses it with the SabFlow marketplace. Filed as a chore on Phase C.10 ramp-up.

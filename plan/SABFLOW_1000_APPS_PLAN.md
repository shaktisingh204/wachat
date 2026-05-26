# SabFlow → "1,000+ apps connectable" Plan

> **Status:** Strategy document. Companion to [N8N_MIGRATION_PLAN.md](./N8N_MIGRATION_PLAN.md).
> **Premise:** n8n markets "400 native + 1,000+ via HTTP." SabFlow already has the 400-native equivalent (760 forge ports landed across W0–W24 of the migration). This document is the path to the second number.
> **Strategy:** amplify the generic HTTP Request block with a per-app **preset registry** + a marketplace flow for user contributions. Do not port 1,000 more files.

---

## §1. Goal

**SabFlow connects to 1,000+ apps without porting 1,000 files.**

The n8n migration plan is complete — 760 native forge blocks (283 n8n ports + 7 legacy + LangChain catalog + community wave) cover the curated long catalog. The remaining "1,000 more" claim from n8n marketing is satisfied not by hand-written nodes but by their generic HTTP Request node + user-supplied credentials. SabFlow has the same primitive (`forge_http_request`) and the same credential primitives (`http_basic_auth`, `http_header_auth`, `oauth2`).

What's missing is a **structured registry of presets** so the user doesn't have to hand-author method/URL/headers for every API call. This plan adds that registry, three importers that populate it cheaply, and the UI surface that makes the count visible.

Non-goal: replacing native ports. The 760 stay. This is additive — Tier 2 in §2 — and lives next to the existing catalog.

---

## §2. Three-tier coverage model

| Tier | What it is | How many apps | Where it lives |
|---|---|---|---|
| Tier 1: Native forge ports | Hand-written `forge_X` blocks with bespoke actions, field schemas, pagination helpers, OAuth refresh | **~760** (current) | per-file under `src/lib/sabflow/forge/blocks/n8n/<category>/<name>.ts` |
| Tier 2: App presets | A JSON definition per app, loaded into the generic HTTP block, exposing pre-baked endpoints + auth shape | **Target: +400** → 1,160 covered | `src/lib/sabflow/app-presets/<id>.json` (NEW) |
| Tier 3: Custom HTTP | User writes a one-off HTTP request inline in a flow | **unbounded** | per-flow inline (already works today via `forge_http_request`) |

### Tier 1 example — Slack (already shipped)

`src/lib/sabflow/forge/blocks/n8n/communication/slack.ts` — a hand-written `ForgeBlock` with 6+ actions (`message_send`, `channel_create`, …), each with its own `fields` schema and a typed `run` function calling `https://slack.com/api/...`.

### Tier 2 example — Vimeo (proposed)

`src/lib/sabflow/app-presets/vimeo.json` ships as data, not code. The generic `forge_app_preset` block reads the JSON at runtime and renders the action list + fields in the standard forge UI. No file per action — just data.

### Tier 3 example — any obscure REST API

User drops a `forge_http_request` block, fills `method=POST`, `url=https://obscure.example/v1/widgets`, `headers=[{Authorization, Bearer …}]`, and a JSON body. Already works today; this plan just makes it the fallback, not the only option.

---

## §3. App-preset schema (NEW concept)

A preset is a JSON document under `src/lib/sabflow/app-presets/`. Schema:

```json
{
  "id": "vimeo",
  "name": "Vimeo",
  "description": "Video hosting platform — manage videos, albums, channels.",
  "category": "Video",
  "iconName": "LuVideo",
  "version": 1,
  "lastVerified": "2026-05-17",
  "auth": {
    "type": "bearer",
    "credentialType": "vimeo",
    "header": "Authorization",
    "scheme": "Bearer"
  },
  "baseUrl": "https://api.vimeo.com",
  "endpoints": [
    {
      "id": "get_video",
      "label": "Get video",
      "method": "GET",
      "path": "/videos/{video_id}",
      "fields": [
        { "id": "video_id", "label": "Video ID", "type": "text", "required": true }
      ],
      "outputPath": "$"
    },
    {
      "id": "list_albums",
      "label": "List albums",
      "method": "GET",
      "path": "/me/albums",
      "fields": [
        { "id": "page", "label": "Page", "type": "number", "defaultValue": 1, "in": "query" },
        { "id": "per_page", "label": "Per page", "type": "number", "defaultValue": 25, "in": "query" }
      ]
    },
    {
      "id": "create_album",
      "label": "Create album",
      "method": "POST",
      "path": "/me/albums",
      "fields": [
        { "id": "name", "label": "Album name", "type": "text", "required": true, "in": "body" },
        { "id": "description", "label": "Description", "type": "textarea", "in": "body" }
      ]
    }
  ]
}
```

### Schema rules

- **`id`** — kebab-case, unique across the registry. Used as `forge_app_preset:<id>` for routing.
- **`auth.type`** — one of `bearer`, `basic`, `header`, `query_token`, `oauth2`, `aws_sigv4`, `none`. Each maps to a built-in builder; OAuth2 reuses `_shared/oauth.ts`.
- **`auth.credentialType`** — references a `CredentialType` in `src/lib/sabflow/credentials/types.ts`. New presets can reuse `http_basic_auth` / `http_header_auth` / `oauth2` if no dedicated type is needed.
- **`endpoints[].path`** — supports `{param}` placeholders resolved from `fields` of matching `id`.
- **`endpoints[].fields[].in`** — `path | query | body | header`. Defaults to `path` if the path mentions the id, `body` for POST/PATCH/PUT, `query` otherwise.
- **`endpoints[].fields[].type`** — same Forge field set: `text | textarea | number | toggle | select | json | password`.
- **`outputPath`** — optional JSONPath to project the response (`$.data[0]` etc.). Defaults to `$`.

The picker shows each preset as a "block" rendered the same as a hand-written forge block. At runtime the engine reads `presetId + actionId + inputs`, fills the template, calls fetch, returns `{ data, status, ok }`.

---

## §4. Where the 400+ presets come from

Five realistic sources, listed by effort. Aggregate covers well over 1,000 apps with conservative quality controls.

1. **n8n descriptor parser** — n8n's `*.node.ts` files contain `INodeTypeDescription` with `properties`, `resource`/`operation` matrices, and base URLs. Write `scripts/n8n-to-preset.ts` that reads every node, extracts the resource/operation list, and emits a preset JSON. Auto-covers ~300 apps where we didn't do full ports. (Effort: **~1 day** of scripting.)
2. **Postman collection imports** — Postman has 50k+ public collections in its API Network. Build an importer route `POST /api/sabflow/presets/import-postman` that reads a Postman v2 JSON → preset. Auto-covers another ~200 apps the user supplies. (Effort: **~half day**.)
3. **OpenAPI / Swagger imports** — most modern APIs publish OpenAPI specs (Stripe, Twilio, Plaid, Wise, every API gateway, every government dataset). Build `POST /api/sabflow/presets/import-openapi` that walks `paths` + `components.securitySchemes` → preset. Auto-covers another ~500+ apps. (Effort: **~1 day**.)
4. **Manual presets** — for the boutique long tail (e.g. Make.com webhooks, vendor-internal APIs, country-specific tax tools), users author a preset via a small JSON form in the Connections tab. (Effort: built once, zero per-preset cost to the platform.)
5. **Community marketplace** — public registry where tenants publish presets. Each preset gets a `version`, `author`, `lastVerified`. Install via "Add from marketplace" button. (Effort: **~1 week** — separate v2 feature, opt-in per tenant.)

Effort budget for 1,000+: **sources 1 + 2 + 3 + 4 = ~3 days** of work to seed the registry past 1,000. Source 5 is icing.

---

## §5. UI surface

Picker layout after presets land (ASCII):

```
┌──────────────────────────────────────────────────────────┐
│ [ Search apps...                            ]  [Category▾]│
├──────────────────────────────────────────────────────────┤
│ Native forge (760)                                       │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐             │
│  │ Slack  │ │Discord │ │ GitHub │ │ Notion │  …          │
│  └────────┘ └────────┘ └────────┘ └────────┘             │
├──────────────────────────────────────────────────────────┤
│ App presets (412)                                        │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐             │
│  │ Vimeo  │ │ Wistia │ │ Plaid  │ │ Wise   │  …          │
│  └────────┘ └────────┘ └────────┘ └────────┘             │
│                              [+ Add app from preset…]    │
├──────────────────────────────────────────────────────────┤
│ Custom HTTP                                              │
│  ┌────────────────────────────────┐                      │
│  │ + Build your own HTTP block    │                      │
│  └────────────────────────────────┘                      │
└──────────────────────────────────────────────────────────┘
```

### Preset block UI

When the user picks a preset, the canvas shows a block with the same chrome as a hand-written forge block:

- Header shows preset `name` + `iconName` + a small "preset" badge so power users can tell the surface tier.
- Action selector dropdown lists `endpoints[].label`.
- On action select, `endpoints[].fields[]` render through the **existing** `ForgeFieldRenderer` — the renderer doesn't know the difference between a preset and a native block.
- Credential select uses `auth.credentialType` and reuses the existing `CredentialSelect`.

### "Add app from preset" sheet

A side sheet lists installable presets paginated, with search + category chips. Each row: name, category, action count, `lastVerified` date with a stale-badge if >6 months.

### Bottom-row counter

The picker footer reads: `1,172 apps available · 760 native · 412 presets · ∞ custom HTTP`.

---

## §6. Engine integration

A single new forge block dispatches the entire preset tier:

```ts
// src/lib/sabflow/forge/blocks/generic/app_preset.ts
//
// block.options shape:
//   { presetId: string, actionId: string, inputs: Record<string, unknown> }
//
const block: ForgeBlock = {
  id: 'forge_app_preset',
  name: 'App preset',
  description: 'Generic adapter that executes any app-preset JSON definition.',
  category: 'Integration',
  auth: { type: 'dynamic' },  // resolved at runtime from preset.auth.credentialType
  actions: [
    {
      id: 'execute',
      label: 'Execute',
      fields: [],  // rendered dynamically from preset endpoint
      run: async (ctx) => {
        const preset = await loadPreset(asString(ctx.options.presetId));
        const endpoint = preset.endpoints.find(e => e.id === asString(ctx.options.actionId));
        if (!endpoint) throw new Error(`Preset ${preset.id}: action ${ctx.options.actionId} not found`);

        const inputs = (ctx.options.inputs ?? {}) as Record<string, unknown>;
        const { url, query } = resolvePath(preset.baseUrl + endpoint.path, endpoint.fields, inputs);
        const headers = buildAuthHeaders(preset.auth, ctx.credential);
        const body = buildBody(endpoint, inputs);

        const res = await apiRequest({
          service: preset.name,
          method: endpoint.method,
          url: appendQuery(url, query),
          headers,
          json: body,
        });
        return { outputs: { data: projectOutput(res.data, endpoint.outputPath) }, logs: [`${preset.name}.${endpoint.id} → ${res.status}`] };
      },
    },
  ],
};
```

### Required helpers (`src/lib/sabflow/app-presets/runtime/`)

- `loadPreset(id)` — reads JSON from disk + in-memory LRU cache; falls back to remote registry (when marketplace lands).
- `resolvePath(template, fields, inputs)` — substitutes `{param}` placeholders, returns leftover `query` params.
- `buildAuthHeaders(auth, credential)` — dispatches on `auth.type`. `oauth2` calls `_shared/oauth.ts` for refresh. `aws_sigv4` uses the existing `@aws-sdk` signer.
- `buildBody(endpoint, inputs)` — collects `in: 'body'` fields into a JSON object honoring required + defaults.
- `projectOutput(data, path)` — minimal JSONPath (`$`, `$.foo`, `$.foo[0].bar`).

### Picker / settings panel glue

`ForgeBlockSettings` already renders fields from `actions[].fields[]`. For a preset block it instead reads `preset.endpoints[actionId].fields[]` and shoves them into the same renderer. ~30 lines of dispatch in `src/components/sabflow/panels/blocks/forge/ForgeBlockSettings.tsx`.

---

## §7. Implementation waves

| Wave | Scope | Effort |
|---|---|---|
| **A1** | Define preset JSON schema (`types.ts`) + `forge_app_preset` generic block + runtime helpers (`loadPreset`, `resolvePath`, `buildAuthHeaders`, `buildBody`, `projectOutput`). Single PR. | **~3 hours** |
| **A2** | Seed registry with 100 hand-picked presets (Vimeo, Wistia, Plaid, Twilio Programmable Voice extras, Wise, Algolia, Typeform, Calendly events extras, ConvertAPI, ScrapingBee, Apify, etc.). | **~1 day** |
| **A3** | Build `scripts/n8n-to-preset.ts` — parse `INodeTypeDescription` from n8n source, emit preset JSON. Run against `n8n-master` and ingest. | **~1 day** |
| **A4** | OpenAPI importer route — `POST /api/sabflow/presets/import-openapi` (paste URL or upload spec ≤10 MB). | **~1 day** |
| **A5** | Postman importer route — `POST /api/sabflow/presets/import-postman` (Collection v2.1). | **~half day** |
| **A6** | Picker UI changes: presets section with category chips + search + "Add app from preset" sheet + footer counter. | **~1 day** |
| **A7** (opt) | Public marketplace — multi-tenant preset sharing, install/uninstall, version pinning. | **~1 week** |

Ambitious path total: **~6 working days for A1–A6 → 1,000+ apps unlocked.** A7 is opt-in v2.

---

## §8. Acceptance criteria

- [ ] `forge_app_preset` block registered in `forge/index.ts` and executes presets from JSON.
- [ ] Preset registry on disk has **≥100 hand-curated entries** with `lastVerified` set.
- [ ] `POST /api/sabflow/presets/import-openapi` accepts any OpenAPI 3.x spec ≤10 MB and emits a valid preset.
- [ ] `POST /api/sabflow/presets/import-postman` accepts any Postman Collection v2.1 and emits a valid preset.
- [ ] Picker shows **≥1,000 selectable integrations** across Tier 1 + Tier 2, searchable + filterable by category.
- [ ] A user can author a custom preset in **<5 minutes** via the JSON form in the Connections tab.
- [ ] Auto-imported presets land in `draft` state and require a human "Verify" click before they appear in the picker.
- [ ] `lastVerified` >6 months old surfaces a stale badge in the picker and a soft warning at block execute time.

---

## §9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Auth complexity** — OAuth2 with refresh tokens, AWS SigV4, JWT-bearer, HMAC request signing, cookie-jar flows all need preset-level support | High | Reuse `_shared/oauth.ts` for OAuth2 (already production). For SigV4 require `aws_lambda`-style credential. For HMAC require a small `signing` block in the preset (`{ algorithm, headerName, secretKey }`). Bespoke flows (Salesforce, Shopify HMAC, Google service-accounts) stay on Tier 1 native ports — do not downgrade them. |
| **API drift** — auto-imported presets go stale as APIs change | Medium | Every preset carries `lastVerified`. UI surfaces stale (>6 mo) presets with a yellow badge. Marketplace v2 exposes version diffs and per-tenant version pinning. |
| **Quality variance** — auto-imported descriptors miss required-field validations, mislabel methods, drop pagination | Medium | Auto-imports land in `draft` state. Picker only shows verified presets by default; "show drafts" is a per-user toggle. A "Verify" click moves draft → verified and stamps `lastVerified`. |
| **Credential type explosion** — every preset wants its own `CredentialType` | Low | Default to `http_basic_auth` / `http_header_auth` / `oauth2`. Only mint a dedicated `CredentialType` when the preset graduates to "popular" status (≥N tenants using it). |
| **Performance** — loading 1,000 JSON files at boot | Low | Manifest pattern: one `index.json` lists ids + names + categories for the picker; individual presets load lazily on block-pick. LRU cache keyed by `presetId`. |
| **Discovery debt** — users won't find the preset they need | Medium | Strong search ranking (title, category, endpoint labels), category chips, "Suggest a preset" button that opens a GitHub issue template. |

---

## §10. Relationship to existing n8n migration

This plan is **additive**, not a replacement. The 760 native forge ports stay; presets fill the gap for the "1,000 more" surface. Both tiers appear in the **same picker**, differentiated only by a small badge.

**Promotion path** — if a Tier 2 preset becomes a usage hotspot, the team can promote it to Tier 1 by writing a hand-port that replaces the preset entry. The block id stays stable (`forge_<name>`) so user flows don't break. Tier 2 → Tier 1 demotion never happens; Tier 2 presets exist forever as the long-tail surface.

**Catalog math** — Tier 1 (760) + Tier 2 target (≥400 from importers + manual) + Tier 3 (unbounded custom HTTP) = **>1,000 apps connectable**, matching the n8n marketing claim while honoring the existing migration investment.

---

## §11. Open questions (deferred)

- Does the marketplace (A7) need per-preset rating + reporting + flagging? Likely yes once external authors are involved — design alongside the v2 marketplace, not now.
- Should presets carry per-endpoint plan gating (`plan: 'pro'`)? Defer until pricing tier conversations close.
- Should the OpenAPI importer attempt to derive auth from `components.securitySchemes` automatically, or always prompt the user? Default: derive, but show a confirmation step.
- Versioned presets — when a preset upgrades from v1 → v2, do existing flows pin to v1? Same answer as native blocks: yes, pin by version; surface an "upgrade available" prompt in the flow builder.

---

## §12. Definition of done

The catalog reaches "1,000+ apps connectable" the day:

1. A1–A6 are merged.
2. The picker footer counter displays a number ≥1,000.
3. A new user can search "Plaid", click a result, pick `transactions.list`, attach an OAuth2 credential, and run the block end-to-end in under 2 minutes.

After that, this document moves to "live tracking" mode like N8N_MIGRATION_PLAN.md — every batch of new presets bumps a Progress table at the bottom.

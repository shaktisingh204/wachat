# SabFlow Marketplace — `template.json` Schema Reference

- **Track / Phase / Sub-task:** Track C · Phase 10 · #4
- **Status:** Proposed (partner-facing draft)
- **Owner:** SabFlow marketplace on-call
- **Related:** `docs/partners/marketplace-contributing.md` (the lifecycle this schema feeds into), `docs/partners/marketplace-review-criteria.md` (what passes / fails review), `src/lib/sabflow/recipes/types.ts` (in-repo `Recipe` shape — `template.json` deserialises to this), `src/lib/sabflow/recipes/registry.ts` (`instantiateRecipe` — the runtime path), `src/lib/sabflow/validation.ts` (`validateFlow` — the graph validator the harness wraps).

> Scope. This document is the **field-by-field** reference for `template.json`. The contributing guide (`marketplace-contributing.md`) covers the *lifecycle around* the schema — submission, review, versioning. The review criteria doc (`marketplace-review-criteria.md`) covers *what gets approved or rejected*. Use this document when authoring or updating a template file.

---

## 1. Top-level shape

```json
{
  "$schema": "https://sabnode.com/schemas/sabflow-template-v1.json",
  "id": "lead-to-whatsapp-welcome",
  "name": "Lead → WhatsApp Welcome",
  "version": "1.0.0",
  "category": "crm",
  "description": "When a new lead is created in your CRM, send them a WhatsApp welcome template within seconds and mark the deal as contacted.",
  "tags": ["crm", "whatsapp", "lead", "welcome", "onboarding"],
  "trigger": { /* SabFlowEvent — §4 */ },
  "variables": [ /* Variable[] — §5 */ ],
  "blocks": [ /* Block[] — §3 */ ],
  "publisher": { /* §7 */ },
  "preview": "sabfile://__system/marketplace/previews/lead-to-wa-welcome.png",
  "icon": "sabfile://__system/marketplace/icons/lead-to-wa-welcome.svg",
  "minPlatformVersion": "2026.05.0"
}
```

This deserialises directly into the in-repo `Recipe` type (`src/lib/sabflow/recipes/types.ts`) plus marketplace-only fields (`publisher`, `preview`, `icon`, `minPlatformVersion`).

---

## 2. Required vs optional fields

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `$schema` | string (URI) | recommended | Pin to a versioned schema URL so editors can validate offline. |
| `id` | string | **required** | `^[a-z0-9-]{3,48}$`. Unique across the marketplace. Reserved at submission time. |
| `name` | string | **required** | Display name. 4–60 chars. Title-cased. |
| `version` | string | **required** | Semver (`MAJOR.MINOR.PATCH`). Must monotonically increase across re-submissions. |
| `category` | enum | **required** | One of `sales`, `marketing`, `support`, `ops`, `finance`, `crm`, `whatsapp`, `ecommerce`, `ads`, `onboarding`. See `src/lib/sabflow/templates/index.ts`. |
| `description` | string | **required** | 40–280 chars. Plain text. No markdown. Renders on the listing card. |
| `tags` | string[] | optional | 0–8 entries. Each tag is `^[a-z0-9-]{2,24}$`. Powers gallery search. |
| `trigger` | object | **required** | Exactly one `SabFlowEvent`. See §4. |
| `variables` | array | **required** | May be empty. Schema in §5. |
| `blocks` | array | **required** | Minimum 1 block. Schema in §3. |
| `publisher` | object | **required** | Attribution. See §7. |
| `preview` | string | required at `submit` | `sabfile://` URI. Optional for `verify` (warning, not error). |
| `icon` | string | optional | `sabfile://` URI. PNG or SVG, 64×64 minimum. Falls back to the category default. |
| `minPlatformVersion` | string | optional | Semver. Refuses to instantiate on older SabNode releases. Default = current. |

---

## 3. `blocks` — the step list

A block is a single step in the template's pipeline. The shape mirrors the in-repo `Block` type from `src/lib/sabflow/types.ts`.

### 3.1 Block shape

```json
{
  "id": "b_wa_send",
  "groupId": "g_send",
  "type": "forge_twilio",
  "options": { /* per-type config; §3.3 */ },
  "items": [ /* optional, for routing blocks; §3.4 */ ],
  "outgoingEdgeId": "e_send_next"  /* optional inline edge */
}
```

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `id` | string | **required** | `^[a-z0-9_]{3,48}$`. Unique within the template. Prefix with `b_` by convention. Re-keyed at instantiation. |
| `groupId` | string | **required** | Logical canvas step. Prefix with `g_` by convention. Blocks sharing a `groupId` render in the same canvas group. Groups are auto-laid-out left-to-right at instantiation; partners do **not** supply coordinates. |
| `type` | string | **required** | Must be in the allowlist (§3.2). Unknown types are rejected. |
| `options` | object | **required** | Per-`type` schema (§3.3). Validated by the matching node-parameter validator under `src/lib/sabflow/n8n/node-parameters/`. |
| `items` | array | conditional | Required for routing block types (`condition`, `ab_test`, `choice_input`, `picture_choice_input`). Each item has its own `outgoingEdgeId`. |
| `outgoingEdgeId` | string | optional | Inline edge target for non-routing blocks. Mutually exclusive with the routing-blocks pattern. |

### 3.2 Block-type allowlist

The harness rejects any `block.type` not in this list. The list is the conservative partner-safe subset of the full SabFlow block catalogue — internal-only and experimental block types are intentionally excluded.

**Messaging & email**

- `text` — text bubble (chatbot-style render)
- `send_email`
- `forge_twilio` (SMS + WhatsApp)
- `forge_sendgrid`
- `forge_mailgun`
- `forge_slack`
- `forge_discord`
- `forge_telegram`

**Data movement & integrations**

- `webhook` — outbound HTTP call
- `forge_hubspot`
- `forge_salesforce`
- `forge_pipedrive`
- `forge_airtable`
- `forge_googlesheets`
- `forge_notion`
- `forge_stripe`
- `forge_shopify`
- `forge_zendesk`
- `forge_linear`
- `forge_jira`

**Logic & control flow**

- `condition` — branching, supports multiple `items`
- `set_variable` — write to a declared variable
- `wait` — delay (seconds / minutes / hours / days)
- `jump` — explicit jump to another `groupId`
- `ab_test` — split traffic, supports `items`

**AI (forge wrappers)**

- `forge_openai`
- `forge_anthropic`
- `forge_googleai`

**Input collection (chatbot flows only)**

- `text_input`, `number_input`, `email_input`, `phone_input`, `url_input`, `date_input`, `time_input`, `rating_input`, `file_input`, `choice_input`, `picture_choice_input`

**Out of scope** — explicitly **not** allowed in marketplace templates today:

- `code` (raw JS execution) — reserved for trusted internal recipes; partner-safe variant pending.
- `forge_raw_sql` — direct DB access is internal-only.
- `payment_input` — requires per-tenant payment-provider config that can't be templated safely.
- Any `internal_*` prefixed type.

### 3.3 Block-type `options` schemas — examples

The full per-type schema is generated from the node-parameter validators under `src/lib/sabflow/n8n/node-parameters/` and published machine-readable at `https://sabnode.com/schemas/sabflow-block-options-v1.json`. Below are the most common shapes.

**`webhook`** (outbound HTTP)

```json
{
  "type": "webhook",
  "options": {
    "url": "https://api.example.com/v1/widgets",
    "method": "POST",
    "authentication": "header",
    "authHeaderName": "Authorization",
    "body": {
      "type": "json",
      "content": "{\"name\": \"{{lead.name}}\", \"id\": \"{{lead.id}}\"}"
    },
    "responseMappings": [
      { "id": "rm_1", "path": "$.id", "variableId": "v_widget_id" }
    ]
  }
}
```

- `url` — supports `{{token}}` interpolation. Must be `https://` for external hosts.
- `body.type` — `json` | `form` | `text` | `none`.
- `responseMappings[].variableId` — must reference a declared variable in `template.json.variables[].id`.

**`send_email`**

```json
{
  "type": "send_email",
  "options": {
    "to": "{{customer.email}}",
    "subject": "Welcome {{customer.name}}!",
    "bodyType": "html",
    "body": "<p>Hi {{customer.name}}…</p>"
  }
}
```

- `to` — single address or `{{variable}}` token. Multiple recipients go through a `wait` + loop pattern (forward-ref to Phase C.11).
- `bodyType` — `html` | `text`.

**`set_variable`**

```json
{
  "type": "set_variable",
  "options": {
    "variableId": "v_lead_phone",
    "valueType": "custom",
    "value": "{{lead.phone}}"
  }
}
```

- `variableId` — must reference a declared variable.
- `valueType` — `custom` | `empty` | `today`.

**`condition`** (uses `items`)

```json
{
  "type": "condition",
  "options": {},
  "items": [
    {
      "id": "i_high_value",
      "content": {
        "comparisons": [
          { "id": "c1", "variableId": "v_amount", "operator": ">=", "value": "1000" }
        ]
      },
      "outgoingEdgeId": "e_high_value"
    },
    {
      "id": "i_default",
      "content": { "comparisons": [] },
      "outgoingEdgeId": "e_default"
    }
  ]
}
```

- Operators: `=`, `!=`, `>`, `>=`, `<`, `<=`, `contains`, `starts_with`, `ends_with`, `matches`, `is_empty`, `is_not_empty`.
- Order of `items` is evaluated top-to-bottom; first match wins. The `is_empty`-comparison default branch should be last.

**`forge_*` (third-party integrations)**

All `forge_*` blocks share the shape:

```json
{
  "type": "forge_slack",
  "options": {
    "action": "message_send",
    "channel": "#sales-wins",
    "text": "Deal won — {{customer.name}} paid {{payment.amount}}"
  }
}
```

- `action` — the operation name. Schema for each forge is generated from the Rust node definitions in `rust/crates/sabflow-nodes/`. Browse the full action list at `https://sabnode.com/schemas/sabflow-forge-actions-v1.json`.
- Credential fields (e.g. `apiKey`, `accessToken`, `clientSecret`) **must** be omitted from `template.json` — they are bound at install time by the tenant via the SabFlow credentials picker.

### 3.4 `items` — routing block sub-shape

For `condition`, `ab_test`, `choice_input`, and `picture_choice_input`:

```json
{
  "id": "i_<short>",
  "content": { /* type-specific */ },
  "outgoingEdgeId": "e_<short>"
}
```

- `outgoingEdgeId` — every item **must** have one. The graph validator flags items without an outgoing edge as a warning; the marketplace overlay promotes it to an error for partner submissions (partners cannot ship dead branches).

---

## 4. `trigger` — the single starting event

Exactly one trigger per template. The trigger's id is re-keyed at instantiation, but everything else (type, options, `appEvent`) is preserved.

### 4.1 Trigger shape

```json
{
  "id": "t_lead_created",
  "type": "webhook",
  "appEvent": "crm_lead_created",
  "options": { /* trigger-type specific; §4.3 */ }
}
```

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `id` | string | **required** | Prefix `t_`. Unique within the template. Re-keyed at instantiation. |
| `type` | enum | **required** | `webhook` \| `schedule` \| `manual` \| `app_event`. |
| `appEvent` | string | conditional | Required when `type === 'app_event'`. Must be in the registered app-event catalogue. |
| `options` | object | **required** | Per-`type` schema below. |
| `graphCoordinates` | object | **forbidden** | Partners do not set canvas coordinates; the platform lays out the trigger automatically. The harness strips this field if present. |

### 4.2 Allowed trigger types

| Type | When to use | Restrictions |
| ---- | ----------- | ------------ |
| `webhook` | External system POSTs to a tenant-specific URL | Path templated to `/webhooks/<random>/<tenant>` at install time. Partners pick the suffix only. |
| `schedule` | Run on a fixed cron schedule | Cron expression must run no more often than every 5 minutes. Sub-5-min schedules are platform-only. |
| `manual` | Tenant clicks "Run" in the editor | No options beyond `enabled`. |
| `app_event` | First-party SabNode product event (CRM lead created, payment received, etc.) | `appEvent` must be in the catalogue at `https://sabnode.com/schemas/sabflow-app-events-v1.json`. |

### 4.3 Trigger `options` examples

**`webhook`**

```json
{
  "path": "/webhooks/crm/lead-created",
  "method": "POST",
  "authentication": "header",
  "authHeaderName": "X-Webhook-Secret",
  "responseMode": "immediately",
  "enabled": true
}
```

- `authentication` — `none` | `header` | `query` | `basic`. `none` only permitted when the trigger is paired with a downstream `condition` that performs validation; the harness flags `authentication: 'none'` without that pattern as a warning.
- `responseMode` — `immediately` | `last_node`. Default `immediately`.

**`schedule`**

```json
{
  "cron": "0 */6 * * *",
  "timezone": "UTC",
  "enabled": true
}
```

- `cron` — standard 5-field cron. Validated against the 5-min minimum cadence.
- `timezone` — IANA name. Default `UTC`.

**`manual`**

```json
{ "enabled": true }
```

**`app_event`**

```json
{ "enabled": true }
```

App-event triggers carry no options beyond `enabled` — the binding is via `appEvent`.

---

## 5. `variables` — declared bindings

Variables are the named slots that `{{token}}` references resolve against. They must be declared up front so the variable panel can render them and the validator can resolve tokens.

### 5.1 Variable shape

```json
{
  "id": "v_lead_phone",
  "name": "lead.phone",
  "defaultValue": ""
}
```

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `id` | string | **required** | Prefix `v_`. Unique within the template. Used internally by `set_variable.options.variableId` and `webhook.options.responseMappings[].variableId`. |
| `name` | string | **required** | Token name used in `{{name}}`. Lowercase, dot-separated namespaces allowed (`lead.phone`, `payment.amount`). `^[a-z][a-z0-9_.]{0,47}$`. |
| `defaultValue` | string | optional | Empty string by default. Used until the tenant provides a runtime value. |

### 5.2 Standard runtime bindings (do not declare these)

These are auto-provided by the runtime and **must not** appear in `variables[]`. The validator allows their tokens regardless.

- `{{$now}}` — ISO 8601 timestamp at execution.
- `{{$execution.id}}` — current execution id.
- `{{$workspace.id}}` — tenant workspace id.
- `{{$trigger.payload}}` — full trigger payload as JSON.
- `{{$prev.<blockId>.<path>}}` — output of a prior block, JSONPath access.

### 5.3 Token resolution rules

- Tokens are resolved against `variables[].name` first, then against the standard bindings above, then against the trigger payload.
- Unresolved tokens at instantiation time become empty strings — the validator emits a warning per `validateFlow` (the rule is `missing_variable`).
- Tokens inside JSON-stringified bodies are interpolated *after* JSON serialisation, so `"id": "{{lead.id}}"` resolves to `"id": "abc-123"` (a string). For numeric fields use `"amount": {{payment.amount}}` (no quotes) — but ensure the variable's `defaultValue` is a stringified number so the JSON parses during validation.

---

## 6. Skeletons

Three minimal templates that pass the verification harness. Copy, rename, fill in.

### 6.1 Webhook-triggered

```json
{
  "$schema": "https://sabnode.com/schemas/sabflow-template-v1.json",
  "id": "my-webhook-template",
  "name": "My Webhook Template",
  "version": "0.1.0",
  "category": "ops",
  "description": "Receives an inbound webhook and forwards a Slack message.",
  "tags": ["webhook", "slack"],
  "trigger": {
    "id": "t_inbound",
    "type": "webhook",
    "options": {
      "path": "/webhooks/my-template",
      "method": "POST",
      "authentication": "header",
      "authHeaderName": "X-Webhook-Secret",
      "responseMode": "immediately",
      "enabled": true
    }
  },
  "variables": [
    { "id": "v_payload_summary", "name": "payload.summary", "defaultValue": "" }
  ],
  "blocks": [
    {
      "id": "b_notify",
      "groupId": "g_notify",
      "type": "forge_slack",
      "options": {
        "action": "message_send",
        "channel": "#alerts",
        "text": "Inbound: {{payload.summary}}"
      }
    }
  ],
  "publisher": {
    "name": "Acme Templates",
    "supportEmail": "support@example.com",
    "homepageUrl": "https://example.com"
  }
}
```

### 6.2 Schedule-triggered

```json
{
  "$schema": "https://sabnode.com/schemas/sabflow-template-v1.json",
  "id": "daily-digest",
  "name": "Daily Digest",
  "version": "0.1.0",
  "category": "ops",
  "description": "Sends a daily summary email at 09:00 UTC.",
  "tags": ["schedule", "email", "digest"],
  "trigger": {
    "id": "t_daily",
    "type": "schedule",
    "options": { "cron": "0 9 * * *", "timezone": "UTC", "enabled": true }
  },
  "variables": [
    { "id": "v_recipient", "name": "recipient.email", "defaultValue": "" }
  ],
  "blocks": [
    {
      "id": "b_email",
      "groupId": "g_email",
      "type": "send_email",
      "options": {
        "to": "{{recipient.email}}",
        "subject": "Daily digest — {{$now}}",
        "bodyType": "html",
        "body": "<p>Today's summary…</p>"
      }
    }
  ],
  "publisher": {
    "name": "Acme Templates",
    "supportEmail": "support@example.com",
    "homepageUrl": "https://example.com"
  }
}
```

### 6.3 Manual-triggered

```json
{
  "$schema": "https://sabnode.com/schemas/sabflow-template-v1.json",
  "id": "ad-hoc-broadcast",
  "name": "Ad-Hoc Broadcast",
  "version": "0.1.0",
  "category": "marketing",
  "description": "Run on demand to broadcast a Slack message to a channel.",
  "tags": ["manual", "broadcast", "slack"],
  "trigger": {
    "id": "t_manual",
    "type": "manual",
    "options": { "enabled": true }
  },
  "variables": [
    { "id": "v_message", "name": "message", "defaultValue": "Hello team!" }
  ],
  "blocks": [
    {
      "id": "b_broadcast",
      "groupId": "g_broadcast",
      "type": "forge_slack",
      "options": {
        "action": "message_send",
        "channel": "#general",
        "text": "{{message}}"
      }
    }
  ],
  "publisher": {
    "name": "Acme Templates",
    "supportEmail": "support@example.com",
    "homepageUrl": "https://example.com"
  }
}
```

---

## 7. `publisher` — attribution

```json
{
  "name": "Acme Templates",
  "supportEmail": "support@example.com",
  "homepageUrl": "https://example.com",
  "sourceRepoUrl": "https://github.com/example/sabflow-templates",
  "logoUrl": "sabfile://__system/marketplace/publishers/<userId>/logo.png"
}
```

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `name` | string | **required** | Display name. Must match the legal display name on file in the partner profile. |
| `supportEmail` | string (email) | **required** | Per-template support inbox. May be a shared inbox; reviewers verify deliverability. |
| `homepageUrl` | string (URL) | **required** | `https://` only. Must resolve at submission time. |
| `sourceRepoUrl` | string (URL) | optional | Public Git repo. Strongly recommended. |
| `logoUrl` | string (SabFiles URI) | optional | `sabfile://` only. Falls back to category default. |

`userId` is not partner-supplied — the server fills it in from the authenticated submission session. Mismatches between `publisher.name` and the partner profile name reject the submission.

---

## 8. Disallowed field patterns

The harness scans for and rejects the following anywhere in `template.json`:

- [ ] **Raw secrets.** Anything matching `(?i)(api[-_]?key|secret|token|password|private[-_]?key)` keyed onto a string >= 24 chars. The intent is to catch pasted credentials; false positives can be silenced with the metadata key `"!partnerVerified": "no-secret"` on the offending value (this surfaces on review).
- [ ] **External file URLs.** Any string matching `^https?://.*\.(png|jpg|jpeg|gif|webp|svg|pdf|mp4|mov|wav|mp3|csv|xlsx|docx)(\?.*)?$` that is **not** a `sabfile://` URI. Per the SabFiles policy in `CLAUDE.md`, every file must come from SabFiles.
- [ ] **Coordinates.** `graphCoordinates` on the trigger or any group. The platform lays out the canvas; partner-supplied coordinates are stripped.
- [ ] **`userId` on publisher.** Server-controlled; partners cannot set this.
- [ ] **`status` / `installCount` / `averageRating` / `reviewCount`.** Server-controlled.
- [ ] **Empty `blocks[]`.** Templates with no blocks are not useful and not permitted.
- [ ] **Multi-trigger.** `events[]` exposed as an array — partners specify `trigger` (singular).

---

## 9. JSON Schema (machine-readable)

The canonical machine-readable schema is published at:

- `https://sabnode.com/schemas/sabflow-template-v1.json` — top-level `template.json`
- `https://sabnode.com/schemas/sabflow-block-options-v1.json` — per-block-type `options` schemas
- `https://sabnode.com/schemas/sabflow-forge-actions-v1.json` — per-forge action catalogue
- `https://sabnode.com/schemas/sabflow-app-events-v1.json` — `app_event` trigger catalogue

Editor integration: point your JSON-aware editor at the `$schema` URL in `template.json` for autocomplete, inline error squigglies, and hover docs. The schemas are also bundled with `@sabnode/sabflow-template-cli` so `verify` runs fully offline.

---

## 10. Compatibility & versioning

- [ ] **Schema is versioned in the URL.** The current major is `v1`. Breaking schema changes ship as `v2` and the platform supports `v1` and `v2` side-by-side for **180 days** after `v2` lands.
- [ ] **`minPlatformVersion`** on a template gates instantiation — the gallery hides the template on older SabNode releases. Defaults to the platform version at the time of approval.
- [ ] **Unknown fields** at the top level produce a warning, not an error, so partners can ship templates against a newer schema minor without breaking older CLI installs. Unknown fields *inside* `blocks[].options` are errors (mistyped option names are almost always bugs).

---

## Summary (≤200 words)

`template.json` is the portable, partner-authored descriptor for a SabFlow marketplace template. It deserialises into the in-repo `Recipe` type (`src/lib/sabflow/recipes/types.ts`) plus marketplace-only attribution fields (`publisher`, `preview`, `icon`, `minPlatformVersion`). Every template carries a stable kebab-case `id`, a semver `version`, one of ten supported categories, exactly **one** trigger (`webhook`, `schedule`, `manual`, or `app_event`), a declared `variables[]` array, and a minimum of one block from the partner-safe allowlist (messaging, integrations, logic, AI, input-collection — explicitly **excluding** `code`, raw SQL, and `internal_*` types). Every `block.type` is validated against the matching node-parameter schema under `src/lib/sabflow/n8n/node-parameters/` and the whole document is run through `validateFlow` plus a marketplace overlay (no embedded secrets, no external file URLs outside SabFiles, no partner-set canvas coordinates). Publisher attribution is mandatory: name + support email + homepage URL, with name matching the partner profile at submission. Three minimal skeletons (webhook, schedule, manual) are provided in §6. The canonical machine-readable JSON Schema is at `https://sabnode.com/schemas/sabflow-template-v1.json` and shipped offline with `@sabnode/sabflow-template-cli`.

# Facebook Ads → CRM Leads Integration

**Date:** 2026-05-11  
**Status:** Approved  
**Module:** CRM → Settings → Integrations

---

## Overview

Automatically create CRM leads in real-time when a prospect submits a Facebook Lead Ad form. The integration is webhook-driven (Meta fires instantly on submission), with all heavy logic — Graph API fetch, field mapping, routing, MongoDB write — owned by the Rust BFF. Next.js handles only the webhook entry point and the configuration UI.

---

## Architecture & Data Flow

```
Meta fires "leadgen" webhook event
        ↓
/api/webhooks/meta  (Next.js — already registered & verified)
        ↓  detects change.field === "leadgen"
POST /v1/facebook/lead-gen/process-webhook  (Rust BFF)
        ↓
  1. Parse: form_id, lead_id, page_id, ad_id, adset_id, campaign_id
  2. Fetch full lead from Facebook Graph API
       GET /{lead_id}?fields=field_data,created_time,ad_id,adset_id,campaign_id
  3. Load crm_facebook_leadgen_config for this tenantId + form_id
  4. Evaluate campaignRules top-down (first match wins) → pick pipeline/stage/assignee
     Fall back to defaultRouting if no rule matches
  5. Map field_data entries → CrmLead fields
     Unmapped custom Q&A → description as "Q: ... / A: ..." pairs
  6. Check crm_leads.facebookLeadId index for idempotency (Meta retry guard)
  7. Insert CrmLead into MongoDB (source: "Facebook Ads", facebookLeadId indexed)
  8. Append entry to activity log collection
  9. Return { leadId, status } → Next.js logs result
```

Next.js always returns HTTP 200 to Meta regardless of downstream outcome (prevents Meta retry floods).

---

## Data Model

### `crm_facebook_leadgen_config` (new MongoDB collection, managed by Rust BFF)

```json
{
  "_id": "ObjectId",
  "tenantId": "string",
  "pageId": "string",
  "pageAccessToken": "string (encrypted at rest)",
  "isActive": "boolean",
  "forms": [
    {
      "formId": "string",
      "formName": "string",
      "fieldMapping": [
        {
          "fbField": "string",
          "crmField": "email | contactName | phone | company | title | description | notes | ignore"
        }
      ],
      "defaultRouting": {
        "pipelineId": "string",
        "stage": "string",
        "assignedTo": "string (userId)"
      },
      "campaignRules": [
        {
          "campaignId": "string (optional)",
          "adsetId": "string (optional)",
          "pipelineId": "string",
          "stage": "string",
          "assignedTo": "string (userId)"
        }
      ]
    }
  ],
  "createdAt": "DateTime",
  "updatedAt": "DateTime"
}
```

### `CrmLead` additions

One new field added to the existing `crm_leads` collection (`source` already exists):

| Field | Type | Notes |
|---|---|---|
| `facebookLeadId` | `string` | Sparse unique index — idempotency guard for Meta retries |

`source` is set to `"Facebook Ads"` on insert — no schema change required.

### `crm_facebook_leadgen_activity` (new collection)

```json
{
  "_id": "ObjectId",
  "tenantId": "string",
  "timestamp": "DateTime",
  "formId": "string",
  "formName": "string",
  "facebookLeadId": "string",
  "crmLeadId": "string | null",
  "leadName": "string",
  "status": "created | skipped | error",
  "errorMessage": "string | null"
}
```

TTL index: 90 days. Only last 100 entries returned to UI.

---

## Rust BFF Endpoints

### New endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/v1/facebook/lead-gen/process-webhook` | Internal JWT | Receive event, fetch from Graph API, map, insert lead |
| `GET` | `/v1/facebook/lead-gen/config` | Session JWT | Get all form configs for tenant |
| `POST` | `/v1/facebook/lead-gen/config` | Session JWT | Create or update a form config |
| `DELETE` | `/v1/facebook/lead-gen/config/{formId}` | Session JWT | Remove a form config |
| `GET` | `/v1/facebook/lead-gen/activity` | Session JWT | Last 100 activity log entries for tenant |

### Existing endpoints reused internally

- `GET /v1/facebook/lead-gen/projects/{projectId}/forms` — list available forms (already exists)
- `GET /v1/facebook/lead-gen/leads/{leadId}` — fetch individual lead (already exists, used in process-webhook)

### `POST /v1/facebook/lead-gen/process-webhook` payload

```json
{
  "pageId": "string",
  "formId": "string",
  "leadId": "string",
  "adId": "string | null",
  "adsetId": "string | null",
  "campaignId": "string | null",
  "tenantId": "string"
}
```

---

## Next.js Changes

### `webhook-processor.ts` — one new branch

```typescript
if (change.field === "leadgen") {
  await rustClient.post("/v1/facebook/lead-gen/process-webhook", {
    pageId: entry.id,
    formId: change.value.form_id,
    leadId: change.value.leadgen_id,
    adId:   change.value.ad_id       ?? null,
    adsetId:    change.value.adset_id    ?? null,
    campaignId: change.value.campaign_id ?? null,
    tenantId: resolvedTenantId,  // resolved from entry.id (pageId) via existing project cache lookup
  });
}
```

`resolvedTenantId` comes from the existing page-ID → project lookup cache already used by the webhook processor for other Meta events. Errors from Rust are caught and logged; the outer handler still returns 200 to Meta.

### New Rust client wrapper — `wachat-facebook-leadgen-config.ts`

Thin typed wrappers for the five new Rust config/activity endpoints, following the same pattern as existing `wachat-facebook-lead-gen.ts`.

### Meta webhook subscription

The Facebook Page webhook subscription must have `leadgen` added to its subscribed fields. This is a one-time action done in the Meta App Dashboard (or via Graph API). Document this in the setup UI.

---

## Configuration UI

**Location:** `/src/app/dashboard/crm/settings/integrations/facebook-ads/page.tsx`

**Entry point:** New integration card in `/src/app/dashboard/crm/settings/integrations/page.tsx` alongside Slack, QuickBooks, etc.

```
┌─────────────────────────────────────────────────────┐
│  [FB icon]  Facebook Ads → Leads                    │
│  Auto-create CRM leads from Lead Ad forms in        │
│  real-time.                                         │
│                                [Configure →] button  │
└─────────────────────────────────────────────────────┘
```

If token is expired, card shows an amber "Reconnect required" badge.

### Tab 1 — Connection

- "Connect Facebook Page" → triggers existing `/auth/facebook` OAuth flow with `leads_retrieval` + `pages_manage_metadata` scopes requested
- Connected state: shows page avatar, page name, connected-on date
- Disconnect button: revokes token, sets `isActive: false`, shows confirmation modal

### Tab 2 — Forms

- Lists all Lead Gen forms on connected page (from existing Rust forms endpoint)
- Each form: expandable panel containing:

**Field Mapping table**

| Facebook Form Field | CRM Field |
|---|---|
| `full_name` | `contactName` ▾ |
| `email` | `email` ▾ |
| `phone_number` | `phone` ▾ |
| `company_name` | `company` ▾ |
| `[custom question text]` | `notes` ▾ |

Dropdown options: `contactName`, `email`, `phone`, `company`, `title`, `description`, `notes`, `[ignore]`

**Default Routing**

Pipeline → Stage → Assignee (three chained selectors, same pattern as existing pipeline UI)

**Campaign Rules**

Add-row table. Columns: Campaign ID (optional text), Ad Set ID (optional text), Pipeline, Stage, Assignee. Rules evaluated top-down; drag handles to reorder. First match wins; falls back to Default Routing.

### Tab 3 — Activity Log

Table: Timestamp | Form Name | Lead Name | CRM Lead | Status

- Status chip: green "Created" / amber "Skipped" / red "Error"
- Last 100 entries
- "Error" rows expand to show error message

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Facebook Graph API unreachable | Rust returns 503 to Next.js; Next.js catches, logs warning, returns 200 to Meta |
| `form_id` not found in config | Rust drops lead silently; logs activity entry with status `skipped`, reason "Form not configured" |
| Page access token expired | Rust logs activity `error`; sets `isActive: false` on config; integration card shows "Reconnect required" badge |
| MongoDB write failure | Rust retries once after 2 s; on second failure logs `error` to activity, returns 200 to Meta |
| Duplicate `facebookLeadId` (Meta retry) | Rust detects duplicate on sparse unique index; skips insert; logs `skipped` to activity |
| `campaignRules` has no match | Falls back to `defaultRouting` — never silently drops a configured lead |
| Rust BFF unreachable from Next.js | Next.js logs error, returns 200 to Meta; lead is lost (acceptable — no polling fallback in scope) |

---

## Field Mapping Logic (Rust)

```
for entry in lead.field_data:
  match form_config.field_mapping.find(|m| m.fb_field == entry.name):
    Some(mapping) if mapping.crm_field == "ignore" => skip
    Some(mapping) => set crm_lead[mapping.crm_field] = entry.values[0]
    None => append "Q: {entry.name} / A: {entry.values.join(', ')}" to description
```

Standard Facebook field name aliases handled: `full_name` → splits into `contactName`; `phone_number` normalised to E.164 if possible.

---

## Routing Logic (Rust)

```
routing = form_config.default_routing
for rule in form_config.campaign_rules:  // top-down, first match wins
  if (rule.campaign_id is None OR rule.campaign_id == lead.campaign_id)
  AND (rule.adset_id   is None OR rule.adset_id   == lead.adset_id):
    routing = rule
    break
apply routing → crm_lead.pipeline_id, crm_lead.stage, crm_lead.assigned_to
```

---

## Duplicate Policy

- **Same `facebookLeadId` (Meta retry):** Idempotency check via sparse unique index — skip insert.
- **Same email, different `facebookLeadId` (real re-engagement):** Always create a new `CrmLead`. No deduplication by email.

---

## Out of Scope

- Polling/catch-up sync (not needed; webhook-only)
- Instagram Lead Ads (same API surface, can be added later with minimal changes)
- Editing leads back to Facebook
- Facebook Conversions API (sending CRM events back to Meta)
- Per-lead notification emails/Slack messages (handled by existing CRM automation rules)

---

## File Inventory

### New files
- `src/app/dashboard/crm/settings/integrations/facebook-ads/page.tsx` — config UI
- `src/lib/rust-client/wachat-facebook-leadgen-config.ts` — Rust client wrappers for config/activity endpoints

### Modified files
- `src/lib/webhook-processor.ts` — add `leadgen` branch
- `src/lib/definitions.ts` — add `facebookLeadId?: string` to `CrmLead` type
- `src/app/dashboard/crm/settings/integrations/page.tsx` — add Facebook Ads integration card

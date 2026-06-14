# SabNode Future — Zoho Parity Gap Audit

Inventory of Zoho's product catalog vs. what SabNode currently ships. Only the
**gaps and partials** are listed — anything fully covered is omitted.

Legend
- ❌ Missing — no module today.
- 🟡 Partial — some adjacent functionality exists; significant gap remains.

Generated 2026-05-27 from `src/app/dashboard/**`.

---

## CRM & Sales

| Zoho product | Status | Closest SabNode | Gap |
|---|---|---|---|
| Zoho Bigin | 🟡 | `crm/sales-crm/pipelines` | No standalone lightweight "starter CRM" SKU — Bigin is positioned as a simpler, cheaper CRM for micro-businesses. |
| Zoho Desk | 🟡 | `crm/tickets` | Tickets exist; missing dedicated helpdesk surface — SLA timers, agent workspaces, omnichannel ticket capture, knowledge-base hosting beyond `sabchat/knowledge`, customer self-service portal scoped to support. |
| Zoho Lens | ❌ | — | AR remote camera assist for field support. Not present. |
| Zoho Assist | ❌ | — | Remote screen-share / unattended access. Not present. |
| Zoho Campaigns | 🟡 | `email/`, `marketing/drip-campaigns` | Drip + email exists; missing dedicated bulk-email campaign manager with list-segmentation funnels, transactional vs. marketing split, deliverability dashboards beyond `email/deliverability`. |
| Zoho Sign | 🟡 | `sabsign` | Module exists but check end-to-end: signer authentication tiers, audit trail PDF, in-person sign, templates with field-mapping, bulk sign, recipient routing rules. |
| Zoho Thrive | 🟡 | `crm/sales/loyalty`, `marketing/affiliate-management`, `sabrewards` | Pieces exist; missing the unified customer-loyalty + referral + reward storefront UX. |

## Finance Suite

| Zoho product | Status | Closest SabNode | Gap |
|---|---|---|---|
| Zoho Checkout | ❌ | `crm/sales/payments` | No hosted recurring/one-off payment-page builder (shareable links with branded pages, plan selector). |
| Zoho Commerce | 🟡 | `dashboard/sabshop` (single page) | E-commerce storefront is a stub. No catalog, cart, checkout flow, themes, shipping zones, tax engine. `crm/store` + `crm/pos` are POS-side, not consumer storefront. |
| Zoho Practice | ❌ | — | Accountant practice management — client-firm relationship, multi-client books, document requests, advisory dashboards. Not present. |

## Collaboration & Productivity

| Zoho product | Status | Closest SabNode | Gap |
|---|---|---|---|
| Zoho Mail | 🟡 | `email/inbox`, `crm/email` | Email **sending/marketing** is built; no hosted user mailbox (IMAP/SMTP user accounts, custom-domain mailboxes, calendar/contacts sync, mobile mail clients). |
| Zoho Cliq | ❌ | `wachat` (external WhatsApp only) | No internal team chat — channels, threads, DMs, presence, huddles. |
| Zoho Meeting | ❌ | `sabmeet`, `crm-advanced/meeting-scheduler` | Scheduler exists; missing the actual video-conference engine (WebRTC rooms, screen-share, recording, dial-in). |
| Zoho Writer | ❌ | — | Collaborative document editor. Not present. |
| Zoho Sheet | ❌ | — | Collaborative spreadsheet. Not present. |
| Zoho Show | ❌ | — | Collaborative presentation. Not present. |
| Zoho Notebook | ❌ | `crm/workspace/sticky-notes` | Sticky notes are board-level; no personal note-taking app with notebooks/sections/multimedia notes. |
| Zoho Connect | 🟡 | `hrm/hr/announcements`, `hrm/hr/events`, `hrm/hr/recognition` | Internal-social pieces exist (now folded into HRM); missing unified intranet feed, employee groups, manuals, custom apps inside the social layer. |
| Zoho Vault | ❌ | `settings/api-keys` | No team password manager (encrypted vault, password-sharing rules, browser extension, secret rotation, breach alerts). |

## HR & Recruitment

| Zoho product | Status | Closest SabNode | Gap |
|---|---|---|---|
| Zoho Workerly | ❌ | — | Temp/agency staffing — client→worker→timesheet→invoice loop. Not present. |

## IT & Helpdesk

| Zoho product | Status | Closest SabNode | Gap |
|---|---|---|---|
| ManageEngine | ❌ | — | IT operations suite (endpoint mgmt, MDM, AD mgmt, patch). Not present. |
| Site24x7 | ❌ | — | Synthetic monitoring / APM / uptime checks for external endpoints. SabNode has internal observability only. |
| Qntrl | 🟡 | `sabflow`, `sabrequests` | SabFlow is a workflow engine; Qntrl is a *request/approval* orchestration layer (forms-driven request lifecycle with SLAs). Different shape, partial overlap. |

## Development & Low-Code

| Zoho product | Status | Closest SabNode | Gap |
|---|---|---|---|
| Zoho Creator | ❌ | `sabflow` | No low-code app builder — drag-drop forms → tables → pages → workflows → mobile/web app, with row-level security. |
| Zoho Catalyst | ❌ | — | Serverless function platform / BaaS (functions, datastore, auth, file store as a service for customers). Not present. |
| Zoho Analytics | 🟡 | `sabbi`, `crm/dashboards`, `crm/analytics`, `crm/reports` | Module-scoped reports exist; missing standalone BI workspace — bring-your-own dataset, joined data prep, drag-drop visualizations, drilldown, scheduled report email/embed. |
| Zoho DataPrep | 🟡 | `sabprep`, `sabflow` (transform nodes) | ETL nodes exist inside flows; missing dedicated visual data-prep canvas (column profiling, suggested cleansing, joins UI). |
| Zoho Tables | ❌ | — | Airtable-equivalent — schema-on-the-fly tables, multiple views (grid/kanban/gallery/calendar), formula/lookup columns, automations. Not present. |

## Project Management

| Zoho product | Status | Closest SabNode | Gap |
|---|---|---|---|
| Zoho Sprints | ❌ | `sabsprints`, `crm/projects/kanban` | Kanban view exists; missing Scrum-specific tooling — backlog, sprint planning, velocity, burndown, epics, story points. |
| BugTracker | 🟡 | `sabbugs`, `crm/tickets` | Tickets are customer-facing; missing internal dev bug tracker with versions, build numbers, severity matrices. |

## Marketing & Commerce

| Zoho product | Status | Closest SabNode | Gap |
|---|---|---|---|
| Zoho Backstage | ❌ | `crm/workspace/events` | Internal events only; missing ticketed-event platform — public event pages, ticket types, attendee app, sponsor mgmt, on-site check-in. |
| Zoho Webinar | ❌ | — | Webinar engine — registration funnel, branded landing, live streaming, polls/Q&A, recording, attendee analytics. |
| Zoho PageSense | 🟡 | `sabsense`, `marketing/ab-testing`, `marketing/utm-tracking` | A/B + UTM exist; missing CRO observability — heatmaps, scroll maps, funnel analysis, session recordings. |
| Zoho Publish | ❌ | — | Local-business listings management — Google Business Profile, Yelp, Bing Places, Apple Maps sync from one console. Not present. |

## Communication

| Zoho product | Status | Closest SabNode | Gap |
|---|---|---|---|
| Zoho Voice | 🟡 | `sabvoice` | Module exists; verify full cloud-PBX feature set — DID provisioning, IVR builder, call recording, queues, agent live dashboard, voicemail-to-email. |
| Trident | ❌ | — | Native desktop "unified work" client wrapping mail/chat/calendar/meetings. Not present. |
| Zoho Cliq | ❌ | `wachat` (external WhatsApp only) | No internal team chat — channels, threads, DMs, presence, huddles. |

## All-in-One Suites

✅ Covered conceptually: SabNode itself is the all-in-one. Bundles (Zoho One,
Workplace, Finance Plus, CRM Plus, People Plus) map to plan-level packaging,
not separate modules.

---

## Quick gap shortlist (highest leverage)

Build order if pursuing parity, ranked by typical SMB pull-through:

1. **Zoho Mail equivalent** — hosted custom-domain mailboxes (high churn-reducer).
2. **Zoho Cliq equivalent** — internal team chat (the obvious hole next to WaChat).
3. **Zoho Meeting** — video rooms (scheduler is already built; add the room).
4. **Zoho Commerce** — finish the storefront on top of `dashboard/sabshop`.
5. **Zoho Tables** — Airtable-style flexible DB (drives ad-hoc app building).
6. **Zoho Analytics standalone BI** — cross-module data workspace.
7. **Zoho Vault** — team password manager (high stickiness, low surface area).
8. **Zoho Sprints** — agile module reusing the existing projects/kanban.
9. **Zoho Webinar** — pairs naturally with marketing campaigns.
10. **Zoho Publish** — local-listings sync (cheap to build, sells itself).

Out-of-scope without a dedicated team:
- **ManageEngine / Site24x7** — heavy IT-ops verticals, large surface.
- **Zoho Lens / Assist** — AR + low-latency screen-share require native apps + media servers.
- **Writer / Sheet / Show** — collaborative editors are multi-quarter builds; consider partnering or embedding open-source (OnlyOffice/Collabora) instead.
- **Trident** — native desktop client; defer until web suite is mature.

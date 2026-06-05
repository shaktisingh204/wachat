Task tracking isn't essential to producing this markdown deliverable. I have everything needed. Writing the final plan now.

# WaChat Master Completion Plan

## 1. Executive Summary

**Total pages:** 100 (`src/app/wachat/**/page.tsx`).

**Reality check (audit JSON arrived empty — this plan is grounded in a fresh classification of all 100 files):** WaChat is *far* healthier than a greenfield campaign. 97/100 render inside the `<WachatPage>` shell, 79 import real server actions, and the large "thin" pages (`analytics`, `delivery-reports`, `link-tracking`, `team-performance`, `template-analytics`, `message-statistics`, `response-time-tracker`, `chat-ratings`, `campaign-ab-test`, `bulk-messaging`, etc.) are already fully wired — they `await` real Rust-backed actions (`getDeliveryReport`, `getLinkClicks`, `getAgentPerformance`, `getTemplateAnalytics`, `getBroadcastSegments`, `sendBulkMessages`) inside `useEffect` with loading state. This is a **hardening campaign, not a build-from-mock campaign.**

**worksToday classification (100 pages):**
| Bucket | Count | Meaning |
|---|---|---|
| `worksToday=true` — fully wired | ~74 | Real backend read + mutations + states already present |
| `worksToday=true` — redirect-stub (no work) | 4 | `message-analytics`→`message-statistics`, `whatsapp-ads/setup`→`/dashboard/facebook/all-projects`, `canned-messages`→settings, `calls`→`calls/logs` |
| `worksToday=true` — docs/static (no backend by design) | 4 | `flows/docs`, `flow-builder/docs`, `setup/docs`, `whatsapp-ads/roadmap` |
| `worksToday=true` — route-entry delegating to client (no work) | 3 | `chat`, `chat/kanban`, `catalog/new` (logic lives in `_components`) |
| `worksToday=false` — needs work | ~15 | mock-seeded, missing-mutation, or partial UX |

**By backendStatus:** `rust-wired` ~60 · `mongo-direct` ~6 (chatbot, auto-reply-order, media-library, settings/agents, link-generator) · `actions-wired` (analytics/reports) ~20 · `local-mock-only` 2 (`two-line`, `interactive-message-builder` saved-templates) · `redirect/docs` 12.

**By priority:** P0 ~6 broken (overview polish, chat states, contacts edge cases, template builders persistence) · P1 ~6 · P2 ~3.

**By effort:** S (states/toasts only) ~9 · M (add one mutation + states) ~5 · L (new persistence layer) ~2 (`two-line`, `interactive-message-builder`).

**Biggest systemic gaps (the only real ones):**
1. **No "phone-number routing" persistence for `two-line`** — it seeds `INITIAL_NUMBERS` mock into `useState` and never persists. Routing data already has a home (`settings/agents/actions.ts` writes to `projects`/`contacts`), so this is a wiring gap, not a missing backend.
2. **`interactive-message-builder` saves templates to `localStorage`** instead of the Rust template library (`wachatTemplatesActionsApi.librarySave`).
3. **Inconsistent empty/error UX** on a handful of otherwise-wired pages (they have loading + data but swallow errors silently or lack `EmptyState`). This is the dominant *small* task across the campaign.
4. **No shared "require active project" gate** — every page re-implements the `if (!activeProjectId) return <EmptyState>` check inline (97 copies). A shared guard would cut boilerplate and standardize the empty state.

---

## 2. Shared Backend To Build First

These cross-cutting pieces unblock multiple page-agents and **must land before the waves** so agents reuse rather than reinvent. Most of the backend already exists (see inventory) — the shared work is thin wrappers + UI consistency primitives.

| # | Name | File path | Responsibility | Reuses |
|---|---|---|---|---|
| S1 | **`<RequireProject>` guard + `useActiveProject()` helper** | `src/app/wachat/_components/require-project.tsx` | Single component that reads `useProject()`, renders a standard "No project selected" `EmptyState` (with a link to `/wachat`) when `!activeProjectId`, else renders children with `{ activeProject, activeProjectId, phoneNumberId }`. Kills 97 inline copies. | `@/context/project-context`, 20ui `EmptyState` |
| S2 | **`<DataState>` wrapper (loading/empty/error in one)** | `src/app/wachat/_components/data-state.tsx` | Props `{ loading, error, isEmpty, skeleton, emptyState, onRetry, children }`. Renders 20ui `Skeleton` / `EmptyState` / error-with-retry consistently. Standardizes the "three required states" from the cheat-sheet across every list/report page. | 20ui `Skeleton, EmptyState, Button` |
| S3 | **Phone-number routing server action module** | `src/app/wachat/two-line/actions.ts` | NEW. `listNumberRouting(projectId)` + `saveNumberRouting(projectId, pnId, { label, teamId, defaultRoute })`. Persist to `projects.phoneNumberRouting[]` via Mongo (`connectToDatabase`) — mirror the pattern in `settings/agents/actions.ts` (`updateProjectRoutingRules`). Phone numbers themselves come from `wachatConfigApi.syncPhoneNumbers` / `activeProject.phoneNumbers`. | `@/lib/mongodb`, `getSession`, `rustClient.wachatConfig` |
| S4 | **Interactive-template persistence action** | `src/app/wachat/templates/interactive-message-builder/actions.ts` | NEW. `saveInteractiveTemplate` → `rustClient.wachatTemplatesActions.librarySave`; `listInteractiveTemplates` → `libraryList`; `deleteInteractiveTemplate` → `libraryDelete`. Replaces the page's `localStorage` savedTemplates array. | `wachat-templates-actions.ts` (already exists) |
| S5 | **Shared error-toast normalizer** | `src/app/wachat/_lib/handle-action-error.ts` | `toastError(toast, e)` — unwraps `RustApiError` / `SabwaEngineError` / plain `Error` to a user-message and fires the 20ui toast. Ensures every mutation gives feedback (the cheat-sheet's "toast on error" rule). | `RustApiError` from `@/lib/rust-client`, `useToast` |
| S6 | **Reports date-range hook** | `src/app/wachat/_lib/use-report-range.ts` | `useReportRange(default='7d')` returning `{ days, range, setRange }` synced to URL (`useSearchParams` + `router.replace`). The 8 report pages each hand-roll a `days` selector; centralize it. | `use-debounce`, 20ui `Segmented`/`DateRange` |

**Do NOT build:** new Mongo collections beyond `projects.phoneNumberRouting` — every other feature already persists Rust-side via `rustClient.wachatFeatures.*` / `wachatConfig` / `wachatBroadcast`. Adding native-Mongo collections would re-trigger the documented **two-store gotcha** (data silently vanishing because reads go to Rust). Route all feature persistence through the existing `rustClient`.

---

## 3. Execution Waves

Waves ordered by priority (P0 domains first). For each page: **route · priority · effort**. "Independent" pages can be dispatched fully in parallel; "shared-file" pages are flagged for conflict serialization.

### Wave 1 — Overview / Analytics (P0)
| Page | Pri | Effort | Work |
|---|---|---|---|
| `/wachat/overview` | P0 | S | Already fetches `/api/wachat/dashboard`. Add error state + retry (S2), guard with S1; layout prefs in localStorage are fine. |
| `/wachat/analytics` | P0 | S | Wired (`getLocalMessageAnalytics`+`getBroadcastAnalytics`). Adopt S2/S6, error toast S5. |
| `/wachat/health` | P1 | S | Replace mock-seed const with `getWabaHealthStatus`/`getPhoneNumberHealthStatus` (already imported on `/wachat/page.tsx`); S2. |
| `/wachat` (All Projects) | P0 | S | Wired (`getWabaHealthStatus`); standardize empty state via S1. |

**Depends on:** S1, S2, S5, S6. **Parallelization note:** all independent (different files). S6 is *read-only shared* — copy-safe. Dispatch 4 in parallel after S1/S2/S6 land.

### Wave 2 — Inbox / Chat (P0)
| Page | Pri | Effort | Work |
|---|---|---|---|
| `/wachat/chat` | P0 | S | Route-entry only; logic in `ZoruChatClient`. Verify SSE `/api/wachat/stream` degrades when `REDIS_URL` absent (503 → show "live updates unavailable" banner, not crash). |
| `/wachat/chat/kanban` + `/wachat/conversation-kanban` | P0 | M | Confirm `getKanbanData`/`saveKanbanStatuses` wiring; add optimistic drag + S2/S5. |
| `/wachat/conversation-search` | P1 | S | Wired (`searchConversations`); add empty/error S2. |
| `/wachat/conversation-filters` | P1 | M | `getConversationFilters`/save/delete (wachatFeatures); add save mutation feedback. |
| `/wachat/assignments` | P1 | M | `getUnassignedConversations`/`assignConversation`; optimistic reassign. |
| `/wachat/agent-availability` | P1 | S | `getAgentStatuses`/`setAgentStatus`; S2/S5. |

**Depends on:** S1, S2, S5; SSE degradation. **Parallelization note:** `chat` and `conversation-kanban` may both touch `_components/zoru-chat-client` / kanban client — **serialize those two**; the other 4 are independent.

### Wave 3 — Contacts (P0)
| Page | Pri | Effort | Work |
|---|---|---|---|
| `/wachat/contacts` | P0 | — | Reference impl (done). |
| `/wachat/contact-groups` | P1 | S | `getContactGroups`/save/delete; S2/S5. |
| `/wachat/contact-blacklist` | P1 | S | `getBlacklist`/add/bulkAdd/remove. |
| `/wachat/blocked-contacts` | P1 | S | `getBlockedContacts`/block/unblock. |
| `/wachat/contact-import-history` | P2 | S | `getImportHistory` (read-only) + empty state. |
| `/wachat/contact-merge` | P1 | M | Needs a merge mutation — wire to contacts update/delete pair via `wachatContactsApi`; confirm a Rust merge endpoint, else compose update+delete. |
| `/wachat/contact-notes` | P2 | S | `getContactNotes`/add/delete. |
| `/wachat/contact-timeline` | P2 | S | `getContactTimeline` (read-only) + S2. |

**Depends on:** S1, S2, S5. **Parallelization note:** fully independent (each is its own `wachatFeatures` slice). Dispatch all 7 in parallel. Only `contact-merge` needs design attention (no single merge fn — compose).

### Wave 4 — Broadcasts (P0)
| Page | Pri | Effort | Work |
|---|---|---|---|
| `/wachat/broadcasts` + `/[broadcastId]` | P0 | S | Wired (`getBroadcasts`/`getBroadcastById`/attempts/logs). S2/S5 only. |
| `/wachat/broadcast-history` | P1 | S | Wired (`getBroadcasts`); empty/error. |
| `/wachat/broadcast-scheduler` + `/wachat/scheduled-messages` | P1 | M | `scheduleBroadcast`/`getScheduledBroadcasts`/cancel + `scheduleMessage`/`getScheduledMessages`. |
| `/wachat/broadcast-cron` | P1 | S | `requeueStuck` admin + `startCronBroadcast` action exist; wire trigger + status. |
| `/wachat/broadcast-segments` | P1 | — | Wired (`getBroadcastSegments`). Done; verify states. |
| `/wachat/campaign-ab-test` | P1 | M | Wired to segments; add variant compare + result read. |
| `/wachat/bulk`, `/wachat/bulk/template`, `/wachat/bulk-messaging`, `/wachat/broadcasts/bulk-template` | P1 | M | `bulk` delegates to `bulk-actions-client`; `bulk-messaging` calls `sendBulkMessages` (done). `bulk/template` + `broadcasts/bulk-template` use localStorage **draft** only (acceptable) but must call `handleBulkBroadcast` on submit — verify the submit path persists. |

**Depends on:** S1, S2, S5. **Parallelization note:** the four `bulk*` pages share `_components/bulk-actions-client` — **serialize bulk-family** under one agent; broadcasts/scheduler/cron/segments/ab-test are independent.

### Wave 5 — Templates & Messages (P0)
| Page | Pri | Effort | Work |
|---|---|---|---|
| `/wachat/templates` + `/templates/create` + `/templates/library` + `/message-templates-library` | P0 | S | Wired (`getTemplates`/`handleSyncTemplates`/`handleCreateTemplate`/library*). S2/S5. |
| `/wachat/template-builder` | P1 | M | Persists drafts in local state + has versions UI; wire save to `handleCreateTemplate`/`librarySave`; persist versions via library. |
| `/wachat/templates/interactive-message-builder` | **P0** | **L** | **BROKEN:** saved-templates in `localStorage`. Replace with **S4** (`librarySave`/`libraryList`/`libraryDelete`). Wire "Send test" to `whatsappSendApi.send` (interactive kind). |
| `/wachat/template-analytics` | P1 | — | Wired (`getTemplateAnalytics`). Done. |
| `/wachat/saved-replies`, `/quick-reply-categories`, `/message-tags` | P1 | S | `getSavedReplies`/`getQuickReplyCategories`/`getMessageTags` (+save/delete). `message-tags` currently mock-seeds — wire to `wachatFeatures`. |
| `/wachat/canned-messages` | — | — | Redirect-stub. No work. |

**Depends on:** **S4**, S1, S2, S5. **Parallelization note:** `interactive-message-builder` (S4) and `template-builder` both touch the template-library Rust slice — keep on **separate files** (they are) so parallel-safe; just land S4 first. Saved-replies/quick-reply/message-tags independent.

### Wave 6 — Automation (P1)
| Page | Pri | Effort | Work |
|---|---|---|---|
| `/wachat/auto-reply` + `/auto-reply-rules` | P1 | M | Wired (`AutoReplyForm`, `handleUpdateMasterSwitch`, `updateAutoReplyRuleOrder` Mongo reorder). Add states. |
| `/wachat/automation` (Conversational AI) | P1 | M | `getConversationalAutomation`/update/delete. |
| `/wachat/chatbot` | P1 | M | Already native-Mongo (`whatsapp_bots` via `marketing/whatsapp-chatbots.actions`). Wire CRUD UI + states. |
| `/wachat/greeting-messages`, `/away-messages`, `/business-hours` | P1 | S | `getGreetingMessage`/`getAwayMessage`/`getBusinessHours` (+save). |
| `/wachat/flow-builder` + `/[flowId]` + `/flows` + `/flows/create` | P1 | M | Wired (`wachatFlowsApi`, `meta-flow.actions`). **Note:** `/api/wachat/flows/endpoint/[phoneNumberId]` `handleFlowAction` is a deliberate placeholder — leave an integration seam (see Risks). |

**Depends on:** S1, S2, S5. **Parallelization note:** `auto-reply` + `auto-reply-rules` share `_components/auto-reply-form` — **serialize the pair**; rest independent.

### Wave 7 — Reports (P1)
All already wired to Rust analytics actions — this wave is **pure UX hardening (S2 + S6)**.
| Page | Pri | Effort |
|---|---|---|
| `/wachat/message-statistics`, `/delivery-reports`, `/response-time-tracker`, `/customer-satisfaction`, `/team-performance`, `/link-tracking`, `/chat-ratings` | P1 | S each |
| `/wachat/message-analytics` | — | Redirect-stub. No work. |

**Depends on:** S2, S6, S5. **Parallelization note:** fully independent; all consume read-only S6 (copy-safe). Dispatch 7 in parallel.

### Wave 8 — Growth Tools (P1/P2)
| Page | Pri | Effort | Work |
|---|---|---|---|
| `/wachat/catalog` (+`[catalogId]`, `/new`, product edit) | P1 | M | Confirm catalog read/send (`whatsappSendApi.sendCatalog`); product-edit persistence. |
| `/wachat/whatsapp-pay` + `/settings` | P1 | S | Wired (`wachatPay.*`). States only. |
| `/wachat/qr-codes` | P1 | S | `getQrCodes`/create/update/delete (wachatConfig). |
| `/wachat/whatsapp-link-generator` + `/integrations/whatsapp-link-generator` | P2 | S | `shortenUrlAction` + `saveGeneratedLink` (Mongo) exist; add list/states. |
| `/wachat/whatsapp-ads` (+`/roadmap`, `/setup`) | P1 | M | `ads.actions`/`updateEntityStatus` wired; `setup` is redirect, `roadmap` static. |
| `/wachat/post-generator` | P2 | S | Uses `@ai-sdk/react` `useChat` + `mockFacebookDataString` sample (legit demo seed). Confirm the chat route is real; keep sample as placeholder text. |
| `/wachat/ads` | P1 | S | Wired (`getAdAccounts`/`handleLinkAccount`). States. |

**Depends on:** S1, S2, S5. **Parallelization note:** catalog sub-routes share catalog client — **serialize catalog family**; rest independent.

### Wave 9 — Calling & Numbers (P1)
| Page | Pri | Effort | Work |
|---|---|---|---|
| `/wachat/numbers` | P1 | S | `wachatConfig.syncPhoneNumbers` + profile; states. |
| `/wachat/phone-number-settings` | P1 | M | `updatePhoneProfile`/`registerPhone`/verify; states. |
| `/wachat/two-line` | **P1** | **L** | **BROKEN:** `INITIAL_NUMBERS` mock + no persistence. Wire to **S3** (`listNumberRouting`/`saveNumberRouting`); source numbers from `activeProject.phoneNumbers`. |
| `/wachat/calls/logs` + `/calls/settings` | P1 | S | `wachatCallingApi.listLogs`/`getSettings`/`saveSettings`; `/calls` is redirect. |
| `/wachat/media-library` | P1 | S | Wired (R2 presign + `wachat_media_meta` Mongo). States only. |

**Depends on:** **S3**, S1, S2, S5. **Parallelization note:** `two-line`, `numbers`, `phone-number-settings` all read `activeProject.phoneNumbers` but write different stores — independent files, parallel-safe once S3 lands.

### Wave 10 — Engagement (P2)
| Page | Pri | Effort | Work |
|---|---|---|---|
| `/wachat/chat-export` | P2 | S | `exportChatHistory`. |
| `/wachat/chat-labels` | P2 | S | `getChatLabels`/save/delete/assign. |
| `/wachat/chat-ratings` | P2 | — | Wired (Wave 7). |
| `/wachat/chat-transfer` | P2 | M | `transferConversation`/`getTransferHistory`. |
| `/wachat/conversation-summary` | P2 | M | Read timeline; if AI summary, use AI seam (Risks). |
| `/wachat/opt-out` | P2 | S | `getOptOutList`/add/remove. |

**Depends on:** S1, S2, S5. **Parallelization note:** fully independent. Dispatch all in parallel.

### Wave 11 — Settings (P2)
| Page | Pri | Effort | Work |
|---|---|---|---|
| `/wachat/settings/general` | P2 | S | `wachatConfig.getPublicProject`/`saveWidgetSettings`. |
| `/wachat/settings/agents` | P1 | — | Wired (Mongo actions exist). States. |
| `/wachat/settings/attributes` | P2 | M | Needs an attributes store — wire via `wachatFeatures` conversation-tags/filters if no dedicated fn, else native Mongo `api_*` collection. |
| `/wachat/settings/canned` | P2 | S | Delegates to `CannedMessagesSettingsTab`; localStorage is UI-pref only. Verify the tab persists Rust-side. |
| `/wachat/webhooks` + `/webhook-logs` | P1 | S | `pingWebhookUrl` + `wachatWebhookActionsApi.listLogs`/reprocess; `webhook_logs` Mongo + replay exist. |
| `/wachat/integrations` (+`/razorpay`, `/whatsapp-widget-generator`) | P2 | S | Wired (`saveWidgetSettings`, link-gen Mongo); tabbed static + states. |

**Depends on:** S1, S2, S5. **Parallelization note:** `settings/attributes` is the only one needing a store decision; rest independent.

---

## 4. Per-Page Definition-of-Done Checklist (worksToday=false / needs-work only)

| Route | What to build | Backend | DoD |
|---|---|---|---|
| `/wachat/two-line` | Replace `INITIAL_NUMBERS` mock with real list+save | **S3** `two-line/actions.ts` → `projects.phoneNumberRouting`; numbers from `activeProject.phoneNumbers` | Reads live numbers; add/edit/delete persists to Mongo & survives reload; S1 guard; S2 states; S5 toast |
| `/wachat/templates/interactive-message-builder` | Replace localStorage savedTemplates; wire test-send | **S4** `librarySave`/`libraryList`/`libraryDelete`; `whatsappSendApi.send` (interactive) | Templates persist server-side; list reloads from Rust; test-send hits real number; states+toasts |
| `/wachat/template-builder` | Persist template + versions | `handleCreateTemplate` / `wachatTemplatesActions.librarySave` | Save creates a real template; version history reads from library; S2/S5 |
| `/wachat/message-tags` | Replace mock-seed with real tags | `wachatFeatures.getMessageTags`/save/delete | CRUD persists; empty state; toasts |
| `/wachat/health` | Replace mock-seed with live health | `getWabaHealthStatus`/`getPhoneNumberHealthStatus` | Live WABA + per-number status; S2 |
| `/wachat/contact-merge` | Merge mutation | Compose `wachatContacts.updateDetails` + `delete` (no single merge fn) | Selecting two contacts merges + removes dupe; confirm dialog; toast |
| `/wachat/conversation-filters` | Save/delete filters | `getConversationFilters`/save/delete | Saved filter persists & reapplies; states |
| `/wachat/assignments` | Assign mutation + optimistic | `getUnassignedConversations`/`assignConversation` | Assign updates list optimistically; rollback on error; toast |
| `/wachat/broadcast-scheduler` · `/scheduled-messages` | Schedule + cancel | `scheduleBroadcast`/`scheduleMessage` (+cancel) | Schedule persists, shows in list, cancel works; states |
| `/wachat/settings/attributes` | Custom-attribute store | `wachatFeatures` tags/filters OR native `api_wachat_attributes` | CRUD persists scoped by tenant; states |
| All other needs-work pages (Waves) | Add S1 guard + S2 states + S5 error toast | existing action (already wired) | Skeleton on load, `EmptyState` when empty, error+retry, toast on every mutation |

**Universal DoD (every page):** inside `<WachatPage>`; guarded by `<RequireProject>` (S1); loading/empty/error via `<DataState>` (S2); every mutation gives toast feedback (S5) + re-fetches; uses only `@/components/sabcrm/20ui` primitives; `phoneNumberId`/`projectId` passed explicitly to every action.

---

## 5. Risks & Out-of-Scope

**Needs live Meta Graph credentials (build the seam, can't fully verify in-repo):**
- **`/api/wachat/flows/endpoint/[phoneNumberId]` `handleFlowAction`** — deliberate echo/ack placeholder. Concrete flow business logic needs real RSA keys per project + a live Flow. *Degrade:* keep the HMAC-verify + decrypt scaffold; add a `// INTEGRATION SEAM: dispatch to project flow handler` comment and a config-driven dispatch table. Do not fake responses.
- **Ads / Facebook / Instagram pages** (`whatsapp-ads`, `ads`, `post-generator` publish target, `catalog` Meta sync) — depend on `wachatAds*`/`wachatFacebook*` Rust fns that call Graph API. *Degrade:* wire the Next action + UI; the Rust layer already handles the Graph call. Live onboarding goes through `handleFacebookOAuthCallback` (per memory, the onboarding bug is Rust-side, not Next).
- **WhatsApp test-sends** (`interactive-message-builder`, catalog, templates) — require a registered phone number with credit. *Degrade:* wire `whatsappSendApi.send`; surface the Rust error verbatim when no number/credit (S5).

**Needs Rust crate recompilation (out-of-scope for page-agents):**
- Any endpoint not in the rust-client inventory (e.g. a true single-call **contact merge**, or `settings/attributes` if no `wachatFeatures` slice fits). *Degrade:* compose existing calls (merge = update+delete) or persist via native Mongo `api_*` collection scoped by tenant — **never** read one store and write another (two-store gotcha).

**External services:**
- **SSE live feed** (`/api/wachat/stream`) returns **503 without `REDIS_URL`**. *Degrade:* chat/kanban must catch the 503 and show a non-blocking "Live updates paused" banner, falling back to manual refresh — not crash.
- **AI features** (`post-generator`, `conversation-summary`) use `@ai-sdk/react`. *Degrade:* keep the `useChat` transport; the bundled `mockFacebookDataString` is a legitimate sample placeholder, not broken data — leave it as prefill text.
- **R2 / media-library** presign — already wired; out-of-scope to change.

**Explicitly out-of-scope (no work):** the 4 redirect-stubs (`message-analytics`, `whatsapp-ads/setup`, `canned-messages`, `calls`), the 4 docs/roadmap static pages, and the 3 route-entry delegators (`chat`, `chat/kanban`, `catalog/new`) whose logic lives in `_components`. Mark these `worksToday=true`, no-op — unless a redirect target is verified broken.

**Convention guardrail for all agents:** persist through `rustClient` wherever a fn exists; only fall back to native Mongo (`connectToDatabase`, `api_*` collections, tenant-scoped) for genuinely new surfaces (S3 routing, attributes). Mixing stores is the #1 documented failure mode in this module.
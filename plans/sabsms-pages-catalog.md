# SabSMS — 55-Page × 50-Feature Catalog

> **Status:** Binding spec for the SabSMS UI. Every route under `/sabsms/*` must implement (1) the 30 **shared features** delivered by `src/components/sabsms/page-toolkit/*` and (2) the page-specific features listed in its section.
>
> **Companion docs:**
> - `plans/sabsms-world-class-plan.md` — 14-phase backend roadmap.
> - `services/sabsms-engine/` — Rust engine (Phase 1 live).
>
> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:subagent-driven-development` for parallel page builds. Each subagent owns ONE page and integrates against the shared toolkit. Coordinate via this file — never invent feature lists.

---

## A. Shared feature surface (30 features — delivered by `page-toolkit/`)

Every page composes these from the toolkit. Counting them toward the per-page total means each section only needs to list ~17–22 *page-unique* features to reach 50.

| # | Feature | Toolkit primitive |
|--:|---|---|
| S1  | Page title + description + eyebrow                | `SabsmsPageShell` (`ZoruPageHeader`) |
| S2  | Breadcrumb trail with parent chain                | `SabsmsPageShell` (`ZoruBreadcrumb`) |
| S3  | Primary action button (right-aligned)             | `SabsmsPageShell` |
| S4  | Secondary action overflow menu                    | `SabsmsPageShell` (`ZoruDropdownMenu`) |
| S5  | Help / "what is this page" popover                | `SabsmsHelpButton` (`ZoruPopover`) |
| S6  | Search input with debounce (300 ms) + URL sync    | `SabsmsFilterBar` |
| S7  | Faceted filter chips (multi-select)               | `SabsmsFilterBar` |
| S8  | Date range picker (preset + custom)               | `SabsmsFilterBar` (`ZoruDateRangePicker`) |
| S9  | Sort selector with direction toggle               | `SabsmsFilterBar` |
| S10 | Saved views (named filter combinations)           | `SabsmsSavedViews` |
| S11 | Column picker (show/hide + reorder)               | `SabsmsColumnPicker` |
| S12 | Density toggle (compact / comfortable / cosy)     | `SabsmsDensityToggle` |
| S13 | Sticky table header                               | `SabsmsDataTable` |
| S14 | Resizable columns                                 | `SabsmsDataTable` |
| S15 | Row hover quick actions (view / edit / delete)    | `SabsmsDataTable` |
| S16 | Bulk select with shift-click range                | `SabsmsDataTable` |
| S17 | Select-all-on-page + select-all-matching          | `SabsmsBulkActions` |
| S18 | Bulk action menu (assign / tag / delete / export) | `SabsmsBulkActions` |
| S19 | Pagination (page size 25/50/100/250)              | `SabsmsPagination` |
| S20 | Cursor-based fetch for large tables               | `SabsmsDataTable` |
| S21 | Empty state with primary CTA                      | `ZoruEmptyState` (toolkit wrapper) |
| S22 | Loading state (skeleton matching layout)          | `SabsmsSkeleton` |
| S23 | Error state with retry                            | `SabsmsErrorBoundary` |
| S24 | Refresh button + auto-refresh toggle              | `SabsmsRefreshButton` |
| S25 | Export to CSV / Excel / JSON                      | `SabsmsExportMenu` |
| S26 | Import via SabFiles (CSV)                         | `SabsmsImportButton` |
| S27 | Detail side-drawer for row preview                | `SabsmsDetailDrawer` (`ZoruSheet`) |
| S28 | URL-state sync (filters/sort/page in querystring) | `useSabsmsUrlState` |
| S29 | Keyboard shortcuts overlay (`?`)                  | `SabsmsKbdHint` |
| S30 | Audit trail link from any record                  | `SabsmsAuditTrail` |

---

## B. Page catalog (55 pages, grouped by sidebar section)

Each page lists its **20 unique features** below (combine with the 30 shared above → 50). Routes are absolute. Required Mongo collections noted where they read/write.

### B.1 Workspace (5 pages)

#### 1. `/sabsms` — Overview
1. Engine reachability probe + version
2. Workspace credit balance + burn-rate forecast
3. KPI grid (total / queued / sent / delivered / failed / inbound 24h)
4. Delivery-rate sparkline (last 30 d)
5. Cost-per-segment trend
6. Sender pool health summary
7. Active campaigns list (top 5)
8. Active drips list (top 5)
9. Recent failed messages with one-click retry
10. Provider scoreboard (DLR % per provider)
11. Top destinations by country
12. Top contacts by reply rate
13. Compliance status banner (10DLC / DLT / consent gaps)
14. Quick send dialog (no full composer)
15. "What's new" changelog popover
16. Welcome / onboarding checklist (collapsible)
17. Live event stream toggle (SSE)
18. Workflow shortcuts card (5-step Phase-1 happy path)
19. Roadmap card (which phases are live)
20. Pinned saved views shortcut

#### 2. `/sabsms/send` — Composer
1. Recipient picker (single phone / paste E.164 / contact pick from CRM)
2. Live segment counter + encoding indicator (GSM-7 / UCS-2)
3. Cost estimate before send
4. Category selector (transactional / OTP / marketing / alert / service)
5. Sender override dropdown (from sender pool)
6. Provider override (advanced)
7. Send time scheduler (now / scheduled / contact-TZ aware)
8. Variable picker `{{first_name}}` with autocomplete
9. Link shortener toggle (auto-wrap URLs)
10. UTM auto-append toggle
11. MMS media picker (SabFiles only)
12. Template clone-into composer
13. Test send (sandbox / specific recipient)
14. Draft auto-save
15. Compliance pre-check (suppression / quiet-hours / TCPA category)
16. Status polling (queued → sent → delivered) with progress bar
17. Live DLR webhook log panel
18. "Send another" quick-loop button
19. Idempotency key surface (advanced)
20. Recent sends list (last 10) for re-send

#### 3. `/sabsms/inbox` — 2-way conversations
1. 3-pane layout: filters / list / thread
2. Filter rail (all / mine / unassigned / closed / snoozed / labels)
3. Conversation list with unread badges + last message preview
4. Thread view with delivery ticks (queued / sent / delivered / read)
5. Inline reply composer with template insertion
6. Internal notes (not sent to contact)
7. Assign-to-agent / team
8. Auto round-robin assignment toggle
9. Snooze (wake on reply or after duration)
10. Close / reopen with status reason
11. Merge two conversations (same contact)
12. Labels / tags
13. SLA first-response timer + resolution timer with breach pulse
14. Canned responses
15. Reaction emojis on inbound
16. Add to segment from thread
17. Add to suppression (block sender) from thread
18. Search conversations by body / contact / id / date
19. Keyboard shortcuts (j/k navigate, e archive, r reply, n note)
20. Live updates via SSE / WebSocket fallback to polling

#### 4. `/sabsms/quick-send` — Bulk paste
1. Paste E.164 list (newline / comma / TSV)
2. Auto-normalise + dedupe + validate
3. Per-row preview with body interpolated
4. Live segment cost total
5. Throttle slider (msgs/sec)
6. Sender pool selector
7. Quiet-hours warning per timezone
8. Dry-run preview (no send)
9. Save as campaign instead of immediate send
10. Skip suppressed (auto)
11. Skip already-sent-today toggle
12. Variable map (paste with columns: phone, var1, var2…)
13. Test row send before bulk
14. Progress dashboard during send
15. Pause / resume / cancel
16. Failure CSV download
17. Re-attempt failures
18. Cost confirmation modal
19. Required category attestation (TCPA category)
20. Audit log entry on launch

#### 5. `/sabsms/logs` — Message logs
1. Status filter chips (queued / sent / delivered / failed / undelivered / rejected / suppressed)
2. Direction filter (outbound / inbound)
3. Provider filter
4. Category filter
5. Campaign id filter
6. Idempotency-key lookup
7. Provider-message-id lookup
8. Date range with timezone
9. Per-row status badge with color semantics
10. Per-row segment count + cost
11. Inline body preview with copy
12. Click-through to conversation thread
13. Click-through to campaign
14. Replay / re-send single message
15. Provider raw payload viewer (advanced)
16. DLR timeline (queued → sent → delivered with timestamps)
17. Cost-per-status aggregate footer
18. CSV / JSONL export of the current filter
19. Saved view for re-running the same filter
20. URL-state share for filter bookmark

---

### B.2 Outbound (10 pages)

#### 6. `/sabsms/campaigns` — Campaigns list
1. Status filter (draft / scheduled / running / paused / completed / cancelled / failed)
2. Created-by filter
3. Template filter
4. Audience size column
5. Send velocity column (msgs/sec)
6. Progress bar per running campaign
7. Estimated finish time
8. Quick pause / resume / cancel from row
9. Duplicate campaign action
10. Compare two campaigns (side-by-side)
11. Cost so far / cost forecast
12. CTR / reply rate / opt-out rate columns
13. Per-campaign Live Tail (SSE event stream)
14. Test send from row
15. Convert campaign → drip
16. Convert campaign → template
17. Archive
18. Tag/label
19. Roll-up totals card above table
20. Inline filter by date range with chart preview

#### 7. `/sabsms/campaigns/new` — Campaign wizard
1. Step 1: Pick template (search + preview)
2. Step 2: Pick audience (segment / contacts / CSV upload)
3. Step 3: Sender strategy (single / pool / sticky-per-recipient)
4. Step 4: Schedule (immediate / scheduled / recurring cron / drip)
5. Step 5: Throttle (msgs/sec slider + per-provider cap)
6. Step 6: Per-country quiet hours
7. Step 7: Per-recipient TZ-aware quiet hours toggle
8. Step 8: A/B split (N variants + winner metric + sample window)
9. Step 9: Frequency cap per contact
10. Step 10: Smart suppression toggle (engagement filter)
11. Step 11: Send-time optimization toggle
12. Step 12: Variable map preview
13. Step 13: Cost estimate (low / median / high) + currency conversion
14. Step 14: Compliance attestation
15. Step 15: Review screen with editable jumps
16. Save as draft / Launch / Schedule
17. Test send (specific recipient or sandbox)
18. Audit log entry on launch
19. Auto-resume from saved draft URL
20. Keyboard step navigation (Cmd-←/→)

#### 8. `/sabsms/campaigns/[id]` — Campaign detail / analytics
1. Live status bar (queued / sent / delivered / failed counts)
2. Timeline chart (per-minute send velocity)
3. Funnel: queued → sent → delivered → clicked → converted
4. Provider breakdown chart
5. Segment-by-country chart
6. Click heatmap (if links)
7. Reply timeline
8. Opt-out timeline
9. Sender rotation pie
10. Cost / margin reporting
11. A/B variant comparison
12. Per-recipient drill-down with status
13. Re-send failures CSV
14. Pause / resume / cancel
15. Edit schedule (if not yet running)
16. Clone campaign
17. Convert to drip
18. Export raw events JSONL
19. Webhook fire log
20. Public share link (read-only dashboard)

#### 9. `/sabsms/templates` — Templates list
1. Status filter (draft / submitted / approved / rejected)
2. Category filter (transactional / OTP / marketing / alert / service)
3. Language filter
4. Search by body content
5. Sort by usage count
6. Inline preview hover
7. Approval status badges
8. DLT-registered chip (India)
9. 10DLC-registered chip (US)
10. Duplicate template
11. Submit for approval (bulk)
12. Withdraw approval submission
13. Mark template as deprecated
14. Variable inventory column
15. Per-template usage analytics link
16. Tag / label
17. Import from JSON / WhatsApp template
18. Export as JSON bundle
19. Suggestion: "convert to drip"
20. Audit history per template

#### 10. `/sabsms/templates/[id]` — Template editor
1. Body textarea with `{{var}}` autocomplete
2. Live char counter + segment / encoding split
3. Cost-per-segment preview
4. Locale tabs (en, hi, es, ar, …)
5. Variable defaults editor
6. Conditional blocks (`{% if x %}…{% endif %}`)
7. Date filter helpers (Luxon expressions)
8. Test interpolation against a sample contact
9. DLT registration form (India: PEID, template id, header id)
10. 10DLC registration form (US: brand id, campaign id, use case)
11. AI: "Rewrite shorter" / "Make friendlier" / "Add CTA"
12. AI: Translate to language
13. Spam likelihood score
14. PII scrub preview before AI call
15. Approval submit flow with reviewer notes
16. Reviewer notes inbox (admin)
17. Save draft + publish
18. Diff vs previous version
19. Auto-link-wrap toggle
20. Footer policy injection toggle ("Reply STOP…")

#### 11. `/sabsms/templates/approvals` — Approval queue (admin)
1. Pending queue with reviewer assignment
2. Approve / reject with required notes
3. Reviewer SLA timer
4. Bulk approve same-category
5. Rule-based auto-approve toggle
6. Flag for compliance review
7. Side-by-side diff vs previous approved version
8. Variable inventory check
9. Sample compliance score
10. AI-suggested verdict (advisory)
11. Audit trail per decision
12. Filter by category / submitter / age
13. Workspace filter (cross-workspace admin)
14. Export decision log
15. Reviewer rotation config
16. Reject reasons taxonomy editor
17. Re-submit after rejection workflow
18. Approver permission audit
19. Bulk export approved bundle (JSON)
20. Stats: avg time-to-approval per category

#### 12. `/sabsms/drips` — Drip sequences list
1. Status filter (enabled / disabled)
2. Entry-trigger filter (manual / segment-join / event)
3. Active-recipient count column
4. Throughput per drip
5. Conversion rate per drip
6. Pause / resume from row
7. Duplicate drip
8. Branching count column
9. Visual mini preview (steps as dots)
10. Stage drop-off chart per drip
11. Export drip definition JSON
12. Import drip JSON
13. Filter by template usage
14. Show drips with errors
15. Auto-pause-on-error toggle
16. Edit schedule from row
17. Cohort attribution column
18. Test enrol contact
19. Bulk enrol from segment
20. Mass exit (remove all contacts)

#### 13. `/sabsms/drips/[id]` — Drip builder
1. Visual canvas (nodes + edges) — `ZoruUI` palette
2. Add step (template + wait + branch)
3. Conditional branch on replied / clicked / opened
4. Exit conditions (replied / clicked / converted / unsubscribed)
5. Quiet-hours per step
6. Time-of-day windows
7. Skip-on-weekend toggle
8. Wait by relative (`X hours`) or absolute (`next Tuesday 10am`)
9. Per-step throttle
10. Per-step provider override
11. Per-step A/B split
12. AI: "Suggest next step"
13. Validate (no orphan nodes, no infinite loops)
14. Dry-run with sample contact
15. Live enrol counter
16. Pause / resume drip
17. Version history with rollback
18. Export drip JSON
19. Clone steps from another drip
20. Step-level analytics drill-down

#### 14. `/sabsms/ab-tests` — A/B tests
1. List active tests
2. Variant table (body / sender / send-time)
3. Statistical significance indicator
4. Confidence interval column
5. Auto-promote winner toggle
6. Min-sample threshold
7. Conversion metric picker
8. Stop test early
9. Force-pick winner
10. Per-variant CTR / reply / conversion
11. Funnel comparison
12. Cost comparison
13. Export raw event log
14. Clone test
15. Schedule next test
16. Test history archive
17. Significance simulation graph
18. Per-segment lift analysis
19. Bayesian vs frequentist mode toggle
20. Audit trail

#### 15. `/sabsms/scheduled` — Scheduled sends
1. Calendar view (month / week / day)
2. List view fallback
3. Group by sender / template / campaign
4. Drag to reschedule
5. Cancel scheduled send
6. Quiet-hours conflict warnings
7. Per-recipient TZ visualization
8. Bulk reschedule by drag-window
9. Conflict detection across campaigns
10. Slot capacity per sender per hour
11. Cron preview ("every Monday at 9am")
12. Recurring schedule editor
13. Holiday calendar overlay
14. Export schedule iCal
15. Subscribe iCal URL (read-only)
16. Notification rules ("alert me 1h before")
17. Per-country quiet-hour heatmap
18. Drag from "unscheduled" tray
19. Optimistic UI for drag-reschedule
20. Audit log entry per change

---

### B.3 Audience (8 pages)

#### 16. `/sabsms/contacts` — Contacts list
1. Source filter (CRM / import / API / inbound)
2. Country filter (E.164 prefix)
3. Engagement score column
4. Last-message-at column
5. Consent state badge (single / double / none / opt-out)
6. Carrier lookup (HLR) on row
7. VoIP / disposable flag
8. Tag editor
9. Inline edit phone format
10. Merge duplicates
11. Bulk add to segment
12. Bulk add to suppression
13. Send single SMS from row
14. Open conversation thread
15. Send opt-in confirmation request
16. Bulk import via SabFiles CSV
17. Per-contact send-time-of-day learned best hour
18. Bulk delete (with consent-log retention)
19. Audit who edited what when
20. Export filtered list

#### 17. `/sabsms/contacts/[id]` — Contact detail
1. Conversation thread (full history)
2. Consent log timeline
3. Carrier details (operator, country, line type)
4. Engagement metrics (sent / delivered / replied / clicked)
5. Drip enrolments
6. Campaign memberships
7. Send a message panel
8. Add note (internal)
9. Add to suppression with reason
10. Remove from suppression (admin)
11. Custom fields editor
12. Time-zone override
13. Locale override
14. Linked CRM lead / deal
15. Linked SabWa / Wachat contact
16. Risk score (spam / abuse)
17. GDPR data export (subject access)
18. GDPR data deletion request
19. Audit log
20. Tags + labels

#### 18. `/sabsms/segments` — Segments list
1. Static vs dynamic indicator
2. Size column (live count)
3. Last-refresh timestamp
4. Refresh now button
5. Auto-refresh interval picker
6. Used-in-campaigns column
7. Used-in-drips column
8. Duplicate segment
9. Export contact list
10. Convert to suppression list
11. Tag / label
12. Activity feed (members added/removed)
13. Bulk archive
14. Search by predicate text
15. Cross-app segment (reused from CRM)
16. Compare two segments (overlap %)
17. Membership history chart
18. Quick send to segment
19. Run cost estimate for segment
20. Audit log

#### 19. `/sabsms/segments/new` — Segment builder
1. Predicate canvas (and/or groups)
2. Field picker with CRM + SabSMS-specific predicates
3. Live count preview (debounced)
4. Sample matching contacts
5. Save as static snapshot
6. Save as dynamic (re-evaluated)
7. Schedule re-evaluation cron
8. Import predicates from another segment
9. Convert to drip entry trigger
10. Test predicate against a phone
11. SQL-style preview (read-only)
12. AI: "Build segment from prompt"
13. Validation (must include consent predicate for marketing)
14. Cost-forecast for sending to segment
15. Export predicate JSON
16. Share segment definition
17. Diff vs prior version
18. Tag / label
19. Audit who created
20. Required category attestation

#### 20. `/sabsms/suppressions` — Suppressions
1. Source filter (stop / complaint / bounce / manual / carrier_block / import)
2. Phone search (exact or hash)
3. Bulk import (CSV)
4. Bulk export
5. Reason column with edit
6. Created-at + last-touched columns
7. Per-row unsuppress (admin only, audit-trailed)
8. Bulk unsuppress (with required reason)
9. Suppression coverage report (% of contacts)
10. Per-campaign suppression match preview
11. Audit log
12. Webhook on suppression added (config)
13. Auto-suppress rules editor (e.g. >3 failures)
14. Cross-workspace shared suppression list (admin)
15. Required reason taxonomy
16. Cost of suppressed sends avoided (24h)
17. Tag / label
18. Suppression hash export (privacy-safe)
19. Compliance-trail PDF export
20. URL-state share

#### 21. `/sabsms/consent` — Consent log
1. Phone hash search
2. Kind filter (opt-in single / double / opt-out variants)
3. Capture-method filter (web form / API / import / verbal / inbound keyword)
4. Source URL search
5. IP / user-agent forensic columns
6. Timeline view per phone
7. Bulk export (audit-ready, signed)
8. Verify double-opt-in for a phone
9. Re-request consent (send confirmation)
10. Reason taxonomy editor
11. Per-jurisdiction compliance status (TCPA / GDPR / CASL / TRAI)
12. Subject access request handler
13. Erasure request handler (hash-preserving)
14. Webhook on consent change
15. Filter by date range
16. Cohort retention (consent stickiness)
17. Bulk import retroactive consents (CSV with audit metadata)
18. Audit-trail PDF export
19. Tag / label
20. URL-state share

#### 22. `/sabsms/imports` — Imports
1. Drag-and-drop CSV via SabFiles
2. Column mapping wizard
3. Preview first 50 rows
4. Phone normalisation preview
5. Duplicate detection
6. Skip suppressed toggle
7. Required consent attestation for marketing lists
8. Background import job with progress
9. Pause / resume / cancel import
10. Per-row error CSV download
11. Retry failed rows
12. Audit trail per import
13. Saved column-mapping templates
14. Import history list
15. Rollback an import (delete its rows)
16. Schedule recurring import
17. Webhook on import complete
18. Cost estimate (carrier lookup if HLR enabled)
19. Bulk tag on import
20. Bulk segment-assign on import

#### 23. `/sabsms/lists` — Lists (static)
1. Create list (manual)
2. Add contacts to list (search / paste)
3. Remove contacts
4. Import to list (CSV)
5. Export list
6. Send to list (open composer with list pre-filled)
7. Convert list → segment
8. Convert list → suppression
9. Duplicate list
10. Tag / label
11. Membership history
12. Cost estimate
13. Cross-link to campaigns using list
14. Auto-expire list (date-based)
15. Read-only share link
16. Audit log
17. Compare two lists overlap
18. Bulk delete (admin)
19. Search lists
20. List-of-lists analytics (sizes, freshness)

---

### B.4 Infrastructure (8 pages)

#### 24. `/sabsms/numbers` — Numbers list
1. Country filter
2. Type filter (longcode / shortcode / tollfree / alphanumeric)
3. Provider filter
4. Capability filter (SMS / MMS / RCS / voice)
5. Health badge (deliverability / complaint rate)
6. Monthly cost column
7. Last-used-at column
8. Send-volume column (24h)
9. Provision new number (modal)
10. Release number
11. Reassign to workspace (admin)
12. Set as default sender
13. Set as fallback sender
14. Per-number quiet-hours override
15. Per-number throttle override
16. Per-number campaign assignment
17. Bulk port (admin)
18. Number rental history
19. Audit log
20. CSV export

#### 25. `/sabsms/numbers/new` — Provision number
1. Provider picker
2. Country picker
3. Type picker
4. Capability requirements (SMS / MMS / RCS / voice)
5. Area-code / pattern search (where supported)
6. Available numbers preview
7. Price preview per number
8. Bulk provision (multiple at once)
9. Pre-provisioning compliance check (10DLC / DLT)
10. Assign to campaign
11. Assign to sender pool
12. Test-call after provision (voice-capable)
13. Webhook URLs auto-config preview
14. Default footer policy
15. Default sender id (alpha)
16. Webhook URL override
17. Save as draft (for admin approval)
18. Cost-cap warning
19. Required attestation (use case)
20. Audit log entry

#### 26. `/sabsms/numbers/[id]` — Number detail
1. Live health chart (DLR / complaint rate)
2. Volume time series
3. Cost time series
4. Capability detail (carrier lookup)
5. Send-history table
6. Inbound-history table
7. Per-country deliverability map
8. Per-template performance
9. Per-campaign assignment
10. Per-pool assignment
11. Throttle config
12. Quiet hours config
13. Webhook URLs (inbound / DLR / voice) editor
14. Sender-id alpha override (where supported)
15. Compliance status (10DLC / DLT registered)
16. Reassign to sender pool
17. Release with grace-period
18. Port-out request workflow
19. Audit log
20. Test send from this number

#### 27. `/sabsms/providers` — Providers list
1. Provider catalog (all 13 supported)
2. Provider-account list (workspace creds)
3. Status badge per account
4. Test connection
5. Add account (provider-specific dialog)
6. Edit credentials (encrypted)
7. Set default account
8. Disable account
9. Last-error column
10. Last-successful-send timestamp
11. Send-volume column (24h)
12. Pricing tier indicator
13. Region selector
14. Failover priority drag-reorder
15. Per-country routing override
16. Cost-vs-margin chart per provider
17. Health monitor link
18. Provider docs link
19. Webhook URL display + copy
20. Audit log

#### 28. `/sabsms/providers/[id]` — Provider config
1. Provider-specific credential form (Twilio / Vonage / etc.)
2. Test send to a known number
3. Test inbound webhook (echo)
4. Test DLR webhook (echo)
5. Webhook signature secret rotation
6. Per-country pricing table (read from provider API where available)
7. Rate limit configuration
8. Sender-id whitelist
9. Number purchase delegation
10. Lookup API enable toggle (HLR cost warning)
11. Default sender for provider
12. Per-channel toggles (SMS / MMS / RCS)
13. Send-rate cap
14. Concurrent-job cap
15. Provider-specific timeouts
16. Provider-specific retry policy
17. Region pinning
18. SDK version display (engine side)
19. Connection log (last 100 calls)
20. Audit log

#### 29. `/sabsms/pool` — Sender pool config
1. Pool definition (which numbers)
2. Rotation strategy (round-robin / least-loaded / hash-by-recipient)
3. Sticky-per-recipient toggle
4. Per-pool throttle
5. Per-pool quiet-hours
6. Per-pool campaign assignment
7. Health-based degrade rules
8. Pool size live preview
9. Pool capacity simulation
10. Add/remove numbers
11. Pool clone
12. Pool archive
13. Audit log
14. Per-pool deliverability chart
15. Per-pool cost chart
16. Per-pool complaint-rate chart
17. Pool A/B test (compare two pools)
18. AI: "Suggest pool composition"
19. Pool-membership change history
20. Drag-and-drop allocation

#### 30. `/sabsms/routing` — Routing rules
1. Rule editor (if destination = X and category = Y, route to provider Z)
2. Visual rule chain
3. Conflict detection
4. Priority drag-reorder
5. Per-rule cost preview
6. Per-rule deliverability simulation
7. Default fallback editor
8. Per-country failover order
9. Per-category routing
10. Per-time-of-day routing
11. Test routing against sample
12. Rule history with diff
13. Activate / deactivate rule
14. Tag / label
15. AI: "Optimize routing for cost / deliverability"
16. Compare two routing configs
17. Per-rule analytics
18. Export rule set JSON
19. Import rule set
20. Audit log

#### 31. `/sabsms/health` — Health monitor
1. Per-provider rolling DLR rate (last 1h / 24h / 7d)
2. Per-provider error code histogram
3. Per-number health scoreboard
4. Carrier-level deliverability table
5. Alert rules editor (DLR % below X → page)
6. Live throughput chart
7. Queue depth chart (BullMQ-equivalent)
8. Worker concurrency chart
9. Webhook delivery success rate
10. Engine uptime SLA
11. Pause-all-sends kill switch
12. Auto-degrade trigger log
13. Re-route history
14. Outage timeline (incident-style)
15. Per-region health (if multi-region engine)
16. Sample failed sends with error codes
17. Compliance-violation alerts (e.g. carrier blocks)
18. Notification channel config (email / Slack / SabFlow)
19. Health webhook publisher
20. Audit log

---

### B.5 Compliance (6 pages)

#### 32. `/sabsms/compliance` — Compliance dashboard
1. 10DLC brand + campaign status
2. DLT principal-entity + headers + content templates status
3. EU consent coverage %
4. CASL consent coverage %
5. TRAI quiet-hours adherence %
6. TCPA category-mismatch counts
7. STOP / HELP keyword config preview
8. Footer policy preview
9. Suppression coverage %
10. Consent freshness distribution
11. SAR / erasure backlog
12. Recent unsubscribes timeline
13. Per-country quiet-hour map
14. Auto-reply STOP confirmation toggle
15. Required attestation matrix
16. Recent rejected templates with reasons
17. Compliance officer assignment
18. Audit export (signed PDF + CSV)
19. Compliance webhook publisher
20. Roadmap link to plan §Phase 8

#### 33. `/sabsms/compliance/10dlc` — 10DLC registration (US)
1. Brand registration form (legal name, EIN, vertical)
2. Brand status polling
3. Brand score display
4. Brand vetting upgrade
5. Campaign registration form (use case, message samples)
6. Campaign status polling
7. Campaign sharing with reseller
8. Number ↔ campaign assignment matrix
9. Capability matrix (SMS / MMS)
10. Throughput limits per campaign
11. Sample-message editor (4 required)
12. CTAs and opt-out language preview
13. Reseller relationship config
14. Submission audit trail
15. Renewal reminders
16. Cost preview (one-time + monthly)
17. Reject reason inbox
18. Re-submission workflow
19. Bulk register multiple campaigns
20. Audit log

#### 34. `/sabsms/compliance/dlt` — DLT registration (India)
1. Principal entity registration (PEID)
2. Telemarketer entity (TMID) registration
3. Header (sender id) registration
4. Content template registration with category
5. Variable preview per template
6. DLT status polling
7. Rejection reason inbox
8. Re-submission workflow
9. TRAI quiet-hour adherence config
10. Per-operator support matrix
11. Consent capture aligned with TRAI
12. DLT-template ↔ SabSMS-template mapping
13. Bulk register
14. Bulk re-submit
15. Sample-message editor
16. Audit submission log
17. Cost preview
18. Webhook on status change
19. Renewal reminders
20. Operator-level deliverability per header

#### 35. `/sabsms/compliance/gdpr` — GDPR / privacy
1. Subject Access Request (SAR) inbox
2. SAR fulfillment workflow
3. Erasure request inbox
4. Hash-preserving erasure executor
5. Consent ledger export
6. DPIA template & status
7. Data Processing Addendum download (DPA)
8. Sub-processor list
9. Data retention policy editor
10. Cross-border transfer config (SCCs)
11. Cookie / SDK pixel disclosure
12. AI processing disclosure (PII redaction toggle)
13. Audit trail per request
14. SLA timers per request (30-day TCPA, 30-day GDPR)
15. Bulk SAR processing
16. Required reason taxonomy
17. Webhook on request received
18. Privacy-officer assignment
19. Compliance-trail PDF export per phone
20. Roadmap link to plan §Phase 8

#### 36. `/sabsms/compliance/keywords` — STOP / HELP
1. Keyword list editor (multi-language)
2. Per-keyword response template
3. Per-keyword action (suppression / unsuppression / send help)
4. Locale-aware mapping
5. Test keyword against inbound message
6. Audit per-keyword fires
7. Custom keywords beyond STOP / HELP
8. Auto-reply rate limit
9. Confirmation template editor
10. Per-channel toggle (SMS / MMS / RCS)
11. Carrier-blocked keyword warnings
12. UNSTOP / START handling rules
13. Required vs optional keyword config
14. Localised SMS-spec keywords (CTIA / TRAI)
15. Match precedence editor
16. Bulk import keyword set
17. Bulk export keyword set
18. AI: "Suggest keywords from inbound corpus"
19. Audit log
20. Roadmap link

#### 37. `/sabsms/compliance/audit` — Audit log
1. Action filter (template-approved / suppression-added / consent-changed / send-blocked / …)
2. Actor filter (user / system / admin / API key)
3. Subject filter (phone / template / campaign / drip / number)
4. Time range
5. Workspace filter (admin)
6. Severity filter
7. Inline diff for change events
8. Export (signed CSV + PDF)
9. Webhook publisher
10. Retention policy editor
11. Search free-text
12. Per-record drill-down
13. Saved view
14. URL-state share
15. Auto-archive policy
16. Tamper-evident hash chain display
17. Verify integrity action
18. AI: "Summarise this hour"
19. Per-record raw payload viewer
20. Per-record replay (rerun action if reversible)

---

### B.6 Insights (6 pages)

#### 38. `/sabsms/analytics` — Analytics dashboard
1. Date range (preset + custom + compare-to)
2. Group-by (provider / country / sender / campaign / template)
3. Sent / delivered / failed / replied / clicked / opt-out KPI tiles
4. Funnel chart with drop-off %
5. Cohort retention heatmap
6. Provider scorecard
7. Number health scorecard
8. CTR table
9. Top countries
10. Top contacts by engagement
11. Cost vs revenue chart
12. Margin chart
13. Conversions table (server pixel + on-site JS)
14. Reply-rate by template
15. AI: "Why is this metric down?"
16. Drill-down to filtered logs
17. Exportable chart PDFs
18. Scheduled email report (uses SabFlow)
19. Public share link (read-only)
20. Custom dashboard layout (drag tiles)

#### 39. `/sabsms/analytics/deliverability` — Deliverability
1. Per-provider DLR % over time
2. Per-country DLR %
3. Per-number DLR %
4. Per-template DLR %
5. Failure-code breakdown
6. Carrier breakdown (where lookup enabled)
7. Latency p50/p95/p99
8. DLR-delay distribution
9. Top failing destinations
10. Top failing senders
11. Suspected-throttle alerts
12. Suspected-spam-block alerts
13. Network-degrade alerts
14. Recommended re-route preview
15. Apply re-route as routing rule (one click)
16. Compare two date ranges
17. Drill-down to raw events
18. Export CSV / JSONL
19. Save view
20. Webhook publisher

#### 40. `/sabsms/analytics/cohorts` — Cohort retention
1. Cohort definition (first-message date / first-reply / first-click)
2. Retention metric picker (sends / replies / clicks / conversions)
3. Heatmap with selectable cells
4. Compare cohorts
5. Filter cohorts by source
6. Filter cohorts by campaign
7. AI: "Explain this cohort"
8. Save cohort as segment
9. Save cohort as drip entry trigger
10. Drill-down to contacts
11. Export PNG / PDF
12. Export CSV (raw)
13. Schedule periodic export
14. Saved view
15. Public share link
16. Multi-metric overlay
17. Per-locale cohort splits
18. Per-provider cohort splits
19. Per-template cohort splits
20. URL-state share

#### 41. `/sabsms/analytics/funnel` — Funnel reports
1. Funnel steps editor
2. Drag to reorder
3. Per-step drop-off %
4. Per-step time-to-progress
5. Audience filter
6. Date range
7. Compare two funnels
8. Per-segment funnel
9. AI: "Suggest funnel optimisations"
10. Save funnel
11. Funnel A/B test
12. Per-funnel cohort drill
13. Export PNG / CSV
14. Public share link
15. Schedule email
16. Per-variant funnel
17. Conversions value column
18. Per-channel comparison (SMS vs MMS vs RCS)
19. Lift estimate vs control
20. Saved view

#### 42. `/sabsms/analytics/cost` — Cost / margin
1. Spend per day chart
2. Spend per provider
3. Spend per country
4. Spend per campaign
5. Spend per template
6. Revenue ingest (manual entry or webhook from payments)
7. Margin chart
8. Forecast spend by month
9. Burn-rate alert config
10. Per-workspace cost cap (admin)
11. Per-campaign cost cap
12. Per-number cost cap
13. Auto-pause when cap reached
14. AI: "Recommend lower-cost routes"
15. Reseller markup editor
16. Per-segment cost-per-conversion
17. Export CSV / Excel
18. Schedule email
19. Public share link
20. Saved view

#### 43. `/sabsms/analytics/numbers` — Number scorecards
1. Per-number deliverability score
2. Per-number complaint rate
3. Per-number cost per delivered
4. Per-number reply rate
5. Per-number block rate
6. Per-number ban risk
7. AI: "Should I rotate this number out?"
8. Bulk pause underperforming
9. Bulk archive
10. Heatmap of underperformers
11. Compare two periods
12. Drill-down to raw events
13. Per-carrier breakdown
14. Saved view
15. Export CSV
16. Schedule periodic email
17. Auto-rotate config (rules)
18. New-number warm-up tracker
19. Capacity utilisation chart
20. Public share link

---

### B.7 Developer (8 pages)

#### 44. `/sabsms/api-keys` — API keys
1. Create new key (name + scopes)
2. Scope picker (read-only / send-only / full / admin)
3. IP allow-list per key
4. Last-used-at column
5. Last-used-by-IP
6. Per-key rate-limit override
7. Revoke key
8. Rotate key
9. Per-key audit trail
10. Per-key usage chart
11. Per-key error chart
12. Per-key idempotency-store size
13. CLI snippet generator
14. Postman collection export
15. Per-key permission diff vs role
16. Restrict to webhook subscription only
17. Key expiry date
18. Bulk rotate
19. Audit log
20. Owner reassignment

#### 45. `/sabsms/webhooks` — Outbound webhooks
1. Add endpoint (URL + secret)
2. Event filter chooser
3. HMAC algorithm selector (SHA-256 default)
4. Test fire to endpoint
5. Per-endpoint retry config
6. Per-endpoint DLQ settings
7. Disable endpoint
8. Last-delivery-status column
9. Per-endpoint chart (success / fail)
10. Replay last N events
11. Sample payload preview
12. JSON schema viewer per event type
13. Per-endpoint allowlist of source events
14. Per-endpoint headers config
15. mTLS client cert upload (advanced)
16. Per-endpoint signing-secret rotation
17. Audit log
18. Export endpoint config JSON
19. Import endpoint config
20. Per-endpoint URL alias for staging vs prod

#### 46. `/sabsms/webhooks/log` — Delivery log
1. Endpoint filter
2. Event filter
3. Status filter (delivered / failed / DLQ)
4. HTTP status code histogram
5. Latency histogram
6. Per-delivery attempt timeline
7. Replay single delivery
8. Bulk replay failed
9. Payload diff vs original
10. Response body viewer
11. Headers viewer
12. Curl snippet for repro
13. Webhook signature verifier
14. Export delivery batch JSONL
15. Saved view
16. URL-state share
17. Filter by source message id
18. Filter by source conversation
19. Filter by source campaign
20. Audit per-replay

#### 47. `/sabsms/api-docs` — API docs / playground
1. OpenAPI 3.1 viewer
2. Try-it-out (in-browser fetch)
3. Auth header auto-fill from selected API key
4. Per-endpoint request examples (curl / fetch / SDKs)
5. Response schema viewer
6. Search endpoints
7. Per-endpoint changelog
8. Per-endpoint deprecation notice
9. Webhook event schemas
10. Idempotency examples
11. Rate-limit examples
12. Error catalogue
13. SDK tab (TypeScript / Python / Go)
14. AI: "Generate code for my use case"
15. Sandbox toggle (sandbox vs prod)
16. Per-endpoint usage analytics
17. Postman / Insomnia download
18. OpenAPI JSON download
19. Versioned switcher (v1 / v2)
20. Public share link (read-only)

#### 48. `/sabsms/sabflow-blocks` — SabFlow block reference
1. List of SabSMS blocks (triggers + actions)
2. Per-block schema viewer
3. Per-block example workflow
4. Per-block changelog
5. Embed-anywhere copy snippet
6. "Add to SabFlow" button (deep-link)
7. Per-block usage analytics
8. Per-block beta / GA badge
9. Per-block credit cost notes
10. AI: "Pick blocks for my use case"
11. Search blocks
12. Per-block category
13. Per-block icon picker (custom)
14. Suggested flows (templates)
15. Per-flow installation guide
16. Per-flow test data generator
17. Per-flow audit
18. Per-block deprecation notice
19. Compatibility matrix (Wachat / SabWa / CRM)
20. Per-block dependency graph

#### 49. `/sabsms/sdk-reference` — SDK reference
1. Tab per language (TypeScript / Python / Go / Ruby)
2. Install snippet
3. Auth snippet
4. Send-message snippet
5. List-messages snippet
6. Conversation reply snippet
7. Webhook signature verify snippet
8. Idempotency snippet
9. Streaming snippet
10. Retry / backoff snippet
11. Bulk send snippet
12. Per-language changelog
13. Per-language version selector
14. Per-language type definitions viewer
15. Per-language sample app link
16. Issue-tracker link
17. Discord / community link
18. AI: "Convert this snippet to language X"
19. Copy-all-as-curl
20. Code Bin export (private gist via SabFiles)

#### 50. `/sabsms/rate-limits` — Rate limits monitor
1. Global limit display
2. Per-workspace limit
3. Per-API-key limit
4. Per-provider TPS limit
5. Per-number TPS limit
6. Current consumption chart
7. Throttled-request log
8. 429 response rate chart
9. Provider-side throttle log
10. Auto-adjust suggestion
11. Burst credit display
12. Per-route limits table
13. Cool-down timer per offender
14. Notification on limit breach
15. Webhook publisher
16. Per-key rate-limit override editor
17. Per-IP rate-limit override
18. Bulk reset
19. Audit log
20. Saved view

#### 51. `/sabsms/idempotency` — Idempotency monitor
1. List active idempotency keys
2. Per-key first-seen / last-seen
3. Per-key request hash
4. Per-key response cached
5. Per-key TTL (default 24h)
6. Bulk invalidate
7. Stats: hit / miss ratio
8. Per-API-key idempotency usage
9. Per-endpoint idempotency usage
10. Filter by route
11. Filter by API key
12. Replay-protection failure log
13. Storage-utilisation chart
14. AI: "Find risky idempotency patterns"
15. Per-key audit
16. Export CSV
17. Saved view
18. Sample payload viewer
19. Cache-warm endpoint test
20. URL-state share

---

### B.8 Settings (4 pages)

#### 52. `/sabsms/settings` — Workspace settings
1. Display name + logo
2. Default sender id
3. Default category
4. Footer policy template
5. Auto-link-wrap default
6. UTM auto-append default
7. Quiet-hours defaults
8. Send-time-optimization default
9. Frequency-cap defaults
10. Compliance officer assignment
11. Locale + timezone default
12. AI feature toggle
13. PII-redaction-in-AI toggle
14. Per-feature notifications toggle
15. SSE live-event toggle
16. Webhook secret rotation
17. Engine kill-switch (admin)
18. Restore defaults button
19. Audit-trail link
20. Roadmap link

#### 53. `/sabsms/settings/team` — Team / RBAC
1. Member list with roles
2. Invite member
3. Bulk-invite via CSV
4. Role assignment (sabsms_admin / agent / marketer / developer)
5. Custom role creator (per-permission)
6. Per-member rate-limit override
7. Per-member daily-send-cap
8. Pending invitations list
9. Resend invitation
10. Revoke invitation
11. Last-seen-at column
12. Last-action-at column
13. Force-logout-everywhere
14. Per-member API-key usage drill-down
15. Audit member changes
16. 2FA-required toggle
17. SSO connection (uses existing SabNode SSO)
18. Per-member alert subscriptions
19. Out-of-office handoff config
20. Bulk re-assign role

#### 54. `/sabsms/settings/billing` — Billing / credits
1. Credit balance (per type: sms domestic / international / mms / rcs / lookups)
2. Burn-rate forecast
3. Spend cap config
4. Auto-top-up rules
5. Top-up modal
6. Plan upgrade / downgrade
7. Invoice list
8. Invoice PDF download
9. Payment method management (uses existing SabNode billing)
10. Refund request workflow
11. Per-line-item breakdown
12. Per-feature gating display (mms enabled? rcs enabled?)
13. Per-route cost preview
14. Margin reporting (admin)
15. Currency selector
16. Tax / GST / VAT settings
17. Compliance attestation per region
18. Tax-form upload (W-8/W-9)
19. Audit billing changes
20. Export usage as CSV

#### 55. `/sabsms/settings/notifications` — Notifications
1. Channel list (in-app / email / Slack / SabFlow / webhook)
2. Per-event subscription editor
3. Per-event channel mapping
4. Quiet-hours for notifications
5. Digest mode (immediate / hourly / daily)
6. Per-channel test send
7. Mute all temporary
8. Critical-only mode
9. Mobile push subscription (where available)
10. Per-recipient overrides (team members)
11. Threshold-based notifications (e.g. failure spike)
12. AI-generated daily summary opt-in
13. Per-event template editor
14. Per-event allow-list / block-list
15. Per-channel signing secret
16. Audit notification changes
17. Bulk unsubscribe
18. Restore defaults
19. Export config JSON
20. Import config JSON

---

## C. Implementation order (this session + follow-ups)

### This session (target: catalog + toolkit + 8-12 pages)

**Toolkit (Phase 1):**
- [ ] `src/components/sabsms/page-toolkit/index.ts` — barrel
- [ ] `useSabsmsUrlState.ts` — querystring sync
- [ ] `SabsmsPageShell.tsx`
- [ ] `SabsmsFilterBar.tsx`
- [ ] `SabsmsDataTable.tsx`
- [ ] `SabsmsBulkActions.tsx`
- [ ] `SabsmsPagination.tsx`
- [ ] `SabsmsExportMenu.tsx`
- [ ] `SabsmsDetailDrawer.tsx`
- [ ] `SabsmsKbdHint.tsx`
- [ ] `SabsmsColumnPicker.tsx`
- [ ] `SabsmsSavedViews.tsx`
- [ ] `SabsmsRefreshButton.tsx`
- [ ] `SabsmsImportButton.tsx`
- [ ] `SabsmsAuditTrail.tsx`

**Wave A — parallel agents (4):**
- [ ] Page 3: `/sabsms/inbox` (helpdesk-grade)
- [ ] Page 7: `/sabsms/campaigns/new` (wizard)
- [ ] Page 10: `/sabsms/templates/[id]` (editor)
- [ ] Page 38: `/sabsms/analytics` (dashboard)

**Wave B — parallel agents (4):**
- [ ] Page 6: `/sabsms/campaigns` (list)
- [ ] Page 9: `/sabsms/templates` (list)
- [ ] Page 16: `/sabsms/contacts` (list)
- [ ] Page 32: `/sabsms/compliance` (dashboard)

### Follow-up sessions

Remaining 43 pages. Order them by user impact:
1. Drip builder + list (13, 12)
2. Numbers detail + provisioning (24, 25, 26)
3. Providers list + detail (27, 28)
4. Sender pool + routing (29, 30)
5. Suppressions + consent (20, 21)
6. Segments + segment builder (18, 19)
7. Compliance: 10DLC + DLT + GDPR + keywords + audit (33-37)
8. Analytics deep-dives (39, 40, 41, 42, 43)
9. Developer surface (44-51)
10. Settings (52-55)

---

## D. Conventions every page must follow

- **Server component by default.** Add `'use client'` only where state or effects are required (typically just for the interactive composer / drawer / table sub-components).
- **Routes:** `force-dynamic`. No static caching for tenant-scoped data.
- **Data access:** read from `getSabsmsCollections()` in server components; send work through `sabsmsEngine.*` (never raw `fetch` to the Rust engine).
- **RBAC:** every page reads its required permission key via the existing `requirePermission` helper at the top of the server component; deny → 403.
- **Empty / loading / error states:** use the toolkit primitives — never raw text.
- **Tests:** every new page or toolkit primitive ships with at least one Vitest unit test covering its core invariant.
- **No emojis** unless the user explicitly asks.
- **No `// removed` or `// renamed` comments** — code is authoritative.
- **No URL-paste file inputs** — use `<SabFilePicker>` per CLAUDE.md.

---

## E. Open questions

1. **Per-workspace provider credentials encryption** — reuse the workspace-KMS pattern from SabWa (`@/lib/sabwa/crypto`?) or introduce a SabSMS-specific cipher store?
2. **Permission keys per page** — current registry has coarse `sabsms_*` keys. Page B.8.52-55 (settings) needs `sabsms_team`, `sabsms_billing`, `sabsms_notifications` — register before building those pages.
3. **CRM segment reuse vs SabSMS-specific segments** — Page 18 promises reuse; confirm the CRM segment shape can be filtered by SabSMS predicates (last_sms_clicked_at etc.) or do we mirror the contact list into `sabsms_contacts`?
4. **i18n source for AI translation** — uses existing project LLM gateway; confirm rate-limits and PII redaction approach before building Page 10 / 38.

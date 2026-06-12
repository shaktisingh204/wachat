# R&D — SabCRM Polish Backlog (task #11) + Sales-side World-class Gaps

> Execution spec for the build agent. Every file path, action name, wire field and component
> name below was verified against the working tree on 2026-06-12. The world-class directive
> applies: every entity surface exposes its FULL field set (forms + list columns + detail
> slots) with real entity pickers; minimal dialogs are non-compliant.

## Ground truth — where everything lives today

| Concern | File |
| --- | --- |
| Record list surface (flagged 20ui) | `src/app/sabcrm/[objectSlug]/record-surface.tsx` (1760 L) |
| List adapter (pure wire mapping) | `src/app/sabcrm/[objectSlug]/record-surface-adapter.ts` |
| Record detail surface (flagged 20ui) | `src/app/sabcrm/[objectSlug]/[recordId]/record-detail-surface.tsx` (1384 L) |
| Legacy detail (Twenty-styled) | `src/app/sabcrm/[objectSlug]/[recordId]/record-detail-tw.tsx` |
| Existing rich-text editor (dep-free) | `src/app/sabcrm/[objectSlug]/[recordId]/rich-text-editor.tsx` + `rich-text.css` |
| Record composites (20ui) | `src/components/sabcrm/20ui/composites/record/` — `view-bar.tsx`, `record-grid.tsx`, `record-board → board.tsx`, `record-cell.tsx`, `record-detail.tsx`, `record-panel.tsx`, `record-tabs.tsx`, `filter-builder.tsx`, `bulk-bar.tsx`, `grid-pagination.tsx` |
| 20ui command primitives | `src/components/sabcrm/20ui/command.tsx` (`Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandSeparator`, `CommandShortcut`, `CommandDialog`) — `cmdk@^1.0.0` is installed |
| Twenty command menu (to replace) | `src/components/sabcrm/twenty/twenty-command-menu.tsx` (1218 L) + `.css`; hook `src/components/sabcrm/twenty/use-command-menu.ts` |
| Workspace switcher (to re-home) | `src/components/sabcrm/twenty/twenty-workspace-switcher.tsx` (372 L) |
| Suite frame (hosts both) | `src/components/sabcrm/sabcrm-suite-frame.tsx` — `TwentyCommandMenu` at L403, `TwentyWorkspaceSwitcher` in sidebar `footer` at L412, `useCommandMenu()` at L143 |
| Gated server actions | `src/app/actions/sabcrm-twenty.actions.ts` (+ `.types.ts`); `gate(action, projectId?)` at L103 runs session → project-membership → `canServer('sabcrm', action, projectId)` → plan |
| Activities rust client | `src/lib/rust-client/sabcrm-activities.ts` (`SabcrmRustActivity`: `id, projectId, type, title, body?, targetObject, targetRecordId, authorId, status?, assigneeId?, dueAt?, attachments?, createdAt, updatedAt`) |
| Views rust client / DTO | `src/lib/rust-client/sabcrm-views.ts`; `rust/crates/sabcrm-views/src/dto.rs` — `SavedView.view_fields: Vec<ViewField>` where `ViewField = { fieldKey, position, isVisible, size? }` (camelCase wire) |
| Records rust handlers | `rust/crates/sabcrm-records/src/handlers.rs` — collection `sabcrm_records` (L48); free-text `q` is an **unescaped** case-insensitive regex `$or` over `SEARCH_FIELDS = [name, title, firstName, lastName, email, phone, jobTitle, body, …]` (L93, L648–657) |
| Activities rust handlers | `rust/crates/sabcrm-activities/src/handlers.rs` — collection `sabcrm_activities` (L39) |
| workspaceMembers object | `rust/crates/sabcrm-core/src/standard_objects.rs` `workspace_members()` (L518): fields `id, name (isLabel), email, avatarUrl, role`; records upserted with `_id = users._id` and `data.id = user id hex` (`rust/crates/sabcrm-objects/src/handlers.rs` L557–665); seeded lazily by `seedMembersBestEffort()` in `src/app/actions/sabcrm-objects.actions.ts` (L160) via `sabcrmObjectsApi.sync(projectId, 'workspaceMembers')` |
| RBAC client plumbing | `src/context/project-context.tsx` — `ProjectProvider` loads `getMyEffectivePermissions(activeProjectId)` (`src/app/actions/rbac.actions.ts` L11) into context on every project change; **`useCan(moduleKey, action)` already exists** (L218–221) wrapping `can()` from `src/lib/rbac.ts` (`PermissionAction = 'view'|'create'|'edit'|'delete'`) |
| WaChat inbound ingest | `src/app/api/webhooks/meta/route.ts` → `processWebhookInline` (L133) → `handleSingleMessageEvent` in `src/lib/webhook-processor.ts` (L1339–1545) |
| System→Rust call pattern | `forwardLeadGenToRust` in `src/app/api/webhooks/meta/route.ts` (L245–277): `issueRustJwt({ userId: tenantId, tenantId, roles: [] })` from `@/lib/jwt-for-rust`, then raw `fetch` to `${RUST_API_URL}/v1/sabcrm/...` |
| CRM↔WaChat outbound bridge | `src/app/actions/sabcrm-comms.actions.ts` — `phoneFromValue` (L160), `firstRecordPhone` (L199), `toWaId` (L218: digits-only strip), `resolveThread` (L291), `sendSabcrmWhatsappMessage` logs a `WHATSAPP` activity (L456) |
| Doc-surface kit (reference patterns) | `src/app/sabcrm/finance/_components/doc-surface/` — `EntityPicker` props in `entity-picker.tsx` L18–36: `{ value, valueLabel?, onChange(option|null), search(q)=>Promise<DocEntityOption[]>, placeholder?, emptyText?, disabled?, invalid?, id?, aria-label? }`; `DocEntityOption = { id, label, meta? }` |
| Surface flag | `NEXT_PUBLIC_SABCRM_RECORD_SURFACE` = `'1'|'all'|<slug,csv>` — `recordSurfaceEnabled()` in `src/app/sabcrm/[objectSlug]/page.tsx` L2515 |

Mongo is shared: both Next (`src/lib/mongodb.ts`) and the Rust engine (`rust/crates/api/src/main.rs` L176–177) read `MONGODB_URI` + `MONGODB_DB`.

---

## Work item 1 — Record CREATE dialog: "Show all fields" expand

**File:** `src/app/sabcrm/[objectSlug]/record-surface.tsx`, `CreateRecordDialog` (L236–402).

Today the dialog filters to `object.fields.filter((f) => !f.system && (f.required || f.inTable))` (L257–260) — non-compliant minimal dialog.

Spec:
1. Compute two lists from `object.fields`:
   - `primaryFields` = `!f.system && (f.required || f.inTable)` (unchanged order).
   - `extraFields` = `!f.system && !(f.required || f.inTable)`.
2. Add `const [showAll, setShowAll] = React.useState(false)`. Render `primaryFields` always; when `extraFields.length > 0`, render below them a ghost `Button` (20ui `Button variant="ghost" size="sm"` with `ChevronDown`/`ChevronUp` icon): label `Show all fields (${extraFields.length} more)` / `Show fewer fields`, `aria-expanded={showAll}`. When `showAll`, render `extraFields` with the SAME `<RecordCell mode="edit">` rows (RELATION fields keep the real `relationResolver` picker — already threaded as a prop, L241/376).
3. Seed `defaultValue` for ALL non-system fields in the `useState` initializer (currently only the filtered list, L263–269 — change `fields` to the union).
4. `missingRequired` (L286) stays computed over required fields only; keep the `draftRef` blur-commit race fix (L271–273) untouched.
5. Deep-link create: the command menu navigates to `/sabcrm/${slug}?new=1` (`twenty-command-menu.tsx` L756–760 comment) but **nothing handles it**. In `RecordSurface`, initialize `const [createOpen, setCreateOpen] = React.useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1')` (replace the plain `useState(false)` at L1421), and on dialog close strip `new` from the URL with the existing replace-state pattern (mirror the L718–733 effect's `window.history.replaceState` usage).
6. Gate the whole dialog open affordance on `useCan('sabcrm', 'create')` (see work item 7).

A11y: the expand button must precede the extra fields in DOM order; keep `maxHeight: '60vh', overflowY: 'auto'` on the scroller (L341–343).

## Work item 2 — Column show/hide UI + persistence

**Files:** `src/components/sabcrm/20ui/composites/record/view-bar.tsx`, `src/app/sabcrm/[objectSlug]/record-surface.tsx`, `src/app/sabcrm/[objectSlug]/record-surface-adapter.ts`.

Today: columns = `object.fields.filter(f => f.inTable)` (record-surface L657–661); only `columnWidths` persists, as an ad-hoc additive key on the saved-view doc (`snapshotToWireKeys` L336–356 of the adapter; the Rust update handler `$set`s the flattened patch verbatim). The Rust view document already has the **authoritative** channel: `viewFields: [{ fieldKey, position, isVisible, size? }]` (`rust/crates/sabcrm-views/src/dto.rs` L163–174, `SabcrmViewField` in `src/lib/rust-client/sabcrm-views.ts` L52–61). The ViewBar has no fields control (props L122–166).

Spec:
1. **ViewBar composite** — add optional controlled props:
   ```ts
   /** Field keys currently shown as table columns (order = display order). Omit to hide the control. */
   visibleColumns?: string[];
   onVisibleColumnsChange?: (keys: string[]) => void;
   ```
   Render (between the Group-by select and the search input, same `vb__divider` pattern) a `Popover` button labelled `Fields` (icon `Columns3` from lucide, count badge when hidden > 0, like the Filter badge). Popover content: one row per non-system field of `fields` with a 20ui `Checkbox` (`../../choice`, imported RELATIVELY per the barrel self-cycle gotcha), checked = key ∈ `visibleColumns`; toggling calls `onVisibleColumnsChange` preserving field-metadata order. Include "Show all" / "Reset to default" footer actions (reset = the `inTable` set). Do NOT allow unchecking down to zero — disable the last checked row.
2. **Host state** (record-surface.tsx): add `const [visibleColumns, setVisibleColumns] = React.useState<string[] | null>(null)` (null = default). Change the `columns` memo (L657) to:
   ```ts
   const defaults = inTable.length > 0 ? inTable : object.fields.slice(0, 6);
   if (!visibleColumns) return defaults;
   const byKey = new Map(object.fields.map(f => [f.key, f]));
   const picked = visibleColumns.map(k => byKey.get(k)).filter(Boolean);
   return picked.length > 0 ? picked : defaults;
   ```
   Reset `visibleColumns` to `null` in the slug-change effect (L481–491) and include it in `ViewStateSnapshot` + the implicit-save debounce deps (L624–653) and in `applyView` (L513–521).
3. **Persistence** (record-surface-adapter.ts):
   - Extend `ViewStateSnapshot` with `visibleColumns?: string[] | null`.
   - In `snapshotToWireKeys`, emit canonical `viewFields` when `visibleColumns` is set:
     ```ts
     viewFields: snap.visibleColumns
       ? snap.visibleColumns.map((fieldKey, i) => ({
           fieldKey, position: i, isVisible: true,
           ...(snap.columnWidths?.[fieldKey] ? { size: Math.round(snap.columnWidths[fieldKey]) } : {}),
         }))
       : [],
     ```
     Keep writing the legacy `columnWidths` map too (back-compat for views the legacy page reads).
   - Add `export function visibleColumnsFromWire(view: SabcrmRustView): string[] | null` — read `view.viewFields`, filter `isVisible !== false`, sort by `position`, return the `fieldKey` list; return `null` when the array is absent/empty.
   - In `savedViewFromWire`, surface it on the composite `SavedView` — extend the `SavedView` interface in `view-bar.tsx` (L108–117) with `visibleColumns?: string[] | null`, and apply it in `applyView`.
4. **No-active-view fallback:** persist to `localStorage` key `` `sabcrm:cols:v1:${objectSlug}` `` (JSON `string[]`) whenever `activeViewId === null`; hydrate it in the slug-change reset. Guard all storage access in try/catch (mirror `readRecents` in twenty-command-menu.tsx L68–97).
5. Add tests beside the adapter's existing unit-test conventions for `visibleColumnsFromWire` round-trip (empty array, missing key, unsorted positions).

## Work item 3 — Rich-text notes editor

**Verified dependency state:** `package.json` has ONLY `"@tiptap/core": "^3.25.0"` (L118) and `node_modules/@tiptap/` contains only `core` (used purely for the `JSONContent` *type* in `src/lib/sabcrm/emails/`). A tiptap editor therefore requires adding `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm` at `^3.25.0`. Meanwhile the repo already ships a **dependency-free, sanitized, Twenty-fidelity block editor**: `src/app/sabcrm/[objectSlug]/[recordId]/rich-text-editor.tsx` (839 L) exporting `RichTextEditor`, `RichTextView`, `sanitizeRichText`, `isHtmlBody`, `isRichTextEmpty` — already used by the legacy `record-detail-tw.tsx` (L1171, L1646) and storing sanitized HTML in activity `body`.

**Decision (option A, recommended): promote the existing editor to a shared composite. Zero new deps, identical storage format, sanitizer included.**
1. Move `rich-text-editor.tsx` + `rich-text.css` to `src/components/sabcrm/20ui/composites/editor/rich-text.tsx` + `rich-text.css` (keep `.rte-*` class namespace and `--st-*` tokens). Leave a re-export shim at the old path so `record-detail-tw.tsx` keeps compiling:
   `export * from '@/components/sabcrm/20ui/composites/editor/rich-text';`
   Do NOT re-export through the 20ui barrel index (barrel self-cycle gotcha) — consumers import the composite path directly.
2. **Detail Notes tab** (`record-detail-surface.tsx` `NotesTab`, L296–367): replace the `Textarea` with `RichTextEditor` (`value`/`onChange` sanitized-HTML string; `onSubmit` = the existing `submit`). On submit derive `firstLine` for the title from the PLAIN text — reuse `bodyExcerpt`-style stripping or `sanitizeRichText` then strip tags. Replace the `meta: bodyExcerpt(a.body)` excerpt rendering with a small `RichTextView`-backed preview: keep `bodyExcerpt` for the one-line `meta` (it already tolerates HTML poorly — extend it: if `isHtmlBody(body)`, excerpt from the sanitized text content instead of the JSON walker).
3. **Activity composer** (`ActivityComposer`, L232–294): leave the single-line `Input` quick-log as-is (good ergonomics), but add an optional "Add details" disclosure that mounts `RichTextEditor` and submits `body`.
4. **Notes page** (`src/app/sabcrm/notes/page.tsx` `CreateDialog`, L140–226): replace the body `Textarea` with `RichTextEditor`; keep the ⌘/Ctrl+Enter submit (the editor already submits the parent on ⌘/Ctrl+Enter per its header doc). `NoteTile` body preview (L100–114): strip HTML via a tiny shared `plainTextOfBody(body)` helper exported from the new composite (wraps `sanitizeRichText` + tag-strip) instead of rendering raw markup as text.
5. **Option B (only if the product owner insists on tiptap):** `pnpm add @tiptap/react@^3.25 @tiptap/starter-kit@^3.25 @tiptap/pm@^3.25`; build `src/components/sabcrm/20ui/composites/editor/tiptap-editor.tsx` with `useEditor({ extensions: [StarterKit] })`, emit HTML through the SAME `sanitizeRichText` before persisting, and keep the public prop contract identical to option A so the call sites don't change. Note `src/app/dashboard/sabsign/docs/[docId]/page.tsx` (L12, L327) already documents this exact install for SabSign — coordinate the version pin.

## Work item 4 — Timeline actor-name resolution

**Where authorId comes from:** `createSabcrmActivityTw` sets `authorId: g.ctx.userId` (sabcrm-twenty.actions.ts L941) — the SabNode session user `_id`. **Members lookup:** the `workspaceMembers` records are upserted with `_id = users._id` and `data: { id, name, email, avatarUrl, role }` (rust sabcrm-objects handlers L557–665), seeded idempotently whenever `listObjectsTw` runs (`seedMembersBestEffort`, sabcrm-objects.actions.ts L146–174). So `activity.authorId === workspaceMembers record id`.

The `TimelineItem` model **already supports actors**: `actor?: { name: string; avatarUrl?: string }` (`record-tabs.tsx` L161–169, rendered with `Avatar` at L264–273). The detail surface just never populates it.

Spec (in `record-detail-surface.tsx`):
1. Add a members fetch alongside the activities effect (L930–951):
   ```ts
   const [members, setMembers] = React.useState<Map<string, { name: string; avatarUrl?: string }>>(new Map());
   // listSabcrmRecordsTw('workspaceMembers', { limit: 200 }, activeProjectId ?? undefined)
   // map: record.id -> { name: String(record.data.name ?? ''), avatarUrl: typeof record.data.avatarUrl === 'string' ? record.data.avatarUrl : undefined }
   ```
   Failure degrades silently (no actor chips) — never an error banner.
2. In `timelineItems` (L1093–1103) and `NotesTab.items` (L319–329) populate `actor: members.get(a.authorId)` (omit when unknown). For `WHATSAPP` inbound activities authored by the system sentinel (work item 10), fall back to `actor: { name: 'WhatsApp' }` when `a.authorId` starts with `system:`.
3. Comments already carry `authorId` + `createdAtRelative` (`SabcrmComment`, sabcrm-activities.ts L124–144) — reuse the same map when the comments thread UI lands.

## Work item 5 — Per-activity edit / delete

Server actions already exist and are gated: `updateSabcrmActivityTw(id, patch, projectId?)` (gate `'edit'`, L957) and `deleteSabcrmActivityTw(id, projectId?)` (gate `'delete'`, L979). `UpdateSabcrmActivityTwPatch` accepts `type/title/body/status/assigneeId/dueAt/attachments` (.types.ts L165–174).

Spec:
1. **Composite slot:** extend `TimelineItem` in `record-tabs.tsx` (L161) with `actions?: React.ReactNode`, rendered right-aligned in the row, visible on row hover/focus-within (CSS in the same file's stylesheet; ensure keyboard reachability — buttons are always in the tab order, only *visually* revealed).
2. **Host wiring** (`record-detail-surface.tsx`): for each activity build a `DropdownMenu` (already imported, L72–76) with `Edit` and `Delete` items, gated on `useCan('sabcrm','edit')` / `useCan('sabcrm','delete')`.
   - Edit opens a Dialog with `Input` (title), `RichTextEditor` (body, work item 3), and for `type === 'TASK'` the assignee/due controls from work item 6; submit via `updateSabcrmActivityTw(a.id, patch, activeProjectId ?? undefined)`, then `setActivities(prev => prev.map(x => x.id === a.id ? res.data : x))`.
   - Delete confirms with the 20ui `AlertDialog` (`src/components/sabcrm/20ui/alertdialog.tsx`), then `deleteSabcrmActivityTw(a.id, ...)` and `setActivities(prev => prev.filter(x => x.id !== a.id))`. Optimistic removal with rollback on `!res.ok` (mirror `toggleTask`, L974–1003).
3. Thread the same `actions` nodes into `NotesTab` items and `TasksTab` rows (tasks rows are bespoke `<li>`s, L435–481 — append an icon-button cluster).

## Work item 6 — Task assignee + dueDate quick-add

Wire support already exists end-to-end: `CreateSabcrmActivityTwInput.assigneeId?/dueAt?` (.types.ts L158–159) → `createSabcrmActivityTw` forwards both (L944–945) → `SabcrmRustActivity.assigneeId?/dueAt?` round-trips. The detail `TasksTab` quick-add (record-detail-surface.tsx L377–487) currently sends only `{ type:'TASK', title, status:'TODO' }` and renders `dueAt` read-only.

Spec (detail `TasksTab`):
1. Add two compact controls beside the title `Input`:
   - **Assignee:** 20ui `Select` (size `sm`) whose options come from the members map of work item 4 (`{ value: memberId, label: name }`), placeholder `Assignee…`, clearable (null option). This is the real entity picker — workspaceMembers IS the member directory object.
   - **Due date:** 20ui `DatePicker` (`src/components/sabcrm/20ui/datepicker.tsx`) emitting `YYYY-MM-DD`; convert to RFC3339 (`new Date(\`${d}T09:00:00\`).toISOString()`) for `dueAt`.
2. `submit` posts `{ type:'TASK', title, status:'TODO', assigneeId: assignee ?? undefined, dueAt: dueIso ?? undefined }` — extend `NewActivityInput` (L205–211) with `assigneeId?: string; dueAt?: string` and thread through `createActivity` (L953–972, already spreads `...input`).
3. Task rows: render the assignee as a name chip via the members map (`members.get(task.assigneeId)`), and keep the existing due-date chip (L471–479). Overdue (`dueAt < now && status !== 'DONE'`) gets the danger token color.
4. **Tasks PAGE parity** (`src/app/sabcrm/tasks/page.tsx`): the "New task" modal stores free-text `assignee` on the `tasks` OBJECT record (`payload.assignee = assignee.trim()`, L403). Replace the free-text input with the same members `Select`, writing BOTH `assigneeId` (member id) and `assignee` (display name, keeps existing renderers `assigneeLabel` L138 working). Note in the PR description: the tasks page uses `tasks` object records while the detail tab uses `TASK` activities — two models by design today; do not merge them in this phase.

## Work item 7 — `canEdit` RBAC affordance gating

**How effectivePermissions reach the client (verified):** `ProjectProvider` (`src/context/project-context.tsx`) fetches `getMyEffectivePermissions(activeProjectId)` (`src/app/actions/rbac.actions.ts` L11) on every `activeProjectId`/user change (L147–158) and exposes `effectivePermissions` plus the hook `useCan(moduleKey, action)` (L218–221) over `can()` from `src/lib/rbac.ts`. Server actions remain authoritative via `gate()`'s `canServer('sabcrm', action, projectId)`.

Spec — client affordances only (never security):
1. **Composites:** add `readOnly?: boolean` to `RecordDetailProps` (record-detail.tsx L54–71) and `RecordPanelProps` (record-panel.tsx L37–53). When `readOnly`, `PanelRow.onStartEdit` is a no-op, the hover edit affordance and title inline-edit are suppressed, and `RecordCell` is always rendered in display mode. Same for `RecordGrid`: it already only enters edit through the host's `renderCell` double-click handler, so no composite change needed there.
2. **record-surface.tsx:**
   - `const canCreate = useCan('sabcrm','create'); const canEdit = useCan('sabcrm','edit'); const canDelete = useCan('sabcrm','delete');`
   - Hide/disable the ViewBar `trailing` "New …" button and the empty-state create actions when `!canCreate`.
   - In `renderCell`'s `onDoubleClick` (L1116–1120) bail when `!canEdit`; in `canMove`/`handleBoardMove` return `{ ok:false, reason:'You do not have edit permission.', kind:'permission' }` client-side when `!canEdit` (server still re-checks).
   - BulkBar: hide the stage `Select` when `!canEdit`, the Delete button when `!canDelete`.
3. **record-detail-surface.tsx:** pass `readOnly={!canEdit}` to `RecordDetail`; hide `ActivityComposer`, note/task/file create affordances when `!useCan('sabcrm','create')`; hide the header Actions→Delete item when `!canDelete`; hide favorite toggle never (view-level).
4. The legacy `record-detail-tw.tsx` already models this as a `canEdit` prop defaulting `true` (L2568–2573) — keep naming consistent (`readOnly` on composites, `canEdit` booleans in hosts).

## Work item 8 — 20ui `CommandDialog` replacement for `TwentyCommandMenu`

**What the menu indexes today** (verified in `twenty-command-menu.tsx`):
- **Navigate** — every object index from the live catalogue (`listSabcrmObjectsTw`, fallback `FALLBACK_OBJECTS` L224) + global nav (`/sabcrm/dashboard`, `/sabcrm/my-work`, `/sabcrm/search`, L358–380).
- **Create** — one per object → navigates `/sabcrm/${slug}?new=1` (L749–765; today a dead param — fixed by work item 1.5).
- **View** — per object Table / Board switch (`?view=board`) for objects with `hasBoard` (L767–793).
- **Settings** — 4 routes under `/dashboard/settings/crm[/appearance|/profile|/general]` (L383–412).
- **Preferences** — light/dark toggle writing the `sabcrm.prefs.v1` localStorage blob + `.st-theme-dark` class (L129–180).
- **Actions** — record-level actions behind the Lab flag `lab.commandMenuActions` from `useSabcrmSettings()` (L828+).
- **Records** — debounced (200 ms) fan-out search: `listSabcrmRecordsTw` across ≤ `MAX_SEARCH_OBJECTS = 6` objects, `PER_OBJECT_LIMIT = 5` rows, labels via `deriveRecordLabel` + avatar via `deriveRecordAvatarUrl` (L256–331, 470–473).
- **Recent** (empty query) — localStorage `sabcrm:cmdk:recents` (cap 8) with exported `recordRecents` helper (L54–116).
- **Favorites** (empty query) — `listSabcrmFavoritesTw`, labels `${objLabel} · ${recordId.slice(-6)}` (L337–344).
- **Shortcuts help** — `?` overlay listing ⌘K, `/`, arrows, Enter, Esc (L417–429); open/close + `/` + `?` bindings live in `use-command-menu.ts` (keep this hook as-is — it is UI-framework-agnostic).

Spec:
1. New file `src/components/sabcrm/command-menu.tsx` (NOT under `twenty/`). Same props contract: `{ open, onOpenChange, projectId?, helpOpen?, onHelpOpenChange? }`. Reuse verbatim (move, don't rewrite): `readRecents/pushRecent/recordRecents`, theme helpers, `deriveRecordLabel`, `deriveRecordAvatarUrl`, `favoriteLabel`, catalogue loading, the debounced record search effect. Extract those into `src/components/sabcrm/command-menu-data.ts` so the component file is presentation only.
2. Shell: `CommandDialog` from `@/components/sabcrm/20ui/command` with `shouldFilter={false}` (results are pre-filtered server/host-side via the existing `matchesTerm`; cmdk must not re-filter). Structure:
   `CommandInput` (controlled `value={query}` `onValueChange={setQuery}`) → `CommandList` → `CommandEmpty` → `CommandGroup heading=…` per section in the SAME order as today (Recent, Favorites, Records, Navigate, Create, View, Actions, Settings, Preferences) with `CommandSeparator` between, `CommandItem onSelect={…}` rows (avatar rows keep `TwentyAvatar` for now or swap to 20ui `Avatar` — prefer 20ui `Avatar` from `@/components/sabcrm/20ui/avatar`). Delete the hand-rolled overlay/keyboard/activeIndex code (cmdk owns roving focus, `loop`, Escape is wired in `CommandDialog`).
3. Keep `recordRecents` re-export working: update `use-command-menu.ts` L9 to re-export from the new module.
4. Host swap in `sabcrm-suite-frame.tsx`: import the new `CommandMenu` and replace L403; keep `useCommandMenu()` as the open-state owner. The sidebar "Search ⌘K" leaf (L350–356) is unchanged.
5. Retire `twenty-command-menu.tsx` + `.css` after the swap: leave a deprecation re-export in `src/components/sabcrm/twenty/index.ts` for one release; `twenty-app-frame.tsx` also imports it — swap that import too.
6. Help overlay: render as a second small `Dialog` (20ui) listing `SHORTCUTS` — keep the `?` binding behavior.

## Work item 9 — Workspace switcher 20ui replacement

`twenty-workspace-switcher.tsx` is ALREADY ~90 % on 20ui (`Menu/MenuItem/MenuSeparator/Modal/Field/Input/Textarea/Button` from `@/components/sabcrm/20ui`, `SabFileUrlInput` from `@/components/sabfiles` — SabFiles policy compliant). Remaining Twenty residue: the `.st-ws*` / `.st-workspace-switcher` classes styled inside `src/components/sabcrm/twenty/notifications.css` (L17+) under the `.sabcrm-twenty .st-sidebar__header` scope.

Spec:
1. Move the file to `src/components/sabcrm/workspace-switcher.tsx` (rename export `WorkspaceSwitcher`, keep a `TwentyWorkspaceSwitcher` alias re-export in `src/components/sabcrm/twenty/index.ts`).
2. Create `src/components/sabcrm/workspace-switcher.css` with the trigger/menu/avatar styles ported off `notifications.css`, expressed in `--st-*`/`--u-*` tokens, scoped to a fresh `.crm-ws` namespace (rename classes `st-ws*` → `crm-ws*`, `st-workspace-switcher` → `crm-ws__trigger`). Import the css from the component.
3. Update hosts: `sabcrm-suite-frame.tsx` L412 (`footer={<WorkspaceSwitcher />}`) and `twenty-app-frame.tsx`.
4. Behavior is otherwise frozen: `listSabcrmProjectsTw`/`createSabcrmProjectTw`/`updateSabcrmProjectTw`, standalone-CRM-project filtering, auto-select-first (L113–117), `setActiveProjectId` + `router.refresh()` — do not touch.

## Work item 10 — Inbound WhatsApp → CRM activity hook

**Ingest path (verified):** Meta → `POST /api/webhooks/meta` (`src/app/api/webhooks/meta/route.ts`, signature check L122–128, project resolution by `phone_number_id`/WABA L57–110) → `processWebhookInline` (L133) → per message `handleSingleMessageEvent(db, project, message, contactProfile, phoneNumberId)` (`src/lib/webhook-processor.ts` L1339). That function: dedups by `wamid` (L1352–1359 — runs ONCE per message, our idempotency anchor), extracts `lastMessageText` per message type (L1364–1439), upserts the `contacts` doc (L1468), inserts `incoming_messages` (L1495–1511), inserts a `notifications` doc (L1513–1528), then runs opt-in/flows/auto-reply.

**Hook point:** immediately after the `incoming_messages` insert (after L1511), fire-and-forget:
```ts
// CRM bridge: log this inbound message on any matching SabCRM record (best-effort).
import('@/lib/sabcrm/inbound-whatsapp-bridge')
  .then((m) => m.logInboundWhatsappToCrm({
    tenantId: String(project.userId),
    waId: senderWaId,            // Meta sends E.164 digits without '+'
    senderName,
    text: lastMessageText,
    wamid: message.id,
    at: new Date(parseInt(message.timestamp, 10) * 1000),
  }))
  .catch((e) => console.error('[CRM bridge] inbound WA log failed:', e?.message));
```

**New module `src/lib/sabcrm/inbound-whatsapp-bridge.ts`** (server-only):
1. **Match records** — direct Mongo read (same DB: `connectToDatabase()` / `MONGODB_DB` is shared with the engine) on collection `sabcrm_records`:
   - Find the tenant's CRM project ids: `db.collection('projects').find({ userId: new ObjectId(tenantId) }, { projection: { _id: 1 } })` (CRM projects are plain project docs — see `listSabcrmProjectsTw`).
   - Query: `{ projectId: { $in: projectIdStrings }, object: { $in: ['people', 'leads', 'companies'] }, deletedAt: { $exists: false }, $or: [ { 'data.phone': { $regex: digitTolerantRegex(waId), $options: 'i' } }, { 'data.phones': { $regex: … } }, { 'data.whatsapp': { $regex: … } } ] }` — string-typed phone values only (a `$regex` never matches PHONES composite objects; acceptable v1 limitation, see Risks). Confirm the exact `projectId` storage type (string vs ObjectId) against one live `sabcrm_records` doc before shipping — the Rust handlers scope by string `projectId`.
   - `digitTolerantRegex(digits)` interleaves `[^0-9]*` between digits and anchors on the LAST 10 digits (national number) so `"+91 98765 43210"`, `"098765-43210"` and `9876543210` all match `waId = 919876543210`. Cap matches at 5 records.
2. **Create the activity through the engine** (never direct Mongo writes — engine owns `_id`/timestamps): mirror `forwardLeadGenToRust` (route.ts L245–277):
   ```ts
   const { issueRustJwt } = await import('@/lib/jwt-for-rust');
   const token = await issueRustJwt({ userId: tenantId, tenantId, roles: [] });
   await fetch(`${process.env.RUST_API_URL || 'http://localhost:8080'}/v1/sabcrm/activities`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
     body: JSON.stringify({
       projectId: rec.projectId, type: 'WHATSAPP',
       title: `WhatsApp from ${senderName}: ${text.slice(0, 120)}`,
       body: text, targetObject: rec.object, targetRecordId: rec.id,
       authorId: `system:whatsapp-inbound`,
     }),
   });
   ```
   (`SabcrmActivityCreateInput` requires `authorId`; the sentinel renders as "WhatsApp" per work item 4.2. If the Rust handler validates `authorId` as ObjectId hex, fall back to `tenantId`.) Verify the activities POST route does not require extra claims beyond the `AuthUser` JWT — the lead-gen endpoint accepts this exact token shape.
3. **Idempotency:** rely on the upstream `wamid` dedup (the hook only runs on first delivery). Belt-and-braces: include the `wamid` in the activity `body` tail (`\n\n[wamid:…]`) — no extra read needed.
4. **Surface:** the detail Timeline already maps `WHATSAPP → 'event'` (`ACTIVITY_TIMELINE_KIND`, record-detail-surface.tsx L116–124) and the WhatsApp tab exists for phone-bearing objects (L1057–1175); inbound entries appear on next load. No UI change required beyond work item 4.
5. **Config kill-switch:** read `process.env.SABCRM_INBOUND_WA_BRIDGE === '0'` to disable; default on.

## Work item 11 — E.164 normalization point

**Today:** the ONLY normalization is `toWaId(phone) = phone.replace(/[^\d]/g, '')` in `sabcrm-comms.actions.ts` L218 — no shared helper, no country-code defaulting, nothing at record-write time. `phoneFromValue` (L160–192) is the canonical reader for Twenty's `{ primaryPhoneNumber, primaryPhoneCallingCode, additionalPhones[] }` composites.

Spec — single shared module `src/lib/sabcrm/phone.ts` (plain TS, no `server-only`, unit-testable):
```ts
export function digitsOnly(raw: string): string;                       // strip non-digits
export function toE164(raw: string, defaultCc?: string): string|null;  // '+<cc><nsn>'; 10-digit bare numbers get defaultCc (env SABCRM_DEFAULT_CC, fallback '91'); <8 digits ⇒ null
export function toWaId(raw: string, defaultCc?: string): string|null;  // toE164 without '+'
export function digitTolerantRegex(digits: string): string;            // last-10-digit interleaved [^0-9]* matcher (work item 10)
export { phoneFromValue, firstRecordPhone };                            // MOVED here from sabcrm-comms.actions.ts
```
Adoption points (in order):
1. `sabcrm-comms.actions.ts` — delete its local `phoneFromValue`/`firstRecordPhone`/`toWaId`, import from `@/lib/sabcrm/phone`. `resolveThread` (L291) uses the new `toWaId` (keeps the `waId.length < 8` guard semantics via the `null` return).
2. `inbound-whatsapp-bridge.ts` (work item 10) uses `digitTolerantRegex`.
3. **Record write-time normalization** — in `createSabcrmRecordTw` (sabcrm-twenty.actions.ts L410) and `updateSabcrmRecordTw` (L471): after the gate, load the object metadata (already fetched in these actions for actor labels) and for every `PHONE`-typed field whose value is a plain string, rewrite to `toE164(value) ?? value` before the engine call (non-destructive: unparseable input passes through verbatim). Do NOT touch `PHONES` composites in this phase (their sub-shape is owned by the field editor). This makes future inbound matching exact instead of regex-fuzzy.
4. Unit tests: `src/lib/sabcrm/__tests__/phone.test.ts` — Indian national 10-digit, `+91`-prefixed, spaced/hyphenated, `00`-prefixed international, too-short, composite via `phoneFromValue`.

---

## Suggested build order & verification

1. WI-7 (RBAC affordances — small, unblocks gating in later items) → 2. WI-1 (create dialog + `?new=1`) → 3. WI-2 (columns) → 4. WI-4 (actors) → 5. WI-5/WI-6 (activity edit/delete + task quick-add, share the member map) → 6. WI-3 (editor) → 7. WI-8 (command menu) → 8. WI-9 (switcher) → 9. WI-11 then WI-10 (phone lib before bridge).

Verification per item: `NEXT_PUBLIC_SABCRM_RECORD_SURFACE=all` locally; the Rust engine on `:8080` (see `scripts/sabpay-e2e.mjs` pattern for minting a dev JWT); typecheck with 16 GB heap (`NODE_OPTIONS=--max-old-space-size=16384 tsc --noEmit` — tsc OOMs below 12 GB in this repo). For WI-10, replay a captured Meta `messages` payload at `POST /api/webhooks/meta` with a valid `x-hub-signature-256` (or `NODE_ENV=development` bypass path at route.ts L118–121) and assert a `WHATSAPP` row lands in `sabcrm_activities`.

## Risks

- **Saved-view `viewFields` round-trip:** the Rust update handler `$set`s the flattened patch verbatim (`UpdateViewInput.patch: Value`), but the typed `SavedView.view_fields` deserializer may reject malformed entries on read — keep entries exactly `{ fieldKey, position, isVisible, size? }` and add an adapter unit test against a live view doc.
- **Inbound bridge couples Next to the engine's Mongo schema** (`sabcrm_records` field layout, `projectId` storage type) — verify against a live document; schema drift in the Rust crate would silently break matching.
- **Phone matching v1 misses PHONES composite values** (regex can't match objects) and assumes a default country code for bare 10-digit numbers (env `SABCRM_DEFAULT_CC`).
- **`authorId` sentinel** (`system:whatsapp-inbound`) may violate an ObjectId-hex expectation in the Rust activities handler — verify; fall back to `tenantId`.
- **Command-menu rewrite regression surface** is large (keyboard nav, recents, Lab actions); keep the data layer verbatim and snapshot the rendered group order before/after.
- **Composites are shared** — `readOnly` on RecordDetail/RecordPanel and `actions` on TimelineItem must stay optional and import 20ui primitives relatively (barrel self-cycle gotcha) to avoid breaking other adopters.
- **Two task models** (`tasks` object records vs `TASK` activities) remain divergent by design; surfacing assignees in both places risks user confusion until a later unification phase.
- **Write-time E.164 normalization changes stored data shape** for PHONE fields — existing automations/segments filtering on formatted phone strings could stop matching; ship behind a quick env flag if uncertain (`SABCRM_NORMALIZE_PHONES=1`).

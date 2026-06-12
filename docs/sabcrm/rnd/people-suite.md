# P7 — People suite (SabCRM) — R&D / execution spec

> Task #8 of the SabCRM suite program. This doc is the build spec for the
> `/sabcrm/people/*` suite: HR crate inventory, re-scope plan (ScopeMode →
> `project_router`), and a world-class page spec per entity. Reference
> vertical: **invoices** (`rust/crates/crm-invoices` +
> `src/app/sabcrm/finance/invoices/*` + the doc-surface kit).

---

## 0. Ground rules (non-negotiable)

- **Full field set everywhere.** Every entity form exposes the FULL model
  field set (grouped sections), every list exposes the meaningful columns,
  every detail page renders every stored field in a slot. Minimal dialogs
  are non-compliant.
- **Real entity pickers.** Every FK (`employeeId`, `departmentId`,
  `shiftId`, `salaryStructureId`, `leaveTypeId`, `reportingManagerId`,
  `approverId`, …) is picked via the kit `EntityPicker` over a gated search
  action. Never a free-text ObjectId input. Picked values always render as
  labels (the picker caches `valueLabel`).
- **SabFiles for every file field** (`photoFileId`, `selfieFileId`,
  `offerLetterFileId`, KYC lists, `signatureFileId`, …): use
  `<SabFilePickerButton>` / `<SabFileUrlInput>` from `@/components/sabfiles`.
- **Gate pattern**: every server action runs the session → project → RBAC →
  plan gate exactly as `src/app/actions/sabcrm-finance-invoices.actions.ts`
  lines 86–127 (`gate(action, explicitProjectId)`, `MODULE_KEY = 'sabcrm'`,
  `canServer`, `sabcrmPlanFeature`). Failures normalise to
  `{ ok: false, error }` (`ActionResult<T>` from `@/lib/sabcrm/types`).
- **Engine scope**: SabCRM mounts are `ScopeMode::Project` — `projectId` is
  REQUIRED on every request (query for GET/PATCH/DELETE, body for POST) per
  `rust/crates/crm-core/src/scope.rs` (`sabcrm_project_oid` rejects
  absent/blank/malformed with 4xx).

---

## 1. The reusable kit — real API (read before building)

`src/app/sabcrm/finance/_components/doc-surface/` — barrel `index.ts`:

| Export | File | Use in People suite |
|---|---|---|
| `DocListPage` + `DocListPageConfig<R>` | `doc-list-page.tsx` | EVERY list surface. Config: `title`, `description`, `icon`, `entity {singular, plural}`, `columns: DocListColumn<R>[]`, `statuses: DocStatusDef[]`, `fetchPage(filters)`, `fetchAllForCsv?`, `csvFileName?`, `rowHref?`, `rowLabel`, `partyFilter? {placeholder, search}`, `bulkActions?`, `pageSize?`. Column kinds: `text | party | money | date | status | badge | aging`. `DocListFilters = {page, q, status, partyId, from?, to?}` — in People, `partyId` is repurposed as the **employee filter** (the `partyFilter.search` becomes employee search). |
| `EntityPicker` | `entity-picker.tsx` | All FK pickers. Props: `value`, `valueLabel?`, `onChange(option \| null)`, `search(q) => Promise<DocEntityOption[]>`, `placeholder?`, `emptyText?`, `disabled?`, `invalid?`, `id?`, `aria-label?`. `DocEntityOption = {id, label, meta?}`. |
| `StatusFlow` | `status-flow.tsx` | Detail headers. Props: `flow: string[]` (happy path), `statuses: DocStatusDef[]`, `current`, `className?`. Off-path states (cancelled/rejected) render as a leading pill automatically. |
| `ConvertMenu` + `ConvertMenuItem` | `convert-menu.tsx` | Detail action dropdowns (approve / disburse / generate payslips / …). Item: `{key, label, icon?, description?, disabled?, danger?, onSelect, group?}`. |
| `DocDetailPage` | `doc-detail-page.tsx` | Payroll-run + payslip detail "paper" pages. Props: `backHref/backLabel`, `docNumber`, `entitySingular`, `statuses/flow/status`, `actions?`, `party: DocDetailParty \| null`, `meta: {label, value}[]`, `currency`, `lines: DocDetailLine[]`, `totals: DocDetailTotals`, `notes?`, `terms?`, `related: DocRelatedRef[]`, `attachments?`, `activity?`, `railExtra?`, `error?`. |
| `DocForm`, `DocFormValues` | `doc-form.tsx` | **Finance-shaped** (`number/partyId/lines/dueDate/currency`). DO NOT contort People forms into it. See kit-reuse matrix below. |
| `formatDocDate`, `formatDocMoney` | `doc-list-page.tsx` | Reuse for money/date cells in custom detail slots. |

**Kit-reuse matrix (decision):**

- `DocListPage` → all 13 list surfaces (it is generic over `R extends {id:string}`).
- `EntityPicker`, `StatusFlow`, `ConvertMenu` → everywhere applicable.
- `DocDetailPage` → **payroll runs** (employees[] rows map to `DocDetailLine`:
  `description` = employee label, `qty` = 1, `rate`/`total` = net; totals map
  gross→`subTotal`, deductions→`discountTotal`, net→`total`) and **payslips**
  (earnings/deductions as lines).
- Employee detail, attendance day editor, leave forms etc. are NOT
  line-item documents — build them as full-width 20ui forms/detail pages
  (`@/components/sabcrm/20ui` primitives: `Card`, `Input`, `Select`,
  `Badge`, `Tabs`, `DropdownMenu`, `toast`) inside the SabCRM shell, with
  the kit pieces above embedded. Follow the section-grouped layout of the
  invoice detail rail (`[id]/invoice-detail-client.tsx`) for visual parity.
  Import `'@/components/sabcrm/20ui/surface-crm-base.css'` + the doc-surface
  CSS the same way `doc-detail-page.tsx` does.

**Reference adopter files** (clone their structure verbatim):

- `src/app/sabcrm/finance/invoices/page.tsx` — server entry, parallel
  initial fetch, `export const dynamic = 'force-dynamic'`.
- `src/app/sabcrm/finance/invoices/invoice-config.ts` — statuses + flow +
  filter mapping + href helpers (client-safe, no server imports).
- `src/app/sabcrm/finance/invoices/invoices-client.tsx` — KPI strip
  (`KpiCard` from `@/components/sabcrm/20ui/composites/charts`) +
  `DocListPage` config + bulk actions.
- `src/app/sabcrm/finance/invoices/[id]/invoice-detail-client.tsx` —
  detail + StatusFlow + ConvertMenu wiring.

---

## 2. Crate inventory (HR/People)

`ls rust/crates | grep -iE "employee|attendance|leave|payroll|salary|payslip|time-log|timesheet|shift|holiday"` →

Two generations exist. **Gen-1** flattens `crm_core::Identity` (so documents
already carry `projectId` at the root) and uses the canonical models in
`rust/crates/hrm-payroll-types/src/*`. **Gen-2** crates declare their own
flat `types.rs` whose documents carry **`userId` only — no `projectId`**.

| Crate | Gen | Model (response type) | Collection | Mount today (`rust/crates/api/src/router.rs`) | `project_router`? |
|---|---|---|---|---|---|
| `crm-employees` | 1 | `hrm_payroll_types::Employee` | `crm_employees` | `/v1/hrm/employees` (line 931) | NO |
| `crm-attendance` | 1 | `hrm_payroll_types::Attendance` | `crm_attendance` | `/v1/hrm/attendance` (932) | NO |
| `crm-leaves` | 1 | `LeaveType` + `LeaveApplication` | `crm_leave_types`, `crm_leave_applications` | `/v1/hrm/leaves` (933) — subtrees `/types`, `/applications`, `/applications/{id}/approve` | NO |
| `crm-payroll-runs` | 1 | `hrm_payroll_types::PayrollRun` | `crm_payroll_runs` | `/v1/hrm/payroll-runs` (934) — plus `/{runId}/compute|approve|disburse` | NO |
| `crm-holidays` | 1 | `hrm_payroll_types::Holiday` | `crm_holidays` | `/v1/hrm/holidays` (935) | NO |
| `crm-payroll-settings` | 2 | `CrmPayrollSetting` (own `types.rs`) | `crm_payroll_settings` | `/v1/crm/payroll-settings` (876) | NO |
| `crm-payslips` | 2 | `CrmPayslip` (own `types.rs`) | `crm_payslips` | `/v1/crm/payslips` (879) | NO |
| `crm-salary-structures` | 2 | `CrmSalaryStructure` (own `types.rs`) | `crm_salary_structures` | `/v1/crm/salary-structures` (880) | NO |
| `crm-leave-requests` | 2 | `CrmLeaveRequest` | `crm_leave_requests` | `/v1/crm/leave-requests` (897) | NO |
| `crm-time-logs` | 2 | `CrmTimeLog` | `crm_time_logs` | `/v1/crm/time-logs` (901) | NO |
| `crm-shifts` | 2 | `CrmShift` | `crm_shifts` | `/v1/crm/shifts` (916) | NO |
| `crm-shift-rotations` | 2 | `CrmShiftRotation` | `crm_shift_rotations` | `/v1/crm/shift-rotations` (926) | NO |
| `crm-shift-change-requests` | 2 | `CrmShiftChangeRequest` | `crm_shift_change_requests` | **NOT MOUNTED** (crate exists, no `let`/`nest` in router.rs) | NO |
| `hrm-payroll-types` | — | shared model crate (no router): `attendance.rs compliance.rs department.rs employee.rs holiday.rs leave.rs payroll_run.rs payslip.rs performance.rs salary_structure.rs settings.rs` | — | n/a | n/a |

Adjacent (do NOT touch — different modules): `sabchat-shifts`,
`sabpractice-time-logs`, `sabworkerly-payroll-runs`, `sabworkerly-timesheets`,
`hrm-advanced` actions, `crm-departments` (mounted at `/v1/crm` → provides
`/v1/crm/departments` + `/v1/crm/designations`, line 941 — needed for pickers).

**Crucially: NONE of the 13 crates use `crm_core::ScopeMode` today.** Even
gen-1 handlers hardcode `base_ownership_filter(user_id)` =
`{ userId, archived: { $ne: true } }` (e.g.
`rust/crates/crm-employees/src/handlers.rs:64`). The re-scope is a handler
refactor + second router constructor per crate, copying
`rust/crates/crm-invoices/src/router.rs` (`crud_routes()` +
`router()` with `Extension(ScopeMode::User)` + `project_router()` with
`Extension(ScopeMode::Project)`) and
`rust/crates/crm-invoices/src/handlers.rs:100` (`resolve_scope(mode, &user,
project_id)`).

### 2.1 Known mismatches found during inventory (fix as part of P7)

1. **Rust-client path bug (live 404s):** `src/lib/rust-client/crm-employees.ts`,
   `crm-attendance.ts`, `crm-leaves.ts` call `/v1/crm/employees|attendance|leaves`
   but the engine mounts these at `/v1/hrm/...` (router.rs 931–933). Their
   consumers (`src/app/dashboard/hrm/payroll/employees/*`,
   `src/app/actions/crm-employees.actions.ts`) get engine 404s today.
   Fix in WI-13 by adding the missing legacy aliases
   (`.nest("/v1/crm/employees", …)` etc. with the same `router()`), which is
   safer than editing three TS clients consumed by ~10 legacy pages.
2. **Salary-structure schema collision (payroll-breaking):**
   `crm-payroll-runs::compute_payroll_run`
   (`rust/crates/crm-payroll-runs/src/handlers.rs:804`) reads
   `crm_salary_structures` as the RICH `hrm_payroll_types::SalaryStructure`
   (`name`, `effectiveDate`, `components[]`, `applicableTo[]`, `active`),
   but the mounted CRUD crate `crm-salary-structures` writes the FLAT
   `CrmSalaryStructure` (`employeeId`, `basic`, `hra`, `da`,
   `otherAllowances`, `pfEmployer/pfEmployee`, …) into the SAME collection.
   A structure created through `/v1/crm/salary-structures` fails BSON
   deserialization inside compute (missing required `name`/`effectiveDate`)
   → the whole compute 500s. **Decision: the rich
   `hrm_payroll_types::SalaryStructure` is canonical for the People suite.**
   The new project-scoped salary-structures surface CRUDs the rich shape
   (new handlers in `crm-salary-structures` parameterised on scope, writing
   the rich model); the legacy flat CRUD stays only on its `/v1/crm/...`
   user mount, untouched. Compute additionally gets a graceful skip
   (deserialize to `Document` first, `bson::from_document` per doc,
   `tracing::warn!` + skip on shape mismatch) so one legacy doc can't 500 a
   run.
3. **Payslip dual shape + no generation:** `crm-payslips` stores the flat
   `CrmPayslip` (`basic/hra/allowances/deductions/pf/esi/tax/gross/net`,
   status `draft|issued|paid|archived`) while `hrm_payroll_types::payslip.rs`
   defines the frozen render-ready `Payslip` (header, employee_snapshot,
   earnings[], deductions[], reimbursements[], netPay, netPayInWords, ytd,
   attendanceSummary, leaveBalanceSnapshot, bankInfoSnapshot, signature/
   watermark file ids, locked/sent/downloadedLog). `disburse_payroll_run`
   (`handlers.rs:996`) is a stub: it mints a random `bankFileId` ObjectId
   (NO SabFile) and flips status — it does NOT generate payslips. P7 adds
   `POST /{runId}/generate-payslips` writing rich `Payslip` docs (see WI-7).
4. **Formula engine gap:** `eval_formula`
   (`crm-payroll-runs/src/handlers.rs`, recursive-descent parser) supports
   only `+ - * / ( )`, unary minus, identifiers `basic|ctc|monthlyCtc|annualCtc`.
   `min()`/`max()` are UNSUPPORTED and resolve to `0.0` with a warn — yet the
   canonical PF example in `hrm-payroll-types/src/salary_structure.rs`
   (test fixture) is `min(BASIC, 15000) * 0.12`. Either add `min`/`max`
   function support to the parser (small, recommended — extend `parse_atom`
   identifier branch) or forbid them in the structure form validation. The
   fixture-verification suite (§6) MUST cover this either way.
5. **Two leave systems:** gen-1 `crm-leaves` (catalog `crm_leave_types` +
   `crm_leave_applications` with ordered `approverChain[]`, `balanceSnapshot`)
   vs gen-2 `crm-leave-requests` (flat single-approver `crm_leave_requests`).
   **Decision: `crm-leaves` is the People-suite canonical.** Do not build a
   `/sabcrm/people` surface for `crm-leave-requests`; it remains a legacy
   user-mount only.
6. **Employee designation duality:** the model
   (`hrm_payroll_types::employee::EmploymentProfile`) stores free-text
   `designation: String`, while `CreateEmployeeInput`
   (`crm-employees/src/dto.rs:109`) takes `designation_id` (FK into
   `crm_designations`) and the TS doc type carries both. Handler resolves the
   id → label at create. The People form uses the **designation picker**
   (search over `/v1/crm/designations`) and shows the resolved label.
7. **Gen-2 docs have no `projectId`:** adding `ScopeMode::Project` to gen-2
   crates requires (a) `pub project_id: Option<ObjectId>` (serde
   `rename`d to land as `projectId`, `default`, `skip_serializing_if`) added
   to each `types.rs` struct, (b) create handlers stamping it under Project
   scope, (c) the Project filter `{projectId: oid}` — meaning pre-existing
   user-scope documents are invisible on the new mounts. That is acceptable
   (the suite starts clean per project); no migration in P7.

---

## 3. Engine work — re-scope recipe (per crate)

For each crate, replicate the crm-invoices pattern exactly:

1. **`router.rs`**: extract the route table into `fn crud_routes<S>()`;
   `pub fn router<S>()` = `crud_routes().layer(Extension(ScopeMode::User))`;
   add `pub fn project_router<S>()` =
   `crud_routes().layer(Extension(ScopeMode::Project))`. Keep
   non-CRUD specials (punch-in/out, compute/approve/disburse, leave approve)
   in `crud_routes` so both mounts get them — they are tenant-safe once
   handlers are scope-aware.
2. **`handlers.rs`**: add
   `Extension(mode): Extension<ScopeMode>` to every handler;
   add `fn resolve_scope(mode, &user, project_id) -> Result<TenantScope>`
   (copy of `crm-invoices/src/handlers.rs:100-104`); replace
   `base_ownership_filter(user_id)` with
   `{ let mut f = scope.filter(); f.insert("archived", doc!{"$ne": true}); f }`.
   GET/PATCH/DELETE read `projectId` from a `ScopeQuery`
   (`#[derive(Deserialize)] struct ScopeQuery { project_id: Option<String> }`,
   camelCase) merged into the existing query structs; POST reads
   `input.project_id` (already present on all gen-1 create DTOs:
   `CreateEmployeeInput.project_id`, `CreateAttendanceInput.project_id`,
   `CreateLeaveTypeInput/CreateLeaveApplicationInput.project_id`,
   `CreatePayrollRunInput.project_id`, `CreateHolidayInput.project_id`;
   ADD it to gen-2 create DTOs).
   Under `ScopeMode::User`, create keeps stamping `projectId` from
   the optional body value / minted ObjectId exactly as today (behaviour
   freeze); under `ScopeMode::Project` the body `projectId` is mandatory and
   the stamped `userId` remains `AuthUser.user_id` (auditing).
3. **Cross-collection reads** inside handlers (payroll compute reads
   `crm_employees` + `crm_salary_structures`; payslip generation reads the
   run) must use `scope.filter()` — not `userId` — so a Project-mounted
   compute only sees that project's roster.
4. **Tests**: each crate keeps its dto round-trip tests; add one test per
   crate asserting `project_router` rejects a request without `projectId`
   (mirror `crm-core/src/scope.rs` tests).

### Work items WI-1 … WI-15 (engine)

| WI | Crate / file | Work |
|---|---|---|
| WI-1 | `crm-employees` | ScopeMode refactor + `project_router`. |
| WI-2 | `crm-attendance` | Same; `punch_in`/`punch_out` (`PunchInput`: `employee_id★`, `at?`, `lat?`, `lng?`, `ip?`, `device?`, `selfie_file_id?`, `source?`) become scope-aware. |
| WI-3 | `crm-leaves` | Same for both subtrees + `approve_leave_application`. |
| WI-4 | `crm-holidays` | Same. |
| WI-5 | `crm-payroll-runs` | Same + scope-aware compute/approve/disburse (cross-collection filters per §3.3) + graceful-skip on structure shape mismatch (§2.1.2). |
| WI-6 | `crm-payroll-runs` | Formula parser: add `min(a,b)`/`max(a,b)` support in `parse_atom` + unit tests incl. the PF formula `min(basic, 15000) * 0.12`. |
| WI-7 | `crm-payroll-runs` + `crm-payslips` | New `POST /{runId}/generate-payslips`: run must be `approved|disbursed`; for each `EmployeeRunRow` write one rich `hrm_payroll_types::Payslip` into `crm_payslips` (employee snapshot from `crm_employees`, header from payroll settings' `companyName`, `netPayInWords` via a small int-to-words helper, masked bank from `Employee.personal.bank`); idempotent per (runId, employeeId) via upsert filter. |
| WI-8 | `crm-salary-structures` | Re-scope + **rich-model CRUD** for Project mode (§2.1.2): new DTOs mirroring `SalaryStructure` (`name★`, `effectiveDate★`, `components[]` of `SalaryComponent {name, code, type: earning\|deduction\|reimbursement, calc: {kind: fixed\|percent_basic\|percent_ctc\|formula, …}, taxable, statutory, prorate, frequency: monthly\|quarterly\|annually, maxCap?, minCap?}`, `applicableTo[]` of `{kind: employee\|department\|grade, id}`, `active`). Legacy flat CRUD untouched on User mount. |
| WI-9 | `crm-payslips` | Re-scope; Project-mode list/get reads BOTH shapes (deserialize `Document`, branch on presence of `runId`) returning a unified DTO; rich payslips are read-only (created by WI-7); add `POST /{payslipId}/mark-sent`. |
| WI-10 | `crm-shifts` | Add `project_id` to `CrmShift` + create DTO; ScopeMode refactor + `project_router`. |
| WI-11 | `crm-shift-rotations` | Same recipe as WI-10 for `CrmShiftRotation`. |
| WI-12 | `crm-shift-change-requests` | Same recipe + **mount the crate at all** (it is currently dead code): legacy `/v1/crm/shift-change-requests` + project mount. Keep its intentional snake_case wire fields (`employee_id`, `current_shift_id`, `requested_shift_id`, `effective_date`, `approver_id`, `approved_at`, `response_notes`) — the TS client `src/lib/rust-client/crm-shift-change-requests.ts` already speaks it. |
| WI-13 | `crm-time-logs` | Same recipe for `CrmTimeLog` (note: it already has an UNRELATED `project_id` FK meaning "CRM project entity" — name the new tenant field `workspaceProjectId`? NO — instead reuse the crm-core convention: rename existing field stays `projectId` (it is the *work* project) and the tenant scope field must be added as `scopeProjectId`… **Decision:** to avoid a wire break, add tenant field as `tenantProjectId` in Mongo via serde rename, and have `TenantScope::Project` filtering for time-logs use a crate-local filter key override. Simplest compliant approach: in `crm-time-logs` handlers, when mode is Project, filter `{ tenantProjectId: oid }` and stamp it on create. Document this exception in the crate docstring. |
| WI-14 | `crm-payroll-settings` | Re-scope `CrmPayrollSetting` (singleton-per-scope: `GET /` returns the scope's single doc, `PUT /` upserts). Fields: `companyName?`, `pfRate?`, `esiRate?`, `payCycle: monthly\|weekly\|biweekly`, `taxSlabs[]` (`{min,max,rate}` docs), `defaultCurrency?`, `status`. |
| WI-15 | `rust/crates/api/src/router.rs` | Mount everything (after line 935 block): `.nest("/v1/sabcrm/people/employees", crm_employees::project_router::<AppState>())` and likewise `attendance`, `leaves`, `holidays`, `payroll-runs`, `payslips`, `salary-structures`, `payroll-settings`, `shifts`, `shift-rotations`, `shift-change-requests`, `time-logs`. Plus legacy-alias fixes from §2.1.1 (`/v1/crm/employees`, `/v1/crm/attendance`, `/v1/crm/leaves` → same user routers) and the missing `/v1/crm/shift-change-requests` mount. |

---

## 4. TS plumbing

### 4.1 Rust-client (WI-16)

New file `src/lib/rust-client/sabcrm-people.ts` (mirrors
`src/lib/rust-client/sabcrm-finance.ts` style): one namespace per entity,
every method takes `projectId` and appends `?projectId=` (GET/PATCH/DELETE)
or injects into the body (POST). Re-export the existing doc types from the
legacy clients (`CrmEmployeeDoc` from `crm-employees.ts`, etc.) — they are
already camelCase-faithful to the models. Add the missing types: rich
`SabcrmSalaryStructureDoc` (components/applicableTo per WI-8) and rich
`SabcrmPayslipDoc` (per `hrm_payroll_types::payslip.rs`).

Base paths: `/v1/sabcrm/people/<entity>` exactly as WI-15.

### 4.2 Server actions (WI-17 … WI-22)

Six action files in `src/app/actions/` (+ `.types.ts` siblings), all using
the invoices gate verbatim and `revalidatePath` on their routes:

| File | Entities | Key exports (names are binding) |
|---|---|---|
| `sabcrm-people-employees.actions.ts` | employees | `listSabcrmEmployeesPage`, `getSabcrmEmployee`, `createSabcrmEmployee`, `updateSabcrmEmployee`, `deleteSabcrmEmployee`, `searchSabcrmEmployees` (picker: label = `displayName ?? firstName+lastName`, meta = `employeeId · workEmail`), `searchSabcrmDepartments`, `searchSabcrmDesignations` (over `/v1/crm/departments|designations` via `crmDepartmentsApi`), `getSabcrmEmployeeKpis` (headcount, active, on-leave, joiners-this-month). |
| `sabcrm-people-attendance.actions.ts` | attendance | `listSabcrmAttendancePage`, `getSabcrmAttendance`, `createSabcrmAttendance`, `updateSabcrmAttendance`, `deleteSabcrmAttendance`, `punchInSabcrm`, `punchOutSabcrm`, `getSabcrmAttendanceKpis` (present/absent/late today). |
| `sabcrm-people-leave.actions.ts` | leave types + applications | `listSabcrmLeaveTypesPage`, `saveSabcrmLeaveType`, `deleteSabcrmLeaveType`, `listSabcrmLeaveApplicationsPage`, `getSabcrmLeaveApplication`, `createSabcrmLeaveApplication`, `updateSabcrmLeaveApplication`, `approveSabcrmLeaveApplication`, `deleteSabcrmLeaveApplication`, `searchSabcrmLeaveTypes` (picker). |
| `sabcrm-people-shifts.actions.ts` | shifts, rotations, change requests, holidays | full CRUD per entity + `searchSabcrmShifts` (picker), `approveSabcrmShiftChange` (PATCH status + `approver_id` + `approved_at` + `response_notes`). |
| `sabcrm-people-payroll.actions.ts` | salary structures, payroll runs, payslips, settings | structures CRUD (rich shape), `listSabcrmPayrollRunsPage`, `getSabcrmPayrollRun`, `createSabcrmPayrollRun`, `updateSabcrmPayrollRun`, `deleteSabcrmPayrollRun`, `computeSabcrmPayrollRun`, `approveSabcrmPayrollRun`, `disburseSabcrmPayrollRun`, `generateSabcrmPayslips`, `listSabcrmPayslipsPage`, `getSabcrmPayslip`, `markSabcrmPayslipSent`, `getSabcrmPayrollSettings`, `saveSabcrmPayrollSettings`, `searchSabcrmSalaryStructures` (picker), `getSabcrmPayrollKpis`. |
| `sabcrm-people-time.actions.ts` | time logs | `listSabcrmTimeLogsPage`, `saveSabcrmTimeLog`, `deleteSabcrmTimeLog`, `startSabcrmTimer`, `stopSabcrmTimer`. |

**Display-readiness rule** (copied from invoices): list actions resolve FK
labels server-side (batch `$in` fetch of employees/shifts/leave-types, build
`Map<id,label>`) and return rows with `employeeLabel`, `shiftLabel`,
`leaveTypeLabel` etc. — raw ObjectIds never reach the client.

### 4.3 Navigation (WI-23)

`src/components/sabcrm/sabcrm-suite-frame.tsx`:

- In the `entries` array (starts line 252) add a `people` group after
  `commerce` entries: `{ group: 'people', id: 'employees', label: 'Employees', href: '/sabcrm/people/employees', icon: Users }`,
  then `attendance` (icon `CalendarCheck` — add lucide import), `leave`
  (`CalendarOff`), `holidays` (`CalendarDays`), `shifts` (`Clock`),
  `shift-rotations` (`RefreshCw`), `shift-changes` (`Shuffle` already
  imported), `salary-structures` (`Layers`), `payroll-runs` (`Banknote`),
  `payslips` (`ReceiptText`), `time-logs` (`Timer`), `people-settings`
  (`Settings`, href `/sabcrm/people/settings`).
- In the grouped-result builder (~line 380) push
  `{ id: 'people', label: 'People', items: entries.filter(e => e.group === 'people').map(toLeaf) }`
  between `commerce` and `insights`.
- Note: `FALLBACK_OBJECTS` already contains a `people` **object slug**
  (the person records object) — unrelated; do not touch.

---

## 5. Per-entity world-class surface specs (WI-24 … WI-36)

All under `src/app/sabcrm/people/<entity>/` with the invoices file split:
`page.tsx` (server, force-dynamic, parallel initial fetch) +
`<entity>-config.ts` + `<entity>-client.tsx` (+ `[id]/page.tsx` +
`[id]/<entity>-detail-client.tsx` where a detail page is specified). The
doc-surface kit is imported via a relative path
`../../finance/_components/doc-surface` — **first promote the kit**: move is
NOT required; finance kit files are already app-internal and importable.
(If the build agent prefers, re-export it from
`src/app/sabcrm/_components/doc-surface.ts` as a thin barrel — one line per
export — and import that from People surfaces.)

### WI-24 `/sabcrm/people/employees` — flagship

- **Model truth**: `rust/crates/hrm-payroll-types/src/employee.rs`. All
  fragments flatten to the document root (camelCase wire).
- **List columns** (`DocListColumn<SabcrmEmployeeRow>`): `employeeId` (text),
  employee (party — `displayName`, meta workEmail), `designation` (text),
  department (party — resolved label), `employmentType` (badge:
  `full_time|part_time|contract|intern|consultant`), `joiningDate` (date),
  `ctc` (money, INR), `status` (status). Statuses
  (`EMPLOYEE_STATUSES`): `active`/success, `on_leave`/warning,
  `terminated`/danger, `resigned`/neutral. KPI strip via
  `getSabcrmEmployeeKpis`.
- **Toolbar filters**: q (firstName/lastName/displayName/workEmail/employeeId
  per `crm-employees/src/dto.rs` ListQuery), status, department
  (partyFilter → `searchSabcrmDepartments`), date range = joiningDate.
- **Create/edit form** (drawer or `/new` page; FULL create-DTO field set,
  grouped):
  1. *Identity*: salutation, firstName★, middleName, lastName★, displayName,
     dob★ (date), gender (select: male/female/non_binary/other/
     prefer_not_to_say), maritalStatus, bloodGroup, nationality, languages
     (tag input), photoFileId (SabFilePickerButton).
  2. *Contact*: personalEmail, personalPhone, workEmail★, workPhone,
     extension, emergencyContact {name, phone, relation}, address.current /
     address.permanent (street/city/state/zip per `crm_sales_types::Address`).
  3. *Employment*: joiningDate★, confirmationDate, probationEnd,
     employmentType, departmentId★ (EntityPicker), designationId★
     (EntityPicker), reportingManagerId (EntityPicker → employees),
     dottedLineManagerId (EntityPicker → employees), workLocation, shiftId
     (EntityPicker → shifts), noticePeriodDays, status.
  4. *Compensation*: salaryStructureId★ (EntityPicker → salary structures),
     ctc, variablePct.
  5. *Statutory & bank* (PATCH-only section; create-DTO doesn't carry them —
     the detail page edits them via `updateSabcrmEmployee`): identityDocs
     {aadhaarMasked, pan, passportNo, passportExpiry, drivingLicence,
     voterId}, uan, esicNo, bank {accountNo★, ifsc★, bankName★, branch,
     nameOnAccount★}.
- **Detail page** `/sabcrm/people/employees/[id]` — tabbed (20ui `Tabs`):
  *Profile* (all personal+contact), *Employment* (all employment incl.
  exitDate/exitReason when set), *Compensation* (structure link + ctc +
  variablePct), *Documents* (offerLetterFileId, appointmentFileId,
  contractFileId, ndaFileId, kycFiles[], educationCertFiles[],
  idProofFiles[], visa {number, visaType, issued, validTill, country},
  workPermitFileId — every slot a SabFiles picker), *Skills & history*
  (skills[{name,level}], certifications[{name,issuer,issued,expiry,fileId}],
  education[{institution,degree,fieldOfStudy,start,end,grade}],
  pastEmployment[{company,role,start,end,reasonForLeaving}]),
  *Activity* (attendance last 30d + leave applications + payslips for this
  employee — three `DocRelatedRef` lists in a rail). Header: StatusFlow
  (flow `['active']`, off-path pills handle the rest) + ConvertMenu:
  "Mark on leave", "Mark resigned", "Mark terminated" (status PATCHes,
  danger), "Punch in today" (calls `punchInSabcrm`), "View payslips".

### WI-25 `/sabcrm/people/attendance`

- Model: `hrm_payroll_types::attendance.rs`. Statuses: `present`/success,
  `absent`/danger, `half_day`/warning, `leave`/info, `holiday`/neutral,
  `wfh`/info. Sources: `manual|biometric|web|mobile`.
- List columns: date (date), employee (party), shift (text — resolved
  label), punchIn.at (text `HH:mm`), punchOut.at (text), totalHours (text),
  overtimeHours (text), lateByMinutes (badge, warning when >0), status
  (status), source (badge).
- Toolbar: employee partyFilter, status, date range (maps to
  ListQuery `dateFrom/dateTo` — note dto camelCase `date_from`).
- Form (full `CreateAttendanceInput`): date★, employeeId★ (picker),
  status★, shiftId (picker), punchIn {at, lat, lng, ip, device,
  selfieFileId (SabFiles)}, punchOut {same}, breaks[] (in/out time-pair
  repeater), totalHours, overtimeHours, lateByMinutes, earlyOutByMinutes,
  source (select), approverId (employee picker), notes (textarea).
- Header actions: "Punch in" / "Punch out" buttons opening a mini-dialog
  (employeeId picker + optional selfie via SabFiles + geolocation consent)
  → `punchInSabcrm`/`punchOutSabcrm`.
- Detail: row-expand drawer (no separate route) showing every field incl.
  both PunchPoints and the breaks table.

### WI-26 `/sabcrm/people/leave` (tabbed: Applications | Types)

- **Applications** (default tab). Statuses: `pending`/warning,
  `approved`/success, `rejected`/danger, `cancelled`/neutral; flow
  `['pending','approved']`.
  Columns: employee (party — via `Assignment.assignedTo`? NO: the
  application's employee is `identity.userId`-adjacent; the create DTO has
  optional `employee_id` — list rows must resolve and display it), leave
  type (party — `leaveTypeId` label), from (date), to (date), days (text),
  halfDay (badge), balanceSnapshot (text), status (status).
  Form: leaveTypeId★ (picker), employeeId (picker — admin applying on
  behalf), from★, to★, halfDay (switch), reason (textarea), attachments[]
  (SabFiles). `days` is server-computed — display read-only preview.
  Detail drawer: full approverChain[] timeline ({approverId → label,
  status, decidedAt, comment}) + Approve action (`ConvertMenu`: Approve /
  Reject with comment → `approveSabcrmLeaveApplication`).
- **Types**: columns code, name, paid (badge), accrualRule (text),
  maxBalance, carryForward (badge), encashable (badge), genderRestricted,
  minServiceMonths. Form = all nine fields (`CreateLeaveTypeInput`).

### WI-27 `/sabcrm/people/holidays`

- Model `hrm_payroll_types::holiday.rs`. Columns: date (date), name (text),
  holidayType (badge: national/regional/religious/optional/restricted),
  recurring (badge), applicableLocations (text join), notes (text).
  Toolbar: year filter (ListQuery `year`), holidayType. Form: date★, name★,
  holidayType, recurring (switch), applicableLocations (tag input), notes.
  Bulk action: delete. No detail route (drawer edit).

### WI-28 `/sabcrm/people/shifts`

- Model `crm-shifts/src/types.rs::CrmShift`. Columns: name, code,
  startTime–endTime (text), breakMinutes, graceMinutes, isNightShift
  (badge), workingDays (text join), departments (text — resolved labels),
  isDefault (badge), status (status: `active`/success, `archived`/neutral).
  Form (full `CreateShiftInput`): name★, code, startTime★/endTime★ (time
  inputs HH:MM), breakMinutes, graceMinutes, isNightShift, workingDays
  (Mon–Sun checkbox row), color (color input), description, isDefault,
  departmentIds[] (multi EntityPicker), isActive.

### WI-29 `/sabcrm/people/shift-rotations`

- Model `CrmShiftRotation`. Columns: name, target (party — employee OR
  department OR team label), cycleDays, startDate (date), endDate (date),
  isActive (badge), status (status: active/success, paused/warning,
  completed/info, archived/neutral). Form: name★, description, exactly-one-of
  employeeId/departmentId/teamId (segmented picker), cycleDays★,
  startDate★, endDate, pattern[] editor — repeater of `{dayOffset (0-based),
  shiftId (EntityPicker), isOff (switch)}` validating offsets `< cycleDays`,
  isActive, status.

### WI-30 `/sabcrm/people/shift-changes`

- Model `CrmShiftChangeRequest` (snake_case wire — keep field names).
  Statuses: pending/warning, approved/success, rejected/danger,
  cancelled/neutral; flow `['pending','approved']`. Columns: employee
  (party — `employee_name` cached), current shift, requested shift,
  effective_date (date), reason, status, approver. Form: employee_id★
  (picker — store id AND cache `employee_name`), current_shift_id★ +
  requested_shift_id★ (shift pickers, cache names), effective_date★,
  reason. ConvertMenu on row drawer: Approve / Reject (+ response_notes
  prompt) → `approveSabcrmShiftChange`.

### WI-31 `/sabcrm/people/salary-structures` (rich shape — WI-8)

- Columns: name, effectiveDate (date), components (text — `n components`),
  earnings/deductions split (text), applicableTo (text summary), active
  (badge). Form: name★, effectiveDate★, active,
  **components repeater** — per row: name★, code★ (uppercase),
  type (select earning/deduction/reimbursement), calc kind (select fixed /
  percent_basic / percent_ctc / formula) with conditional input (amount |
  pct | expr), taxable / statutory / prorate (switches), frequency,
  minCap / maxCap; **applicableTo repeater** — kind (employee/department/
  grade) + conditional EntityPicker or grade text. Detail drawer previews a
  computed example (call a tiny client-side mirror of `resolve_amount` for
  display only; server stays source of truth).

### WI-32 `/sabcrm/people/payroll-runs` + `[id]` detail — flagship #2

- Statuses (`PAYROLL_RUN_STATUSES`): `draft`/neutral,
  `processing`/info, `approved`/warning, `disbursed`/success,
  `closed`/neutral. Flow: `['draft','approved','disbursed','closed']`
  (`processing` renders off-path).
- List columns: period (text `periodFrom – periodTo`), payDate (date),
  lockDate (date), employees (text `totals.employeeCount`), gross (money),
  net (money), ctc (money), bankFileFormat (badge: neft/imps/rtgs/upi_bulk),
  status (status). KPIs: total net this FY, last run net, headcount paid,
  next pay date.
- Create form (full `CreatePayrollRunInput`): periodFrom★, periodTo★,
  payDate, lockDate, bankFileFormat (select).
- **Detail page** uses `DocDetailPage`: `docNumber` = period label;
  `meta` = payDate, lockDate, bankFileFormat, bankFileId, approvals count;
  `lines` = one `DocDetailLine` per `EmployeeRunRow` (description =
  resolved employee label, qty 1, rate = gross, total = net);
  `totals` = {subTotal: totals.gross, discountTotal: gross − net (deduction
  roll-up), total: totals.net}; `railExtra` = approvals timeline
  (`ApprovalStep {approverId, status, decidedAt, comment}`) + per-employee
  expandable earnings/deductions/reimbursements tables; `related` =
  generated payslips (`DocRelatedRef` children → `/sabcrm/people/payslips/[id]`).
  `actions`: `ConvertMenu` — **Compute** (enabled in draft/processing →
  `computeSabcrmPayrollRun`), **Approve** (draft, with comment →
  `approveSabcrmPayrollRun`), **Disburse** (approved →
  `disburseSabcrmPayrollRun`), **Generate payslips** (approved/disbursed →
  `generateSabcrmPayslips`, group:true), **Delete** (draft only, danger).

### WI-33 `/sabcrm/people/payslips` + `[id]`

- List (unified DTO per WI-9): period (text `periodLabel` or
  `payPeriod`), employee (party), gross (money), deductions (money), net
  (money), sent (badge), locked (badge), status (status — flat shape only).
  Toolbar: employee filter, run filter, date range.
- Detail `[id]` for rich payslips uses `DocDetailPage`: party = employee
  snapshot (name, meta designation · department · employmentId), meta =
  PAN, UAN, ESIC, joiningDate, periodLabel, netPayInWords; lines =
  earnings (+) and deductions (−, render via two line groups);
  totals = {subTotal: gross(sum earnings), total: netPay}; railExtra =
  `attendanceSummary` (workingDays/present/leaves/holidays/lop),
  `ytd` (gross/net/taxPaid), `leaveBalanceSnapshot` map,
  `bankInfoSnapshot` (masked), `downloadedLog`. Actions: Mark sent,
  Print (window.print — the kit's paper layout is print-friendly).

### WI-34 `/sabcrm/people/time-logs`

- Model `CrmTimeLog`. Statuses: running/info, stopped/neutral,
  approved/success, rejected/danger, archived/neutral. Columns: employee
  (party — `userLogId` resolved), work item (text — resolved
  task/project/issue label or `entityKind`), startedAt (date+time),
  endedAt, durationMinutes (text h:mm), isBillable (badge), hourlyRate
  (money), amount (money — duration × rate, computed in row mapper),
  status. Header: **Start timer** (description + optional links) /
  table-row **Stop**. Form (full DTO): userLogId (employee picker),
  projectId/taskId/issueId or (entityKind + entityId), startedAt, endedAt,
  durationMinutes, description, isBillable, hourlyRate, status. Approve /
  Reject bulk actions (PATCH `status`, `approved_by`, `approved_at`).

### WI-35 `/sabcrm/people/settings`

- Single-card form (no DocListPage): `getSabcrmPayrollSettings` →
  companyName, pfRate, esiRate, payCycle (select monthly/weekly/biweekly),
  defaultCurrency, taxSlabs[] repeater ({min, max, rate}), status.
  Save → `saveSabcrmPayrollSettings` (upsert).

### WI-36 People overview `/sabcrm/people` (page.tsx)

- KPI dashboard: headcount, attendance today, pending leave
  approvals, pending shift changes, next payroll run; quick links into each
  surface. Mirrors `/sabcrm/finance/page.tsx` composition.

---

## 6. Payroll-run fixture verification (WI-37) — REQUIRED before sign-off

Payroll math cannot be eyeballed. Add
`scripts/sabcrm-people-e2e.mjs` cloned from `scripts/sabpay-e2e.mjs`
(JWT mint: HS256, `sub` = 24-hex, `iss: 'sabnode-bff'`, secret from
`rust/.env` `RUST_JWT_SECRET`; engine `http://localhost:8080`). Drive the
project-scoped mounts with a fixed `projectId` and assert exact numbers:

1. **Seed**: payroll settings (payCycle monthly); department; rich salary
   structure "E2E Eng 2026" with components —
   BASIC earning `percent_ctc 40`, HRA earning `percent_basic 50`,
   SPECIAL earning `formula "monthlyCtc - basic - basic * 0.5"`,
   PF deduction `formula "min(basic, 15000) * 0.12"` maxCap 1800 statutory,
   PT deduction `fixed 200`; two employees (ctc 1,200,000 and 600,000,
   status active, salaryStructureId = seeded structure).
2. **Run**: create run (periodFrom/periodTo = current month), `POST
   /{runId}/compute`, then assert per-employee rows EXACTLY:
   - emp A (monthlyCtc 100,000): basic 40,000; hra 20,000; special 40,000;
     pf min(40000,15000)·0.12 = 1,800 (cap no-op); pt 200; gross 100,000;
     net 98,000; ctc 100,000.
   - emp B (monthlyCtc 50,000): basic 20,000; hra 10,000; special 20,000;
     pf 1,800; pt 200; gross 50,000; net 48,000.
   - totals: gross 150,000 / net 146,000 / employeeCount 2.
   (If WI-6 lands without `min()`, PF asserts change to the documented
   fallback — the script must FAIL loudly on silent-zero formulas: assert
   pf > 0.)
3. **Lifecycle**: approve (assert status `approved`, approvals[0] stamped);
   disburse (assert `disbursed` + `bankFileId` present; re-disburse → 409);
   generate-payslips (assert 2 payslips with `runId`, netPay matches row
   net, `netPayInWords` non-empty, masked account); compute on a
   `disbursed` run → 409; second compute idempotency from `processing`.
4. **Scope isolation**: same calls with a second `projectId` see ZERO
   employees/runs; request without `projectId` → 4xx (`sabcrm_project_oid`).
5. **Legacy-shape resilience**: insert one FLAT `CrmSalaryStructure` doc
   into `crm_salary_structures` for the project, point a third employee at
   it, recompute — run must succeed, skip the employee, and keep totals for
   the other two (graceful-skip from WI-5).

Browser smoke (after surfaces land): Playwright spec
`tests/sabcrm-people.spec.ts` — create employee via the full form, run the
payroll lifecycle from the run detail ConvertMenu, open the generated
payslip paper page. (Needs a real Mongo user/session — same caveat as the
SabPay local stack.)

---

## 7. Execution order

1. **Engine**: WI-1…WI-15 (WI-6/7/8 are the only net-new logic; the rest is
   the mechanical ScopeMode recipe). `cargo test -p <crate>` per crate;
   `cargo check -p sabnode-api` after WI-15.
2. **Fixture harness**: WI-37 steps 1–4 against the engine BEFORE building
   UI (engine on :8080 per the SabPay local-stack runbook).
3. **Plumbing**: WI-16…WI-23.
4. **Surfaces**: WI-24 (employees) first — it produces the shared pickers
   every other surface imports; then WI-31/WI-32/WI-33 (payroll spine);
   then WI-25…WI-30, WI-34…WI-36 in any order (parallelisable).
5. Re-run WI-37 incl. step 5 + Playwright smoke; `graphify update .`.

## 8. Risk register

- **R1 (high)**: salary-structure schema collision 500s payroll compute on
  mixed data (§2.1.2) — graceful-skip in WI-5 is mandatory, not optional.
- **R2 (high)**: formula engine silently zeroes unsupported functions
  (`min`/`max`) → understated deductions and WRONG NET PAY with the
  documented PF formula. WI-6 + the `pf > 0` fixture assert are the guard.
- **R3 (medium)**: gen-2 re-scope means legacy user-scope rows are invisible
  on project mounts (no `projectId`). Accepted for P7 (clean-start), but the
  build agent must not "fix" it by falling back to userId filters — that
  would cross-tenant-leak. Any backfill is a separate migration task.
- **R4 (medium)**: `crm-time-logs` field collision — `projectId` already
  means "CRM project entity" on that document; tenant scope must use the
  crate-local `tenantProjectId` exception (WI-13) or data corrupts.
- **R5 (medium)**: rust-client `/v1/crm/employees|attendance|leaves` 404s
  also affect the LEGACY HRM pages today; the alias mounts in WI-15 change
  legacy behaviour (pages start working) — QA the old
  `/dashboard/hrm/payroll/*` pages after mounting.
- **R6 (low)**: `crm-shift-change-requests` was never mounted; its TS client
  has never run against the engine — expect first-contact wire bugs
  (snake_case body) when WI-12 lands; the dto tests cover casing.
- **R7 (low)**: payslip "unified DTO" (WI-9) must branch on `runId`
  presence; getting this wrong renders empty payslip lists even though
  documents exist.
- **R8 (process)**: payroll money is f64 end-to-end (engine convention);
  keep TS display via `formatDocMoney` and never re-derive totals client-side.

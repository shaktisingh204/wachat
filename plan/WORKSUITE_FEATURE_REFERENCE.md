# WORKSUITE — Complete Feature Reference

> Exhaustive scan of the Laravel Worksuite codebase at `/Users/harshkhandelwal/Downloads/script/`
> **193 controllers, 243 models, 24+ modules, full multi-tenant SaaS.**
>
> This document is the implementation contract: same flow, same sidebar, same — and advanced — features.

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Top-Level Sidebar (EXACT order & conditions)](#2-top-level-sidebar-exact-order--conditions)
3. [Settings Sidebar (EXACT order & conditions)](#3-settings-sidebar-exact-order--conditions)
4. [Modules System (24+ pluggable modules)](#4-modules-system)
5. [Role & Permission System (deep)](#5-role--permission-system)
6. [Dashboard & My Calendar](#6-dashboard--my-calendar)
7. [Leads & Deals (CRM)](#7-leads--deals-crm)
8. [Clients](#8-clients)
9. [HR — Employees, Attendance, Leaves, Shifts, Holidays, Departments, Designations, Appreciations](#9-hr)
10. [Work — Contracts, Projects, Tasks, Sub-tasks, Time Logs](#10-work)
11. [Finance — Proposals, Estimates, Invoices, Payments, Credit Notes, Expenses, Bank Accounts](#11-finance)
12. [Products & Orders](#12-products--orders)
13. [Tickets (Helpdesk)](#13-tickets)
14. [Events, Notices, Messages](#14-events-notices-messages)
15. [Knowledge Base](#15-knowledge-base)
16. [Reports](#16-reports)
17. [GDPR](#17-gdpr)
18. [Settings — Every Tab](#18-settings)
19. [Public / Client Portal Routes](#19-public-client-portal-routes)
20. [Payment Gateways](#20-payment-gateways)
21. [Notifications & Events System](#21-notifications--events)
22. [Imports & Exports](#22-imports--exports)
23. [Database Schema (key tables)](#23-database-schema)
24. [Controller Inventory (all 193)](#24-controller-inventory)
25. [Model Inventory (all 243)](#25-model-inventory)
26. [SabNode Mapping (already built vs missing)](#26-sabnode-mapping)

---

## 1. ARCHITECTURE OVERVIEW

**Stack:** Laravel + Blade + Bootstrap 4 + jQuery + DataTables. Multi-tenant via `company_id` on every table.

**Authentication:** session-based (cookies), Passport optional for OAuth, social login (Google + others), 2FA (email + Google Authenticator).

**Multi-Tenancy:** `companies` table; every domain table has `company_id`. `HasCompany` trait auto-scopes queries.

**Module System:** 24+ modules enable/disable per company × per role (admin/employee/client) — see `Modules` & `ModuleSettings`.

**Permission System:** value-based per `(role, module_key, action)`:
- `1` = added (records they created)
- `2` = owned (records assigned to them)
- `3` = both
- `4` = all
- `5` = none

`UserPermission` table can override at the user level (`customised_permissions` flag).

**Currencies:** multi-currency, exchange rates, crypto support (0–8 decimals).

**File Storage:** local OR AWS S3 (configurable per company).

**Audit:** `added_by`, `last_updated_by` on every domain model + `EmployeeActivity` log + `TaskHistory`, `DealHistory`, etc.

**Soft Deletes:** `Project`, `Task`, `Ticket`, `Invoice`, `User` all use `SoftDeletes` so historical reports survive.

**Custom Fields:** `CustomFieldsTrait` on every domain model; admin-defined groups + fields per module.

**Notification Channels:** database, email (SMTP), Slack webhook, Pusher Beams (web push), browser push.

**Queue/Jobs:** Excel imports (`ImportEmployeeJob`, `ImportClientJob`, `ImportAttendanceJob`, `ImportExpenseJob`, `ImportProductJob`), DB backup, scheduled email.

---

## 2. TOP-LEVEL SIDEBAR (EXACT ORDER & CONDITIONS)

Source: `resources/views/sections/menu.blade.php`. Every item is permission-gated AND module-gated.

| # | Icon | Item | Children | Visible When |
|---|------|------|----------|--------------|
| 1 | house | **Dashboard** | • Private Dashboard<br>• Advanced Dashboard | Admin OR any `view_*_dashboard` = all |
| 2 | calendar-range | **My Calendar** | _(direct link)_ | Any of tasks/events/holidays/tickets/leaves modules enabled |
| 3 | person | **Lead** | • Lead Contact<br>• Deal | Not client + `leads` module + (`view_lead` or `view_deals` not none) |
| 4 | building | **Clients** | _(direct link)_ | Not client + `clients` module + `view_clients` not none |
| 5 | people | **HR** | • Employees<br>• Leaves<br>• Shift Roster<br>• Attendance<br>• Holidays<br>• Designation<br>• Department<br>• Appreciation | Not client + any of (employees/leaves/attendance/holidays) modules + permissions |
| 6 | briefcase | **Work** | • Contracts<br>• Projects<br>• Tasks<br>• Time Logs | Any of (contracts/projects/tasks/timelogs) modules + permissions |
| 7 | cash-coin | **Finance** | • Proposal<br>• Estimates<br>• Invoices<br>• Payments<br>• Credit Note<br>• Expenses<br>• Bank Account | Any of (estimates/invoices/payments/expenses/bankaccount/proposals) + permissions |
| 8 | basket | **Products** | _(direct link)_ | `products` module + `view_product` ≠ none (and purchase plugin NOT installed) |
| 9 | cart3 | **Orders** | _(direct link)_ | `orders` module + `view_order` ≠ none |
| 10 | headset | **Tickets** | _(direct link)_ | `tickets` module + `view_tickets` ≠ none |
| 11 | calendar-event | **Events** | _(direct link)_ | `events` module + `view_events` ≠ none |
| 12 | chat-left-text | **Messages** | _(direct link, with unread count badge)_ | `messages` module + (client_admin OR client_employee allowed) |
| 13 | lock | **GDPR** | _(direct link)_ | (admin OR client) + `enable_gdpr` = 1 |
| 14 | clipboard | **Notice Board** | _(direct link)_ | `notices` module + `view_notice` ≠ none |
| 15 | note | **Knowledge Base** | _(direct link)_ | `knowledgebase` module + `view_knowledgebase` ≠ none |
| 16 | journal-text | **Notes** | _(direct link, CLIENT ONLY)_ | Client role + `view_client_note` ≠ none |
| — | — | **(Plugin slots)** | dynamic | `worksuitePlugins` loop — `Modules/*` |
| 17 | graph-up | **Reports** | • Task Report<br>• Time Log Report<br>• Weekly Timesheet<br>• Finance Report<br>• Income vs Expense<br>• Leave Report<br>• Attendance Report<br>• Expense Report<br>• Deal Report<br>• Sales Report | `reports` module + any `view_*_report` = all |
| 18 | link | **Custom Links** | dynamic | `CustomLinkSetting` items with role-based visibility |
| 19 | gear | **Settings** | _(direct link → opens settings sidebar)_ | Always visible |

**Sidebar header:**
- Sidebar brand box with company logo + appName + user name
- Dropdown: profile link, "Invite Member" (if permission), dark theme toggle, logout
- "Raise Support Ticket" button (admin only)
- App version display
- Mobile-friendly collapse panel

---

## 3. SETTINGS SIDEBAR (EXACT ORDER & CONDITIONS)

Source: `resources/views/components/setting-sidebar.blade.php`. Every item gated by `user()->permission('manage_*_setting') == 'all'`.

| # | Setting | Permission | Module Gate |
|---|---------|-----------|-------------|
| 1 | **Account Settings** (Company) | `manage_company_setting` | always |
| 2 | **Business Addresses** | `manage_company_setting` | always |
| 3 | **App Settings** | `manage_app_setting` | always |
| 4 | **Profile Settings** | — | always (every user) |
| 5 | **Notification Settings** | `manage_notification_setting` | always |
| 6 | **Currency Settings** | `manage_currency_setting` | always |
| 7 | **Payment Gateway Credentials** | `manage_payment_setting` | always |
| 8 | **Finance Settings** (invoices/estimates) | `manage_finance_setting` | invoices/estimates/orders/leads/payments |
| 9 | **Contract Settings** | `manage_contract_setting` | contracts |
| 10 | **Tax Settings** | `manage_tax` | always |
| 11 | **Ticket Settings** | `manage_ticket_setting` | tickets |
| 12 | **Project Settings** | `manage_project_setting` | projects |
| 13 | **Attendance Settings** | `manage_attendance_setting` | attendance |
| 14 | **Leave Settings** | `manage_leave_setting` | leaves |
| 15 | **Custom Fields** | `manage_custom_field_setting` | always |
| 16 | **Roles & Permissions** | `manage_role_permission_setting` | always |
| 17 | **Message Settings** | `manage_message_setting` | messages |
| 18 | **Lead Settings** | `manage_lead_setting` | leads |
| 19 | **Time Log Settings** | `manage_time_log_setting` | timelogs |
| 20 | **Task Settings** | `manage_task_setting` | tasks |
| 21 | **Security Settings** | — | always |
| 22 | **Theme Settings** | `manage_theme_setting` | always |
| 23 | **Module Settings** | `manage_module_setting` | always |
| 24 | **Storage Settings** | `manage_storage_setting` | worksuite-only |
| 25 | **Language Settings** | `manage_language_setting` | worksuite-only |
| 26 | **Social Login** | `manage_social_login_setting` | worksuite-only |
| 27 | **Google Calendar** | `manage_google_calendar_setting` | worksuite-only |
| 28 | **Custom Links** | `manage_custom_link_setting` | worksuite-only |
| 29 | **GDPR Settings** | `manage_gdpr_setting` | worksuite-only |
| 30 | **Database Backup** | admin | worksuite-only |
| 31 | **Sign-up Settings** | `manage_company_setting` | worksuite-only |
| — | **(Plugin settings)** | dynamic | `Modules/*` |
| 32 | **Updates** | admin | system update enabled |

Settings sidebar has a **live keyword search** at the top.

---

## 4. MODULES SYSTEM

24 first-class modules, each can be **enabled/disabled per company × per role**:

```
clients, employees, projects, attendance, tasks, estimates,
invoices, payments, timelogs, tickets, events, notices,
leaves, leads, holidays, products, expenses, contracts,
reports, settings, orders, knowledgebase, bankaccount, messages
```

**Per-role visibility:**

| Role | Default modules |
|------|-----------------|
| **client** | projects, tickets, invoices, estimates, events, messages, tasks, timelogs, contracts, notices, payments, orders, knowledgebase |
| **employee** | projects, tasks, timelogs, leaves, attendance, events, expenses, messages, tickets, knowledgebase |
| **admin** | ALL (including: clients, employees, attendance, expenses, leaves, leads, holidays, products, reports, settings, bankaccount) |

**Module dependency check** — `Module::checkVersion()` ensures plugin compatibility.
**Custom modules** — Laravel Modules package; `Modules/<Name>/` directories with their own sidebar slots (`sections.sidebar`, `sections.hr.sidebar`, `sections.work.sidebar`, `sections.finance.sidebar`, `sections.setting-sidebar`).

---

## 5. ROLE & PERMISSION SYSTEM

### 5.1 Permission Value Scheme

Every `(role × module × action)` row stores one integer:

| value | meaning |
|------:|---------|
| 1 | **added** — records this user created |
| 2 | **owned** — records assigned to this user |
| 3 | **both** — added OR owned |
| 4 | **all** — every record in the tenant |
| 5 | **none** — no access |

Some toggles are simpler (all/none only) — e.g. `add_clients`, `manage_tax`.

### 5.2 Full Permission Matrix (Module → Actions)

#### Clients
`add_clients`, `view_clients`, `edit_clients`, `delete_clients`, `manage_client_category`, `manage_client_subcategory`, `add_client_contacts`, `view_client_contacts`, `edit_client_contacts`, `delete_client_contacts`, `add_client_notes`, `view_client_note`, `edit_client_notes`, `delete_client_notes`, `add_client_documents`, `view_client_document`, `edit_client_documents`, `delete_client_documents`

#### Employees
`add_employees`, `view_employees`, `edit_employees`, `delete_employees`, `manage_designation` (view/edit/delete), `manage_department` (view/edit/delete), `view_employee_documents`, `add_employee_documents`, `edit_employee_documents`, `delete_employee_documents`, `view_leaves_taken`, `update_leaves_quota`, `view_employee_tasks`, `view_employee_projects`, `view_employee_timelogs`, `change_employee_role`, `manage_emergency_contact`, `view_employee_menu`, `manage_award`, `view_appreciation`, `add_appreciation`, `edit_appreciation`, `delete_appreciation`, `view_immigration`, `add_immigration`, `edit_immigration`, `delete_immigration`, `view_increment_promotion`, `manage_increment_promotion`

#### Projects
`add_projects`, `view_projects`, `edit_projects`, `delete_projects`, `manage_project_category`, `add_project_files`, `view_project_files`, `delete_project_files`, `add_project_discussions`, `view_project_discussions`, `edit_project_discussions`, `delete_project_discussions`, `manage_discussion_category`, `add_project_milestones`, `view_project_milestones`, `edit_project_milestones`, `delete_project_milestones`, `view_project_members`, `add_project_members`, `edit_project_members`, `delete_project_members`, `add_project_rating`, `view_project_rating`, `edit_project_rating`, `delete_project_rating`, `view_project_budget`, `view_project_timelogs`, `view_project_expenses`, `view_project_tasks`, `view_project_invoices`, `view_project_estimates`, `view_project_burndown_chart`, `view_project_payments`, `view_project_gantt_chart`, `add_project_notes`, `view_project_notes`, `edit_project_notes`, `delete_project_notes`, `manage_project_templates`, `view_project_templates`, `view_project_hourly_rates`, `create_public_project`, `view_miroboard`, `manage_project_labels`

#### Attendance
`manage_employee_shifts`, `view_shift_roster`, `add_attendance`, `view_attendance`, `edit_attendance`, `delete_attendance`

#### Tasks
`add_tasks`, `view_tasks`, `edit_tasks`, `delete_tasks`, `view_task_category`, `add_task_category`, `edit_task_category`, `delete_task_category`, `view_task_files`, `add_task_files`, `delete_task_files`, `view_sub_tasks`, `add_sub_tasks`, `edit_sub_tasks`, `delete_sub_tasks`, `view_task_comments`, `add_task_comments`, `edit_task_comments`, `delete_task_comments`, `view_task_notes`, `add_task_notes`, `edit_task_notes`, `delete_task_notes`, `manage_task_labels`, `change_status`, `send_reminder`, `add_status`, `view_unassigned_tasks`, `create_unassigned_tasks`, `manage_recurring_task`

#### Estimates
`add_estimates`, `view_estimates`, `edit_estimates`, `delete_estimates`

#### Invoices
`add_invoices`, `view_invoices`, `edit_invoices`, `delete_invoices`, `manage_tax`, `link_invoice_bank_account`, `manage_recurring_invoice`

#### Payments
`add_payments`, `view_payments`, `edit_payments`, `delete_payments`, `link_payment_bank_account`

#### Timelogs
`add_timelogs`, `view_timelogs`, `edit_timelogs`, `delete_timelogs`, `approve_timelogs`, `manage_active_timelogs`, `view_timelog_earnings`

#### Tickets
`add_tickets`, `view_tickets`, `edit_tickets`, `delete_tickets`, `manage_ticket_type`, `manage_ticket_agent`, `manage_ticket_channel`, `manage_ticket_tags`, `manage_ticket_groups`

#### Events / Notices / Holidays / Leaves / Leads / Deals / Lead-Notes / Lead-Files / Lead-Sources / Lead-Categories / Lead-Agents / Lead-Follow-ups / Proposals / Products / Expenses / Contracts / Orders / Knowledge Base / Bank Accounts
(All have `add_*`, `view_*`, `edit_*`, `delete_*` + their own management permissions — see §5.2 raw list below)

#### Reports
`view_task_report`, `view_time_log_report`, `view_finance_report`, `view_income_expense_report`, `view_leave_report`, `view_attendance_report`, `view_expense_report`, `view_lead_report`, `view_sales_report`

#### Dashboards
`view_overview_dashboard`, `view_project_dashboard`, `view_client_dashboard`, `view_hr_dashboard`, `view_ticket_dashboard`, `view_finance_dashboard`

#### Settings (each setting page guarded individually)
`manage_company_setting`, `manage_app_setting`, `manage_notification_setting`, `manage_currency_setting`, `manage_payment_setting`, `manage_finance_setting`, `manage_ticket_setting`, `manage_project_setting`, `manage_attendance_setting`, `manage_leave_setting`, `manage_custom_field_setting`, `manage_message_setting`, `manage_storage_setting`, `manage_language_setting`, `manage_lead_setting`, `manage_time_log_setting`, `manage_task_setting`, `manage_social_login_setting`, `manage_security_setting`, `manage_gdpr_setting`, `manage_theme_setting`, `manage_role_permission_setting`, `manage_module_setting`, `manage_google_calendar_setting`, `manage_contract_setting`, `manage_custom_link_setting`

---

## 6. DASHBOARD & MY CALENDAR

### Dashboard Types (toggle widgets)
1. **Private (overview)** — `/account/dashboard`
2. **Advanced** — `/account/dashboard-advanced`
3. **Project Dashboard**
4. **Client Dashboard**
5. **HR Dashboard**
6. **Ticket Dashboard**
7. **Finance Dashboard**
8. **Employee (Member) Dashboard**
9. **Client Panel Dashboard**

### Widgets (configurable per dashboard)
- Project status counts (not_started / in_progress / on_hold / finished)
- Project completion progress bars
- Today's tasks (Kanban mini)
- Open tickets count by status
- Active timer (start/stop from dashboard)
- Week-wise timelog
- Active employee count
- Pending leaves count
- Upcoming birthdays / work anniversaries
- Latest discussions / notices / events
- Top performing projects (by hours / budget)
- Revenue this month, expense this month
- Pending invoices, unpaid amount
- New leads, won deals (last 30d)
- Upcoming follow-ups (deals)
- Activity feed (recent edits, comments)
- Calendar widget (private calendar)

**Dashboard endpoints:**
- `POST /dashboard/widget/{dashboardType}` — toggle widget on/off
- `POST /dashboard/week-timelog` — fetch week chart
- `GET /dashboard/lead-data/{id}` — deal stage data
- `GET /dashboard/private_calendar` — calendar view

### Clock In/Out (Attendance Modal from Dashboard)
- `GET /attendances/clock-in-modal`
- `POST /attendances/store-clock-in`
- `GET /attendances/update-clock-in` — clock-out
- `GET /attendances/show_clocked_hours`

### My Calendar
`GET /my-calendar`
Filters: Events, Holidays, Tasks, Tickets, Leaves, Deal Follow-ups. Color-coded; click any event → modal with details.

### Pusher Beams Push
`GET /pusher/beams-auth` — auth endpoint for browser push subscriptions.

---

## 7. LEADS & DEALS (CRM)

### 7.1 Lead Contact
**Route prefix:** `/account/lead-contact`. Model `Lead`.

**Fields:** company_name, website, address, salutation, client_name, client_email, mobile, cell, office, city, state, country, postal_code, note, next_follow_up, value, total_value, currency_id, category_id, source_id, status_id, agent_id, column_priority, hash, company_id.

**Operations:**
- CRUD (index, create, store, edit, update, destroy, show)
- Convert lead → client (creates User + ClientDetails)
- Bulk: delete / change status / assign agent
- Excel import (`LeadImport` + `ImportLeadJob`)
- Sort by next_follow_up / value
- Lead → Deal conversion
- Public lead form (`/lead-form/{id}`) — embeddable
- ReCAPTCHA on public form
- GDPR purpose consent linking

### 7.2 Deals (Pipeline Kanban)
**Routes:** `/deals` (index = pipeline board), `/lead-board` (alternative view). Model `Deal`.

**Fields:** name, lead_id, client_id, lead_pipeline_id, pipeline_stage_id, agent_id, deal_watcher, category_id, source_id, value, currency_id, close_date, next_follow_up, status_id, column_priority.

**Operations:**
- Kanban board with drag-drop stage change (`/deals/change-status`)
- Multiple pipelines per company (LeadPipeline) — choose pipeline before viewing board
- Custom stages per pipeline (PipelineStage with slug, color, priority, type)
- Won/Lost stages auto-populate close_date
- Deal watchers (subscribers)
- Multiple products attached (LeadProducts pivot)
- Deal notes (DealNote)
- Deal files (DealFile)
- Deal history (every change logged — DealHistory)
- Follow-ups (DealFollowUp) with auto-reminder events
- Bulk: delete, change stage, change agent, change source/category
- Excel import (`DealImport`) + export (`DealExport`)
- Quick-add client during deal creation
- Custom fields per deal

### 7.3 Lead Settings (under Settings → Lead Settings)
- **Lead Sources** — CRUD (LeadSourceSettingController)
- **Lead Categories** — CRUD (LeadCategoryController)
- **Lead Stages** (per pipeline) — CRUD (LeadStageSettingController)
- **Lead Pipelines** — CRUD (LeadPipelineSettingController) — default pipeline flag
- **Lead Agents** — assign users as agents per category (LeadAgentSettingController)
- **Custom Forms** — public-facing lead forms (LeadCustomForm) with custom fields
- **Public lead edit toggle**

### 7.4 Proposals
**Route:** `/proposals`. Model `Proposal`.

**Fields:** deal_id, valid_till, sub_total, total, discount, discount_type, currency_id, unit_id, status (waiting/accepted/rejected/converted), proposal_number, description, note, client_comment, signature_approval, send_status, invoice_convert, calculate_tax (before_discount/after_discount), ip_address, last_viewed, hash.

**Operations:**
- Create from template (ProposalTemplate + ProposalTemplateItem)
- Line items with images (ProposalItem + ProposalItemImage)
- Discount (fixed / %)
- Multiple taxes per line item
- E-signature requirement (ProposalSign)
- PDF download (DomPDF)
- Email send with `NewProposalEvent`
- Public client view via signed URL (`/proposal/{hash}`)
- Public actions: accept / reject (with comment)
- Auto-convert accepted proposal → invoice
- Client view tracking (IP + last_viewed)

---

## 8. CLIENTS

**Route prefix:** `/account/clients`. User-role = `client`.

**User fields:** name, email, mobile, password, image, gender, locale, status (active/deactive), admin_approval, email_notifications, country_id, country_phonecode, is_client_contact.

**ClientDetails fields:** user_id, company_name, website, address, shipping_address, postal_code, state, city, office, note, gst_number, linkedin, facebook, twitter, skype, category_id, sub_category_id, company_logo, electronic_address, electronic_address_scheme, quickbooks_client_id.

**Operations:**
- CRUD + bulk actions (`apply-quick-action`: delete / change status)
- Tabs on client detail: Profile, Projects, Invoices, Estimates, Credit Notes, Payments, Contracts, Notes, Documents, Contacts, Notifications, GDPR
- AJAX detail loading (`POST /clients/ajax-details/{id}`)
- Project list (`POST /clients/project-list/{id}`)
- Finance counts (`GET /clients/finance-count/{id}`)
- Excel import — multi-step: upload → process → progress
- Client contacts (ClientContact) — sub-users with portal access, separate login as a contact (`session('clientContact')`)
- Client notes (ClientNote) — password-protected option (`askForPassword` + `checkPassword`)
- Client documents (ClientDocument) — uploaded files
- Categories / sub-categories
- Approval workflow (`/approve/{id}`)
- GDPR consent (`/clients/gdpr-consent`, `/clients/save-client-consent/{lead}`)
- Active scope to filter deactivated users
- Client signup public route (configurable + admin approval)

---

## 9. HR

### 9.1 Employees
**Route:** `/employees`. Model `User` + `EmployeeDetails`.

**EmployeeDetails fields:** employee_id, user_id, address, hourly_rate, slack_username, telegram_user_id, department_id, designation_id, company_address_id, reporting_to, about_me, calendar_view, joining_date, last_date, date_of_birth, probation_end_date, notice_period_start_date, notice_period_end_date, contract_end_date, internship_end_date, employment_type (permanent / contract / internship / trainee / freelance), marital_status, marriage_anniversary_date.

**Detail tabs:**
- **profile** — basic info + custom fields
- **attendance** — monthly grid
- **leaves** — history + quota
- **tasks** — assigned tasks
- **projects** — member of
- **timelogs** — time tracking
- **tickets** — assigned
- **documents** — files (EmployeeDocument + EmployeeDocumentExpiry)
- **emergency-contacts** — EmergencyContact rows
- **increment-promotions** — Promotion (designation/department history)
- **appreciation** — awards received
- **leaves-quota** — EmployeeLeaveQuota per LeaveType
- **shifts** — ShiftRotation, EmployeeShiftSchedule
- **permissions** — UserPermission overrides
- **activity** — EmployeeActivity audit log
- **immigration** — Passport + VisaDetail

**Operations:**
- CRUD with role assignment (`employees/assignRole`)
- Bulk actions
- Invite via email link (`employees/invite-member` + `employees/send-invite` + `employees/create-link`)
- Excel import
- By-department lookup (`employees/byDepartment/{id}`)
- Skills tagging (FirstOrCreate on Skill model)
- Exit date message (`/get-exit-date-message`)

### 9.2 Attendance
**Route:** `/attendances`. Model `Attendance`.

**Fields:** user_id, clock_in_time, clock_out_time, clock_in_ip, clock_out_ip, latitude, longitude, working_from, work_from_type, location_id, late, half_day, half_day_type, employee_shift_id, shift_start_time, shift_end_time, overwrite_attendance, attendance (date).

**Features:**
- Monthly grid: Present / Late / Half-Day / Leave / Holiday / Day Off / Absent
- Multiple clock-ins per day (max via shift `clockin_in_day`)
- GPS tracking (lat/lng)
- IP logging
- Auto-late based on `halfday_mark_time`
- Half-day calculation
- Manual override (`overwrite_attendance`)
- QR code clock-in/out (configurable)
- Conflict detection on edit
- Timezone-aware (per company)
- Filters: department, designation, employee, date range
- Export to Excel (`AttendanceExport`, `AttendanceByMemberExport`)

### 9.3 Leaves
**Route:** `/leaves`. Models `Leave`, `LeaveType`, `EmployeeLeaveQuota`.

**Leave fields:** user_id, leave_type_id, leave_date, duration (full/half/multiple), half_day_type (first_half/second_half), unique_id (groups consecutive), reason, status (pending/approved/rejected), reject_reason, approve_reason, approved_by, approved_at, paid, manager_status_permission.

**LeaveType fields:** type_name, color, no_of_leaves (quota), paid, encashed, monthly_limit, over_utilization (allowed/not_allowed), effective_after, effective_type, unused_leave (carry forward policy).

**Eligibility rules per leave type:** allowed_probation, allowed_notice, gender, marital_status, department, designation, role (all JSON arrays).

**Operations:**
- Apply leave (with auto-validation: balance, no overlap, skip holidays, monthly limit)
- Manager pre-approval workflow (then HR approval)
- Approve / Reject with reason
- Bulk actions
- Leave calendar (`/leaves/calendar`)
- Personal leave view (employee's own quota)
- Excel export
- Leave quota management (`/employee-leaves/employeeLeaveTypes/{id}`)
- Leave period: company year_start OR employee joining_date
- Custom forms with files (LeaveFile)

### 9.4 Shifts & Shift Rotations
**Routes:** `/employee-shifts`, `/shift-rotations`. Models `EmployeeShift`, `ShiftRotation`, `EmployeeShiftSchedule`, `AutomateShift`, `EmployeeShiftChangeRequest`.

**Shift fields:** shift_name, shift_short_code, color, office_start_time, office_end_time, auto_clock_out_time, halfday_mark_time, late_mark_duration, clockin_in_day, office_open_days (JSON bitmask), early_clock_in, shift_type (fixed / flexible), flexible_total_hours, flexible_half_day_hours, flexible_auto_clockout.

**Features:**
- Default shift per company
- Per-day shift override via EmployeeShiftSchedule
- Shift rotation patterns (cycles, sequences)
- Auto-rotation (AutomateShift + RotationAutomateLog)
- Shift change requests (employee-initiated, manager-approved)
- Shift roster (grid view)
- Permission: `manage_employee_shifts`, `view_shift_roster`

### 9.5 Holidays
**Route:** `/holidays`. Model `Holiday`.

**Fields:** date, occassion, notification_sent, department_id_json, designation_id_json, employment_type_json, event_id (Google Calendar).

**Features:**
- Calendar OR table view
- Department/designation/employment-type scoping
- Google Calendar sync
- Auto-exclude from leave eligibility
- Marked in attendance grid

### 9.6 Departments (Teams)
Hierarchical (parent-child). Routes: `/departments`. Operations:
- Tree view with drag-drop reordering (`changeParent`)
- Search with hierarchy
- Get members
- Prevent circular relationships

### 9.7 Designations
Hierarchical. Routes: `/designations`. Same pattern as departments + employees.

### 9.8 Appreciations & Awards
**Routes:** `/awards` (types), `/appreciations` (given to employees).

**Award:** title, summary, color_code, status, awardIcon. **AwardIcon** = library of icons.
**Appreciation:** award_id, award_to (recipient), award_date, summary, image, added_by.

Permissions split: `manage_award` (configures types) vs `view/add/edit/delete_appreciation` (given to employees).

### 9.9 Emergency Contacts, Passport, Visa
Sub-features per employee. `EmergencyContact` (name, mobile, email, relation, address), `Passport` (number, issue/expiry), `VisaDetail` (visa_number, issue_date, expiry_date, country_id, alert_before_months, file). Expiry alerts.

### 9.10 Promotions / Increments
Tracks designation + department changes per employee (Promotion model). `view_increment_promotion`, `manage_increment_promotion` permissions.

---

## 10. WORK

### 10.1 Contracts
**Route:** `/contracts`. Model `Contract`.

**Fields:** client_id, project_id, subject, amount, currency_id, contract_name, contract_number, contract_type_id, start_date, end_date, description, contract_detail, contract_note, alternate_address (+ cell, office, city, state, country, postal_code), company_logo, company_sign, sign_date, sign_by, hash, event_id.

**Operations:**
- CRUD + bulk
- Templates (ContractTemplate) — clone-from-template
- Contract types (ContractType)
- Client signing (ContractSign: full_name, email, date, place, signature image)
- Company signing (admin)
- Renewals (ContractRenew with renewal_history)
- Discussions (ContractDiscussion + replies)
- Files (ContractFile)
- PDF download
- Expiration alerts (expired / about-to-expire counts)
- Public signing URL (`/contract/{hash}`, `/contract/sign/{id}`)
- Auto Google Calendar event on contract create

### 10.2 Projects
**Route:** `/projects`. Model `Project`.

**Fields:** project_name, project_short_code, project_summary, start_date, deadline, project_admin, client_id, team_id, status (not_started/in_progress/on_hold/finished/canceled), category_id, currency_id, project_budget, hours_allocated, completion_percent, calculate_task_progress, client_view_task, allow_client_notification, manual_timelog, public, public_gantt_chart, public_taskboard, need_approval_by_admin, client_access, enable_miroboard, miro_board_id, notes, feedback, hash.

**Project Detail Tabs:**
- **Overview** — summary + dashboard
- **Members** — ProjectMember with hourly_rate
- **Milestones** — ProjectMilestone with cost, budget impact
- **Tasks** — list + filters
- **Kanban / Taskboard** — by status columns
- **Gantt Chart** — task timeline with dependencies (GanttLink)
- **Files** — ProjectFile with permission control
- **Discussions** — threaded conversations
- **Notes** — ProjectNote (private/public)
- **Invoices** — project invoices
- **Estimates** — project estimates
- **Payments** — received payments
- **Expenses** — recorded expenses
- **Timelogs** — time tracked
- **Burndown Chart** — sprint-style burndown
- **Hourly Rates** — per-member rates
- **Activity** — ProjectActivity log
- **Issues** — Issue model (bugs)
- **Rating** — ProjectRating (client-facing)
- **Miroboard** — embedded whiteboard

**Operations:**
- CRUD + bulk (delete / archive / change_status)
- Duplicate project
- Templates (ProjectTemplate with milestones, tasks, sub-tasks, members)
- Public Gantt link (no auth)
- Public taskboard link
- Soft delete

### 10.3 Tasks
**Route:** `/tasks`. Model `Task`.

**Fields:** heading, description, start_date, due_date, completed_on, project_id, task_category_id, milestone_id, priority (low/medium/high/urgent), status (via TaskboardColumn), board_column_id, column_priority, is_private, billable, estimate_hours, estimate_minutes, dependent_task_id, repeat, repeat_count, repeat_type, repeat_cycles, recurring_task_id, approval_send, need_approval_by_admin, task_short_code, event_id, created_by, added_by.

**Operations:**
- CRUD + bulk (delete / change_status / change_milestone)
- Multi-user assignment (TaskUser pivot)
- Sub-tasks (SubTask + SubTaskFile)
- Comments (TaskComment + emoji reactions TaskCommentEmoji)
- Notes (TaskNote)
- Files (TaskFile)
- Labels (TaskLabel + TaskLabelList)
- Tags (TaskTag + TaskTagList)
- Pin to user (Pinned model)
- Approval workflow ("Waiting for Approval" column)
- Status reason on change (logged as comment)
- Auto-reminder (`/tasks/reminder`)
- Recurring tasks (parent → cycles → child instances)
- Task dependencies (Gantt links validated)
- Send-approval flow (`sendApproval`)
- Leave conflict check (`checkLeaves` warns if assignee on leave)
- History audit (TaskHistory)
- Custom fields
- Unassigned tasks view

### 10.4 Sub-tasks
SubTaskController: CRUD + status toggle + file uploads. Linked to Task.

### 10.5 Taskboard (Kanban)
**Route:** `/task-board` (per-project view; main `/tasks` has board view too).

**TaskboardColumn:** column_name, slug, label_color, priority, company_id. Default columns: incomplete, completed, waiting_approval. Admin can add custom columns.

**Features:**
- Drag-drop task between columns
- Drag-drop column priority
- Column collapse per user (UserTaskboardSetting)
- Load more pagination per column
- Public board link

### 10.6 Gantt Chart
- Bar timeline of tasks across project dates
- Drag bars to update start/due (`updateTaskDuration`)
- Drag dependency lines (GanttLink CRUD)
- Public read-only link (`/gantt-chart/{hash}`)

### 10.7 Time Logs
**Route:** `/timelogs`. Model `ProjectTimeLog`.

**Fields:** user_id, project_id, task_id, start_time, end_time, total_hours, total_minutes, total_break_minutes, memo, hourly_rate, earnings, approved, approved_by, rejected, rejected_by, rejected_at, reject_reason, edited_by_user, invoice_id.

**Operations:**
- Start / stop timer (one active timer per user)
- Manual entry (start + end dates)
- Pause / resume breaks (ProjectTimeLogBreak)
- Approval workflow (pending → approved/rejected)
- Reject with reason
- Bulk approval/rejection
- Earnings calculation: hourly_rate × total_hours
- Project hour limit enforcement (auto-stop timer)
- Date / project / employee filters
- Excel export per employee, per project
- Calendar view (TimelogCalendarController)
- Permission: `view_timelog_earnings` to see $ amounts
- Generate invoice from timelogs (timelog → invoice line items)

### 10.8 Weekly Timesheet
Model `WeeklyTimesheet` + `WeeklyTimesheetEntries`. Manager approval. Routes: `/weekly-timesheet`. Approval controller: `TimelogWeeklyApprovalController`.

---

## 11. FINANCE

### 11.1 Estimates
**Route:** `/estimates`. Model `Estimate`.

**Fields:** estimate_number, valid_till, sub_total, total, discount, discount_type, currency_id, status (draft/waiting/accepted/declined/canceled), client_id, project_id, description, note, send_status, calculate_tax, hash, last_viewed, ip_address, company_address_id, estimate_request_id.

**Workflow:**
- Draft → send (status=waiting) → client accepts/declines via public URL (`/estimate/{hash}`)
- AcceptEstimate captures signature (image or canvas signature)
- On accept → auto-create Invoice (with invoice_status=unpaid)
- PDF download with signature embed

**Templates:** EstimateTemplate + EstimateTemplateItem + images. Clone to new estimate.

**Estimate Requests:** EstimateRequest model — client requests an estimate; admin converts to actual estimate.

### 11.2 Invoices
**Route:** `/invoices`. Model `Invoice`.

**Fields:** invoice_number, custom_invoice_number, issue_date, due_date, last_viewed, ip_address, sub_total, total, discount, due_amount, exchange_rate, discount_type, currency_id, default_currency_id, status (draft/unpaid/partial/paid/pending-confirmation/canceled), payment_status, send_status, client_id, project_id, estimate_id, order_id, company_address_id, bank_account_id, calculate_tax, credit_note, file, downloadable_file, recurring, billing_frequency, billing_interval, billing_cycle, parent_id, invoice_recurring_id, is_timelog_invoice, quickbooks_invoice_id, show_shipping_address, hash.

**Line items:** InvoiceItems (item_name, item_summary, type, hsn_sac_code, quantity, unit_price, amount, taxes JSON, unit_id, product_id) + InvoiceItemImage.

**Recurring invoices:**
- billing_frequency: daily/weekly/bi-weekly/monthly/quarterly/half-yearly/annually
- billing_cycle (total iterations)
- Auto-generates child invoices (RecurringInvoice + RecurringInvoiceController)

**Timelog invoicing:**
- `is_timelog_invoice` flag
- Auto-link billable, approved timelogs
- timelog_from / timelog_to date filter

**Operations:**
- CRUD + bulk
- PDF generation (DomPDF, multiple templates)
- Send to client (email + signed link)
- Public client view (`/invoice/{hash}`) — pay online
- Stripe / PayPal / Razorpay / Paystack / Mollie / PayFast / Authorize.net / Square / Flutterwave integration
- Offline payment with proof upload (`pending-confirmation` → admin approval)
- QuickBooks sync
- Credit note application
- Excel export

### 11.3 Payments
**Route:** `/payments`. Model `Payment`.

**Fields:** amount, currency_id, default_currency_id, exchange_rate, invoice_id, project_id, order_id, paid_on, gateway, transaction_id, status (pending/complete/failed), bill (receipt), remarks, offline_method_id, bank_account_id, payment_gateway_response (JSON), credit_notes_id.

**Features:**
- Online gateways: Stripe, PayPal, Razorpay, Paystack, Mollie, PayFast, Authorize.net, Square, Flutterwave
- Offline payment methods (OfflinePaymentMethod): Bank Transfer, Cash, Check, etc.
- Bulk payment recording across multiple invoices in one transaction
- Bank transaction linking
- Auto-update parent invoice status (paid / partial / pending-confirmation)
- Credit note as payment method
- Excel export

### 11.4 Credit Notes
**Route:** `/creditnotes`. Model `CreditNotes` (+ CreditNoteItem + CreditNoteItemImage).

**Fields:** cn_number, invoice_id, issue_date, due_date, sub_total, total, discount, adjustment_amount, currency_id, status (open/closed), client_id, project_id, file, note, calculate_tax.

**Workflow:**
- Only from `paid`/`partial` invoices
- Apply credit to other unpaid invoices (auto-creates Payment with gateway='Credit Note')
- Reverse credit (delete payment, reopen credit note)
- Only most-recent CN per invoice can be deleted

### 11.5 Expenses
**Route:** `/expenses`. Model `Expense`.

**Fields:** item_name, purchase_date, purchase_from, price, currency_id, exchange_rate, category_id, user_id, approver_id, status (pending/approved/rejected), bill, project_id, description, default_currency_id, bank_account_id, expenses_recurring_id.

**Features:**
- Admin auto-approval
- Categories (ExpensesCategory) with role-based filtering (ExpensesCategoryRole)
- Recurring expenses (ExpenseRecurring)
- Receipt file upload
- Bank account linking
- Excel import + export
- Project association (impacts project budget)
- Approve / reject with notification

### 11.6 Bank Accounts
**Route:** `/bankaccounts`. Model `BankAccount`.

**Fields:** type (bank/cash), bank_name, account_name, account_number, account_type, contact_number, opening_balance, bank_balance, currency_id, bank_logo, status.

**Bank Transactions** (BankTransaction): payment_id, invoice_id, expense_id, amount, type (debit/credit), transaction_date, bank_balance (running), title, memo. Auto-recorded on payment/expense save.

**Operations:** transfer between accounts, deposit, withdraw.

---

## 12. PRODUCTS & ORDERS

### 12.1 Products
**Route:** `/products`. Model `Product`.

**Fields:** name, price, description, taxes (JSON), sku, hsn_sac_code, unit_id, category_id, sub_category_id, downloadable, default_image.

**Files:** ProductFiles (downloadable file storage local/S3).
**Categories:** ProductCategory + ProductSubCategory.
**Used in:** invoice/estimate/proposal line items + Order cart.

### 12.2 Orders
**Route:** `/orders`. Model `Order`.

**Fields:** order_date, order_number, sub_total, total, discount, discount_type, status (pending/completed/refunded/canceled/failed), note, show_shipping_address, client_id, currency_id, address_id, project_id.

**Features:**
- Cart system for clients (OrderCart) — add/remove/empty
- Order → Invoice conversion (`makeOrderInvoice`)
- Stripe + offline payment integration
- Credit note for refunds
- PDF download
- `NewOrderEvent` + `NewInvoiceEvent` (when invoice generated)

---

## 13. TICKETS

**Route:** `/tickets`. Model `Ticket`.

**Fields:** subject, status (open/pending/resolved/closed), priority, ticket_number, mobile, country_id, close_date, project_id, group_id, channel_id, type_id, user_id (requester), agent_id, added_by.

**Replies:** TicketReply (message, type='reply'/'note', is_description, imap_message_id/uid/in_reply_to for email integration), TicketFile attachments, TicketReplyUser (note assignees).

**Activity:** TicketActivity log.

**Settings (under Settings → Ticket Settings):**
- Types (TicketType)
- Channels (TicketChannel)
- Groups (TicketGroup)
- Agent Groups (TicketAgentGroups)
- Email settings (TicketEmailSetting) — IMAP inbox
- Reply Templates (TicketReplyTemplate)
- Custom forms (TicketCustomForm)
- Per-agent settings (TicketSettingForAgents)
- Tags (TicketTag + TicketTagList)

**Features:**
- Auto-assign agent based on group workload
- @mentions (MentionUser)
- Email-in (IMAP polling)
- Public ticket form (`/ticket-form/{id}`)
- ReCAPTCHA on public form
- Excel import
- Bulk: change status / assign agent / delete
- Custom fields per ticket

---

## 14. EVENTS, NOTICES, MESSAGES

### 14.1 Events
**Route:** `/events`. Model `Event`.

Fields: event_name, label_color, where, description, start_date_time, end_date_time, event_link, parent_id (for recurring base), repeat, repeat_type, repeat_every, repeat_cycles, send_reminder, remind_time, remind_type, event_id (Google sync).

**Attendees:** EventAttendee. **Files:** EventFile. @mentions, custom fields, color coding.

`RecurringEventController` handles recurring instances.

### 14.2 Notices
**Route:** `/notices`. Model `Notice`.

Fields: heading, description, to (employee/client/both), department_id.

NoticeView tracks who has read. NoticeFile attachments. NoticeBoardUser audience binding.

### 14.3 Messages (Chat)
**Route:** `/messages`. Model `UserChat`.

Fields: user_one, user_id (the two participants), from, to, message, message_seen, notification_sent.

UserchatFile attachments. Bi-directional chat with search + mention support. `MessageSettingController` config:
- allow_client_admin
- allow_client_employee
- allow_employee_employee

Unread count badge in sidebar.

### 14.4 Sticky Notes
Model `StickyNote`. Per-user private notes on dashboard. CRUD.

---

## 15. KNOWLEDGE BASE

**Route:** `/knowledgebase`. Model `KnowledgeBase` + `KnowledgeBaseCategory` + `KnowledgeBaseFile`.

Fields: title, description (rich text), category_id, files.

Visible to employees/clients per role; can be public-facing internal docs system.

---

## 16. REPORTS

All reports under `/reports/*`. Each has filters + Excel export.

| Report | Route | Filters | Charts |
|--------|-------|---------|--------|
| Task Report | `/task-report` | status, priority, project, milestone, assignee, date range | status pie, employee bar |
| Employee-wise Task | `/employee-wise-task-report` | employee, date | task count per employee |
| Consolidated Task | `/consolidated-task-report` | project, date | aggregate metrics |
| Time Log Report | `/time-log-report` | employee, project, date | hours bar chart |
| Project-wise Time Log | `/time-log-project-report` | project, date | hours per project |
| Weekly Timesheet | `/time-log-weekly-report` | week, employee | per-day breakdown |
| Finance Report | `/finance-report` | date range, currency | revenue line chart, status pie |
| Income vs Expense | `/income-expense-report` | date | dual bar chart |
| Leave Report | `/leave-report` | year, month, employee, leave_type | leave type breakdown |
| Leave Quota Report | `/leave-report/leave_quota` | year, employee | used vs available |
| Attendance Report | `/attendance-report` | month, year, department, employee | monthly grid |
| Expense Report | `/expense-report` | category, date | category pie |
| Deal/Lead Report | `/lead-report` | pipeline, year, category | won/lost pie, avg deal size monthly |
| Sales Report | `/sales-report` | date, client | sales over time |

---

## 17. GDPR

**Route:** `/gdpr`. Settings at `/account/settings/gdpr-settings`.

**Settings (GdprSetting model):**
- enable_gdpr, show_customer_area, show_customer_footer
- enable_export (data download)
- data_removal (request flow)
- lead_removal_public_form, public_lead_edit
- terms_customer_footer
- consent_customer, consent_leads, consent_block
- top_information_block, terms, policy

**Sub-features:**
- Right to access — export user's data
- Right to portability — Excel download
- Right to erasure — RemovalRequest / RemovalRequestLead workflow
- Right to be informed — terms + policy pages
- Purpose consent — `PurposeConsent`, `PurposeConsentLead`, `PurposeConsentUser` (agree/opt-out, IP + timestamp tracked)
- Public lead edit form (`/consent/l/{hash}`)
- Public removal request form

---

## 18. SETTINGS — EVERY TAB

(Order matches sidebar; only key fields listed.)

### 18.1 Account Settings (Company)
Fields: company_name, app_name, company_email, company_phone, logo, light_logo, favicon, auth_theme, sidebar_logo_style, login_background, address, website, currency_id, timezone, date_format (17 options), date_picker_format, time_format (12h/24h), locale, latitude, longitude, year_starts_from, leaves_start_from (year_start/joining_date), task_self, active_theme, dashboard_clock, taskboard_length, google_calendar_status, rounded_theme, hide_cron_message.

### 18.2 Business Addresses
Multiple company addresses (CompanyAddress) — used for invoice "from", attendance locations, shipping origins.

### 18.3 App Settings
Locale, date/time format, currency, timezone, file upload (allowed_file_types, max_file_size, max_file_uploads), session_driver, datatable_row_limit, recaptcha v2 + v3 keys, google_map_key, hide_cron_message, allow_client_signup, admin_approval_client_signup, hide_dashboard_clock, allow_employee_export.

### 18.4 Profile Settings
Per-user: name, email, mobile, image, gender, locale, dark_theme, rtl, password change, telegram_user_id, slack_username, 2FA setup.

### 18.5 Notification Settings
Per-event toggles for: email, slack, push, db. Events: invoice sent, payment received, leave applied, task assigned, project deadline, etc.

### 18.6 Currency Settings
Multiple currencies per company. Currency fields: currency_name, currency_code, currency_symbol, exchange_rate, is_cryptocurrency, usd_price, currency_position (left/right), no_of_decimal, thousand_separator, decimal_separator. Exchange rate API key (auto-update).

### 18.7 Payment Gateway Credentials
9 gateways (Stripe / PayPal / Razorpay / Paystack / Mollie / PayFast / Authorize.net / Square / Flutterwave). Test/Live modes. Encrypted secrets. Webhook URLs.

### 18.8 Finance Settings (Invoice/Estimate/Credit Note)
- Numbering: invoice_digit (padding), invoice_number_separator, prefix per type
- Template selection (multiple PDF templates)
- locale, due_after (days)
- calculate_tax (before/after discount default)
- Show shipping address default

### 18.9 Contract Settings
- Contract number prefix + digit padding
- Contract types (CRUD)
- Contract templates (with rich-text body)

### 18.10 Tax Settings
CRUD: tax_name, rate_percent. Soft-delete preserves historical taxes.

### 18.11 Ticket Settings
Sub-tabs:
- Agent settings (auto-assign rules)
- Types, Channels, Groups, Agent Groups, Tags
- Email IMAP settings
- Reply templates
- Custom forms
- Captcha toggle on public form

### 18.12 Project Settings
- Project categories (CRUD)
- Project status settings (custom statuses)
- Send-reminder for overdue tasks
- Public project creation toggle
- Miroboard integration

### 18.13 Attendance Settings
- week_start_day (Mon-Sun)
- QR clock-in/out toggle
- Shift management UI
- Shift rotation UI
- Attendance auto clock-out

### 18.14 Leave Settings
- Leave types CRUD with all eligibility rules
- Quota assignment (manual or auto)
- Auto leaves_start_from (year_start / joining_date)
- Permission per role for approval

### 18.15 Custom Fields
- Field groups per module
- Field types: text, number, password, textarea, radio, checkbox, select, date, file, etc.
- Required / optional
- Display order
- Module list: clients, employees, projects, tasks, invoices, estimates, deals, leads, tickets, events, contracts, etc.

### 18.16 Roles & Permissions
- CRUD roles (Role model)
- Permission matrix UI per role
- Module enable/disable per role
- Per-user override (UserPermission with `customised_permissions` flag)

### 18.17 Message Settings
- Allow client ↔ admin
- Allow client ↔ employee
- Allow employee ↔ employee

### 18.18 Lead Settings
Sub-tabs: Pipelines, Stages, Sources, Categories, Agents, Custom Forms, Public Edit toggle, Captcha toggle.

### 18.19 Time Log Settings
- Approval workflow on/off
- Active timer auto-stop time
- Earnings visible to employees toggle

### 18.20 Task Settings
- Default task status
- Task category CRUD
- Recurring task settings
- Self-task toggle

### 18.21 Security Settings
- 2FA toggle + backup codes
- reCAPTCHA v2 + v3 (site + secret keys)
- reCAPTCHA on ticket form / lead form

### 18.22 Theme Settings
- Auth theme (light/dark)
- Header color
- Sidebar style (square/full)
- Rounded theme

### 18.23 Module Settings
Enable/disable each of the 24 modules × per role (admin/employee/client). Three matrices.

### 18.24 Storage Settings
- Local OR AWS S3 (key, secret, region, bucket)
- Migration tool (local → S3)
- Test connection

### 18.25 Language Settings
- Locale CRUD
- Auto-translate
- Translation strings management

### 18.26 Social Auth Settings
- Google OAuth (client_id, secret)
- Other providers (facebook, twitter, linkedin)

### 18.27 Google Calendar Settings
- OAuth credentials
- Per-module sync toggle (events, leaves, holidays, contracts)
- Status check

### 18.28 Custom Link Settings
Add menu items linking to external URLs. Visible per role. Active/inactive toggle.

### 18.29 GDPR Settings
See §17.

### 18.30 Database Backup
- Manual backup
- Scheduled backup
- Backup file list with download/delete

### 18.31 Sign-up Settings
- Terms link
- Terms text
- Show terms checkbox on signup

### 18.32 Updates (admin)
- Check current version
- Apply update package
- Update changelog

---

## 19. PUBLIC / CLIENT PORTAL ROUTES

(All under `routes/web-public.php`, no auth required — signed URLs.)

| Route | Purpose |
|-------|---------|
| `GET /invitation/{code}` | Accept invitation signup |
| `POST /check-email` `POST /check-code` `GET /resend-code` | Email verification |
| `GET/POST /redirect/{provider}` `/callback/{provider}` | Social login OAuth |
| `GET /invoice/{hash}` | Public invoice view |
| `POST /invoice-stripe/save-stripe-detail/` | Stripe checkout |
| `POST /paystack-public/{id}/{hash}` | Paystack |
| `POST /flutterwave-public/{id}` | Flutterwave |
| `POST /mollie-public/{id}/{hash}` | Mollie |
| `POST /payfast-public` | PayFast |
| `POST /square-public` | Square |
| `POST /authorize-public/{id}` | Authorize.net |
| `POST /pay-with-razorpay/{hash}` | Razorpay |
| `GET /paypal-public/{invoiceId}` | PayPal |
| All gateways have `/callback/{id}/{type}/{hash}` + `/webhook/{hash}` |
| `GET /lead-form/{id}` `POST /lead-form/leadStore` | Public lead form |
| `GET /ticket-form/{id}` `POST /lead-form/ticket-store` | Public ticket form |
| `POST /contract/sign/{id}` `GET /contract/download/{id}` `GET /contract/{hash}` | Contract signing portal |
| `POST /estimate/accept/{id}` `POST /estimate/decline/{id}` `GET /estimate/{hash}` | Estimate portal |
| `GET /gantt-chart/{hash}` | Public Gantt |
| `GET /task-board/{hash}` | Public taskboard |
| `GET /proposal/{hash}` `POST /proposal-action/{id}` | Proposal portal |
| `GET /consent/l/{hash}` | GDPR consent form |
| `POST /consent/remove-lead-request` | Lead removal request |
| `GET /change-lang/{locale}` | Language switcher |
| `GET /file/{type}/{path}` | Secure file downloader |

**Client-portal authenticated routes** (under `/account/*` with client role):
- Dashboard, projects (read), tasks (read), tickets (CRUD their own), invoices (view+pay), estimates (view+accept), payments (view), contracts (view+sign), events (view), notices (view), notes (CRUD own), knowledge base (view), messages (chat with admin/employees).

---

## 20. PAYMENT GATEWAYS (detail)

Stored in `PaymentGatewayCredentials` (all secrets encrypted via `Crypt::encrypt`).

| Gateway | Modes | Fields |
|---------|-------|--------|
| **Stripe** | test/live | client_id, secret, webhook_secret, status, mode |
| **PayPal** | sandbox/live | client_id, secret, status, mode |
| **Razorpay** | test/live | key, secret, status, mode |
| **Paystack** | test/live | key, secret, merchant_email, status, mode |
| **Mollie** | single | api_key, status |
| **PayFast** | test/live | merchant_id, key, passphrase, status, mode |
| **Authorize.net** | sandbox/production | login_id, transaction_key, environment, status |
| **Square** | sandbox/production | application_id, access_token, location_id, environment, status |
| **Flutterwave** | test/live | api_key, secret, webhook_secret_hash, status, mode |

All have:
- Test/live toggle
- Webhook URL (display only)
- Test connection button
- Enable/disable

**Offline methods** (OfflinePaymentMethod) — admin-defined: Bank Transfer, Cash, Cheque, etc. — image + description. Used for client-uploaded proof + admin approval workflow.

---

## 21. NOTIFICATIONS & EVENTS

**Channels:** database (Notification model), email (Mail classes), Slack (webhook), Pusher Beams (push), browser web-push.

**Key Events:**
- NewProjectEvent, NewTaskEvent, TaskCompletedEvent, TaskCommentEvent, TaskReminderEvent
- NewLeaveEvent, LeaveStatusUpdateEvent, LeaveAppliedEvent
- NewInvoiceEvent, InvoicePaidEvent, NewPaymentEvent, PaymentReminderEvent
- NewEstimateEvent, EstimateAcceptedEvent
- NewProposalEvent, ProposalAcceptedEvent
- NewTicketEvent, TicketReplyEvent
- NewEventEvent, EventReminderEvent
- AutoFollowUpReminderEvent (deal follow-up)
- NewOrderEvent
- NewContractEvent, ContractSignedEvent
- BirthdayWishEvent, WorkAnniversaryEvent

**Cron jobs (`app/Console/Kernel.php`):**
- recurring-invoice
- recurring-event
- recurring-task
- recurring-expense
- shift-rotation-automate
- auto-clock-out
- daily-attendance-reminder
- follow-up-reminder
- visa/passport expiry alerts
- exchange-rate-update
- estimate-expiry
- contract-expiry-alert

---

## 22. IMPORTS & EXPORTS

**Imports** (queue-based via `ImportController`):
- Employees (ImportEmployeeJob)
- Clients (ImportClientJob)
- Leads (ImportLeadJob)
- Deals (ImportDealJob)
- Projects (ImportProjectJob)
- Attendance (ImportAttendanceJob)
- Expenses (ImportExpenseJob)
- Products (ImportProductJob)

Each: upload → preview/map → process job → progress polling endpoint.

**Exports** (`app/Exports/*` — Laravel Excel):
- AttendanceExport, AttendanceByMemberExport
- LeaveExport, LeaveQuotaReportExport
- TimelogExport, ProjectTimelogExport, EmployeeTimelogExport
- ShiftScheduleExport
- DealExport
- Plus per-module XLSX export from DataTable rows

---

## 23. DATABASE SCHEMA

Selected key tables (full list in `database/migrations/`):

### Core
- `companies`, `users`, `user_invitations`, `roles`, `permissions`, `permission_types`, `permission_roles`, `role_users`, `user_permissions`, `modules`, `module_settings`

### Settings
- `global_settings`, `company_addresses`, `currencies`, `currency_format_settings`, `countries`, `languages`
- `smtp_settings`, `slack_settings`, `pusher_settings`, `push_notification_settings`, `email_notification_settings`
- `theme_settings`, `module_settings`, `storage_settings`, `social_auth_settings`, `quick_books_settings`, `google_calendar_modules`, `database_backup_settings`, `custom_link_settings`, `sign_up_settings`, `gdpr_settings`, `language_settings`

### CRM
- `leads`, `lead_pipelines`, `pipeline_stages`, `lead_sources`, `lead_categories`, `lead_agents`, `lead_custom_forms`, `lead_settings`
- `deals`, `deal_files`, `deal_notes`, `deal_follow_ups`, `deal_histories`, `lead_products`
- `proposals`, `proposal_items`, `proposal_item_images`, `proposal_signs`, `proposal_templates`, `proposal_template_items`
- `client_details`, `client_contacts`, `client_notes`, `client_documents`, `client_categories`, `client_sub_categories`, `client_user_notes`

### Projects
- `projects`, `project_members`, `project_files`, `project_notes`, `project_user_notes`, `project_milestones`, `project_categories`, `project_sub_categories`, `project_status_settings`, `project_departments`, `project_activities`, `project_ratings`, `project_settings`
- `project_templates`, `project_template_members`, `project_template_milestones`, `project_template_tasks`, `project_template_sub_tasks`, `project_template_task_users`
- `project_time_logs`, `project_time_log_breaks`
- `gantt_links`, `issues`

### Tasks
- `tasks`, `task_users`, `sub_tasks`, `sub_task_files`, `task_files`, `task_comments`, `task_comment_emojis`, `task_notes`, `task_histories`, `taskboard_columns`
- `task_labels`, `task_label_lists`, `task_tags`, `task_tag_lists`, `task_categories`, `task_settings`
- `pinned`, `mention_users`

### HR
- `employee_details`, `employee_documents`, `employee_document_expiries`, `employee_skills`, `skills`, `employee_teams`, `teams` (departments), `designations`
- `attendances`, `attendance_settings`
- `leaves`, `leave_files`, `leave_settings`, `leave_types`, `employee_leave_quotas`, `employee_leave_quota_histories`
- `holidays`
- `employee_shifts`, `employee_shift_schedules`, `employee_shift_change_requests`, `shift_rotations`, `shift_rotation_sequences`, `automate_shifts`, `rotation_automate_logs`
- `emergency_contacts`, `passports`, `visa_details`
- `awards`, `award_icons`, `appreciations`, `promotions`
- `weekly_timesheets`, `weekly_timesheet_entries`
- `employee_activities`, `user_activities`

### Finance
- `invoices`, `invoice_items`, `invoice_item_images`, `invoice_files`, `invoice_payment_details`, `invoice_settings`
- `recurring_invoices`, `recurring_invoice_items`, `recurring_invoice_item_images`
- `estimates`, `estimate_items`, `estimate_item_images`, `estimate_requests`, `estimate_templates`, `estimate_template_items`, `estimate_template_item_images`, `accept_estimates`
- `payments`, `payment_gateway_credentials`, `offline_payment_methods`
- `credit_notes`, `credit_note_items`, `credit_note_item_images`
- `expenses`, `expense_recurrings`, `expenses_categories`, `expenses_category_roles`
- `taxes`, `unit_types`
- `bank_accounts`, `bank_transactions`

### Contracts
- `contracts`, `contract_signs`, `contract_files`, `contract_discussions`, `contract_renews`, `contract_templates`, `contract_types`, `contract_settings`

### Tickets
- `tickets`, `ticket_replies`, `ticket_reply_users`, `ticket_files`, `ticket_activities`, `ticket_tags`, `ticket_tag_lists`
- `ticket_agent_groups`, `ticket_channels`, `ticket_custom_forms`, `ticket_email_settings`, `ticket_groups`, `ticket_reply_templates`, `ticket_setting_for_agents`, `ticket_types`

### Products & Orders
- `products`, `product_categories`, `product_sub_categories`, `product_files`
- `orders`, `order_items`, `order_item_images`, `order_carts`
- `promotions` (also for marketing)

### Communication
- `discussions`, `discussion_categories`, `discussion_replies`, `discussion_files`
- `notices`, `notice_files`, `notice_views`, `notice_board_users`
- `events`, `event_attendees`, `event_files`
- `user_chats`, `user_chat_files`, `message_settings`
- `sticky_notes`
- `notifications`

### Knowledge Base
- `knowledge_bases`, `knowledge_base_categories`, `knowledge_base_files`

### GDPR
- `gdpr_settings`, `purpose_consents`, `purpose_consent_leads`, `purpose_consent_users`, `removal_requests`, `removal_request_leads`

### Misc
- `custom_fields`, `custom_field_groups`, `custom_modules`, `custom_module_permissions`
- `dashboard_widgets`, `flags`
- `qr_codes`, `social_auth_settings`, `socials`
- `universal_searches`, `user_lead_board_settings`, `user_taskboard_settings`
- `menus`, `sessions`, `failed_jobs`, `jobs`, `job_batches`

---

## 24. CONTROLLER INVENTORY

All 193 controllers grouped:

**Auth:** LoginController, RegisterController, ForgotPasswordController, GoogleAuthController, TwoFASettingController, PasswordReset.

**Profile:** ProfileController, ProfileSettingController, ImageController.

**Dashboard:** DashboardController, HomeController, SearchController, MyCalendarController.

**Settings (33):** AppSettingController, BusinessAddressController, NotificationSettingController, CurrencySettingController, PaymentGatewayCredentialController, InvoiceSettingController, ContractSettingController, TaxSettingController, TicketSettingController, ProjectSettingController, AttendanceSettingController, LeaveSettingController, CustomFieldController, RolePermissionController, MessageSettingController, LeadSettingController, TimeLogSettingController, TaskSettingController, SecuritySettingController, ThemeSettingController, ModuleSettingController, StorageSettingController, LanguageSettingController, SocialAuthSettingController, GoogleCalendarSettingController, CustomLinkSettingController, GdprSettingsController, DatabaseBackupSettingController, SignUpSettingController, PushNotificationController, PusherSettingsController, SlackSettingController, SmtpSettingController, OfflinePaymentSettingController, ProfileSettingController, UpdateAppController, QuickbookSettingsController.

**CRM:** LeadContactController, LeadBoardController, DealController, DealNoteController, LeadFileController, LeadNoteController, LeadCategoryController, LeadSourceSettingController, LeadStageSettingController, LeadPipelineSettingController, LeadAgentSettingController, LeadCustomFormController, ProposalController, ProposalTemplateController, ContractController, ContractDiscussionController, ContractFileController, ContractRenewController, ContractTemplateController, ContractTypeController, ClientController, ClientCategoryController, ClientContactController, ClientDocController, ClientNoteController, ClientSubCategoryController, BusinessAddressController.

**HR:** EmployeeController, EmployeeDocController, EmployeeDocumentExpiryController, EmployeeShiftController, EmployeeShiftChangeRequestController, EmployeeShiftScheduleController, EmployeeVisaController, PassportController, EmergencyContactController, AttendanceController, AttendanceReportController, LeaveController, LeaveFileController, LeaveReportController, LeaveTypeController, LeavesQuotaController, DepartmentController, DesignationController, HolidayController, AwardController, AppreciationController, PromotionController, ShiftRotationController, WeeklyTimesheetController.

**Projects/Tasks:** ProjectController, ProjectCategoryController, ProjectSubCategoryController, ProjectFileController, ProjectMemberController, ProjectMilestoneController, ProjectNoteController, ProjectRatingController, ProjectLabelController, ProjectCalendarController, ProjectTemplateController, ProjectTemplateMemberController, ProjectTemplateMilestoneController, ProjectTemplateTaskController, ProjectTemplateSubTaskController, TaskController, TaskBoardController, TaskCalendarController, TaskCategoryController, TaskCommentController, TaskFileController, TaskLabelController, TaskNoteController, TaskReportController, SubTaskController, SubTaskFileController, RecurringTaskController, GanttLinkController, TimelogController, TimelogCalendarController, TimelogReportController, TimelogWeeklyApprovalController, ProjectTimelogBreakController.

**Finance:** InvoiceController, InvoiceFilesController, InvoicePaymentDetailController, EstimateController, EstimateRequestController, EstimateTemplateController, PaymentController, RecurringInvoiceController, CreditNoteController, ExpenseController, ExpenseCategoryController, ExpenseReportController, RecurringExpenseController, BankAccountController, FinanceReportController, IncomeVsExpenseReportController, SalesReportController, QuickbookController, UnitTypeController.

**Products/Orders:** ProductController, ProductCategoryController, ProductSubCategoryController, ProductFileController, OrderController.

**Tickets:** TicketController, TicketAgentController, TicketChannelController, TicketCustomFormController, TicketEmailSettingController, TicketFileController, TicketGroupController, TicketReplyController, TicketReplyTemplatesController, TicketTypeController.

**Comms:** DiscussionController, DiscussionCategoryController, DiscussionReplyController, DiscussionFilesController, NoticeController, NoticeFileController, EventCalendarController, RecurringEventController, EventFileController, MessageController, MessageFileController, StickyNoteController, NotificationController.

**Reports:** TaskReportController, TimelogReportController, AttendanceReportController, LeaveReportController, ExpenseReportController, FinanceReportController, IncomeVsExpenseReportController, LeadReportController, SalesReportController.

**Other:** GdprController, PublicLeadGdprController, PublicUrlController, FileController, ImportController, KnowledgeBaseController, KnowledgeBaseCategoryController, KnowledgeBaseFileController, AccountBaseController, Controller, CustomModuleController, UserPermissionController.

---

## 25. MODEL INVENTORY

All 243 models (key ones — full list earlier). Notable patterns:
- Every domain model extends `BaseModel` with `HasCompany` trait, soft deletes, `added_by`, `last_updated_by`.
- Models with custom fields use `CustomFieldsTrait`.
- Money columns: `amount`, `total`, `sub_total`, `price`, `discount`.
- Currency columns: paired `currency_id` + `default_currency_id` + `exchange_rate`.

---

## 26. SABNODE MAPPING

How Worksuite features map to what's already built in SabNode CRM/HRM (under `src/app/dashboard/`):

### Built (full parity or better)
| Worksuite | SabNode equivalent | Status |
|-----------|-------------------|--------|
| Leads | `/dashboard/crm/sales-crm/leads` + pipelines + agents + sources + categories | ✅ Done — deeper KPI/filters/bulk than Worksuite |
| Deals | `/dashboard/crm/sales-crm/pipelines` + `/dashboard/crm/sales-crm/all-leads` | ✅ Done |
| Clients | `/dashboard/crm/sales/clients` + sales-crm/contacts | ✅ Done |
| Contracts | `/dashboard/crm/contracts` + types + templates + renewals | ✅ Done |
| Proposals | `/dashboard/crm/sales/proposals` + templates | ✅ Done |
| Projects | `/dashboard/crm/projects` with milestones, tasks, gantt, kanban, issues, files, notes | ✅ Done |
| Tasks | `/dashboard/crm/tasks` + project tasks + recurring + sub-tasks | ✅ Done |
| Time Logs | `/dashboard/crm/time-tracking/time-logs` + weekly-timesheets + reports | ✅ Done |
| Invoices | `/dashboard/crm/sales/invoices` + recurring + estimates → invoice | ✅ Done |
| Estimates | `/dashboard/crm/sales/estimates` + templates | ✅ Done |
| Payments | `/dashboard/crm/sales/payments` | ✅ Done |
| Credit Notes | `/dashboard/crm/sales/credits` | ✅ Done |
| Expenses | `/dashboard/crm/purchases/expenses` + categories | ✅ Done |
| Bank Accounts | `/dashboard/crm/banking/bank-accounts` + transactions + reconciliation | ✅ Done — far deeper than Worksuite |
| Tickets | `/dashboard/crm/tickets` + agents/groups/channels/types/sla/macros/forms/tags | ✅ Done |
| Events | `/dashboard/crm/workspace/events` + recurring | ✅ Done |
| Notices | `/dashboard/crm/workspace/notices` | ✅ Done |
| Knowledge Base | `/dashboard/crm/workspace/knowledge-base` + internal/public | ✅ Done |
| Discussions | `/dashboard/crm/workspace/discussions` | ✅ Done |
| Sticky Notes | `/dashboard/crm/workspace/sticky-notes` | ✅ Done |
| Employees | `/dashboard/crm/hr-payroll/employees` + all sub-pages | ✅ Done |
| Departments | `/dashboard/crm/hr-payroll/departments` + hierarchy | ✅ Done |
| Designations | `/dashboard/crm/hr-payroll/designations` + hierarchy | ✅ Done |
| Attendance | `/dashboard/crm/hr-payroll/attendance` | ✅ Done |
| Leaves | `/dashboard/crm/hr-payroll/leave` + types/balance/calendar/settings | ✅ Done |
| Holidays | `/dashboard/crm/hr-payroll/holidays` | ✅ Done |
| Shifts | `/dashboard/crm/hr-payroll/shifts` + schedule + rotations + change-requests | ✅ Done |
| Reports | `/dashboard/crm/reports/*` (15+ report types) | ✅ Done — more than Worksuite |
| GDPR | `/dashboard/crm/settings/gdpr` + consent logs | ✅ Done |
| Settings (all tabs) | `/dashboard/crm/settings/*` (33 tabs) | ✅ Done |
| Products | `/dashboard/crm/store/products` + categories | ✅ Done |
| Orders | `/dashboard/crm/store/orders` | ✅ Done |
| Awards/Appreciations | `/dashboard/crm/hr/awards` + recognition | ✅ Done |
| Roles & Permissions | `/dashboard/crm/team/manage-roles` + permission keys | ✅ Done |
| Custom Fields | `/dashboard/crm/settings/custom-fields` + groups | ✅ Done |
| Currencies | `/dashboard/crm/settings/currencies` + formats | ✅ Done |
| Taxes | `/dashboard/crm/settings/taxes` | ✅ Done |
| Modules system | `/dashboard/crm/settings/modules` | ✅ Done |
| Custom Links | `/dashboard/crm/settings/custom-links` | ✅ Done |
| Webhooks | `/dashboard/crm/settings/webhooks` | ✅ Done — Worksuite doesn't have outbound webhooks |
| API tokens | `/dashboard/crm/settings/api-tokens` | ✅ Done — Worksuite doesn't have this |
| Audit log | `/dashboard/crm/audit-log` | ✅ Done — far more advanced |
| HRM Portal | `/dashboard/hrm/portal` + roadmaps + reports + permission groups | ✅ NEW — Worksuite doesn't have employee self-service portal |
| POS | `/dashboard/crm/pos` (terminals, sessions, refunds, hold/recall) | ✅ Done — Worksuite has no POS |
| India Tax (GSTR-1, GSTR-2B, e-way bills, ITC, MSME, TDS) | `/dashboard/crm/tax/*` | ✅ Done — Worksuite has basic only |

### Worksuite features NOT yet in SabNode (real gaps)
| Feature | Where it lives in Worksuite | Suggested SabNode path |
|---------|----------------------------|------------------------|
| **Public lead form** (embeddable, ReCAPTCHA) | `/lead-form/{id}` | NEW: `src/app/api/public/lead-form/[formId]/route.ts` + form builder under `/dashboard/crm/sales-crm/forms` (exists — extend with public URL) |
| **Public ticket form** | `/ticket-form/{id}` | NEW: `src/app/api/public/ticket-form/[id]/route.ts` |
| **Public Gantt link** (hash-signed, no auth) | `/gantt-chart/{hash}` | NEW: `/share/gantt/[hash]/page.tsx` |
| **Public taskboard link** | `/task-board/{hash}` | NEW: `/share/taskboard/[hash]/page.tsx` |
| **Public estimate accept/decline** (with e-sign canvas) | `/estimate/{hash}` | NEW: `/share/estimate/[hash]/page.tsx` |
| **Public proposal accept/reject** (with e-sign) | `/proposal/{hash}` | NEW: `/share/proposal/[hash]/page.tsx` |
| **Public contract signing** | `/contract/{hash}` | NEW: `/share/contract/[hash]/page.tsx` |
| **Public invoice payment page** (Stripe/Razorpay/PayPal) | `/invoice/{hash}` | NEW: `/share/invoice/[hash]/page.tsx` with payment SDK integration |
| **Email IMAP inbox for tickets** (auto-create ticket from email) | `TicketEmailSettingController` + IMAP polling | NEW: cron job + parser |
| **Online payment gateway integrations** (9 gateways) | `PaymentController` + `PublicPaymentController` | NEW: server actions per gateway in `crm-payment-gateways.actions.ts` |
| **QuickBooks sync** | `QuickbookController` + `QuickbookSettingsController` | NEW: `/dashboard/crm/settings/integrations/quickbooks` (page exists, wire it) |
| **Google Calendar sync** (events, leaves, holidays, contracts → Google) | `GoogleCalendarSettingController` + per-module event_id field | NEW: `/dashboard/crm/settings/integrations/google-calendar` (page exists, wire OAuth + sync) |
| **Slack notifications** | `SlackSettingController` + webhook | NEW: settings page exists; wire to events |
| **2FA login (email + Google Authenticator)** | `TwoFASettingController` | NEW: `/dashboard/profile/2fa-setup` |
| **Database backup** (scheduled + manual) | `DatabaseBackupSettingController` | NEW: cron job + admin page |
| **Client signup with admin approval** | `SignUpSettingController` + admin queue | NEW: public `/signup` + admin approval queue |
| **Invitation flow** (email link → signup) | `EmployeeController::sendInvite` + `/invitation/{code}` | NEW: `/invitations/[token]` accept page (settings page exists) |
| **Dashboard widget toggle** (per dashboard type) | `DashboardWidget` model | NEW: extend `/dashboard/crm` hub with widget config |
| **Multiple dashboard types** (Overview, Project, HR, Ticket, Finance, etc.) | 6 dashboard types | Already have hubs — add `DashboardWidget` config |
| **Multi-tenant per-user dashboard layout** | `dashboard_widgets` table | NEW: store per-user dashboard prefs |
| **Project rating from client portal** | `ProjectRatingController` | NEW: `/share/project-rating/[hash]/page.tsx` |
| **Client portal full UI** (separate UX for clients vs admins) | `client` role views | NEW: `/portal/client` separate UX |
| **Telegram username + Slack username on employee** | EmployeeDetails fields | Already in employee schema |
| **Client → Contract signing canvas (HTML5 signature pad)** | ContractSign | NEW: signature pad component |
| **Estimate signature canvas** | AcceptEstimate | NEW: signature pad component |
| **Recurring event auto-generation** | `RecurringEventController` cron | NEW: cron job |
| **Recurring task auto-generation** | `RecurringTaskController` cron | NEW: cron job |
| **Recurring invoice auto-generation** | `RecurringInvoiceController` cron | NEW: cron job |
| **Recurring expense auto-generation** | `RecurringExpenseController` cron | NEW: cron job |
| **Shift rotation automation** | `ShiftRotationController` + `AutomateShift` | NEW: cron job |
| **Auto clock-out** (after shift end + buffer) | shift `auto_clock_out_time` cron | NEW: cron job |
| **Deal follow-up auto reminder** | `AutoFollowUpReminderEvent` | NEW: cron job |
| **Visa/passport expiry alert** | `alert_before_months` cron | NEW: cron job |
| **Estimate / contract expiry alert** | cron | NEW: cron job |
| **Exchange rate auto-update** | currency cron | NEW: cron job |
| **Mention users (@-mentions)** | MentionUser polymorphic | NEW: mention parser in rich text editor |
| **Activity feed** (`UserActivity`, `EmployeeActivity`) | logged on every change | Partially done (audit-log); extend per-module |
| **Email notification templates** (per event) | Mail classes | NEW: email template management UI |
| **Universal search across modules** | `UniversalSearch` + indexed table | NEW: extend `/dashboard/crm/_components/global-search` |
| **PDF generation** (DomPDF templates for invoice/estimate/contract/proposal/credit-note) | DomPDF | NEW: `pdf-templates/` directory + Puppeteer / pdfkit |
| **Excel import wizard** (with field mapping + preview + progress polling) | `ImportController` | Partial — only basic CSV import exists |
| **Excel export from any DataTable** | Laravel Excel | ✅ Done via `downloadXlsx` |
| **Burndown chart per project** | `view_project_burndown_chart` | NEW: chart in project detail |
| **Miroboard embed** | `miro_board_id` field | NEW: optional embed iframe in project detail |
| **Project Gantt with drag-resize bars** | `dhtmlxGantt` | NEW: extend `/dashboard/crm/projects/gantt` with full drag editor |
| **Drag-drop project status reorder** | sortable jQuery UI | NEW: drag-drop in project status settings |
| **Task pin to user dashboard** | `Pinned` table | NEW: "Pin to dashboard" button per task |
| **Voice/video chat in messages** | _(not in Worksuite — skip)_ | — |
| **Worksuite plugins / Modules system** | Laravel Modules — `Modules/` dir | Not needed (SabNode is monolith Next.js — use feature flags instead) |

---

## IMPLEMENTATION PRIORITY (recommended next steps)

Given the gaps above, the highest-value missing pieces are:

**Priority 1 — Public/portal pages (revenue-impacting):**
1. Public invoice payment page with gateway integration
2. Public estimate accept/decline with e-sign
3. Public proposal accept/reject with e-sign
4. Public contract sign with e-sign
5. Public lead form (embeddable)

**Priority 2 — Cron automation (data integrity):**
6. Recurring invoices / events / tasks / expenses
7. Shift rotation automation + auto clock-out
8. Follow-up reminders
9. Visa/passport/estimate/contract expiry alerts
10. Exchange rate auto-update

**Priority 3 — Email/integration:**
11. Email IMAP → ticket auto-create
12. Slack notifications wired to events
13. Google Calendar sync (events/leaves/holidays/contracts)
14. QuickBooks integration

**Priority 4 — Multi-tenant polish:**
15. 2FA login
16. Database backup (admin)
17. Client signup + admin approval
18. Dashboard widget configuration per user
19. Mention parser (@-mentions in comments/discussions)
20. Universal cross-module search

---

**End of reference.** This document is the source of truth for "what Worksuite does and where SabNode stands relative to it."

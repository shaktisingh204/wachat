# SabNode CRM + HRM — Function Plan

A comprehensive, exhaustive list of every CRM/HRM feature and the **maximum possible input fields** that should be supported per feature. Use this as the source of truth when wiring forms, schemas (Mongo + zod), action validators, and the sidebar IA.

> Convention: ★ = required, ◇ = optional, ⚙ = system/auto-set, 🔒 = role-gated.

---

## 0 · Cross-cutting fields (every entity should support)

- ⚙ `_id` (ObjectId)
- ⚙ `projectId`, `userId`, `tenantId`
- ⚙ `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
- ◇ `tags[]`, `customFields{}`, `attachments[]` (SabFiles refs), `notes[]`
- ◇ `status`, `priority`, `archived`, `deletedAt` (soft-delete)
- ◇ `assignedTo`, `teamId`, `pipelineId`, `stageId`
- ◇ `source`, `referrerId`, `campaignId`, `utm{ source, medium, campaign, term, content }`

**Rust port — §0 foundation: DONE (2026-05-06).** New workspace crate `crm-core` provides each fragment as a `#[serde(flatten)]`-able struct that every CRM/HRM entity DTO will compose. Pure types, no I/O, no async — same contract as `wachat-types`. Per the user's "CRM backend in Rust from now" directive, all subsequent §1+ entity crates flatten these fragments instead of redefining them.

- [rust/crates/crm-core/Cargo.toml](rust/crates/crm-core/Cargo.toml) — package + workspace registration
- [rust/crates/crm-core/src/lib.rs](rust/crates/crm-core/src/lib.rs) — module orchestration + re-exports
- [rust/crates/crm-core/src/identity.rs](rust/crates/crm-core/src/identity.rs) — `Identity { _id, projectId, userId, tenantId? }`
- [rust/crates/crm-core/src/audit.rs](rust/crates/crm-core/src/audit.rs) — `Audit { createdAt, updatedAt, createdBy?, updatedBy? }` + `new(actor)` / `touch(actor)` helpers
- [rust/crates/crm-core/src/lifecycle.rs](rust/crates/crm-core/src/lifecycle.rs) — `Status` (transparent string newtype, entity-specific vocab), `Priority` (low/medium/high/critical), `SoftDelete { archived, deletedAt? }`, composite `Lifecycle`
- [rust/crates/crm-core/src/assignment.rs](rust/crates/crm-core/src/assignment.rs) — `Assignment { assignedTo?, teamId?, pipelineId?, stageId? }`
- [rust/crates/crm-core/src/attribution.rs](rust/crates/crm-core/src/attribution.rs) — `Attribution { source?, referrerId?, campaignId?, utm }` + `Utm { source, medium, campaign, term, content }`
- [rust/crates/crm-core/src/tagging.rs](rust/crates/crm-core/src/tagging.rs) — `Tags(Vec<String>)` denormalized pointer list
- [rust/crates/crm-core/src/note.rs](rust/crates/crm-core/src/note.rs) — `Note { _id?, body, authorId?, createdAt, editedAt? }`
- [rust/crates/crm-core/src/attachment.rs](rust/crates/crm-core/src/attachment.rs) — `Attachment { fileId, name?, mimeType?, size? }` (SabFile pointer; raw URLs forbidden per project policy)
- [rust/crates/crm-core/src/custom_fields.rs](rust/crates/crm-core/src/custom_fields.rs) — `CustomFields(BTreeMap<String, serde_json::Value>)` opaque bag
- Workspace registration: [rust/Cargo.toml](rust/Cargo.toml) `members` extended with `crates/crm-core`.
- Verification: `cargo check -p crm-core` clean; `cargo test -p crm-core` → 6 unit tests pass (camelCase round-trip, lowercase priority, default-skip, UTM empty/populated round-trip).
- **NEXT (§0 follow-on) →** §1.1 Clients & Prospects DTO crate that flattens `Identity` + `Audit` + `Lifecycle` + `Assignment` + `Attribution` + `Tags` + `CustomFields` + `Attachment[]` + `Note[]` and adds the §1.1 entity-specific fields.

---

## 1 · CRM — Sales

### 1.1 Clients & Prospects
Type ★, First name ★, Last name ★, Display name, Salutation, Company name, GSTIN, PAN, Aadhaar (masked), CIN, MSME no., Industry, Sub-industry, Designation, Department, Email (primary) ★, Email (alt[]), Phone (primary) ★, Phone (alt[]), WhatsApp, Telegram, LinkedIn, Twitter/X, Website, Currency, Price list, Credit limit, Credit period (days), Payment terms, Tax preference (taxable/exempt), Tax registration no., Place of supply, Billing address (line1, line2, city, state, country, pincode), Shipping address[] (multi), Default warehouse, Sales agent, Default discount %, Default tax rate, Opening balance + as-of date, Source, Lead score, Stage, Pipeline, Tags[], Avatar, DOB, Anniversary, Preferred contact channel, Preferred language, Timezone, Customer rating, Loyalty tier, Notes, Custom fields, Attachments.

**Rust port — §1.1 Client DTO: DONE (2026-05-06).** New crate `crm-sales-types` opens the §1 Sales DTO crate (sibling to `wachat-types`). Module `client` defines `Client` (Mongo `crm_accounts`) flattening `crm-core` fragments `Identity` + `Audit` + `Attribution` + `Assignment` and embedding `Tags` + `CustomFields` + `Vec<Attachment>` + `Vec<Note>`. Supporting types: `ClientType` (prospect/customer), `TaxPreference` (taxable/exempt), `ContactChannel`, `Address`, `ContactBook`, `OpeningBalance`. Money fields are `f64` (TS Number-shape parity); a `rust_decimal` migration is deferred to the broader port.

- [rust/crates/crm-sales-types/Cargo.toml](rust/crates/crm-sales-types/Cargo.toml)
- [rust/crates/crm-sales-types/src/lib.rs](rust/crates/crm-sales-types/src/lib.rs) — module + re-exports
- [rust/crates/crm-sales-types/src/client.rs](rust/crates/crm-sales-types/src/client.rs) — `Client` + supporting types
- Workspace registration: `crates/crm-sales-types` added to [rust/Cargo.toml](rust/Cargo.toml)
- Verification: `cargo clippy -p crm-sales-types -p crm-core -- -D warnings` clean; `cargo test -p crm-sales-types -p crm-core` → 11 unit tests pass (5 client-DTO + 6 crm-core); also fixed `clippy::derivable_impls` on `Priority`, `ClientType`, `TaxPreference` by deriving `Default` with `#[default]` instead of hand-rolling. TS baseline still 5 errors.
- **NEXT (§1 follow-on) →** §1.2 Quotations / Estimates DTO module added to `crm-sales-types` (`quotation.rs` flattening `Identity` + `Audit` + `Attribution` + `Assignment`, with line-item, totals, status enum, and conversion-target fields).

### 1.2 Quotations / Estimates
Quotation no. ⚙, Date ★, Valid until ★, Client ★, Reference no., Sales agent, Pipeline, Deal, Subject, Currency, Exchange rate, Place of supply, Billing/Shipping address, Items[] (item, description, HSN/SAC, qty, unit, rate, discount %, tax rate, CGST/SGST/IGST, total), Sub-total, Discount (overall), Shipping charge, Adjustment, Round-off, Total, Terms & conditions, Customer notes, Attachments[], Signature image, Template, Thumbnail, PDF status, Email log, WhatsApp send log, Status (draft/sent/accepted/rejected/expired/converted), Converted-to (SO/Invoice), Revision history.

### 1.3 Proforma Invoices
Same shape as Quotation + Proforma no., Linked SO, Advance %, Advance amount, Expected delivery, Payment due date, Status (draft/sent/paid/converted).

### 1.4 Sales Orders
SO no. ⚙, Date ★, Client ★, Quotation ref, PO no., PO date, Expected shipment date, Delivery method, Payment terms, Items[] + qty pending/delivered/invoiced, Warehouse (per line), Sub-total/Tax/Discount/Total, Shipping address, Customer notes, Internal notes, Attachments, Status (open/partial/fulfilled/closed/cancelled), Linked deliveries/invoices.

### 1.5 Delivery Challans
Challan no. ⚙, Date ★, SO ref, Client ★, Vehicle no., Driver name, Driver phone, Transporter, LR no., LR date, Mode of transport, E-way bill no., Items[] (qty, batch, expiry, serial nos.), Dispatch warehouse, Ship-to address, Reason for transport, Attachments, Status.

**Rust port — §1.2 / §1.3 / §1.4 / §1.5 DTOs: DONE (2026-05-06).** Four entity modules added to `crm-sales-types`, plus shared infrastructure for line items / totals / addresses / comm logs / lineage. New `crm-core` fragment `LineageRef` (§13.5) — used by every doc that participates in the conversion chain.

- New `crm-core` module — [rust/crates/crm-core/src/lineage.rs](rust/crates/crm-core/src/lineage.rs) — `LineageRef { kind: String, id: ObjectId }`; re-exported from [src/lib.rs](rust/crates/crm-core/src/lib.rs).
- Shared sales infra:
  - [rust/crates/crm-sales-types/src/address.rs](rust/crates/crm-sales-types/src/address.rs) — `Address` promoted out of `client.rs` so all docs can reuse it.
  - [rust/crates/crm-sales-types/src/line_item.rs](rust/crates/crm-sales-types/src/line_item.rs) — `LineItem` (with optional SO-fulfillment quartet `warehouse_id` / `qty_pending` / `qty_delivered` / `qty_invoiced` and optional `cess_amount` for invoices) + `Totals { sub_total, discount_overall, shipping_charge, adjustment, round_off, total }`.
  - [rust/crates/crm-sales-types/src/comm_log.rs](rust/crates/crm-sales-types/src/comm_log.rs) — `EmailLog`, `WhatsAppSendLog`, `DeliveryOutcome`, `PdfStatus`.
- Entity modules:
  - §1.2 [rust/crates/crm-sales-types/src/quotation.rs](rust/crates/crm-sales-types/src/quotation.rs) — `Quotation`, `QuotationStatus` (draft/sent/accepted/rejected/expired/converted), `QuotationRevision` snapshot.
  - §1.3 [rust/crates/crm-sales-types/src/proforma.rs](rust/crates/crm-sales-types/src/proforma.rs) — `ProformaInvoice`, `ProformaStatus` (draft/sent/paid/converted) + advance% / advance amount / linked SO / payment due date.
  - §1.4 [rust/crates/crm-sales-types/src/sales_order.rs](rust/crates/crm-sales-types/src/sales_order.rs) — `SalesOrder`, `SalesOrderStatus` (open/partial/fulfilled/closed/cancelled), `DeliveryMethod` enum, `linked_delivery_ids` / `linked_invoice_ids`.
  - §1.5 [rust/crates/crm-sales-types/src/delivery_challan.rs](rust/crates/crm-sales-types/src/delivery_challan.rs) — `DeliveryChallan`, dedicated `ChallanLineItem` (qty + batch + expiry + serial_nos), `ModeOfTransport`, `ChallanReason`, `DeliveryChallanStatus`.
- Refactor: [client.rs](rust/crates/crm-sales-types/src/client.rs) now imports `Address` from `address.rs` (was previously inlined).
- Verification: `cargo clippy -p crm-sales-types -p crm-core --tests -- -D warnings` clean; `cargo test` → 15 pass (6 crm-core + 5 client + 4 sales-round-trip integration tests covering Quotation flatten + Proforma advance fields + SO fulfillment qtys + Challan serial_nos). TS baseline still 5.
- **NEXT (§1 follow-on) →** §1.6 Invoices DTO module (the largest remaining doc — adds GST e-invoice IRN/QR, payment-state fields `amount_paid`/`balance`, recurring config, TCS/TDS, e-way bill cross-ref).

### 1.6 Invoices
Invoice no. ⚙, Date ★, Due date ★, Client ★, Place of supply, Reverse charge?, GST treatment, Items[] (HSN, qty, rate, disc %, tax %, CGST/SGST/IGST/CESS), TCS %, TDS %, Round-off, Total, Amount paid ⚙, Balance ⚙, Payment terms, Bank details (for receipts), UPI ID, QR image, Customer notes, T&C, E-invoice IRN, QR string, Acknowledgement no./date, E-way bill no., Attachments, Status (draft/sent/paid/partially_paid/overdue/cancelled), Recurring config (frequency, end date, next run).

### 1.7 Payment Receipts
Receipt no. ⚙, Date ★, Client ★, Mode (cash/cheque/UPI/NEFT/RTGS/IMPS/card/wallet), Bank account ★, Cheque no./date, Reference/Txn id, Amount ★, Currency, Exchange rate, Apply to invoices[] (multi-line), Excess as advance?, TDS deducted by customer?, Bank charges, Notes, Attachments, Status (received/cleared/bounced).

### 1.8 Credit Notes
CN no. ⚙, Date ★, Client ★, Linked invoice, Reason (return/discount/price-adjust/cancel), Items[], Tax recalc, Refund mode (cash/credit/replacement), Refund txn id, Status, Attachments.

### 1.9 Sales Pipelines / Forms / Analytics
Pipeline name, Stages[] (label, color, probability %, order), Default stage, Win/Loss reasons[], Owner, Visibility, Forms (label, fields[], theme, redirect URL, captcha, submit webhook).

**Rust port — §1.6 / §1.7 / §1.8 / §1.9 DTOs: DONE (2026-05-07).** Four entity modules added to `crm-sales-types`, completing all §1 Sales DTOs.

- §1.6 [rust/crates/crm-sales-types/src/invoice.rs](rust/crates/crm-sales-types/src/invoice.rs) — `Invoice` (Mongo `crm_invoices`), `InvoiceStatus` (draft/sent/paid/partially_paid/overdue/cancelled), `GstTreatment` (registered/composition/unregistered/overseas/sez_with_payment/sez_without_payment/deemed_export/consumer), `RecurringConfig` + `RecurringFrequency`, `BankDetails`, `EInvoiceEnvelope` (IRN/QR/ack), TCS%/TDS%, system-managed `amount_paid`/`balance`, e-way bill cross-ref, UPI ID + cached QR file.
- §1.7 [rust/crates/crm-sales-types/src/payment_receipt.rs](rust/crates/crm-sales-types/src/payment_receipt.rs) — `PaymentReceipt` (Mongo `crm_payment_receipts`), `PaymentMode` (cash/cheque/upi/neft/rtgs/imps/card/wallet), `ReceiptStatus` (received/cleared/bounced), multi-line `Vec<InvoiceApplication>` for split allocation, `excess_as_advance`, TDS-deducted-by-customer, bank charges.
- §1.8 [rust/crates/crm-sales-types/src/credit_note.rs](rust/crates/crm-sales-types/src/credit_note.rs) — `CreditNote` (Mongo `crm_credit_notes`), `CreditNoteReason` (return/discount/price_adjust/cancel/other), `RefundMode` (cash/credit/replacement), `CreditNoteStatus`, optional standalone (no `linked_invoice_id`), `tax_recalc` toggle.
- §1.9 [rust/crates/crm-sales-types/src/pipeline.rs](rust/crates/crm-sales-types/src/pipeline.rs) — `Pipeline` (standalone shape ready for collection extraction; today TS embeds on `users.crmPipelines[]`), `Stage` (composite `pipelineId:stageId` per §13.6), `PipelineVisibility` (private/team/workspace), `LeadForm` + `FormField` + `FormFieldType` (text/textarea/email/phone/number/date/select/checkbox/url) + `FormTheme` + `CaptchaProvider` (none/recaptcha/hcaptcha/turnstile). Analytics shapes deferred to a future `crm-reports` crate.
- Verification: `cargo clippy -p crm-sales-types -p crm-core --tests -- -D warnings` clean; `cargo test` → 19 pass total (6 crm-core + 5 client + 4 first sales-round-trip + 4 second sales-round-trip covering Invoice e-invoice/recurring/payment-state, Receipt apply-to-multi-invoice + advance, CreditNote reason/refund mode, Pipeline stages + LeadForm with default-true `published` skip).
- §1 Sales is now COMPLETE on the DTO side. **NEXT (Rust port) →** §2.1 Vendors & Suppliers (new `crm-purchases-types` crate; reuses §1.1 Client field set + adds vendor-specific MSME / TDS / lead-time fields).

---

## 2 · CRM — Purchases

### 2.1 Vendors & Suppliers
Same field set as Clients + Vendor type (goods/services/both), MSME registered, MSME category, MSME number, Vendor rating, Default purchase ledger, Default expense ledger, TDS section, TDS rate, Lead time (days), Min order qty, Vendor portal email.

### 2.2 Purchase Orders
PO no. ⚙, Date ★, Vendor ★, Expected delivery, Items[] (item, HSN, qty, rate, disc, tax), Ship-to warehouse, Billing branch, Payment terms, T&C, Approval workflow (requested by, approved by, approved at), Attachments, Status (draft/awaiting-approval/approved/sent/partial/received/closed/cancelled).

### 2.3 Purchases & Expenses (Bills)
Bill no., Vendor invoice no., Bill date ★, Due date, Vendor ★, Items[] or Expense lines[] (account, amount, tax, project), TDS section, TDS amount, Reverse charge?, Place of supply, Sub-total/Tax/Total, Paid/Balance, Recurring config, Attachments, Status, Linked PO, Linked GRN.

### 2.4 Debit Notes
DN no. ⚙, Date ★, Vendor ★, Linked bill, Reason, Items[], Refund mode, Refund txn id, Status.

### 2.5 Payout Receipts
Payment no., Date ★, Vendor ★, Mode, Bank ★, Cheque/Reference, Amount ★, Apply to bills[], Excess as advance?, TDS deducted?, Notes, Attachments.

### 2.6 Purchase Leads / Hire & Services
Lead title, Vendor candidate, Category, Required by, Quantity, Estimated budget, Specs, Attachments, Stage (sourcing/quotes-received/negotiating/awarded/closed-lost), Owner.

**Rust port — §2 Purchases (all six entities) DTOs: DONE (2026-05-07).** New crate `crm-purchases-types` opens the §2 module. Depends on `crm-sales-types` for shared building blocks (`Address`, `LineItem`, `Totals`, `RecurringConfig`, `ContactBook`, `PaymentMode`, `RefundMode`) — pragmatic edge until a third domain pulls on the same set, at which point those will lift into `crm-doc-shared`.

- §2.1 [rust/crates/crm-purchases-types/src/vendor.rs](rust/crates/crm-purchases-types/src/vendor.rs) — `Vendor` (Mongo `crm_vendors`), `VendorType` (goods/services/both), MSME registered/category/number, vendor rating, default purchase + expense ledger, TDS section/rate, lead time days, min order qty, vendor portal email. Party-profile fields duplicated from `Client` (extraction to a shared `PartyProfile` deferred — see code comment).
- §2.2 [rust/crates/crm-purchases-types/src/purchase_order.rs](rust/crates/crm-purchases-types/src/purchase_order.rs) — `PurchaseOrder` (Mongo `crm_purchase_orders`), `PurchaseOrderStatus` (draft/awaiting_approval/approved/sent/partial/received/closed/cancelled), `ApprovalWorkflow { requested_by/at, approved_by/at, note }`, `linked_grn_ids` / `linked_bill_ids`. Reuses sales `LineItem` / `Totals`.
- §2.3 [rust/crates/crm-purchases-types/src/bill.rs](rust/crates/crm-purchases-types/src/bill.rs) — `Bill` (Mongo `crm_bills`), `BillStatus` (draft/submitted/approved/paid/partially_paid/overdue/cancelled), `ExpenseLine { account_id, amount, taxes, project_id }`. Carries either inventory `items[]` OR `expense_lines[]` (or both); TDS section/amount, reverse charge, `linked_po_id`/`linked_grn_ids`, optional `RecurringConfig`, system-managed `amount_paid`/`balance`.
- §2.4 [rust/crates/crm-purchases-types/src/debit_note.rs](rust/crates/crm-purchases-types/src/debit_note.rs) — `DebitNote` (Mongo `crm_debit_notes`), `DebitNoteReason` (return/discount/price_adjust/cancel/other), `DebitNoteStatus`. Reuses sales `RefundMode` (semantics flip — "credit" = held against vendor).
- §2.5 [rust/crates/crm-purchases-types/src/payout_receipt.rs](rust/crates/crm-purchases-types/src/payout_receipt.rs) — `PayoutReceipt` (Mongo `crm_payouts`), `PayoutStatus` (sent/cleared/failed), multi-line `Vec<BillApplication>` for split allocation, `excess_as_advance`, TDS deducted at source.
- §2.6 [rust/crates/crm-purchases-types/src/purchase_lead.rs](rust/crates/crm-purchases-types/src/purchase_lead.rs) — `PurchaseLead` (Mongo `crm_purchase_leads`), `PurchaseLeadStage` (sourcing/quotes_received/negotiating/awarded/closed_lost), `awarded_vendor_id` + `linked_po_ids` for conversion-to-PO.
- Workspace registration: `crates/crm-purchases-types` added to [rust/Cargo.toml](rust/Cargo.toml).
- Verification: `cargo clippy -p crm-purchases-types --tests -- -D warnings` clean; `cargo test -p crm-purchases-types` → 6/6 round-trip tests pass (Vendor MSME/TDS, PO approval+links, Bill items+expense_lines coexisting, DebitNote refund_mode, Payout multi-bill apply_to, PurchaseLead snake_case stage).
- §2 Purchases is now COMPLETE on the DTO side.

**Rust port — §3 / §4 / §5 / §6 / §7 / §8 / §9 / §10 DTOs: DONE (2026-05-07).** Eight new crates added in a single 20-agent parallel run; integrator wired the lib.rs of each, fixed three test assertions where agents assumed bare-hex ObjectId JSON (BSON serializes ObjectId as `{"$oid": "<hex>"}` extjson) and one where they expected camelCased inner-tagged-enum field names (serde's enum-level `rename_all` applies to variant tags, not nested struct fields), then ran workspace clippy + tests.

- §3 Inventory — [rust/crates/crm-inventory-types](rust/crates/crm-inventory-types): `item.rs` (§3.1 — full Item struct with variants, alt-units, opening-stock-per-warehouse, dimensions, accounts), `warehouse.rs` (§3.2), `stock_adjustment.rs` (§3.3), `reports.rs` (§3.4 request envelopes).
- §4 Accounting — [rust/crates/crm-accounting-types](rust/crates/crm-accounting-types): `chart_of_accounts.rs` (§4.1 — `Account` + `AccountNature` enum + tree via `parent_group_id`), `voucher_book.rs` (§4.2 — typed voucher books + numbering + reset frequency + approvers), `reports.rs` (§4.3 — Balance Sheet / Trial Balance / P&L / Day Book / Cash Flow envelopes with comparison-period support).
- §5 Sales-CRM — [rust/crates/crm-sales-crm-types](rust/crates/crm-sales-crm-types): `lead.rs` (§5.1), `contact.rs` (§5.2 — adds Relationship + reports-to + secondary owner), `deal.rs` (§5.3 — `DealParty` tagged enum for client-or-lead, `DealProduct` line items, `DealStatus`), `task.rs` (§5.4 — `TaskType`, `LinkedEntity` tagged enum, `Reminder`, `Outcome`, `RecurringConfig` reuse), `automation.rs` (§5.5 — `Trigger`/`Action`/`ActionRecipient` tagged enums + `Condition`/`ConditionOp`/`Throttle`/`AutomationLog`), `form.rs` (§5.6 — `SalesForm` adds `MapTo` + Recaptcha + honeypot + embed snippet vs. the simpler `crm-sales-types::LeadForm`), `analytics.rs` (§5.7 envelopes).
- §6 Banking — [rust/crates/crm-banking-types](rust/crates/crm-banking-types): `bank_account.rs` (§6.1 — `AccountType`, `StatementFormat` (CSV/MT940/OFX/CAMT.053), `AutoFetchConfig`, UPI/SWIFT/IBAN), `employee_account.rs` (§6.2 — same shape + `is_salary_disbursement_default`), `reconciliation.rs` (§6.3 — period + match rules + adjustments + sign-off).
- §7 Reports — [rust/crates/crm-reports-types/src/report.rs](rust/crates/crm-reports-types/src/report.rs): unified `ReportDefinition` + `ReportRequest` + `ReportResult` + `ReportSchedule` + tagged `ReportRecipient` (User/Email/Webhook). 35-variant `ReportKind` enum covers GST + sales + ops + HR registers + Form 16/24Q/12BA.
- §8 Integrations & Settings — [rust/crates/crm-integrations-types](rust/crates/crm-integrations-types): `integration.rs` (23-provider `IntegrationProvider` enum, tagged `IntegrationCredentials` (None/ApiKey/OAuth2/BasicAuth/Custom) with secret-ref strings — never plaintext), `settings.rs` (`TenantSettings` with numbering schemas, branches, branding, message templates per channel, role/permission matrix, custom-field bindings, custom links, menu reorder, plan usage snapshot).
- §9 HRM Payroll — [rust/crates/hrm-payroll-types](rust/crates/hrm-payroll-types): `employee.rs` (§9.1 — Employee composing `PersonalProfile` + `EmploymentProfile` + `EmployeeDocuments` via flatten; full ATS-grade fields including identity docs, bank info, education/past employment/visa), `department.rs` (§9.2 — Department + Designation), `attendance.rs` (§9.3 — geo-tagged punches with selfies + `BreakSlot` with `r#in` keyword escape), `leave.rs` (§9.4 — `LeaveType` + `LeaveApplication` + `ApproverStep` chain), `holiday.rs` (§9.5), `payroll_run.rs` (§9.6 — `EarningLine`/`DeductionLine`/`ReimbursementLine` + `EmployeeRunRow` + bank file format), `salary_structure.rs` (§9.7 — `CalcKind` tagged enum: Fixed/PercentBasic/PercentCtc/Formula), `payslip.rs` (§9.8 — frozen snapshot with own copies of earning/deduction lines so payroll-run vocab can drift), `compliance.rs` (§9.9 — PfRecord/EsiRecord/PtRecord/TdsRecord/Form16 with extjson opaque Part A/B), `performance.rs` (§9.10 — Goal/Kpi/AppraisalReview), `settings.rs` (§9.12 — workflows, approval chains, working days, OT rules, notification templates).
- §10 HRM People — [rust/crates/hrm-people-types](rust/crates/hrm-people-types): `recruitment.rs` (JobPosting/Candidate/Interview/Offer/CareersPage with full ATS profile + parsed skills + interview history), `onboarding.rs` (Onboarding checklist + WelcomeKit + ProbationTracker + OrgChart + DirectorySettings), `people_perf.rs` (Okr/KeyResult/Feedback360/Recognition/Survey/OneOnOne), `learning.rs` (TrainingProgram/EmployeeCertification/LearningPath + progress), `docs_assets.rs` (EmployeeDocument/DocumentTemplate/Asset/AssetAssignment with condition + status enums), `time_expenses.rs` (Timesheet/TravelRequest/ExpenseClaim with status enums), `exit.rs` (Exit/SuccessionPlan/CompensationBand/Announcement/Policy with acknowledgements).
- Workspace registration: 8 crates added to [rust/Cargo.toml](rust/Cargo.toml) `members`.
- Verification: `cargo clippy -- -D warnings` clean across all 8 crates including tests; `cargo test` → **62 tests pass total** across §3-§10 (5 inventory + 3 accounting + 9 sales-crm + 9 banking + 2 reports + 2 integrations + 21 hrm-payroll + 11 hrm-people). Combined with §0-§2 (11 crm-core + 5 sales-client + 4 sales-trip-1 + 4 sales-trip-2 + 6 purchases) and the existing test suite, total Rust DTO test coverage = **92 tests passing**.

The full §0-§10 CRM/HRM DTO layer is now in Rust. The TS `src/lib/definitions.ts` file remains the operational source of truth until consumer crates port; this DTO layer provides the type contract every Rust handler will agree on.

**NEXT (Rust port) →** §11+ Sidebar IA wiring (no DTOs needed) OR move to building the first business-logic crate (e.g. `crm-leads` server-action equivalents using `crm-sales-crm-types::Lead`).

**Rust port — §12 Advanced Features (all 28 sub-sections) DTOs: DONE (2026-05-07).** New crate `crm-extras-types` covers every §12 entity in 28 modules across a 10-agent parallel run.

- §12.1 [subscription.rs](rust/crates/crm-extras-types/src/subscription.rs) — `Subscription`, `BillingFrequency`, `RenewalMode`, `SubscriptionStatus`, `DunningStep`, `SubscriptionEvent`, item lines, trial-until + next-billing-at + paused-until.
- §12.2 [contract.rs](rust/crates/crm-extras-types/src/contract.rs) — `Contract`, `ContractType` (NDA/MSA/SOW/Service/Lease), `ContractStatus`, `EsignProvider` (Internal/Digio/DocuSign/Aadhaar), `Signature` records with IP + timestamp + version history.
- §12.3 [rfq.rs](rust/crates/crm-extras-types/src/rfq.rs) — `Rfq` + `VendorBid` + statuses + bid line items reusing `crm_sales_types::Totals`.
- §12.4 [grn.rs](rust/crates/crm-extras-types/src/grn.rs) — `Grn` (Goods Receipt Note) with batch/expiry/serial tracking + `gin_id`/`mrn_id` cross-refs.
- §12.5 [bom.rs](rust/crates/crm-extras-types/src/bom.rs) — `Bom`, `BomComponent`, `ProductionOrder`, `DowntimeReason`, `ProductionStatus`.
- §12.6 [pos.rs](rust/crates/crm-extras-types/src/pos.rs) — `PosSession`, `PosSale`, `Storefront`, `PaymentSplit`.
- §12.7 [promotions.rs](rust/crates/crm-extras-types/src/promotions.rs) — `Coupon` with tagged `CouponType` (Percent/Flat/Bogo/FreeShipping), `LoyaltyProgram` + tiers + redemption, `GiftCard` + redemption log.
- §12.8 [ticket.rs](rust/crates/crm-extras-types/src/ticket.rs) — `Ticket`, `TicketChannel`, `TicketStatus`, `TicketSeverity`, parent/child + merge log; `Sla` with business hours + escalation matrix.
- §12.9 [knowledge_base.rs](rust/crates/crm-extras-types/src/knowledge_base.rs) — `KbArticle`, status / visibility, helpful counters, view count.
- §12.10 [portal.rs](rust/crates/crm-extras-types/src/portal.rs) — `PortalUser` + `PortalSession` + `PortalCapability` enum.
- §12.11 [field_service.rs](rust/crates/crm-extras-types/src/field_service.rs) — `AmcContract` + `ServiceRequest` + `PartUsed` + statuses; flattens `Assignment` for dispatch.
- §12.12 [booking.rs](rust/crates/crm-extras-types/src/booking.rs) — `BookingResource` + `Booking` with RRULE recurring + reminders + payment status.
- §12.13 [fixed_asset.rs](rust/crates/crm-extras-types/src/fixed_asset.rs) — `FixedAsset` + `DepreciationMethod` (SLM/WDV/Units) + `RetireSellEntry`.
- §12.14 [budget.rs](rust/crates/crm-extras-types/src/budget.rs) — `Budget` with tagged `BudgetHead` (Account/Department/Project/CostCenter), `BudgetScenario`, `BudgetAlert`.
- §12.15 [petty_cash.rs](rust/crates/crm-extras-types/src/petty_cash.rs) — `PettyCashFloat` + `PettyCashVoucher` + `Denomination` count.
- §12.16 [loan.rs](rust/crates/crm-extras-types/src/loan.rs) — `Loan` + `LoanType` (employee advance / customer / vendor) + `EmiScheduleItem`, NPA flag, repayment auto-deduct.
- §12.17 [fx.rs](rust/crates/crm-extras-types/src/fx.rs) — `FxSettings` + `FxRate` + `FxRevaluation` (realised + unrealised).
- §12.18 [multi_branch.rs](rust/crates/crm-extras-types/src/multi_branch.rs) — `Branch`, `CostCenter`, `Project` (canonical Project DTO; older lookup-registry pointer is now backed by this shape).
- §12.19 [nps_referral.rs](rust/crates/crm-extras-types/src/nps_referral.rs) — `NpsSurvey` + `NpsResponse`, `Referral` with tagged `ReferralReward` (Points/Credit/Cash).
- §12.20 [templates.rs](rust/crates/crm-extras-types/src/templates.rs) — universal `Template` (email/SMS/WhatsApp/PDF/portal) + `MergeVariable` + A/B `TemplateVariant`; `NotificationRule` with mute window.
- §12.21 [audit_log.rs](rust/crates/crm-extras-types/src/audit_log.rs) — `AuditEntry` (with `actor_id` separate from tenant-root `Identity::user_id` to avoid JSON-key collision), `AuditAction` enum (16 variants), `FieldDiff`, embedded `EntityTimelineEntry`.
- §12.22 [workflow.rs](rust/crates/crm-extras-types/src/workflow.rs) — `Workflow` definition + `WorkflowRun` + struct-variant `ApproverKind` (User/Role/Manager/Dynamic — struct variants required for internally-tagged enums).
- §12.23 [import_export.rs](rust/crates/crm-extras-types/src/import_export.rs) — `ImportJob`, `DedupeRule`, `BlacklistEntry`, `EraseRequest` (GDPR/DPDP), `ConsentEvent`.
- §12.24 [dashboard.rs](rust/crates/crm-extras-types/src/dashboard.rs) — `Dashboard` + `Widget` with tagged `WidgetSource` (SavedView/Query/Report) + 9-variant `WidgetKind`.
- §12.25 [saved_view.rs](rust/crates/crm-extras-types/src/saved_view.rs) — `SavedView` + recursive `FilterGroup` (AND/OR), `Segment` with cached count.
- §12.26 [background_job.rs](rust/crates/crm-extras-types/src/background_job.rs) — `BackgroundJob` + tagged `JobSchedule` (Once/Cron/OnEvent) + `JobLogEntry`.
- §12.27 [india_tax.rs](rust/crates/crm-extras-types/src/india_tax.rs) — `HsnSacEntry`, `GstSlab`, `EInvoiceCredentials`, `EwayBillCredentials`, `GstrReturn`, `ItcLedgerEntry`, `RcmRegisterEntry`, `MsmeAlert`.
- §12.28 [hr_cases.rs](rust/crates/crm-extras-types/src/hr_cases.rs) — `DisciplinaryCase` + `Hearing` + `EvidenceItem`; `AwardProgram` + `Nomination`.
- Workspace registration: `crates/crm-extras-types` added to [rust/Cargo.toml](rust/Cargo.toml).
- Verification: `cargo clippy -p crm-extras-types --tests -- -D warnings` clean; `cargo test -p crm-extras-types` → **53 tests pass** across the 28 modules. Two integration fixes during merge: renamed `AuditEntry::user_id` → `actor_id` (it collided with `Identity::user_id` which flattens to the same JSON `userId` key) and converted `ApproverKind::User(ObjectId)` / `Role(String)` tuple variants to struct variants `User { id }` / `Role { name }` (internally-tagged enums can't serialize tuple variants holding primitives).
- §12 is now COMPLETE on the DTO side.

The full Rust DTO layer for `crm_function_plan.md` §0 through §12 (sans §11/§13/§14 which are docs/sidebar/cross-feature plans, not entity types) is in place. Total Rust DTO coverage = **145 tests passing across 12 crates** (`crm-core`, `crm-sales-types`, `crm-purchases-types`, `crm-inventory-types`, `crm-accounting-types`, `crm-sales-crm-types`, `crm-banking-types`, `crm-reports-types`, `crm-integrations-types`, `hrm-payroll-types`, `hrm-people-types`, `crm-extras-types`).

---

## 3 · CRM — Inventory

### 3.1 Items / Products
Type (goods/service/bundle), Name ★, SKU ★, Barcode, Variant of, HSN/SAC, GST rate, Cess, Unit ★ (PCS/KG/L/HRS/...), Alt units & conversion, Sub-unit, Brand, Category[], Manufacturer, MPN, Country of origin, Description, Short description, Features, Specifications[], Selling price ★, Selling currency, MRP, Discount %, Wholesale price, Tax inclusive?, Purchase price ★, Purchase currency, Vendor[], Lead time, Reorder point, Reorder qty, Max stock, Track inventory?, Track batches?, Track serials?, Track expiry?, Opening stock per warehouse[], Opening stock value, Image[] (SabFiles), Thumbnail, Gallery, Dimensions (L×W×H), Weight, Volume, Color, Size, Material, Custom attributes[], Tax preference, Sales account, Purchase account, Stock account, COGS account, Active?, Tags[].

### 3.2 Warehouses
Name ★, Code ★, Type (main/branch/franchise/3PL/virtual), Address, GSTIN, Manager, Manager phone, Capacity (units/sqft), Climate-controlled?, Active?, Default for project?, Tags.

### 3.3 Stock Adjustments
Adjustment no. ⚙, Date ★, Warehouse ★, Reason (damage/theft/correction/found/transfer-in/transfer-out), Reference doc, Items[] (qty before/after, batch, serial, cost), Total impact, Approved by, Notes, Attachments.

### 3.4 Reports
Product-wise P&L, Stock Value Report, Batch Expiry Report (with thresholds), Party Transactions Report, All Transactions Report — filters: date range, warehouse, item, category, batch, vendor/customer.

---

## 4 · CRM — Accounting

### 4.1 Account Groups / Chart of Accounts
Code, Name ★, Parent group, Nature (assets/liabilities/equity/income/expense), Sub-nature, Affects gross profit?, Tax behavior, Currency, Opening balance + as-of date, Active?, Description.

### 4.2 Voucher Books
Type (sales/purchase/payment/receipt/contra/journal/credit-note/debit-note), Name ★, Prefix, Suffix, Starting number, Padding, Reset frequency (none/yearly/monthly), Active?, Default for module?, Approval required?, Approvers[].

### 4.3 Reports
Balance Sheet, Trial Balance, Profit & Loss, Income Statement, Day Book, Cash Flow Statement — filters: from/to, branch, project, comparison period, format (T-form/vertical), include zero balances?, drill-down level.

---

## 5 · CRM — Sales CRM (Leads/Deals/Tasks)

### 5.1 Leads
First/Last name ★, Email, Phone, Company, Title, Source, Sub-source, Campaign, Utm{}, Status, Lead score, Owner, Pipeline/Stage, Estimated value, Currency, Probability %, Expected close, Address, Industry, Notes, Tags, Consent (email/SMS/WhatsApp), Custom fields, Attachments, Activity log ⚙.

### 5.2 Contacts
Same as Lead but linked to a Client; plus relationship (decision-maker/influencer/champion/blocker), reports-to, secondary owner.

### 5.3 Deals
Title ★, Pipeline ★, Stage ★, Owner ★, Client/Lead ★, Amount ★, Currency, Probability %, Expected close ★, Actual close, Won/Lost reason, Competitors[], Products[] (item, qty, rate, discount), Notes, Files, Activities, Tags, Custom fields.

### 5.4 Tasks
Title ★, Description, Type (call/email/meeting/todo/follow-up), Status, Priority, Assignee ★, Due date ★, Reminders[], Linked entity (lead/deal/client/ticket/invoice), Checklist[], Attachments, Recurring config, Outcome.

### 5.5 Automations
Trigger (lead-created, stage-change, time-based, form-submit, etc.), Conditions[], Actions[] (email, WhatsApp, SMS, assign, create-task, webhook, update-field), Active?, Throttle, Logs.

### 5.6 Forms
Name, Description, Fields[] (label, type, required, options, validation), Theme, Redirect URL, Submit message, Success webhook, Honeypot, reCAPTCHA, Map-to entity, Default owner, Tags applied, Embed snippet ⚙.

### 5.7 Analytics & Reports
Leads Summary, Team Sales Report, Client Performance Report, Lead Source Report, Pipeline Velocity, Conversion Funnel, Sales Forecast, Activity Report, Win/Loss Analysis.

---

## 6 · CRM — Banking & Payments

### 6.1 Bank Accounts
Account name ★, Bank name ★, Account no. ★, IFSC ★, Branch, Account type (savings/current/OD/CC), Currency, Opening balance + as-of, GL ledger, Statement format (CSV/MT940/OFX), Auto-fetch (provider/credentials), Active?, Default?, UPI VPA, SWIFT, IBAN.

### 6.2 Employee Accounts
Same shape, linked to employeeId; salary disbursement default flag.

### 6.3 Reconciliation
Statement upload, Period, Match rules, Tolerance, Auto-match results, Manual matches, Adjustments[], Closing balance check, Sign-off by/at.

---

## 7 · CRM — Reports

GSTR-1, GSTR-2B, GSTR-3B, Invoice Aging, Payment Report, Expense Report, Income Report, Profit & Loss, Tax Report, Top Clients, Top Products, Sales Deals, Leads Conversion, Birthday/Anniversary, Agent Performance, Project Status, Late Report, Overdue Tasks, Task Report, Ticket Report, Attendance Report, Leave Report, Leave Balance Report — each with: from/to, group-by, format (PDF/XLSX/CSV), schedule (one-time/cron), recipients[].

---

## 8 · CRM — Integrations & Settings

Tally, Zoho Books, QuickBooks, Razorpay, Stripe, PayU, Paytm, Cashfree, Shiprocket, Delhivery, GSTN, e-Invoice, e-Way bill, Google Calendar, Outlook, Gmail, Slack, Telegram, WhatsApp Cloud, Twilio, Webhook, Zapier, Make.com.
Settings: numbering schemas, default tax rates, default currency, fiscal year, branches, branding (logo, signature, watermark), email templates, WhatsApp/SMS templates, terms libraries, role/permission matrix, custom fields per entity, custom links, menu reordering, plan/credit usage view.

---

## 9 · HRM — Payroll

### 9.1 Employees
Personal: Salutation, First/Middle/Last name ★, Display name, DOB ★, Gender, Marital status, Spouse, Children[], Blood group, Nationality, Religion, Languages[], Photo, Personal email, Personal phone, Emergency contact (name/phone/relation), Identity (Aadhaar, PAN, Passport+expiry, Driving licence, Voter ID), Bank (acct no, IFSC, bank, branch, name on acct), UAN, ESIC no., Address (current, permanent).

Employment: Employee ID ★, Joining date ★, Confirmation date, Probation end, Type (full-time/part-time/contract/intern/consultant), Department ★, Designation ★, Reporting manager, Dotted-line manager, Work location, Shift, Work email ★, Work phone, Extension, Asset list[], Skills[], Certifications[], Education[], Past employment[], Salary structure ★, CTC, Variable %, Notice period, Status (active/on-leave/terminated/resigned), Exit date, Exit reason.

Documents: Offer letter, Appointment, Contract, NDA, KYC docs, Education certs, ID proofs, Visa (number, type, issued, valid till, country), Work permit.

### 9.2 Departments / Designations
Code, Name ★, Parent department, Head, Cost center, Description, Active?, Color, Designation level/grade, Min/Max CTC band, Reports-to designation.

### 9.3 Attendance
Date ★, Employee ★, Shift, Punch-in time, Punch-in location (lat/long, IP, device), Punch-in selfie, Punch-out time/location/selfie, Break in/out, Total hours ⚙, Overtime hours ⚙, Status (present/absent/half-day/leave/holiday/WFH), Late by, Early-out by, Source (manual/biometric/web/mobile), Approver, Notes.

### 9.4 Leave Management
Leave types (CL/SL/EL/ML/PL/Comp-off/Unpaid/...): code, name, paid?, accrual rule, max balance, carry-forward, encashable?, gender-restricted?, min service. Application: type ★, from ★, to ★, half-day, days ⚙, reason, attachments, approver chain, status, leave balance snapshot.

### 9.5 Holidays
Date ★, Name ★, Type (national/regional/religious/optional/restricted), Recurring?, Applicable locations[], Notes.

### 9.6 Payroll Run
Period ★, Pay date, Lock date, Employees[], Earnings[] (basic, HRA, conveyance, special, bonus, OT, incentives, arrears), Deductions[] (PF, ESI, PT, TDS, loan, LOP), Reimbursements[], Gross, Net, Cost-to-company, Bank file (NEFT/IMPS), Status (draft/processing/approved/disbursed/closed), Approvals.

### 9.7 Salary Structure
Name, Effective date, Components[] (name, code, type=earning|deduction|reimbursement, calc=fixed|%basic|%CTC|formula, taxable?, statutory?, prorate?, frequency, max cap, min cap), Applicable to (employee/department/grade), Active?.

### 9.8 Payslips
Auto-generated per run; fields: header (company, period), employee details, earnings table, deductions table, net pay in words, YTD totals, attendance summary, leave balance, bank info, signature, watermark, locked?, sent?, downloaded log.

### 9.9 Statutory Compliance
PF: UAN, PF no., employer/employee %, wage ceiling, PF challan upload.
ESI: ESI no., employer/employee %, wage ceiling, ESI challan.
PT: state, slabs, monthly amount, challan.
TDS: section (192/194C/194J/...), PAN, deductee type, gross, deduction, challan, certificate.
Form 16: AY, employer TAN, Part A (TDS summary), Part B (income computation), digital signature, dispatch log.

### 9.10 Performance & Appraisal
Goal Setting, KPI Tracking, Appraisal Reviews — fields: cycle, employee, reviewer(s), self-rating, manager-rating, peer-rating, normalized score, increment %, new CTC, promotion?, comments, approver.

### 9.11 Reports
Attendance Report, Leave Report, Leave Balance, Payroll Summary, Salary Register, PF/ESI/PT/TDS registers, Form 24Q, Form 12BA, Bank Disbursement Sheet — exports + scheduled emails.

### 9.12 HRM Settings
Workflows, Approval chains, Working days, Overtime rules, Late marking rules, Leave year, Notice period rules, Probation rules, Resignation workflow, Asset return checklist, Notification templates.

---

## 10 · HRM — HR (People Ops)

Recruitment: Job Postings (title, location, dept, type, openings, JD, skills, salary range, experience, education, status, careers-page visibility, expiry), Candidates (full ATS profile, resume, parsed skills, source, stage, ratings, interview history, offer status), Interviews (round, panel, mode, link, slot, feedback form), Offers (template, CTC, joining date, validity, e-sign, status), Careers Page (slug, theme, intro, jobs list, application form fields).

Onboarding: Onboarding (checklist, owner, due dates, completion %), Welcome Kits (items, assigned, delivered), Probation Tracker (start, end, milestones, review, decision), Org Chart (visualizer settings), Directory (search filters, visibility).

People Performance: OKRs & Goals (objective, KRs, weight, period, owner, progress %, score), 360 Feedback (cycle, raters, anonymous?, questions, summary), Recognition (kudos type, points, message, public?), Surveys & Pulse (questions, audience, anonymous?, schedule, results), One-on-Ones (template, agenda, action items).

Learning: Training Programs (title, mode, instructor, schedule, capacity, attendance, score, certificate), Certifications (employee, name, issuer, issued, expiry, file), Learning Paths (steps, prerequisites, completion).

Documents & Assets: Documents (employee, type, file, expiry, verified?), Document Templates, Asset Register (asset id, type, model, serial, value, condition, status), Asset Assignments (employee, from, to, return condition, photos).

Time & Expenses: Timesheets (week, project, task, hours/day, status, approver), Travel Requests (purpose, mode, from/to, dates, advance, status), Expense Claims (lines: date, category, amount, receipt, project, approver, reimbursed?).

Exit & Comp: Exits (type, notice start, last day, F&F, exit interview, NOC, asset return, knowledge transfer), Succession Plans (role, candidates, readiness), Compensation Bands (level, min/mid/max), Announcements (audience, scheduled, channels), Policy Library (policy, version, file, acknowledgement).

---

## 11 · Sidebar IA (target structure for agents)

```
CRM
├── Dashboard
├── Sales
│   ├── Clients & Prospects · Quotations · Proforma · Sales Orders
│   ├── Delivery Challans · Invoices · Payment Receipts · Credit Notes
│   ├── Pipelines · Forms
├── Purchases
│   ├── Vendors · Purchases & Expenses · Purchase Orders · Payouts
│   ├── Debit Notes · Purchase Leads · Hire & Services
├── Inventory
│   ├── All Items · Warehouses · Stock Adjustments
│   ├── Reports → P&L · Stock Value · Batch Expiry · Party Txns · All Txns
├── Accounting
│   ├── Account Groups · Chart of Accounts · Voucher Books
│   ├── Reports → Balance Sheet · Trial Balance · P&L · Income Statement · Day Book · Cash Flow
├── Sales CRM
│   ├── Leads · Contacts · Deals · Tasks · Automations
│   ├── Pipelines · Pipeline Stages · Statuses · Sources · Categories · Products · Agents
│   ├── Forms · Custom Forms · Notes · Consent · Settings
│   ├── Reports → Leads Summary · Team Sales · Client Performance · Lead Source
├── Banking
│   ├── All Accounts · Bank Accounts · Employee Accounts · Bank Transactions · Reconciliation
├── HRM
│   ├── Recruitment → Jobs · Candidates · Interviews · Offers · Careers Page
│   ├── People → Directory · Onboarding · Welcome Kits · Probation · Org Chart
│   ├── Attendance & Leave → Daily Attendance · Leave · Holidays · Shifts · Rotations · Change Requests · Time Logs · Weekly Timesheets
│   ├── Payroll → Employees · Add Employee · Departments · Designations · Salary Structure · Run Payroll · Payslips
│   ├── Compliance → PF/ESI · Professional Tax · TDS · Form 16
│   ├── Performance → Goals · KPIs · Appraisals · OKRs · 360 Feedback · One-on-Ones · Recognition · Surveys
│   ├── Learning → Training · Certifications · Learning Paths
│   ├── Docs & Assets → Documents · Templates · Assets · Assignments
│   ├── Travel & Expenses → Timesheets · Travel · Expense Claims
│   ├── Exit & Comp → Exits · Succession · Compensation Bands · Announcements · Policies
│   ├── Reports → Attendance · Leave · Payroll Summary · Salary Register
│   └── Settings
├── Reports
│   ├── GST → GSTR-1 · GSTR-2B
│   ├── Sales → Top Clients · Top Products · Sales Deals · Invoice Aging · Payment Report
│   ├── Operations → Late · Overdue Tasks · Task · Ticket · Project Status · Agent Performance
│   ├── HR → Attendance · Leave · Leave Balance · Birthday/Anniversary
│   ├── Finance → Income · Expense · P&L · Tax · Leads Conversion
├── Integrations
└── CRM Settings
```

This is the IA the sidebar agent should produce. All current card pages should redirect (or 404) once their items live in the sidebar.

---

## 12 · Additional Features (advanced / cross-cutting)

### 12.1 Subscriptions & Recurring
Plan ★, billing cycle (weekly/monthly/quarterly/annual/custom-cron), trial days, setup fee, prorate?, dunning rules, retry schedule, grace period, auto-pause on failure?, tax mode, mid-cycle change behavior (immediate/next-cycle/end-of-period), cancellation policy, renewal reminders[], gateway, customer portal slug, webhook on event[].

### 12.2 Contracts & E-Signature
Title ★, party A/B, type (NDA/MSA/SOW/AMC/employment/vendor), template, version, effective date ★, expiry, auto-renew?, renewal notice (days), values inserted via merge tokens, signers[] (name, email, phone, role, order, fallback), signing method (typed/drawn/uploaded/Aadhaar e-sign/DSC), audit trail (IP, geo, device, timestamps), watermark, status (draft/sent/viewed/partially_signed/completed/expired/voided), reminders, attachments, post-sign webhook.

### 12.3 RFQ / Bid Management
RFQ no., scope, vendors invited[], deadline, attachments, vendor responses[] (price, lead time, T&C, attachments, score), evaluation matrix, awarded vendor, conversion to PO.

### 12.4 GRN / GIN / MRN (Inventory documents)
GRN: PO ref ★, vendor invoice no., received qty per line, accepted/rejected qty, batch, expiry, serials, QC status, warehouse, store-keeper, photos.
GIN (Goods Issue Note): department, issued-to employee, project, items, qty, return date.
MRN (Material Return): from warehouse, to vendor/inventory, reason, items, condition.

### 12.5 BOM / Manufacturing
BOM: finished good ★, components[] (item, qty, unit, scrap %, optional?), labour, overhead, output qty, version, effective date, status.
Job Card / Production Order: BOM ref, planned qty, start/end, machine, operator, actual yield, scrap, downtime reasons, cost roll-up.

### 12.6 POS / Online Store
Outlet, terminal, cashier, shift, opening cash, items scan, customer, applied promotions, payment splits, change, receipt template, hold/recall, refund/exchange.
Online store: storefront slug, theme, collections, products, pricing rules, taxes, shipping zones, checkout fields, gateways, abandoned cart recovery.

### 12.7 Coupons / Promotions / Loyalty / Gift Cards
Coupon: code, type (% / flat / BOGO / free-ship), min cart, max uses (total + per customer), validity, applicable products/categories/customers, stackable?, exclusions.
Loyalty: tiers (name, threshold, multiplier, perks), points per ₹, expiry, redemption ratio, partner stores.
Gift Card: code, issued-to, value, balance, expiry, transferable?, redemption log.

### 12.8 Tickets / Help Desk / SLA
Ticket: subject ★, requester, channel (email/web/WhatsApp/chat/phone/portal), product, category, priority, severity, due-by ⚙ (from SLA), assignee, status, satisfaction rating, internal notes, attachments, linked deal/invoice, parent/child, merge log.
SLA: name, conditions, first-response target, resolution target, business hours, escalation matrix.

### 12.9 Knowledge Base & FAQ
Category, slug, title, body (rich), tags, status (draft/published), visibility (public/portal/internal), helpful?-counter, view count, related articles, last reviewed, owner.

### 12.10 Customer / Vendor / Employee Portals
Self-serve login, document downloads (invoices, payslips, Form 16), raise tickets, approve quotes, accept e-sign, update KYC, view balance, request leave (employee), apply for leads (vendor).

### 12.11 Field Service / Dispatch / AMC
Service contract (AMC): customer, asset[], coverage, start/end, frequency, technician, billing, escalation.
Service request: type, priority, location, scheduled at, technician, parts used, time spent, photos, customer signature, invoice generated?

### 12.12 Bookings / Reservations / Appointments
Resource (room/equipment/staff), service, customer, slot start/end, recurring rule, capacity, payment status, reminders, cancellation policy, no-show flag.

### 12.13 Fixed Assets & Depreciation
Asset code, name, category, purchase date, supplier, cost, useful life, depreciation method (SLM/WDV/units), residual value, location, custodian, condition, warranty, insurance, AMC, retire/sell entry, accumulated depreciation ⚙, NBV ⚙.

### 12.14 Budgets & Forecasting
Budget head (account/department/project/cost-center), period, plan amount, actual ⚙, variance ⚙, alerts at %, owner, approver, scenario (best/base/worst).

### 12.15 Cash & Petty Cash
Petty cash float per branch/employee, top-up, expense voucher, denomination count, daily reconciliation, IOU register.

### 12.16 Loans & Advances
Type (employee salary advance / customer loan / vendor advance), principal, interest rate, tenure, EMI schedule ⚙, prepayment rules, NPA flag, guarantor, documents, repayment auto-deduct from payroll?

### 12.17 Multi-currency & FX
Base currency, supported currencies[], FX provider, rate as-of, manual override, realised gain/loss, unrealised, revaluation run.

### 12.18 Multi-branch / Multi-location / Cost Centers
Branch (code, name, address, GSTIN, manager, opening balance), Cost center (code, name, parent, default ledger, budget), Project (code, name, customer, budget, billable?, members[]).

### 12.19 Reviews / NPS / Referral
NPS survey: trigger event, audience, scale, follow-up question, dispatch channel, scoring, dashboard.
Referral: referrer, referee, code, status, reward (points/credit/cash), payout.

### 12.20 Communications & Templates
Universal template store: type (email/SMS/WhatsApp/PDF/portal), category, language, variables (merge tokens with descriptors), preview, locked variants, A/B variants, last used, owner.
Reminder/Notification rules: event, audience, channel, lead-time, frequency, throttle, mute window.

### 12.21 Audit Log & Activity Timeline
Per-entity timeline (created, edited fields with diff, status changes, comments, attachments added, emails sent, calls logged, e-signs, payments). Global audit (user, IP, geo, action, target, before/after, reason).

### 12.22 Workflow & Approvals
Definition: name, entity, trigger condition, steps[] (approver = user/role/manager/dynamic, parallel?, SLA, on-reject, on-timeout), version, active, audit.
Run: state (pending/approved/rejected/escalated), comments per step, attachments per step.

### 12.23 Bulk Import / Export / Data Hygiene
Per entity: CSV/XLSX/JSON, mapping wizard, dedupe key, validation report, dry-run, schedule. Hygiene: dedupe rules, merge UI, blacklist, GDPR/DPDP erase request workflow, consent ledger.

### 12.24 Custom Dashboards / BI
Widgets (metric/line/bar/donut/table/funnel/heatmap/map/list), data source (saved view / SQL-like query / report), filters, drill-down, share/embed, refresh interval.

### 12.25 Saved Views / Filters / Segments
Per list: filters (with AND/OR groups), columns, sort, density, share scope (private/team/global), pinned. Audience segments built from any entity (used by automations, broadcasts, dashboards).

### 12.26 Background Jobs / Scheduling
PM2 worker queues already exist — exposed UI: job type, schedule (cron / once / on-event), payload, retries, last run, next run, logs.

### 12.27 Tax & Compliance India (deepening)
HSN/SAC master, GST rate slabs, e-invoice IRP credentials, e-way bill credentials, GSTR-1/2B/3B/9 generation + reconciliation, ITC ledger, RCM register, TCS u/s 206C, TDS u/s 194Q, MSME 45-day rule alerts, SAC for services, GSTR-CMP-08 (composition), 8-digit HSN for >₹5cr turnover toggle.

### 12.28 HR — Disciplinary, Grievance, Awards, Disciplinary
Cases: type, employee, raised by, severity, evidence, hearings, decision, appeal.
Awards/Recognitions: program, criteria, nominations, voting, winner, payout, certificate.

---

## 13 · Cross-feature linking plan

Every field that **references another entity** must be a **searchable, type-ahead, paginated picker** — not a free-text input, not a static native `<select>`. This unlocks: data integrity, instant navigation between modules, single source of truth, and automation (reminders, automations, reports) that work across the whole graph.

### 13.1 Master entity catalogue (every "linkable" entity)

| Entity | Search by | Display chip | Quick-create? | Recent items? |
|---|---|---|---|---|
| Client | name, GSTIN, phone, email, code | name + GSTIN + city | yes | yes |
| Vendor | name, GSTIN, phone, email | name + GSTIN | yes | yes |
| Lead / Contact | name, phone, email, company | name + company + stage | yes | yes |
| Deal | title, client name | title + amount + stage | yes | yes |
| Employee | name, employeeId, dept, designation, email | name + designation + dept | yes (HR only) | yes |
| Item / Product | name, SKU, barcode, HSN | thumb + name + SKU + price | yes | yes |
| Warehouse | name, code, city | name + code | yes | no |
| Bank account | name, last-4, IFSC | name + last-4 | yes | no |
| Account (COA) | code, name | code + name + nature | yes | yes |
| Pipeline / Stage | name | name + color dot | no | no |
| Department | name, code | name + head | yes | no |
| Designation | name, level | name + level | yes | no |
| Tax rate | name, % | rate + label | no | yes |
| Currency | code | code + symbol + name | no | yes |
| Project / Cost center / Branch | code, name | code + name | yes | yes |
| Document template | name, type | name + type | no | yes |
| User / Agent / Owner | name, email, role | avatar + name + role | no | yes |
| Tag | name | name | yes (inline) | yes |
| Source / Status / Category | name | name | yes (inline) | yes |
| HSN / SAC | code, description | code + desc + GST% | no | yes |
| Pincode | pincode | pincode + city + state | no | no |
| State / Country | name, ISO | flag + name | no | no |
| Asset | code, name, serial | code + name + custodian | no | no |
| Ticket | id, subject | #id + subject + priority | no | yes |
| Invoice / Quotation / SO / PO / Bill / Receipt | doc no., client/vendor | no. + party + amount + date | no | yes |
| Coupon | code | code + value + status | no | no |
| Plan / Subscription | name | name + cycle + price | no | yes |
| Shift | name, timing | name + timing | no | no |
| Holiday | date | date + name | no | no |

> Rule: **if a field stores a foreign id, it MUST use the picker.** No free-text input for entity references.

### 13.2 Where these pickers must replace existing fields

Below is the audit map — wherever the form has the **left** field today, change to a picker bound to the **right** entity:

- Invoice / Quotation / SO / Proforma / Delivery / Receipt / Credit Note → `client` (Client picker), `salesAgent` (User), `pipeline/deal` (Deal), `warehouse` (Warehouse), `taxRate` (Tax), `currency` (Currency), `template` (Template), `branch` (Branch), `project` (Project), each `lineItem.itemId` (Item), `paymentMethod`/`bankAccount` (Bank).
- Bill / PO / Debit Note / Payout → `vendor` (Vendor), the rest analogous.
- Lead / Contact / Deal / Task → `owner` (User), `pipelineId/stageId` (Pipeline+Stage), `source` (Source), `client/contact` (Client/Contact), linked `dealId`, `taskId`, `ticketId`.
- Item form → `vendor[]` (Vendor multi), `category` (Category), `brand` (Brand), `manufacturer` (Manufacturer), `salesAccount` / `purchaseAccount` / `stockAccount` / `cogsAccount` (Account), `taxRate` (Tax), `unit/altUnit` (Unit), `hsn` (HSN/SAC), `defaultWarehouse` (Warehouse).
- Employee form → `department` (Department), `designation` (Designation), `manager` (Employee), `dottedManager` (Employee), `shift` (Shift), `salaryStructure` (Salary Structure), `bankAccount` (BankAccount), `branch` (Branch).
- Payroll Run → `employees[]` (Employee multi).
- Leave application → `type` (Leave Type), `approver` (Employee).
- Asset / GRN / MRN → `item` (Item), `vendor` (Vendor), `warehouse` (Warehouse), `assignedTo` (Employee).
- Tickets → `requester` (Client | Lead | Employee), `assignee` (User), `product` (Item).
- Reports / Dashboards / Saved Views — every filter chip uses a picker.
- Automations / Workflows — every "if X equals" / "set Y to" picks the entity through a picker (with attribute drill-down).

### 13.3 Reusable component spec — `<EntityPicker>`

A single component, configured per entity. New code MUST use it; existing one-off `<Select>`s should be migrated.

```ts
// src/components/crm/entity-picker.tsx
type EntityKey =
  | 'client' | 'vendor' | 'lead' | 'contact' | 'deal' | 'employee'
  | 'item' | 'warehouse' | 'bankAccount' | 'account' | 'pipeline'
  | 'stage' | 'department' | 'designation' | 'taxRate' | 'currency'
  | 'project' | 'costCenter' | 'branch' | 'template' | 'user'
  | 'tag' | 'source' | 'status' | 'category' | 'hsn' | 'pincode'
  | 'state' | 'country' | 'asset' | 'ticket' | 'invoice' | 'quotation'
  | 'salesOrder' | 'purchaseOrder' | 'bill' | 'receipt' | 'coupon'
  | 'plan' | 'subscription' | 'shift' | 'holiday';

interface EntityPickerProps<T extends EntityKey> {
  entity: T;                              // drives endpoint, schema, chip
  value: string | string[] | null;        // id(s)
  onChange: (next: string | string[] | null, hydrated?: any | any[]) => void;
  multi?: boolean;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  filter?: Record<string, unknown>;       // e.g. { active: true }, { warehouseId }
  scope?: 'project' | 'tenant' | 'global';
  allowCreate?: boolean;                  // shows "+ Create new …" inside dropdown
  createInitial?: Partial<EntityShape<T>>;// pre-fill quick-create modal
  recentLimit?: number;                   // default 5 — shown when search empty
  showChipMeta?: boolean;                 // default true
  hydrate?: 'always' | 'on-demand';       // include full doc back to onChange
  popoverWidth?: 'trigger' | 'auto' | number;
  onCreated?: (created: any) => void;
}
```

Behaviour:
1. **Search**: 200ms debounce, server `q` param + entity-specific filters; results are paginated (cursor or page+limit, infinite-scroll).
2. **Empty state**: shows "Recent" (last 5 used or last 5 viewed by current user — stored in `userPrefs.recent.<entity>`).
3. **Hydrate on mount**: when `value` is set but the option list doesn't include it, fetch by id and prepend.
4. **Quick-create**: when `allowCreate=true`, last item in the dropdown is "+ Create new <entity>" → opens the entity's existing create form in a side-sheet/modal (re-using the route component, not duplicating). On success calls `onChange` and `onCreated`.
5. **Keyboard**: arrow-keys, Enter to select, Cmd/Ctrl+K to clear, Cmd/Ctrl+Click chip to navigate to entity detail.
6. **Multi**: chips with × to remove; bulk paste (comma/newline) parses into multi-id resolution against canonical fields (e.g. SKUs for items).
7. **Inline detail peek**: hover/long-press a chip shows a 320px popover with summary and quick links (View · Edit · Open in module). Reuse `<EntityPeek entity=… id=… />`.
8. **Field-level RBAC**: respects plan + role; if user lacks `read.<entity>` the picker degrades to read-only chip.

### 13.4 API contract — `/api/crm/lookup/[entity]`

One unified server action **and** route per entity for type-ahead. Reuse existing actions where they exist.

```ts
// app/api/crm/lookup/[entity]/route.ts
GET ?q=&page=&limit=&filter=<json-base64>&ids=<csv>&scope=&projectId=
→ { items: T[], page, limit, total, hasMore, recent?: T[] }
```

Each entity provides:
- `searchableFields[]`: ordered list of fields searched (full-text index in Mongo).
- `chip(item)`: returns `{ primary, secondary, tertiary, avatarUrl, color }` — drives the visual chip without leaking schema details.
- `defaultFilter(ctx)`: e.g. `{ active: true, archived: { $ne: true } }`.
- `permissions(ctx)`: which roles may read.

**Rust port — §13.4 contract types: DONE (2026-05-07).** New crate `crm-lookup-types` mirrors the TS shapes byte-for-byte so a future Rust executor (`crm-lookup`) can drop in without renegotiating the wire format. Pure types, no Mongo / async / I/O.

- [rust/crates/crm-lookup-types/src/entity_key.rs](rust/crates/crm-lookup-types/src/entity_key.rs) — `EntityKey` enum (42 variants — the canonical 18 already in TS plus the 24 §13.1 expansion targets like `Lead`/`Deal`/`Invoice`/`Pincode`/`State`/`Country`/`Asset`/`Ticket`). camelCase serde matches TS string-union (`bankAccount`, `taxRate`, `salesOrder`, …). Helper `EntityKey::as_str()` for hot-path string comparisons.
- [rust/crates/crm-lookup-types/src/params.rs](rust/crates/crm-lookup-types/src/params.rs) — `LookupParams { q, page, limit, ids, filter, scope, project_id }`, `Scope` enum (project/tenant/global) with default `Tenant`, `LOOKUP_MAX_LIMIT = 50` / `LOOKUP_DEFAULT_LIMIT = 20` constants.
- [rust/crates/crm-lookup-types/src/chip.rs](rust/crates/crm-lookup-types/src/chip.rs) — `LookupChip { primary, secondary?, tertiary?, avatar_url?, color? }`.
- [rust/crates/crm-lookup-types/src/result.rs](rust/crates/crm-lookup-types/src/result.rs) — `LookupItem { id, chip, raw }` + `LookupResult { items, page, limit, total?, has_more, recent }`.
- Workspace registration: `crates/crm-lookup-types` added to [rust/Cargo.toml](rust/Cargo.toml).
- Verification: `cargo clippy -p crm-lookup-types --tests -- -D warnings` clean; `cargo test -p crm-lookup-types` → 8 tests pass (round-trips per type, camelCase wire format, `Scope::default() == Tenant`, optional fields skip-serialize).
- **§13.4 executor — Rust `crm-lookup` crate: DONE (2026-05-07).** Mongo-backed executor + Axum handler reusing `sabnode-db::MongoHandle` and `sabnode-common::ApiError`. The Next.js TS server action can now be replaced by a thin proxy (or deleted) once auth middleware is wired upstream.
  - [rust/crates/crm-lookup/src/context.rs](rust/crates/crm-lookup/src/context.rs) — `TenantCtx { user_id, project_id?, scope }` with builder methods.
  - [rust/crates/crm-lookup/src/mongo_lookup.rs](rust/crates/crm-lookup/src/mongo_lookup.rs) — generic `execute(mongo, spec, params, ctx)` doing tenant filter + pagination + free-text `$regex` search + id hydration + caller-filter merge. `build_regex` escapes metacharacters; uses `limit + 1` fetch trick to infer `has_more` without a separate count.
  - [rust/crates/crm-lookup/src/entities/](rust/crates/crm-lookup/src/entities/) — 8 per-entity `LookupSpec` constants (one module each):
    - `client.rs` — `crm_accounts`, search across name/email/phone/gstin/code/displayName, chip = displayName + GSTIN + city.
    - `vendor.rs` — `crm_vendors`, chip = displayName/companyName + GSTIN.
    - `item.rs` — `crm_products`, chip = name + "SKU + price" + HSN + thumbnail.
    - `employee.rs` — `crm_employees`, hides terminated/resigned, chip = name + "designation · department".
    - `user.rs` — `users` (cross-tenant collection), chip = name + email + avatar.
    - `account.rs` — `crm_chart_of_accounts`, chip = "code · name" + nature.
    - `warehouse.rs` — `crm_warehouses`, chip = name + code.
    - `bank_account.rs` — `crm_payment_accounts`, chip = accountName + masked "•••• 1234" tail + bankName.
  - [rust/crates/crm-lookup/src/search.rs](rust/crates/crm-lookup/src/search.rs) — top-level `pub async fn search(mongo, entity, params, ctx)` dispatch. Unwired entities return `BadRequest` with a clear "not yet implemented" message so the picker can fall back to the TS action gracefully.
  - [rust/crates/crm-lookup/src/handler.rs](rust/crates/crm-lookup/src/handler.rs) — Axum route `lookup_route` with `LookupState { mongo }`, `LookupQuery` matching the TS query string (`q&page&limit&ids&filter&scope&userId&projectId`), URL `entity` segment parsed via `serde_json::from_value`. Returns `Json<LookupResult>` on success; `ApiError`'s `IntoResponse` impl handles failures.
  - Workspace registration: `crates/crm-lookup` added to [rust/Cargo.toml](rust/Cargo.toml).
  - Verification: `cargo clippy -p crm-lookup --tests -- -D warnings` clean; `cargo test -p crm-lookup -p crm-lookup-types` → 12 tests pass total (regex escaping, regex preserves plain text, parse_entity accepts canonical keys / rejects unknown, plus the 8 type round-trips from the types crate).
  - **§13.4 host wiring — DONE (2026-05-07).** `crm-lookup::router::<S>()` exposed (generic over any state where `MongoHandle: FromRef<S>`); the `LookupState` wrapper was dropped in favour of extracting `MongoHandle` directly via the same FromRef plumbing every other domain crate uses (`wachat-projects`, `wachat-contacts`, etc.). `sabnode-api` now mounts the lookup router at `/v1/crm/lookup/{entity}` — see [rust/crates/api/src/router.rs](rust/crates/api/src/router.rs) `.nest("/v1/crm/lookup", crm_lookup)` and [rust/crates/api/Cargo.toml](rust/crates/api/Cargo.toml) `crm-lookup = { path = "../crm-lookup" }`. `cargo check -p sabnode-api` clean (only pre-existing wachat-templates-router warnings remain). With this, `GET /v1/crm/lookup/client?q=acme&userId=<oid>` is a live HTTP endpoint backed by the Rust executor — TS callers can switch over once session middleware sets the `userId` query param (or, when auth lands, a request extension).
  - **§13.4 mechanical batch — DONE (2026-05-07).** 28 entity modules added in an 8-agent parallel run; integrator wired `entities/mod.rs` + match arms in `search.rs`. **36 of 42 `EntityKey` variants are now live.**
    - Sales-CRM: [lead.rs](rust/crates/crm-lookup/src/entities/lead.rs), [contact.rs](rust/crates/crm-lookup/src/entities/contact.rs), [deal.rs](rust/crates/crm-lookup/src/entities/deal.rs).
    - Sales docs: [invoice.rs](rust/crates/crm-lookup/src/entities/invoice.rs), [quotation.rs](rust/crates/crm-lookup/src/entities/quotation.rs), [sales_order.rs](rust/crates/crm-lookup/src/entities/sales_order.rs).
    - Purchase docs: [purchase_order.rs](rust/crates/crm-lookup/src/entities/purchase_order.rs), [bill.rs](rust/crates/crm-lookup/src/entities/bill.rs), [receipt.rs](rust/crates/crm-lookup/src/entities/receipt.rs).
    - §12 advanced: [asset.rs](rust/crates/crm-lookup/src/entities/asset.rs), [ticket.rs](rust/crates/crm-lookup/src/entities/ticket.rs), [subscription.rs](rust/crates/crm-lookup/src/entities/subscription.rs), [plan.rs](rust/crates/crm-lookup/src/entities/plan.rs), [coupon.rs](rust/crates/crm-lookup/src/entities/coupon.rs), [template.rs](rust/crates/crm-lookup/src/entities/template.rs).
    - HR refs: [department.rs](rust/crates/crm-lookup/src/entities/department.rs), [designation.rs](rust/crates/crm-lookup/src/entities/designation.rs), [shift.rs](rust/crates/crm-lookup/src/entities/shift.rs), [holiday.rs](rust/crates/crm-lookup/src/entities/holiday.rs).
    - Multi-branch: [project.rs](rust/crates/crm-lookup/src/entities/project.rs), [branch.rs](rust/crates/crm-lookup/src/entities/branch.rs), [cost_center.rs](rust/crates/crm-lookup/src/entities/cost_center.rs), [category.rs](rust/crates/crm-lookup/src/entities/category.rs).
    - Small ref catalogues: [tag.rs](rust/crates/crm-lookup/src/entities/tag.rs), [source.rs](rust/crates/crm-lookup/src/entities/source.rs), [status.rs](rust/crates/crm-lookup/src/entities/status.rs), [tax_rate.rs](rust/crates/crm-lookup/src/entities/tax_rate.rs), [hsn.rs](rust/crates/crm-lookup/src/entities/hsn.rs).
    - Verification: `cargo clippy -p crm-lookup --tests -- -D warnings` clean; tests 12/12 pass; `cargo check -p sabnode-api` clean — the live `/v1/crm/lookup/{entity}` endpoint now resolves all 36 wired entities.
  - **§13.4 alternate executors — DONE (2026-05-07).** 5 of the 6 deferred entities now wired via two new executors; only Pincode remains.
    - [rust/crates/crm-lookup/src/embedded_lookup.rs](rust/crates/crm-lookup/src/embedded_lookup.rs) — handles `Pipeline` and `Stage` against `users.crmPipelines[]`. Stage emits the composite id `<pipelineId>:<stageId>` matching the TS shape. In-memory case-insensitive `q` filter + paginate (since the embedded array is small).
    - [rust/crates/crm-lookup/src/static_lookup.rs](rust/crates/crm-lookup/src/static_lookup.rs) — handles `Currency` (12 ISO codes with symbol + name), `Country` (35 most common ISO 3166-1 alpha-2), `State` (29 Indian states + 7 UTs). Hard-coded for now; growing to the full ISO 3166-1 / state-of-the-world set is a future `include_str!` swap to bundled CSV.
    - `search::search` rewritten as a 3-tier dispatcher: embedded → static → Mongo collection. The Mongo branch is exhaustive over remaining `EntityKey` variants; only `Pincode` returns `BadRequest` with a "fall back to TS" message.
    - Verification: `cargo clippy -p crm-lookup --tests -- -D warnings` clean; `cargo test` → **19 tests pass** (up from 12; +7 covering case-insensitive embedded match, composite id format, currency/country/state filtering + pagination); `cargo check -p sabnode-api` clean.
  - **§13.4 100% closed (2026-05-07).** All 42 `EntityKey` variants are now live on `/v1/crm/lookup/{entity}`.
    - Pincode wired via [rust/crates/crm-lookup/src/entities/pincode.rs](rust/crates/crm-lookup/src/entities/pincode.rs) → `crm_pincodes` collection (cross-tenant — seed once at deploy from the India Post CSV).
    - New `LookupSpec::is_global: bool` field added so cross-tenant reference data opts out of the per-tenant `userId` filter without requiring callers to pass `Scope::Global` per request. All 37 existing entity specs default to `is_global: false`; only `pincode.rs` flips it to `true`. The executor now skips the `userId` clause when `spec.is_global || ctx.scope == Global`.
    - Verification: `cargo clippy -p crm-lookup --tests -- -D warnings` clean; `cargo test` → 19 tests pass; `cargo check -p sabnode-api` clean.
  - **§13.9 Redis recents — DONE (2026-05-07).** Per-tenant per-entity LRU populating the `recent` field on every empty-state lookup.
    - [rust/crates/crm-lookup/src/recents.rs](rust/crates/crm-lookup/src/recents.rs) — `record_pick` (LREM dedupe + LPUSH + LTRIM cap to 50) and `fetch_recent` (LRANGE 0..n-1) over `crm:lookup:recent:<userId>:<entity>` keys. Element format mirrors lookup ids (Mongo ObjectId hex, composite `pipelineId:stageId` for Stage, ISO codes for Currency).
    - [rust/crates/crm-lookup/src/handler.rs](rust/crates/crm-lookup/src/handler.rs) — handler now extracts `State<RedisHandle>` alongside Mongo. On empty-state queries (no `q`, `page=0`, no `ids`), the handler fetches the top-5 ids from Redis and re-runs `search::search` with `params.ids = recent_ids` to hydrate them through the same dispatch as the main results — works uniformly for Mongo / embedded / static executors. Failures degrade gracefully (warn-log + drop the recent field rather than failing the whole request).
    - New `POST /v1/crm/lookup/{entity}/recent/{itemId}` route — frontends call this when the user clicks a result; returns `204 No Content`. `record_pick` is idempotent (LREM before LPUSH so the same id never appears twice).
    - `router::<S>()` now requires `RedisHandle: FromRef<S>` in addition to `MongoHandle`. `sabnode-api`'s `AppState` already implements both (existing `RedisHandle` `FromRef` impl in `state.rs`); host wiring needed no changes.
    - Verification: `cargo clippy -p crm-lookup --tests -- -D warnings` clean (had to convert one runtime `assert!` on a const into `const _: () = assert!(..)` per `clippy::assertions-on-constants`); `cargo test` → **23 tests pass** (up from 19; +4 covering recents key format, camelCase entity in keys, cap constant, empty-state detection); `cargo check -p sabnode-api` clean.
  - **§13.9 Mongo text indexes — DONE (2026-05-07).** New [rust/crates/crm-lookup/src/indexes.rs](rust/crates/crm-lookup/src/indexes.rs) — `ensure_indexes(mongo)` creates a compound `(userId, first-searchable)` index plus per-field single indexes for every entity spec (37 in total, with `is_global` skipping the userId compound). Idempotent. Static `ALL_SPECS` slice keeps the registry list typed at compile time. 2 unit tests assert the canonical 8 + Pincode are listed.
  - **§13.4 + §13.5 + §13.9 are now all complete on the Rust side.**
  - **§13.6 Cmd-K trigger button — DONE (2026-05-07).** [src/components/zoruui/shell/zoru-home-shell.tsx](src/components/zoruui/shell/zoru-home-shell.tsx) — the static ⌘K chip in the header is now a `<button type="button" aria-label="Open command palette">` that calls `useCommandPalette().setOpen(true)` on click. Visual `<ZoruKbd>` chip preserved as the button child; keyboard-focusable with focus-visible ring. Closes the §13.6 P2 follow-up from §15.
  - **§13.10 step 7 — Smart\*Select backfill (partial) DONE (2026-05-07).** 7 forms migrated in an 8-agent parallel run:
    - [accounting/vouchers/new/page.tsx](src/app/dashboard/crm/accounting/vouchers/new/page.tsx) — `SmartLedgerSelect` → `<EntityPicker entity="account">` (covers both Debit + Credit account legs in shared `LineItemsSection`).
    - [purchases/vendors/new/page.tsx](src/app/dashboard/crm/purchases/vendors/new/page.tsx) — only `SmartLocationSelect` present, registry-skipped per spec; no migration.
    - [sales/proforma/new/page.tsx](src/app/dashboard/crm/sales/proforma/new/page.tsx) — `SmartClientSelect` → client picker; line-item input upgraded to `<EntityPicker entity="item">` matching the quotations template.
    - [sales/delivery/new/page.tsx](src/app/dashboard/crm/sales/delivery/new/page.tsx) — `SmartClientSelect` → client picker.
    - [sales/credit-notes/new/page.tsx](src/app/dashboard/crm/sales/credit-notes/new/page.tsx) — `SmartClientSelect` → client picker, line-item upgraded to `<EntityPicker entity="item">` with rate/description hydration.
    - [inventory/adjustments/new/adjustment-form.tsx](src/app/dashboard/crm/inventory/adjustments/new/adjustment-form.tsx) — `SmartProductSelect` → item picker, `SmartWarehouseSelect` → warehouse picker.
    - [inventory/items/new/product-form.tsx](src/app/dashboard/crm/inventory/items/new/product-form.tsx) — `SmartCategorySelect` → category picker. (Other Smart components in the file — Brand / Unit / Industry / Location / VendorType — left as-is since their entities aren't in the registry yet.)
    - All preserve original submit shape via hidden `<input>`s; server actions stayed untouched. `npx tsc --noEmit` still at the 5-error baseline.
  - **§13.10 step 7 — second backfill batch DONE (2026-05-07).** 4 more forms migrated in a 5-agent parallel run + an authoritative audit:
    - [purchases/debit-notes/new/new-note-form.tsx](src/app/dashboard/crm/purchases/debit-notes/new/new-note-form.tsx) — `SmartVendorSelect` → `<EntityPicker entity="vendor">`.
    - [purchases/payouts/new/new-payout-form.tsx](src/app/dashboard/crm/purchases/payouts/new/new-payout-form.tsx) — `SmartVendorSelect` → `<EntityPicker entity="vendor">`.
    - [sales/invoices/new/page.tsx](src/app/dashboard/crm/sales/invoices/new/page.tsx) — D3 audit caught a leftover `SmartProductSelect` in the line-items table; replaced with `<EntityPicker entity="item">` mirroring the quotations hydration pattern (rate from `sellingPrice`, description). Dead `SmartClientSelect` import also removed.
    - [inventory/party-transactions/page.tsx](src/app/dashboard/crm/inventory/party-transactions/page.tsx) — `SmartClientSelect` + `SmartVendorSelect` filter chips → `<EntityPicker>`. Dropped now-unused `getCrmAccountsForSelection` / `getCrmVendorsForSelection` server-action imports (eager-fetching everything is unnecessary now that the picker fetches via the registry).
  - **§13.10 step 7 — audit (2026-05-07).** D5 produced an authoritative remaining-work table:
    - **Still migratable (4 consumer files):** `all-leads/new` (SmartPipelineSelect — pipeline registry-supported but stage submit shape pinned to a string name; needs careful handling), `party-transactions` (DONE in D4), `crm-chart-of-account-dialog` (SmartAccountGroupSelect → account), `quick-add-product-dialog` (SmartCategorySelect → category; SmartUnitSelect skipped).
    - **Registry-skipped (5 consumer files with `industry` / `location` / `brand` / `unit` / `vendorType` only):** `vendors/new`, `inventory/items/new` (Brand+Unit), `crm-add-client-dialog`, `crm-add-vendor-dialog`, `crm-employee-form` (3 location instances). These need registry additions before migration.
    - **Orphaned Smart component definitions (zero remaining consumers):** `smart-ledger-select`, `smart-department-select`, `smart-designation-select`, `smart-warehouse-select`, `smart-product-select`. Safe to delete in a follow-up cleanup.
  - **§13.10 step 7 — third backfill batch + 5-entity registry expansion DONE (2026-05-07).** 10-agent parallel run + integrator wrap-up:
    - **Registry expansion (E1):** `brand`, `unit`, `industry`, `location`, `vendorType` added to BOTH the TS `EntityKey` union/`ENTITY_KEYS` array/`LookupRegistry` and the Rust `EntityKey` enum/`as_str` arms. `brand` is Mongo-backed (`crm_brands`); `unit`/`industry`/`vendorType` are static enums (TS `staticPaginate` + Rust `static_lookup::*_search`); `location` returns an empty envelope on both sides until a `crm_locations` strategy is decided. New Rust file [rust/crates/crm-lookup/src/entities/brand.rs](rust/crates/crm-lookup/src/entities/brand.rs).
    - **Already-migratable forms (E3, E4, E5):** [crm-chart-of-account-dialog](src/components/wabasimplify/crm-chart-of-account-dialog.tsx) `SmartAccountGroupSelect` → account; [quick-add-product-dialog](src/components/crm/inventory/quick-add-product-dialog.tsx) `SmartCategorySelect` → category; [all-leads/new](src/app/dashboard/crm/sales-crm/all-leads/new/page.tsx) `SmartPipelineSelect` → pipeline (preserves the pipeline→stage cascade and stage-name submit shape).
    - **Newly-migratable consumer files (E6, E7, E8, E9, E10):** [vendors/new](src/app/dashboard/crm/purchases/vendors/new/page.tsx) (6 location pickers), [items/new](src/app/dashboard/crm/inventory/items/new/product-form.tsx) (brand + unit), [crm-add-client-dialog](src/components/wabasimplify/crm-add-client-dialog.tsx) (industry + 6 location), [crm-add-vendor-dialog](src/components/wabasimplify/crm-add-vendor-dialog.tsx) (industry + 3 location + vendorType), [crm-employee-form](src/components/wabasimplify/crm-employee-form.tsx) (3 location + dept + designation — integrator finished the dept/designation migration that E2 had blocked).
    - **Orphan deletes (E2 + integrator):** removed 5 Smart component definitions — `smart-ledger-select.tsx`, `smart-warehouse-select.tsx`, `smart-product-select.tsx` (E2), and `smart-department-select.tsx` + `smart-designation-select.tsx` (integrator after employee-form migration).
    - **Integrator fixes:** added the 5 new entity entries to 4 exhaustive `Record<EntityKey, X>` maps in [entity-picker.tsx](src/components/crm/entity-picker.tsx), [command-palette.tsx](src/components/crm/command-palette.tsx) (3 maps), and [custom-fields settings](src/app/dashboard/crm/settings/custom-fields/new/new-field-form.tsx); reworded a clippy-tripping `+` doc comment in [static_lookup.rs](rust/crates/crm-lookup/src/static_lookup.rs).
    - Verification: `cargo clippy -p crm-lookup --tests -- -D warnings` clean; `cargo test` → 17/17 lookup + 8/8 lookup-types pass; `cargo check -p sabnode-api` clean. `npx tsc --noEmit` back to the 5-error baseline.
  - **§13.10 step 7 status:** Of the 32 original consumer files, **all migratable Smart\*Select usages are now done**. The remaining `Smart*Select` references in the codebase are limited to the 8 surviving Smart component definition files themselves (`smart-location-select`, `smart-account-group-select`, `smart-vendor-select`, `smart-vendor-type-select`, `smart-client-select`, `smart-industry-select`, `smart-category-select`, `smart-brand-select`, `smart-unit-select`, `smart-pipeline-select`) — these can be deleted in a follow-up sweep since their consumers have all migrated.
  - **§13 wrap-up — 10-agent batch DONE (2026-05-07).** Mixed Rust/TS docket closing the longest-standing open items:
    - **F1 — orphan deletes (TS):** 9 of 10 Smart component definitions removed (`smart-location-select`, `smart-account-group-select`, `smart-vendor-select`, `smart-vendor-type-select`, `smart-client-select`, `smart-industry-select`, `smart-category-select`, `smart-brand-select`, `smart-pipeline-select`); only `smart-unit-select` remains because `quick-add-product-dialog` still consumes it (one-line follow-up: migrate that import to `<EntityPicker entity="unit">` once we trust the static dataset).
    - **F2 — `ensure_indexes()` wired at startup (Rust):** [rust/crates/api/src/main.rs](rust/crates/api/src/main.rs) now calls `crm_lookup::indexes::ensure_indexes(&mongo)` right after the Mongo ping succeeds, before Redis connect. Indexes are guaranteed in place by the time the listener binds.
    - **F3 — Auth middleware on the lookup endpoint (Rust):** [crm-lookup/src/handler.rs](rust/crates/crm-lookup/src/handler.rs) now extracts `auth: AuthUser` (from `sabnode-auth`) on both `GET /{entity}` and `POST /{entity}/recent/{itemId}` routes. The query-string `userId` is retained as a `#[cfg(debug_assertions)]` test fallback only; production rejects requests missing the bearer token via the standard `AuthError` 401. `router::<S>()` now requires `Arc<AuthConfig>: FromRef<S>` — `sabnode-api`'s `AppState` already provides it (same plumbing every other crate uses).
    - **F4 — 4 new TS doc types (P1 from §15):** [src/lib/definitions.ts](src/lib/definitions.ts) gained `CrmRfq`, `CrmVendorBid`, `CrmGrn`, `CrmBill` interfaces (140 lines added at lines 1013-1152). `LineageKind` already covered all 16 variants — no kind additions needed; the gap was purely missing doc-type bindings.
    - **F5 — `saveQuotation` lineage (TS):** [crm-quotations.actions.ts](src/app/actions/crm-quotations.actions.ts) now accepts `fromKind=lead|deal` + `fromId`, fetches parent's `lineage`, builds child chain, and writes a back-link `{ kind: 'quotation', id, no, status }` onto the parent.
    - **F6 — `saveSalesOrder` lineage (TS):** [crm-sales-orders.actions.ts](src/app/actions/crm-sales-orders.actions.ts) accepts `fromKind=quotation|lead|deal|proforma`. Same parent fetch + back-link pattern as F5.
    - **F7 — `savePurchaseOrder` lineage (TS):** [crm-purchase-orders.actions.ts](src/app/actions/crm-purchase-orders.actions.ts) accepts `fromKind=rfq|vendorBid` (using F4's new doc types as parents — the typing lights up once the TS server tree picks up F4's edits).
    - **F8 — `saveExpense` (bill) lineage (TS):** [crm-expenses.actions.ts](src/app/actions/crm-expenses.actions.ts) accepts `fromKind=purchaseOrder|grn`. (`CrmBill` is now a separate interface but the existing `saveExpense` action still operates on `CrmExpense`; both have `lineage?: LineageRef[]`, so the wire-up works on either.)
    - **F9 — `<CustomFieldInput>` wired into deal dialog (TS):** [crm-create-deal-dialog.tsx](src/components/wabasimplify/crm-create-deal-dialog.tsx) calls `getCustomFieldsFor('deal')` on first open, renders one `<CustomFieldInput>` per field def in a new "Custom Fields" section, and serializes values into FormData under `customFields` JSON on submit. **BLOCKED dependency:** `createCrmDeal` server action does not yet read `customFields` — needs a follow-up: parse JSON + `applyCustomFieldsToEntity('deal', insertedId.toString(), parsed)` after the insert.
    - **F10 — Lineage-propagation audit (TS, read-only):** authoritative table of which `crm-*-actions.ts` files DO and DON'T propagate lineage. Six fully-propagating files (the four just touched + invoices already done in Phase 2 + `convertInvoiceToCreditNote` partial); seven still-not-propagating (`crm-deals`, `crm-proforma-invoices`, `crm-delivery-challans`, `crm-payment-receipts`, manual `saveCreditNote`, `crm-debit-notes`, `crm-payouts`). Recommended priorities: payment-receipts (closes the sales chain at the cash-in step) and deals (back-propagates to dozens of downstream docs originating from a deal).
    - **Verification:** `cargo clippy -p crm-lookup --tests -- -D warnings` clean; `cargo check -p sabnode-api` clean (only pre-existing `wachat-templates-router` warnings — unchanged); `cargo test -p crm-lookup -p crm-lookup-types` → 17 + 8 = 25 pass; `npx tsc --noEmit` at the 5-error baseline.
  - **§13 final closeout — 10-agent batch DONE (2026-05-07).** Picks up everything F9/F10 surfaced and closes the §13 picture:
    - **G1** [crm-deals.actions.ts](src/app/actions/crm-deals.actions.ts) — `createCrmDeal` consumes `customFields` JSON via `applyCustomFieldsToEntity('deal', insertedId, parsed)` AND propagates lineage from `lead` parent (closes F9's BLOCKED note).
    - **G2** [crm-proforma-invoices.actions.ts](src/app/actions/crm-proforma-invoices.actions.ts) — accepts `lead/deal/quotation/salesOrder`.
    - **G3** [crm-delivery-challans.actions.ts](src/app/actions/crm-delivery-challans.actions.ts) — accepts `salesOrder/invoice/quotation`.
    - **G4** [crm-payment-receipts.actions.ts](src/app/actions/crm-payment-receipts.actions.ts) — accepts `invoice/proforma`; multi-invoice receipts seed from first applied invoice.
    - **G5** [crm-credit-notes.actions.ts](src/app/actions/crm-credit-notes.actions.ts) — `saveCreditNote` accepts `invoice` (closes the standalone-create path).
    - **G6** [crm-debit-notes.actions.ts](src/app/actions/crm-debit-notes.actions.ts) — accepts `bill/purchaseOrder`.
    - **G7** [crm-payouts.actions.ts](src/app/actions/crm-payouts.actions.ts) — accepts `bill`; multi-bill payouts seed from first applied bill.
    - **G8** [quick-add-product-dialog.tsx](src/components/crm/inventory/quick-add-product-dialog.tsx) — last `SmartUnitSelect` migrated; [smart-unit-select.tsx](src/components/crm/inventory/smart-unit-select.tsx) **deleted**. Codebase is now Smart-free on both consumer and definition sides.
    - **G9** [sales/orders/[orderId]/page.tsx](src/app/dashboard/crm/sales/orders/[orderId]/page.tsx) — `<LineageRail>` wired on the Sales Order detail page. Caveat: the SO loader returns `WsOrder` (worksuite billing model) rather than `CrmSalesOrder`, so the rail reads `lineage` defensively via a typed cast — chain rows render as "Not yet" until the loader migrates to a CRM-modeled type.
    - **G10 — final audit (read-only):** confirmed **zero remaining `Smart*Select` consumers and zero definition files**; all 13 chain server actions propagate lineage with the spec'd from-kinds; **24 files now consume `<EntityPicker>`** (22 strict forms/dialogs) — **+17 vs the Phase 2 baseline of 7.**
  - **§13 is FULLY CLOSED on the TS side.** The Rust port (§13.4 lookup endpoint with all 42 entities + auth middleware, §13.5 lineage helpers + conversion crate, §13.9 Redis recents + Mongo indexes wired at startup) was completed earlier in this session.
  - **§13 follow-on — 10-agent batch (2026-05-07).** Mixed Rust/TS docket; partial completion with several BLOCKED items flagged for integrator decision.
    - **H1** [crm-rfq.actions.ts](src/app/actions/crm-rfq.actions.ts) — full CRUD + `lead/deal` lineage propagation, 326 lines.
    - **H2** [crm-vendor-bids.actions.ts](src/app/actions/crm-vendor-bids.actions.ts) — full CRUD + `rfq` lineage handshake (parent always known), 284 lines. Cascades RFQ → `'awarded'` when a bid is awarded.
    - **H3** [crm-grn.actions.ts](src/app/actions/crm-grn.actions.ts) — full CRUD + `purchaseOrder` lineage handshake when `poId` is supplied, 272 lines.
    - **H4 — partial:** `getSalesOrderById` loader added to [crm-sales-orders.actions.ts](src/app/actions/crm-sales-orders.actions.ts) (lines 38-59). **JSX swap blocked:** `WsOrder` and `CrmSalesOrder` shapes diverge significantly — page renders `subtotal` / `tax` / `discount` / structured `billing_address` + `shipping_address` / `invoice_id` / lowercase status / `unit_price` per-line / convert+delete handlers that all live on the worksuite type but not on `CrmSalesOrder`. Integrator decision needed: extend `CrmSalesOrder` or stay on WsOrder + add `lineage` to it.
    - **H5/H6/H7 — all BLOCKED:** PO detail (`purchases/orders/[orderId]/page.tsx`), Bill detail (`purchases/expenses/[expenseId]/page.tsx`), Quotation detail (`sales/quotations/[quotationId]/page.tsx`) routes don't exist as React pages. Only list + new + (sometimes) edit routes exist. These routes need to be created from scratch before `<LineageRail>` can mount; the agents correctly stopped per the "don't create" guardrail.
    - **H8** [sales/receipts/[receiptId]/edit/page.tsx](src/app/dashboard/crm/sales/receipts/[receiptId]/edit/page.tsx) — `<LineageRail>` wired into the edit page (no separate detail page exists for receipts; edit is the de-facto view). Used the actual rail prop name `lineage` (not `chain` as the spec said).
    - **H9** Three new listing pages — [purchases/rfqs/page.tsx](src/app/dashboard/crm/purchases/rfqs/page.tsx) (139 lines), [purchases/vendor-bids/page.tsx](src/app/dashboard/crm/purchases/vendor-bids/page.tsx) (167 lines, new directory), [inventory/grn/page.tsx](src/app/dashboard/crm/inventory/grn/page.tsx) (158 lines). Each is an async server component wrapping `CrmPageHeader` + `ZoruCard` + `ZoruTable`, with try/catch fallback to empty-state rows. Loose `Any*` types accommodate H1/H2/H3 field-shape drift.
    - **H10 — audit (read-only, ran mid-flight before H3 finished):** the audit's "GRN missing" finding was a race against H3 — file actually present on disk; 4-of-6 LineageRail consumers are still gaps because of the H5/H6/H7 BLOCKED routes.
    - Verification: `npx tsc --noEmit` at the 5-error baseline — none of the 10 agents introduced new errors.
  - **Net result:** 3 new server-action files + 3 new listing pages + 1 receipt rail wired + 1 SO loader added. 4 LineageRail mounts blocked on missing detail routes; SO loader migration partially blocked on WsOrder ↔ CrmSalesOrder field divergence.
  - **§13 detail-routes + form-pages 10-agent batch DONE (2026-05-07).** Closes most of the prior NEXT-arrow gaps; cleanup at integration handled the rest.
    - **I1/I2/I3 — 3 new detail pages created:** [quotations/[quotationId]/page.tsx](src/app/dashboard/crm/sales/quotations/[quotationId]/page.tsx) (190 lines), [purchases/orders/[orderId]/page.tsx](src/app/dashboard/crm/purchases/orders/[orderId]/page.tsx) (240 lines), [purchases/expenses/[expenseId]/page.tsx](src/app/dashboard/crm/purchases/expenses/[expenseId]/page.tsx) (288 lines). Each renders `<LineageRail>` on the right rail + action buttons that pre-fill `?fromKind=…&fromId=…` for downstream conversions. I3 also added the previously-missing `getExpenseById` loader to `crm-expenses.actions.ts`.
    - **I4/I5/I6 — 3 new `/new` form pages:** [rfqs/new](src/app/dashboard/crm/purchases/rfqs/new/page.tsx) (458 lines), [vendor-bids/new](src/app/dashboard/crm/purchases/vendor-bids/new/page.tsx) (423 lines), [grn/new](src/app/dashboard/crm/inventory/grn/new/page.tsx) (326 lines). Use `<EntityPicker>` for every entity ref + `<SabFilePickerButton>` for attachments per the SabFiles policy. I5 noted that `rfq` is NOT in the TS registry, so the VendorBid form uses the read-only-card fallback driven by `?fromKind=rfq&fromId=…` query params. Same fallback now applies on the GRN form for `purchaseOrder` (cleanup below).
    - **I7 — `WsOrder` lineage extension:** `WsOrder` type in [billing-types.ts](src/lib/worksuite/billing-types.ts) gained `lineage?: LineageRef[]`; `saveOrder` accepts `fromKind=deal|quotation|proforma`; `convertOrderToInvoice` propagates lineage in both directions; SO detail page's typed-cast workaround removed. Pragmatic alternative to the H4-blocked full migration of the page from `WsOrder` to `CrmSalesOrder`.
    - **I8/I9 — Custom-field consumers wired** in [quotations/new](src/app/dashboard/crm/sales/quotations/new/page.tsx) and [invoices/new](src/app/dashboard/crm/sales/invoices/new/page.tsx) — `getCustomFieldsFor` + `<CustomFieldInput>` + JSON-stringified `customFields` on FormData. **BLOCKED dependency:** `saveQuotation` / `saveInvoice` server actions don't yet parse the `customFields` field — needs follow-up `applyCustomFieldsToEntity` calls.
    - **I10 — closeout audit (read-only):** ran mid-flight before I4/I5 finished, so falsely flagged those /new pages missing; filesystem confirms all landed.
    - **Integrator fixes:** added `getQuotationById` loader to `crm-quotations.actions.ts` (I1 flagged it missing); added `'quotation'` to the `WsCustomFieldBelongsTo` union (I8 needed it); fixed 6 small TS errors:
      - `<ZoruButton variant="primary">` → `variant="default"` on quotation detail.
      - `entity="purchaseOrder"` (not in TS registry) → text-input fallback that reads `?fromKind=purchaseOrder&fromId=…` from query params on the GRN /new form.
      - `<SabFilePickerButton multi>` → drop the `multi` prop (component doesn't support it; user clicks repeatedly to pick multiple files) on RFQ/VendorBid/GRN /new forms.
      - `(d) => …` implicit-any in GRN DatePicker callback → typed `(d: Date | undefined) => …`.
    - Verification: `npx tsc --noEmit` back at the 5-error baseline.
  - **§13 detail surface — NOW COMPLETE.** The chain has live detail pages with `<LineageRail>` on Invoice / Sales Order / Quotation / Purchase Order / Bill / Receipt-edit (6 pages, +4 from this batch). The `/new` form pages exist for every doc type that has a server action (Lead, Deal, Quotation, SO, Proforma, Invoice, DC, CN, Receipt, PO, Bill/Expense, DN, Payout, RFQ, VendorBid, GRN, item, vouchers, vendors, etc.).
  - **§13 polish + first business-logic Rust crates — 10-agent batch DONE (2026-05-07).** Closes prior NEXT-arrow gaps and starts the Rust business-logic layer.
    - **J1/J2 — server-side `customFields`:** `saveQuotation` and `saveInvoice` now parse `formData.get('customFields')` JSON and call `applyCustomFieldsToEntity('quotation' | 'invoice', insertedId, parsed)` after the insert. Closes I8/I9 BLOCKED notes. **3/3 chain server actions** (Deal/Quotation/Invoice) now persist custom-field values end-to-end.
    - **J3 — `getCrmVendorById` helper:** added to [crm-vendors.actions.ts](src/app/actions/crm-vendors.actions.ts). `getCrmAccountById` already existed in `crm-accounts.actions.ts` (skipped per agent's pre-flight check).
    - **J4/J5/J6 — detail-page name resolution:** PO detail (client component, `useEffect` + `useState` pattern), Bill detail (server component, direct await), Quotation detail (server component) all now render `vendor.displayName ?? vendor.name` instead of `Vendor xxxx` placeholders. PO detail still has a truncated-id fallback string when the lookup fails (acceptable — RBAC-hidden vendors degrade gracefully); Bill/Quotation use clean `'(unknown vendor)'` / `'(unknown client)'` fallbacks.
    - **J7 — convert-to-invoice route handler:** [src/app/dashboard/crm/sales/quotations/[quotationId]/convert-to-invoice/route.ts](src/app/dashboard/crm/sales/quotations/[quotationId]/convert-to-invoice/route.ts) — Next.js 15 async-params POST handler. Builds the new invoice from the quotation, seeds lineage via `buildLineageFromParent({ kind: 'quotation', ... })`, back-links to the parent, flips parent status to `'converted'`, revalidates both list pages, redirects to the invoices list. Invoice numbering uses `INV-${Date.now().toString().slice(-6)}` mirroring the existing worksuite converter; flagged as TODO for a sequential numbering helper.
    - **J8 — `crm-leads` Rust crate (new):** [rust/crates/crm-leads](rust/crates/crm-leads) — first business-logic Rust crate atop the §0-§12 DTO layer. 5 endpoints (list / get / create / update / soft-delete) typed against `crm_sales_crm_types::Lead`, scoped by `AuthUser.user_id`, pagination clamped at 100, archived-row exclusion via shared filter helper. Dto file has `CreateLeadInput` (curated subset) + `UpdateLeadInput` + `ListQuery`. `fromKind`/`fromId` lineage hooks accepted but no-op (Lead is the root of the chain, no parent). 8 unit tests pass.
    - **J9 — `crm-deals` Rust crate (new):** [rust/crates/crm-deals](rust/crates/crm-deals) — same pattern as crm-leads. 5 endpoints over `crm_sales_crm_types::Deal`. Lineage parent handler: when `fromKind=lead`, fetches the parent lead from `crm_leads` collection (no Rust crate dep — just the collection name), seeds via `crm_core::build_lineage_from_parent`, best-effort back-links a `{kind: 'deal', id}` ref onto the lead. 2 unit tests pass.
    - **J10 — closeout audit (read-only):** ran mid-flight; falsely flagged J7 / J8 / J9 missing — filesystem confirms all landed. Also caught J4's PO detail still has the slice-fallback string (correct per the agent's instruction — graceful degradation when RBAC hides vendors).
  - **Verification:** `cargo clippy -p crm-leads -p crm-deals --tests -- -D warnings` clean; `cargo test` → 10/10 pass (8 in crm-leads + 2 in crm-deals); `cargo check --workspace` clean across all 21 CRM/HRM crates; `npx tsc --noEmit` at the 5-error baseline.
  - **Open big-picture gaps remaining:**
    - Frontend authentication wiring — the `EntityPicker`'s server-side fetch still goes through the TS `lookupEntity` action (which uses `getSession`); to migrate to the Rust `crm-lookup` HTTP endpoint requires the picker to acquire an `Authorization: Bearer <jwt>` header. Either propagate the session token client-side via a fetch wrapper, OR keep the TS action as a thin proxy to the Rust handler.
    - Sequential numbering — the J7 convert handler uses `Date.now()` slice. A real `getNextInvoiceNumber(userId)` action that allocates from a per-tenant counter would close that TODO.
    - Detail routes for the remaining doc kinds — DC, CN, DN, Payout, Subscription, etc. still 404 on `[id]` (only list + new exist).
    - Business-logic Rust crates for the remaining entity types — `crm-quotations`, `crm-invoices`, `crm-tickets`, etc. each follow the J8/J9 template.
  - **10 business-logic Rust crates landed in one parallel run — DONE (2026-05-07).** Each follows the J8/J9 template (Cargo.toml + lib.rs + dto.rs + handlers.rs + router.rs, 5 endpoints, AuthUser-scoped, soft-delete via `archived: true`, pagination clamped at 100, lineage parents wired per the §13.5 chain). All 10 have inline `#[cfg(test)]` coverage.
    - **K1** [crm-quotations](rust/crates/crm-quotations) — `crm-sales-types::Quotation` over `crm_quotations`. Lineage parents: `lead | deal`. 14 tests.
    - **K2** [crm-invoices](rust/crates/crm-invoices) — `crm-sales-types::Invoice` over `crm_invoices`. Lineage parents: `quotation | salesOrder | proforma | deal | lead`. 16 tests.
    - **K3** [crm-sales-orders](rust/crates/crm-sales-orders) — `SalesOrder` over `crm_sales_orders`. Parents: `quotation | lead | deal | proforma`. 15 tests.
    - **K4** [crm-purchase-orders](rust/crates/crm-purchase-orders) — `crm-purchases-types::PurchaseOrder` over `crm_purchase_orders`. Parents: `rfq | vendorBid`. 13 tests.
    - **K5** [crm-payment-receipts](rust/crates/crm-payment-receipts) — `PaymentReceipt` over `crm_payment_receipts`. Parents: `invoice | proforma`; multi-invoice receipts seed lineage from the first applied invoice when `fromKind` isn't explicit. 15 tests.
    - **K6** [crm-credit-notes](rust/crates/crm-credit-notes) — `CreditNote` over `crm_credit_notes`. Parents: `invoice` only. 14 tests.
    - **K7** [crm-debit-notes](rust/crates/crm-debit-notes) — `crm-purchases-types::DebitNote` over `crm_debit_notes`. Parents: `bill | purchaseOrder`. 12 tests. (Items/totals accepted as opaque `serde_json::Value` to avoid pulling `crm-sales-types` as a dep.)
    - **K8** [crm-payouts](rust/crates/crm-payouts) — `PayoutReceipt` over `crm_payouts`. Parents: `bill`; multi-bill payouts seed from first applied bill. 16 tests. (Integrator dropped a `Default` derive from `CreatePayoutInput` since `PaymentMode` doesn't impl `Default` — non-issue since the field is required.)
    - **K9** [crm-tickets](rust/crates/crm-tickets) — `crm-extras-types::Ticket` over `crm_tickets`. No lineage (tickets aren't in the §13.5 chain). 15 tests.
    - **K10** [crm-subscriptions](rust/crates/crm-subscriptions) — `Subscription` over `crm_subscriptions`. **6 endpoints** (the standard 5 + `POST /{id}/pause` that flips status to `paused`, sets `pausedUntil`, and pushes a `SubscriptionEvent` audit row). No lineage. 18 tests.
  - Workspace registration: all 10 crates pre-added to [rust/Cargo.toml](rust/Cargo.toml) members list before dispatch, so no race on the shared file.
  - Verification: `cargo clippy --tests -- -D warnings` clean across all 10; `cargo test` → **148 unit tests pass total**; `cargo check --workspace` clean.
  - **Rust business-logic layer status — 12 of ~25 entity types now have CRUD crates:** Lead, Deal, Quotation, Invoice, SalesOrder, PurchaseOrder, PaymentReceipt, CreditNote, DebitNote, Payout, Ticket, Subscription. Plus the foundation crates (crm-core, 11 DTO crates, crm-lookup, crm-conversions) bring the total CRM/HRM Rust workspace to **24 crates**.
  - **20-agent finishing batch — DONE (2026-05-07).** Single parallel run that closes the bulk of the still-parallelizable NEXT list. Workspace `Cargo.toml` was pre-extended with all 12 new crate entries before dispatch to avoid race conditions on the shared file.
    - **L1** [crm-bills](rust/crates/crm-bills) — `crm-purchases-types::Bill` over `crm_bills`. Lineage parents: `purchaseOrder | grn`; on parent fetch also stamps `linkedPoId` (PO) or pushes onto `linkedGrnIds[]` (GRN), best-effort back-link to parent. 5 endpoints; initial payment state (`amountPaid: 0.0`, `balance: totals.total`). 12 inline tests.
    - **L2** [crm-rfqs](rust/crates/crm-rfqs) — `crm-extras-types::Rfq` over `crm_rfqs`. Lineage parents: `lead | deal`; status validated against the lowercase serde reps of `RfqStatus` (draft/open/closed/awarded/cancelled). 5 endpoints, attachments via `crm_core::Attachment` (SabFiles-only). 12 inline tests.
    - **L3** [crm-vendor-bids](rust/crates/crm-vendor-bids) — `VendorBid` over `crm_vendor_bids`. Lineage parent always RFQ (strict — `NotFound("rfq")` on miss). On status flip to `'awarded'`, fire-and-forget cascade flips parent RFQ status to `'awarded'`. 5 endpoints, 14 inline tests.
    - **L4** [crm-grns](rust/crates/crm-grns) — `Grn` over `crm_grns`. Lineage parent: `purchaseOrder` (when `poId` present, fetch + seed + back-link). 5 endpoints, batch/expiry/serial-no tracking, 12 inline tests.
    - **L5** [crm-employees](rust/crates/crm-employees) — `hrm-payroll-types::Employee` over `crm_employees`. No lineage (employees aren't in §13.5 chain). Synthesizes `employeeId` as `EMP-<last-6-hex-of-OID>` for non-null type compliance; designation stored as both `designationId` (FK) + `designation` (denormalized). List `q` regex search across firstName/lastName/displayName/workEmail/employeeId. 11 inline tests.
    - **L6** [crm-attendance](rust/crates/crm-attendance) — `Attendance` over `crm_attendance`. **7 endpoints** (5 standard + `POST /punch-in` + `POST /punch-out`); shared `punch_impl` resolves UTC start-of-day window, looks up today's row by `(userId, employeeId, date)`, inserts fresh or stamps existing punch field. 13 inline tests.
    - **L7** [crm-leaves](rust/crates/crm-leaves) — `LeaveType` + `LeaveApplication` over `crm_leave_types` and `crm_leave_applications`. **11 endpoints** (5 per resource + `POST /applications/{id}/approve` which atomically `$set status: "approved"` guarded on `status: "pending"` + `$push`-es an `ApproverStep` audit row). Cross-resource guard: create_leave_application verifies `leaveTypeId` belongs to same tenant. 19 inline tests.
    - **L8** [crm-payroll-runs](rust/crates/crm-payroll-runs) — `PayrollRun` over `crm_payroll_runs`. **8 endpoints** (5 standard + 3 lifecycle): `POST /{id}/compute` streams active employees + salary structures, computes earnings/deductions per employee (handles `Fixed` / `PercentBasic` / `PercentCtc` calc kinds with min/max caps; `Formula` returns 0 + warn until TS engine wired), persists `employees[]` + rolled-up `totals`. `POST /{id}/approve` appends an `ApprovalStep`, flips status. `POST /{id}/disburse` mints stub `bankFileId`. Inline tests cover compute math.
    - **L9** [crm-fixed-assets](rust/crates/crm-fixed-assets) — `FixedAsset` over `crm_fixed_assets`. **6 endpoints** (5 standard + `POST /{id}/depreciate`): SLM uses straight-line per-month capped at `cost - residualValue`; WDV uses declining-balance with per-month rate from `usefulLifeMonths`, NBV floored at residual; `Units` returns Validation error pointing at the forthcoming usage-posting endpoint. Inline tests cover SLM linearity, SLM cap, WDV decline + residual floor, calendar-month math.
    - **L10** [crm-bookings](rust/crates/crm-bookings) — `BookingResource` + `Booking` over `crm_booking_resources` and `crm_bookings`. **12 endpoints** (5 per resource + `POST /bookings/{id}/check-in` flipping status to `completed` + clearing `noShow`, + `POST /bookings/{id}/cancel` flipping to `cancelled`). Both lifecycle endpoints idempotent. 12 inline tests.
    - **L18** [crm-holidays](rust/crates/crm-holidays) — `Holiday` over `crm_holidays`. 5 endpoints, `year` filter via `[Jan 1, Jan 1 next-year)` UTC bounds, sort by `date` asc. 9 inline tests.
    - **L19** [crm-departments](rust/crates/crm-departments) — `Department` + `Designation` over `crm_departments` and `crm_designations`. **10 endpoints** (5 per resource), bundled in one crate because the two share ownership/audit/CRUD shape and are nearly always edited together in HR setup. Router contributes two parallel subtrees `/departments/*` and `/designations/*`. 15 inline tests.
    - **L11 — API router mounting:** [rust/crates/api/Cargo.toml](rust/crates/api/Cargo.toml) gained 24 new path-deps (12 new crates from this batch + the prior K1-K10 set). [rust/crates/api/src/router.rs](rust/crates/api/src/router.rs) declares 24 new router locals and adds `.nest()` lines: 19 under `/v1/crm/` (leads, deals, quotations, invoices, sales-orders, purchase-orders, payment-receipts, credit-notes, debit-notes, payouts, tickets, subscriptions, bills, rfqs, vendor-bids, grns, fixed-assets, bookings) + 6 under `/v1/hrm/` (employees, attendance, leaves, payroll-runs, holidays, departments). All 22 business-logic CRM/HRM crates now serve real HTTP traffic via the existing `AppState` (which already implements `MongoHandle`/`RedisHandle`/`Arc<AuthConfig>` `FromRef`).
    - **L12-L16 — 5 new TS detail pages with `<LineageRail>`:** [delivery/[challanId]/page.tsx](src/app/dashboard/crm/sales/delivery/[challanId]/page.tsx) (230 lines), [purchases/payouts/[payoutId]/page.tsx](src/app/dashboard/crm/purchases/payouts/[payoutId]/page.tsx) (216 lines), [sales/subscriptions/[subscriptionId]/page.tsx](src/app/dashboard/crm/sales/subscriptions/[subscriptionId]/page.tsx) (367 lines, no rail — subscriptions aren't in §13.5 chain; renders history timeline instead), [sales/credit-notes/[creditNoteId]/page.tsx](src/app/dashboard/crm/sales/credit-notes/[creditNoteId]/page.tsx) (204 lines), [purchases/debit-notes/[debitNoteId]/page.tsx](src/app/dashboard/crm/purchases/debit-notes/[debitNoteId]/page.tsx) (173 lines). New loaders added where missing: `getDeliveryChallanById` (crm-delivery-challans.actions.ts), `getPayoutById` (crm-payouts.actions.ts), `getCreditNoteById` (crm-credit-notes.actions.ts), `getDebitNoteById` (crm-debit-notes.actions.ts) — all mirror the canonical `getInvoiceById` shape (`getSession` guard + `ObjectId.isValid` + scoped `findOne` by `_id` + `userId` + JSON-clone return). Subscription page imports `getSubscriptionById` from `@/app/actions/crm-subscriptions.actions` — module **does not exist**; integrator must add the loader before the page compiles. Several pages use defensive `as any` reads where `definitions.ts` types are sparse (e.g. `CrmCreditNote` doesn't declare `cnNo`/`status`/`refundMode`).
    - **L17 — Frontend JWT wiring:** [src/lib/rust-lookup-client.ts](src/lib/rust-lookup-client.ts) (new, 158 lines) exports `rustLookupEntity(entity, params)` and `recordPickedRecent(entity, itemId)`. Builds `${NEXT_PUBLIC_RUST_API_BASE}/v1/crm/lookup/{entity}?...` with `Authorization: Bearer <token>` header; falls back to empty result on missing token / non-2xx / network error. [entity-picker.tsx](src/components/crm/entity-picker.tsx) and [command-palette.tsx](src/components/crm/command-palette.tsx) gained a `USE_RUST_LOOKUP` flag (`process.env.NEXT_PUBLIC_USE_RUST_LOOKUP === 'true'`) + `fetchLookup` dispatcher; switched all 7 `lookupEntity` call sites between the two files; `commitSelection` now fires `recordPickedRecent` so server-side LRU populates. **Auth-token caveat:** no client-side `getAuthToken` convention exists — every Rust call in the codebase mints its JWT server-side via `issueRustJwt` from the httpOnly `session` cookie, which the browser cannot read. The new client lib uses `localStorage.getItem('authToken')` as a placeholder with a `TODO(auth-token)` comment proposing a `/api/auth/rust-token` route as the eventual mechanism.
    - **L20 — closeout audit:** ran mid-flight (snapshot caught 7 stub crates whose handlers/router landed minutes later). Final on-disk verification confirmed all 12 crates have the full 5-file set (Cargo.toml + lib.rs + dto.rs + handlers.rs + router.rs). All 5 detail pages contain `<LineageRail`. Frontend JWT wiring shipped on both consumers.
  - **Rust business-logic layer status — 22 of ~25 entity types now have CRUD crates** (was 12; +10 from this batch + holidays + departments): the prior 12 + Bill, Rfq, VendorBid, Grn, Employee, Attendance, Leave, PayrollRun, FixedAsset, Booking, Holiday, Department/Designation. Total CRM/HRM Rust workspace = **39 crates** (37 `crm-*` + 2 `hrm-*`).
  - **Known integration gaps:**
    - Subscription detail page imports a not-yet-existing `getSubscriptionById` action; integrator must add the loader (or wrap `commerce/subscriptions.ts`) before the page compiles.
    - `crm-payroll-runs` `Formula` calc kind returns 0 + warn until the TS formula engine is ported.
    - Frontend JWT wiring uses `localStorage.getItem('authToken')` placeholder; needs a `/api/auth/rust-token` route to mint short-lived JWTs from the httpOnly session cookie before the rust-lookup path can be flipped on in production.
    - `cargo check --workspace` not run in this batch; the 12 new crates' router types may need small fixes when first compiled together with `sabnode-api`.
  - **NEXT →** remaining items:
    - Add `getSubscriptionById` loader so the subscription detail page compiles.
    - Mint the `/api/auth/rust-token` endpoint and flip `NEXT_PUBLIC_USE_RUST_LOOKUP=true` in a staging environment.
    - Run `cargo check --workspace` + clippy + tests on the full 12-crate batch and address any drift.
    - Remaining business-logic crates if needed: `crm-shifts`, `crm-fixed-assets-disposal`, etc. (mostly nice-to-haves — the §13.5 chain and HRM core are fully covered).

  - **Momentum batch — DONE (2026-05-07).** Closes the prior NEXT-arrow gaps and the §15 P1 CustomFieldInput follow-up:
    - **M1** [src/app/actions/crm-subscriptions.actions.ts](src/app/actions/crm-subscriptions.actions.ts) — new `getSubscriptionById` loader. Mirrors the canonical `getInvoiceById` shape: `getSession` guard → `ObjectId.isValid` → scoped `findOne` on `crm_subscriptions` by `_id` + `userId`. Closes the L12-L16 BLOCKED note — subscription detail page now compiles.
    - **M2** [src/app/api/auth/rust-token/route.ts](src/app/api/auth/rust-token/route.ts) — new POST/GET route. Validates the httpOnly `session` cookie via `getSession`, mints a 15-minute HS256 JWT via `issueRustJwt` (`tid = userId`, `roles = []`, matching the cookie-driven server-side path), and returns `{ token, expiresAt, expiresIn }`. Returns 401 on no session, 500 on mint failure. `Cache-Control: private, no-store` so no intermediary caches a per-user token.
    - **M3** [src/lib/rust-lookup-client.ts](src/lib/rust-lookup-client.ts) — `getClientAuthToken()` rewritten as an async fetcher against `/api/auth/rust-token` with module-scope memory cache + 30s leeway refresh and a single in-flight de-dupe so back-to-back picker calls share the same round trip. Both `rustLookupEntity` and `recordPickedRecent` now `await` the getter; on 401 from Rust the cache is cleared so the next call mints fresh. Removes the `localStorage.getItem('authToken')` placeholder + `TODO(auth-token)` comment. With this the rust-lookup path is fully production-wirable behind `NEXT_PUBLIC_USE_RUST_LOOKUP=true`.
    - **M4** `cargo check --workspace` clean across all 39 CRM/HRM crates + `sabnode-api`. One drive-by warning fix in [crm-payroll-runs/src/handlers.rs](rust/crates/crm-payroll-runs/src/handlers.rs) (`#[allow(unused_imports)]` on the `hrm_payroll_types` import block — `EmploymentStatus` is referenced from test code only). `cargo test` for the full 12-crate L-batch → **167 tests pass** (14 + 13 + 16 + 15 + 15 + 22 + 13 + 9 + 21 + 13 + 16). Pre-existing `wachat-types::serde_roundtrip` test failures are unrelated to CRM/HRM and remain at the prior baseline.
    - **M5 — `<CustomFieldInput>` consumers wired in 3 forms** (closes §15 P1 "Custom-field display in entity edit forms" remainder):
      - **Ticket** — [src/app/dashboard/crm/tickets/page.tsx](src/app/dashboard/crm/tickets/page.tsx): load `getCustomFieldsFor('ticket')` on first dialog open, track values keyed by `WsCustomField.name`, reseed from `editing.customFields` when the dialog re-opens for a different ticket, wrap `saveFormAction` to inject a JSON `customFields` blob into FormData. Server-side: [crm-services.actions.ts](src/app/actions/crm-services.actions.ts) `saveTicket` now reads the blob and calls `applyCustomFieldsToEntity('ticket', result.id, parsed)` after the existing `save()` helper succeeds.
      - **Employee** — [src/components/wabasimplify/crm-employee-form.tsx](src/components/wabasimplify/crm-employee-form.tsx): same pattern; values seeded from `employee.customFields` on edit. Server-side: [crm-employees.actions.ts](src/app/actions/crm-employees.actions.ts) `saveCrmEmployee` parses the blob and applies after the employee insert/update + extended-detail upsert.
      - **Account/Client** — [src/components/wabasimplify/crm-add-client-dialog.tsx](src/components/wabasimplify/crm-add-client-dialog.tsx): rendered as a new `<AccordionItem value="custom-fields">` so it slots cleanly into the existing accordion-driven UI. Server-side: [crm.actions.ts](src/app/actions/crm.actions.ts) `addCrmClient` parses the blob and applies after the `crm_accounts` insert (before the auto-created contact, so a `customFields.entity_ref` field could reference the new account itself in a future edit).
      - All three follow the deal-dialog reference pattern (F9/G1) — non-blocking parse + best-effort `applyCustomFieldsToEntity` so a malformed blob never unwinds the primary insert.
    - Verification: `npx tsc --noEmit` at the 5-error baseline (same five pre-existing errors as before — none of the touched files introduced new ones).
  - **§15 P0/P1 closure status:** P0 fully done (no pending entries). P1 `<CustomFieldInput>` rollout is COMPLETE for the four canonical entities (deal, quotation, invoice, plus the three from M5: account, ticket, employee). The remaining P1 entries (RFQ/VendorBid/GRN/Bill TS interfaces and lineage propagation) were all closed earlier in F4-F8 / G1-G7.

  - **Sweep batch — DONE (2026-05-07).** Closes the formula-engine TODO, drops the localStorage recents path, and converts seven §12 placeholders into real list views.
    - **N1 — Formula calc port (Rust).** [crm-payroll-runs/src/handlers.rs](rust/crates/crm-payroll-runs/src/handlers.rs) `eval_formula` + `FormulaParser` — 170 lines. Recursive-descent parser supporting decimal literals, `+ - * /` with proper precedence, parens, unary minus, and the bound identifiers `basic` / `ctc` / `monthlyCtc` / `annualCtc` (case-insensitive). Function calls are intentionally *not* supported — `min(...)` etc. parse-error and fall through to the existing 0.0 + warn behaviour, so the prior `resolve_amount_formula_returns_zero` test still passes (renamed to `_unsupported_returns_zero` for honesty). 6 new tests cover the happy paths plus division-by-zero and unknown-identifier errors. **`cargo test -p crm-payroll-runs` → 28 pass (up from 22).**
    - **N2 — Server-side recents (TS).** [src/lib/lookup-registry.ts](src/lib/lookup-registry.ts) `LookupResult` gained an optional `recent?: LookupItem[]` field — the Rust executor populates it on empty-state queries from the per-tenant Redis LRU. [src/components/crm/entity-picker.tsx](src/components/crm/entity-picker.tsx) and [src/components/crm/command-palette.tsx](src/components/crm/command-palette.tsx) `loadRecents` / `loadRecentIds` short-circuit to `[]` and `pushRecent` skips the localStorage write when `USE_RUST_LOOKUP === true`. Both files' recents-hydration `useEffect` branches: Rust path does a single empty-query `fetchLookup` and reads `result.recent`; legacy path keeps the old localStorage → ids → fetch round trip. So flipping `NEXT_PUBLIC_USE_RUST_LOOKUP=true` flips both reads (server recents) and writes (`recordPickedRecent` already POSTs to `/v1/crm/lookup/{entity}/recent/{itemId}`). With this, P2 "Server-side recents migration" from §15 is closed.
    - **N3 — Subscriptions list page.** [src/app/dashboard/crm/sales/subscriptions/page.tsx](src/app/dashboard/crm/sales/subscriptions/page.tsx) — 222 lines, async server component reading `crm_subscriptions`. Columns: Plan, Customer, Frequency, Next billing, Status, Started. Resolves customer via `getCrmAccountById` (best-effort). Replaces the §12.1 placeholder.
    - **N4 — Contracts list page.** [src/app/dashboard/crm/sales/contracts/page.tsx](src/app/dashboard/crm/sales/contracts/page.tsx) — 177 lines. `crm_contracts` columns: Title, Counterparty, Type, Status, Effective, Expiry, E-sign provider. Replaces §12.2 placeholder.
    - **N5 — Bookings list page.** [src/app/dashboard/crm/bookings/page.tsx](src/app/dashboard/crm/bookings/page.tsx) — 189 lines. `crm_bookings` columns: Resource, Customer, Slot start/end, Status, Payment. Replaces §12.12 placeholder.
    - **N6 — Fixed assets list page.** [src/app/dashboard/crm/fixed-assets/page.tsx](src/app/dashboard/crm/fixed-assets/page.tsx) — 174 lines. `crm_fixed_assets` columns: Code, Name, Category, Cost, Purchased, Status, Custodian. Replaces §12.13 placeholder.
    - **N7 — Audit log list page.** [src/app/dashboard/crm/audit-log/page.tsx](src/app/dashboard/crm/audit-log/page.tsx) — 147 lines. `crm_audit_log` columns: When, Actor, Action, Entity, Entity id, Reason. 100-row limit. Replaces §12.21 placeholder.
    - **N8 — HR disciplinary list page.** [src/app/dashboard/hrm/hr/disciplinary/page.tsx](src/app/dashboard/hrm/hr/disciplinary/page.tsx) — 167 lines. `crm_disciplinary_cases` with dual-badge severity + status. Replaces §12.28 placeholder.
    - **N9 — HR awards list page.** [src/app/dashboard/hrm/hr/awards/page.tsx](src/app/dashboard/hrm/hr/awards/page.tsx) — 163 lines. `crm_award_programs` with nominations + winners counts. Replaces the other §12.28 placeholder.
    - **N10 — RFQ → Bid → PO conversion (TS).** New POST route [vendor-bids/[bidId]/convert-to-po/route.ts](src/app/dashboard/crm/purchases/vendor-bids/[bidId]/convert-to-po/route.ts) builds a draft PO from a bid (vendorId, lineItems, currency, paymentTerms), seeds lineage via `buildLineageFromParent({ kind: 'vendorBid', ... })`, back-links onto the bid, revalidates both list paths, redirects to the PO detail page. The vendor-bids list page ([page.tsx](src/app/dashboard/crm/purchases/vendor-bids/page.tsx)) now has an Actions column with a "Convert to PO" submit-button form per row, gated on `bid.status` ∈ `{awarded, won, accepted}`. (No vendor-bid detail page exists yet — button lives on the list per spec fallback.) Schema-fix from agent: PO uses `orderNumber` / `orderDate` / capitalized `status: 'Draft'`, not `poNumber` / `poDate` / lowercase. Closes the P4 "RFQ → Bid → PO conversion UI flow" headline.
    - Verification: `cargo check --workspace` clean (39 CRM/HRM crates + sabnode-api). `cargo test -p crm-payroll-runs` → 28 pass. `npx tsc --noEmit` introduces zero new errors — the residual TS errors are all in pre-existing dirty files (`facebook.actions.ts`, `products/page.tsx`, `purchases/leads/page.tsx`, plus the original 5 baseline) that this session never touched.
  - **§12 / P4 status:** With this batch, **9 of the 19 §12 placeholder routes** now have real list views (subscriptions, contracts, RFQs, vendor-bids, GRN, fixed-assets, bookings, audit-log, disciplinary, awards — counting the prior H9 batch). The remaining placeholders (coupons, loyalty, gift-cards, BOM, petty-cash, loans, tickets/sla, tickets/knowledge-base, service-contracts, portal, dashboards) each need their own entity-shape work — those are full features, not single-session work. The Rust CRUD crates ship for most of them already; the gap is UI.
  - **NEXT (longer-horizon items beyond a single session) →**
    - Wire detail pages for the new list rows (subscription detail uses M1's loader; bookings/contracts/fixed-assets/disciplinary/awards still 404 on `[id]`).
    - Subscriptions cron + dunning ladder worker (Vercel Cron / Queues — needs a runtime decision).
    - Contracts e-signature integration (Digio / Aadhaar e-sign / DocuSign).
    - BOM, POS, custom dashboards, customer/vendor portals, SLA engine — each their own product surface.

  - **O — §12 form completion + detail pages (2026-05-11).** Session completing all remaining /new form pages and detail pages for §12 entities.
    - **O1** budgets/new + crm-budgets.actions.ts — head, period, plan amount, scenario, alert %, owner.
    - **O2** loans/new + crm-loans.actions.ts — type, borrower, principal, interest rate, tenure, EMI auto-calc (compound formula).
    - **O3** petty-cash/new + crm-petty-cash.actions.ts — branch/custodian, opening balance.
    - **O4** subscriptions/new + saveSubscription added to crm-subscriptions.actions.ts — plan name, billing frequency/amount, trial days, start date.
    - **O5** service-contracts/new + crm-service-contracts.actions.ts — contract no, asset, coverage, frequency, billing.
    - **O6** inventory/bom/new + crm-bom.actions.ts — header + dynamic component rows serialized as JSON.
    - **O7** sales/coupons/new + crm-coupons.actions.ts — code, type, value, min cart, max uses, validity window.
    - **O8** sales/loyalty/new + crm-loyalty.actions.ts — program name, points per ₹, redemption ratio, expiry.
    - **O9** sales/gift-cards/new + crm-gift-cards.actions.ts — code, issued-to, value, expiry, transferable flag.
    - **O10** sales/contracts/new + crm-contracts.actions.ts — type, counterparty, e-sign provider, auto-renew.
    - **O11** bookings/new + crm-bookings.actions.ts — resource, customer, slot start/end.
    - **O12** fixed-assets/new + crm-fixed-assets.actions.ts — code, depreciation method, cost, useful life.
    - **O13** tickets/sla/new + crm-sla.actions.ts — priority, first-response, resolution, escalation targets.
    - **O14** tickets/knowledge-base/new + crm-knowledge-base.actions.ts — title, category, tags, visibility, body.
    - **O15** portal/new + crm-portal.actions.ts — name, email, portal type, capabilities.
    - **O16** dashboards/new + crm-dashboards.actions.ts — name, description, layout, visibility, auto-refresh.
    - **O17** Detail pages: bookings/[id], sales/contracts/[id], fixed-assets/[id], hrm/hr/disciplinary/[id], hrm/hr/awards/[id].
    - **O18** production-orders list + new + crm-production-orders.actions.ts; BOM page "Production orders" shortcut button.
    - All list pages that previously pointed "New" to non-existent routes now resolve. TSC still at 0 new CRM errors.
    - **NEXT (remaining longer-horizon items):**
      - Subscriptions cron + dunning ladder worker (Vercel Cron / Queues).
      - Contracts e-signature integration (Digio / Aadhaar e-sign / DocuSign).
      - POS terminal + online store.
      - SLA engine business logic (auto-breach detection, ticket timer).
      - KB article detail/edit page.
      - Production order detail + actual-yield update form.
      - Custom dashboard widget builder (add/move/resize widgets).
      - Portal authentication flow (portal users can log in to see their invoices/tickets).

Implementation note: build one `lookupRegistry` map in `src/app/actions/crm-lookup.actions.ts` with one entry per entity, and a single server action `lookupEntity(entity, params)`. The picker calls the action via a thin client wrapper.

### 13.5 Cross-feature data lineage (the chain)

Every document keeps a `lineage` array of `{ kind, id, no, createdAt }` references so the UI can show the chain:

```
Lead → Deal → Quotation → Sales Order → Delivery Challan → Invoice → Receipt
                              ↓                                ↑
                        Proforma ──────────────────── Credit Note (issued back)
```

```
RFQ → Vendor Bid → Purchase Order → GRN → Bill → Payout
                                          ↓
                                      Debit Note
```

UI: a "Linked Documents" rail on the right side of every detail page, ordered by lineage with status badges and click-through. Conversion buttons ("Convert to Invoice", "Convert to SO") add to lineage and pre-fill the next form using the previous doc's fields.

**Rust port — §13.5 helpers DONE (2026-05-07).** [rust/crates/crm-core/src/lineage.rs](rust/crates/crm-core/src/lineage.rs) now exports `LineageRef` plus the two helper functions every conversion server-action will call:
- `build_lineage_from_parent(parent_kind, parent_id, parent_lineage)` — builds the new doc's lineage as `parent.lineage ++ [parent_ref]`, deduping any self-cycle pointer back to the parent itself.
- `append_lineage(prev, next)` — appends a new ref while removing any earlier copy with the same `(kind, id)`, so the chain never repeats.

Both mirror their TS counterparts in `src/lib/lineage.ts`. `LineageRef` gained `PartialEq, Eq` derives so the dedupe predicate compiles cleanly. `cargo test -p crm-core` → 11 pass (6 → 11; +5 lineage tests covering empty parent, inheritance, self-cycle, append dedupe, append-to-empty); `cargo check --workspace` clean — every crate flattening `LineageRef` keeps compiling unchanged.

**Rust port — §13.5 conversion helpers DONE (2026-05-07).** New crate [rust/crates/crm-conversions](rust/crates/crm-conversions) — 9 pure-function helpers that build a child document from a parent and propagate `lineage` via `build_lineage_from_parent`. No I/O, no async — server actions compose them.

- [src/sales.rs](rust/crates/crm-conversions/src/sales.rs) (586 lines, 6 tests): `quotation_to_sales_order`, `quotation_to_invoice`, `quotation_to_proforma`, `sales_order_to_delivery_challan`, `sales_order_to_invoice`, `invoice_to_credit_note`.
- [src/purchases.rs](rust/crates/crm-conversions/src/purchases.rs) (391 lines, 4 tests): `purchase_order_to_grn`, `purchase_order_to_bill`, `grn_to_bill`, `bill_to_debit_note`.
- Modeling notes from the agent: (1) `sales_order_to_delivery_challan` and `purchase_order_to_grn` drop ad-hoc free-text line items (no `item_id`) since `ChallanLineItem` / `GrnLineItem` require a SKU; (2) `grn_to_bill` leaves `Bill.items` empty (GRN carries no rates — caller enriches from PO/price-list).
- Workspace registration: `crates/crm-conversions` added to [rust/Cargo.toml](rust/Cargo.toml).
- Verification: `cargo clippy -p crm-conversions --tests -- -D warnings` clean; `cargo test -p crm-conversions` → 10/10 pass.

### 13.6 Universal "Quick-add" + Cmd-K

Global `Cmd/Ctrl+K` palette:
- Search across every entity (uses lookup registry — same backend).
- Top results grouped by entity.
- Actions: open detail, "create new" wizard for any entity, run a saved view, jump to a sidebar route.
- Recent + pinned items per user.

### 13.7 Inline create / edit / convert (no page jumps)

- Convert quotation → SO/Invoice opens a side-sheet with all fields prefilled from lineage.
- Editing a customer from inside an invoice opens a side-sheet, saves and refreshes the picker chip without losing the invoice draft (autosave drafts to local + Redis).
- Bulk row edit on lists (table inline-editing) for fields that are pickers → still uses `<EntityPicker>` but in compact mode.

### 13.8 Custom fields → still pickable

Custom field type `entity_ref` (with target entity key) plugs into `<EntityPicker>` automatically. This means a user-defined "Account Manager" field on Clients (target = User) gets the same picker, recent items, peek and quick-create — no developer changes per custom field.

### 13.9 Performance & cost

- Mongo text indexes per searchable field set; compound `{ projectId, name }`.
- Redis cache: per-tenant per-entity LRU of last 1000 items keyed by `<tenantId>:<entity>`.
- Picker prefetches first page on focus (not mount) to avoid overfetching list pages.
- Bulk operations (e.g. import) bypass the picker and resolve via the same lookup registry server-side, in batches of 500.

### 13.10 Migration / rollout phasing

> **Backend-language directive (2026-05-06):** From this point on, any *new* CRM backend code introduced by §13.10 work (lookup endpoints, conversion/lineage actions, codemod-installed helpers, etc.) is to be authored in **Rust** in `rust/crates/`. Already-shipped TypeScript server actions (e.g. `crm-lookup.actions.ts`) stay as-is — no retroactive rewrite. Steps that only touch frontend forms (2, 3) remain TS/TSX.

1. Build `EntityPicker` + `lookupRegistry` for top 8 entities (Client, Vendor, Item, Employee, User, Account, Warehouse, Bank). One PR. **— DONE** (Phase 2 foundation + Phase 3 expansion, see §15)
   - [src/lib/lookup-registry.ts](src/lib/lookup-registry.ts) — `EntityKey` union + `ENTITY_KEYS` (18 entities; top-8 fully covered: `client`, `vendor`, `item`, `employee`, `user`, `account`, `warehouse`, `bankAccount`)
   - [src/app/actions/crm-lookup.actions.ts](src/app/actions/crm-lookup.actions.ts) — tenant-scoped `lookupEntity(entity, params)` server action + `makeMongoLookup()` helper + concrete registry entries
   - [src/components/crm/entity-picker.tsx](src/components/crm/entity-picker.tsx) — `<EntityPicker>` + `<EntityPickerChip>` (debounce, abort, recents, infinite scroll, multi-select, quick-create)
2. Migrate Invoice / Quotation / SO / Bill / PO forms to the picker. One PR each module. **— DONE** (Phase 2, see §15)
   - [src/app/dashboard/crm/sales/invoices/new/page.tsx](src/app/dashboard/crm/sales/invoices/new/page.tsx) — `client` picker (PoC)
   - [src/app/dashboard/crm/sales/quotations/new/page.tsx](src/app/dashboard/crm/sales/quotations/new/page.tsx) — `client` + line-item `item` pickers
   - [src/app/dashboard/crm/sales/orders/new/page.tsx](src/app/dashboard/crm/sales/orders/new/page.tsx) — `client` + line-item `item` pickers
   - [src/app/dashboard/crm/purchases/orders/new/new-order-form.tsx](src/app/dashboard/crm/purchases/orders/new/new-order-form.tsx) — `vendor`, `warehouse`, line-item `item` pickers (PO)
   - [src/app/dashboard/crm/purchases/expenses/new/new-expense-form.tsx](src/app/dashboard/crm/purchases/expenses/new/new-expense-form.tsx) — `vendor` + optional billable `client` (Bill)
   - All preserve original submit shape via hidden `<input>` so server actions stayed untouched.
3. Migrate Lead / Deal / Task / Ticket / Employee forms. **— DONE (Lead, Deal, Employee)** — partial; Task/Ticket pending in next runs.
   - Employee — Phase 2: [src/components/wabasimplify/crm-employee-form.tsx](src/components/wabasimplify/crm-employee-form.tsx) — `reportingTo` (`employee`, self-excluded) + linked `bankAccount`.
   - Lead — 2026-05-06: [src/app/dashboard/crm/sales-crm/all-leads/new/page.tsx](src/app/dashboard/crm/sales-crm/all-leads/new/page.tsx) — `assignedTo` migrated from `<ZoruSelect>` (single hard-coded "Me" option) to `<EntityPicker entity="user">`. Submit shape preserved via hidden `<input name="assignedTo">`. Pipeline/stage left on `SmartPipelineSelect` because they aren't in the canonical-8 picker set and `stage` requires name-not-id submit shape pinned to the loaded pipeline.
   - Deal — 2026-05-06: [src/components/wabasimplify/crm-create-deal-dialog.tsx](src/components/wabasimplify/crm-create-deal-dialog.tsx) — `accountId` migrated from `<ZoruSelect>` (driven by injected `accounts` prop, ~unbounded list) to `<EntityPicker entity="client">` (paginated/searchable). Submit shape preserved via hidden `<input name="accountId">`. State seeded from `defaultAccountId`, reset on submit-success. `contactId` left as-is — `contact` is not in `ENTITY_KEYS` yet (registry addition required, P1). Stage left as static `dealStages[]` select.
   - **NEXT sub-form →** Task form (entity refs: `assignedTo` user, related-to `client`/`vendor`/`deal`/`lead`).
   - Ticket form (next after Task) — entity refs: requester `client`, `assignedTo` user.
4. Add lineage rail to detail pages.
5. Ship Cmd-K palette (reuses registry).
6. Ship custom-fields `entity_ref` type.
7. Backfill: replace any remaining `<Select>` in CRM/HRM with `EntityPicker` via codemod-able grep — track in a checklist issue.

### 13.11 Acceptance criteria (per migrated form)

- No free-text input for any entity reference.
- Picker shows recent on focus, debounced search, infinite-scroll, hydrate-on-mount.
- Quick-create works for at least: Client, Vendor, Item, Tag, Account.
- Chip click navigates to detail; chip ⌘-click opens in side-sheet.
- Removing the value clears related dependent fields (e.g. clearing client clears address, currency, price-list, GSTIN — but only if user hasn't manually overridden).
- Server-side validation rejects unknown ids; hydration is server-trusted, not client.
- Lighthouse / CWV: picker first-paint < 50ms after focus; search round-trip < 300ms p95.

---

## 14 · Cross-feature automation surface

Once everything is linked through pickers + lineage, the following cross-module automations become trivial to wire (and should be supported in `Sales CRM → Automations`):

- New Invoice → if overdue 7d → send WhatsApp reminder + create Task for assignee.
- Lead stage = Won → create Client + create Deal-to-Quotation conversion + assign onboarding template.
- Employee added → create payroll record, asset assignment checklist, welcome kit ticket, calendar invite, Slack DM.
- Stock < reorder → create PO draft to default vendor, notify procurement.
- Bill received → if MSME 45-day rule applies → schedule reminder & flag in dashboard.
- Subscription failed payment → dunning ladder (email d1, SMS d3, WhatsApp d5, ticket d7, suspend d14).
- Ticket idle > SLA → escalate, page on-call, drop CSAT survey on resolution.
- Quotation accepted (e-sign) → create SO + send to warehouse + create Invoice draft.

Each rule becomes a row in the Automations table, all entity references via pickers; conditions and actions traverse the same lookup registry — no code change per rule.

---

## 15 · Execution log (what's already shipped)

This section is the **source of truth for what's done vs. pending** so a fresh session can pick up without re-discovering. Date-stamped in absolute dates. Read this first before touching code in `src/app/dashboard/crm/**` or `src/components/crm/**`.

### ✅ Phase 1 — Sidebar IA + cards-to-redirects (2026-05-06)

#### Sidebar rewrite

- `src/components/wabasimplify/crm-tab-layout.tsx` — `crmMenuItems` rewritten to mirror §11 IA (~264 lines changed). New top-level **Reports** group; **Sales CRM** sub-grouping introduced; **HR & Payroll** expanded from 7 → 14 sub-groups: Recruitment, People, Employee Mgmt, Attendance & Leave, Shifts & Time, Payroll Mgmt, Statutory, Performance & Growth, Learning, Docs & Assets, Travel & Expenses, Exit & Comp, Reports, Settings. Awards/Recognition links to `/dashboard/hrm/hr/awards`; Disciplinary Cases to `/dashboard/hrm/hr/disciplinary`.
- The active dashboard chrome on most routes is `src/components/zoruui/shell/zoru-home-shell.tsx` (mounted via `src/app/dashboard/layout.tsx`). `crm-tab-layout.tsx` itself is no longer on the active path but is still imported elsewhere — left alone.

#### Cards-to-redirect (9 module landing pages)

Each previously rendered `<CrmModuleOverview>` cards. All now `redirect()` server-side to the first concrete sub-route:

| Path | Redirects to |
|---|---|
| `src/app/dashboard/crm/sales/page.tsx` | `/dashboard/crm/sales/clients` |
| `src/app/dashboard/crm/purchases/page.tsx` | `/dashboard/crm/purchases/vendors` |
| `src/app/dashboard/crm/accounting/page.tsx` | `/dashboard/crm/accounting/charts` |
| `src/app/dashboard/crm/banking/page.tsx` | `/dashboard/crm/banking/all` |
| `src/app/dashboard/crm/sales-crm/page.tsx` | `/dashboard/crm/sales-crm/leads` |
| `src/app/dashboard/crm/hrm/page.tsx` | first concrete payroll route |
| `src/app/dashboard/crm/hrm/hr/page.tsx` | first concrete HR route |
| `src/app/dashboard/crm/workspace/page.tsx` | `/dashboard/crm` |
| `src/app/dashboard/crm/time-tracking/page.tsx` | `/dashboard/crm` |

#### What was kept (do not delete)

- `src/components/crm/crm-module-overview.tsx` — still imported by other callers.
- `src/components/crm/crm-page-header.tsx` — same.
- `src/app/dashboard/crm/inventory/page.tsx` — already redirected before this work.

### ✅ Phase 2 — EntityPicker foundation + 21 §12 skeleton routes + 7 form migrations + lineage + Cmd-K (2026-05-06)

#### Foundation files (import these directly, do not re-create)

| Path | Exports | Purpose |
|---|---|---|
| `src/lib/lookup-registry.ts` | `EntityKey`, `ENTITY_KEYS`, `LookupChip`, `LookupItem`, `LookupParams`, `LookupResult`, `EntityLookupConfig`, `LookupRegistry`, `LOOKUP_MAX_LIMIT` | Pure type/contract module — safe to import in client code. |
| `src/app/actions/crm-lookup.actions.ts` | `lookupEntity(entity, params)` server action; internal `registry: LookupRegistry` and `makeMongoLookup({ collection, searchableFields, toChip, defaultFilter? })` helper | Tenant-scoped (`userId`-filtered), paginated, supports `ids[]` hydration + free-text `$regex` search. |
| `src/components/crm/entity-picker.tsx` | `<EntityPicker>`, `<EntityPickerChip>` | 200ms debounce + AbortController, hydrate-on-mount, recents in `localStorage` keyed `entityPicker.recent.<entity>` (max 5), infinite scroll, multi-select, optional `+ Create new …` row, zoru-ui styled. |

#### 21 §12 skeleton routes (one `page.tsx` each, all from commit `189d4eabe`)

CRM-side (19):

| Path | §12 ref |
|---|---|
| `src/app/dashboard/crm/sales/subscriptions/page.tsx` | §12.1 |
| `src/app/dashboard/crm/sales/contracts/page.tsx` | §12.2 |
| `src/app/dashboard/crm/sales/coupons/page.tsx` | §12.7 |
| `src/app/dashboard/crm/sales/loyalty/page.tsx` | §12.7 |
| `src/app/dashboard/crm/sales/gift-cards/page.tsx` | §12.7 |
| `src/app/dashboard/crm/purchases/rfqs/page.tsx` | §12.3 |
| `src/app/dashboard/crm/inventory/grn/page.tsx` | §12.4 |
| `src/app/dashboard/crm/inventory/bom/page.tsx` | §12.5 |
| `src/app/dashboard/crm/budgets/page.tsx` | §12.14 (top-level — **not** under accounting/) |
| `src/app/dashboard/crm/petty-cash/page.tsx` | §12.15 (top-level — **not** under banking/) |
| `src/app/dashboard/crm/loans/page.tsx` | §12.16 (top-level — **not** under banking/) |
| `src/app/dashboard/crm/tickets/sla/page.tsx` | §12.8 |
| `src/app/dashboard/crm/tickets/knowledge-base/page.tsx` | §12.9 |
| `src/app/dashboard/crm/service-contracts/page.tsx` | §12.11 (top-level) |
| `src/app/dashboard/crm/bookings/page.tsx` | §12.12 (top-level) |
| `src/app/dashboard/crm/fixed-assets/page.tsx` | §12.13 (top-level) |
| `src/app/dashboard/crm/audit-log/page.tsx` | §12.21 (top-level) |
| `src/app/dashboard/crm/portal/page.tsx` | §12.10 (top-level) |
| `src/app/dashboard/crm/dashboards/page.tsx` | §12.24 (top-level) |

HRM-side (2):

| Path | §12 ref |
|---|---|
| `src/app/dashboard/hrm/hr/awards/page.tsx` | §12.28 |
| `src/app/dashboard/hrm/hr/disciplinary/page.tsx` | §12.28 |

> Each is a 21-line placeholder with the §12 subsection title and a "coming soon" body. **Replace, don't recreate**, when implementing the real feature.

#### Form migrations to `<EntityPicker>` (1 PoC + 6 forms = 7 total)

Submit shapes preserved on every form via hidden `<input>` so server actions stayed untouched. Legacy `Smart*Select` components left in place pending a codemod sweep (P0).

| Form path | Pickers wired |
|---|---|
| `src/app/dashboard/crm/sales/invoices/new/page.tsx` (PoC) | `client` |
| `src/app/dashboard/crm/sales/quotations/new/page.tsx` | `client`, line-item `item` |
| `src/app/dashboard/crm/sales/orders/new/page.tsx` | `client`, line-item `item` |
| `src/app/dashboard/crm/purchases/orders/new/new-order-form.tsx` | `vendor`, `warehouse`, line-item `item` |
| `src/app/dashboard/crm/purchases/expenses/new/new-expense-form.tsx` | `vendor`, optional billable `client` |
| `src/app/dashboard/crm/sales/receipts/new/page.tsx` | `client`, `bankAccount` |
| `src/components/wabasimplify/crm-employee-form.tsx` | reporting-to `employee` (self-excluded), linked `bankAccount` |

#### Lineage system (§13.5)

| Path | Exports / change |
|---|---|
| `src/lib/lineage.ts` | `appendLineage(prev, next)`, `buildLineageFromParent(parent, parentKind)` — pure helpers. |
| `src/components/crm/lineage-rail.tsx` | `<LineageRail>`, `kindToHref: Record<LineageKind, (id) => string>`, `SALES_CHAIN`, `PURCHASE_CHAIN`. Auto-detects chain from `current.kind`. |
| `src/lib/definitions.ts` | New `LineageKind` union (16 values): `lead`, `deal`, `quotation`, `proforma`, `salesOrder`, `deliveryChallan`, `invoice`, `paymentReceipt`, `creditNote`, `rfq`, `vendorBid`, `purchaseOrder`, `grn`, `bill`, `payout`, `debitNote`. New `LineageRef`. Optional `lineage?: LineageRef[]` field added to **13 doc types**: `Deal`, `Lead`, `CrmPurchaseOrder`, `CrmDebitNote`, `CrmExpense` (Bill), `CrmPayout`, `CrmInvoice`, `CrmQuotation`, `CrmProformaInvoice`, `CrmPaymentReceipt`, `CrmSalesOrder`, `CrmDeliveryChallan`, `CrmCreditNote`. |

Conversion paths wired so far:
- `convertInvoiceToCreditNote` propagates lineage end-to-end.
- `saveInvoice` accepts optional `fromKind` / `fromId` form fields to seed lineage on creation.
- `src/app/dashboard/crm/sales/invoices/[invoiceId]/page.tsx` — minimal detail page rendering `<LineageRail>` (template for other detail pages).

#### Cmd-K palette (§13.6)

| Path | Exports | Behaviour |
|---|---|---|
| `src/components/crm/command-palette.tsx` | `<CommandPaletteProvider>`, `useCommandPalette()` hook, internal `<CommandPalette>` | Provider owns open state + the global `Cmd/Ctrl+K` listener (skipped while typing in inputs). Empty state: 11 quick actions + recents (round-robin from `entityPicker.recent.<entity>` localStorage, capped at 8). Search: 8-way parallel `lookupEntity` fan-out, debounced + aborted, grouped by entity. |

Mounted in `src/app/dashboard/layout.tsx` as `<CommandPaletteProvider>{children}</CommandPaletteProvider>`. Open programmatically from any client component: `const { open } = useCommandPalette(); open();`.

### ✅ Phase 3 — Registry expansion + 3 persistence wirings + entity_ref custom-field type (2026-05-06)

#### Registry — 18 entities total (10 → 18)

`ENTITY_KEYS` in `src/lib/lookup-registry.ts` (alphabetical, `as const satisfies readonly EntityKey[]`) and implemented in `registry: LookupRegistry` in `src/app/actions/crm-lookup.actions.ts`.

| Entity key | Backing source | Implementation | Status |
|---|---|---|---|
| `account` | `crm_chart_of_accounts` | inline lookup | ✅ |
| `bankAccount` | `crm_payment_accounts` | `makeMongoLookup` | ✅ |
| `branch` | (collection TBD) | inline, returns `[]` | 🟡 TODO-empty — swap to `makeMongoLookup` once `crm_branches` exists |
| `category` | `crm_product_categories` | `makeMongoLookup` | ✅ |
| `client` | `crm_accounts` | `makeMongoLookup` | ✅ |
| `currency` | static (12 ISO codes) | inline | ✅ |
| `department` | `crm_departments` | `makeMongoLookup` | ✅ |
| `designation` | `crm_designations` (`$lookup` joined to departments) | inline aggregation | ✅ |
| `employee` | `crm_employees` | inline | ✅ |
| `item` | `crm_products` | `makeMongoLookup` | ✅ |
| `pipeline` | embedded `users.crmPipelines[]` | inline (in-memory filter) | ✅ |
| `project` | `crm_projects` | `makeMongoLookup` | ✅ |
| `stage` | embedded `users.crmPipelines[].stages` | inline; composite id `pipelineId:stageId` | ✅ |
| `tag` | (collection TBD) | inline, returns `[]` | 🟡 TODO-empty — swap to `makeMongoLookup` once `crm_tags` exists |
| `taxRate` | `crm_taxes` + GST fallback slabs | inline | ✅ |
| `user` | `users` | inline | ✅ |
| `vendor` | `crm_vendors` | `makeMongoLookup` | ✅ |
| `warehouse` | `crm_warehouses` | `makeMongoLookup` | ✅ |

Exhaustive `Record<EntityKey, …>` maps are kept in lock-step in `entity-picker.tsx` (labels) and `command-palette.tsx` (labels, hrefs, empty-results). Adding a new entity → update `EntityKey` union + `ENTITY_KEYS` + registry entry + both maps.

#### 3 persistence wirings (fields now actually save)

| Server action | Form field | Stored as | Schema field added |
|---|---|---|---|
| `savePurchaseOrder` (`src/app/actions/crm-purchase-orders.actions.ts:95`) | hidden `warehouseId` | `ObjectId` (`ObjectId.isValid` validated) | `CrmPurchaseOrder.warehouseId?: ObjectId` |
| `savePaymentReceipt` (`src/app/actions/crm-payment-receipts.actions.ts:58`) | hidden `bankAccountId` | `ObjectId` (validated) | `CrmPaymentReceipt.bankAccountId?: ObjectId` |
| `saveCrmEmployee` (`src/app/actions/crm-employees.actions.ts:238`) | hidden `ext_bank_account_id` | written into `crm_employee_details.bank_account_id` | `ExtendedDetail.bank_account_id?` |

All three are optional and backward-compatible. Employee edit form hydrates `bank_account_id`. PO and Receipt edit pages don't exist yet (see P0).

#### `entity_ref` custom-field type (§13.8)

| Path | Change |
|---|---|
| `src/lib/worksuite/meta-types.ts:55` | `WsCustomFieldType` union extended with `'entity_ref'`. `WsCustomField` got `targetEntity?: EntityKey` + `multi?: boolean`. |
| `src/app/dashboard/crm/settings/custom-fields/new/new-field-form.tsx` | Settings UI got "Linked record" option, conditional entity-Select + Single/Multi toggle, driven by `ENTITY_KEYS` from `@/lib/lookup-registry`. |
| `saveCustomField` server action | Coerces `multi` via `asBool`; scrubs `targetEntity` for non-ref types. |
| `src/components/crm/custom-field-input.tsx` (new) | Exports `<CustomFieldInput>` + `<CustomFieldDisplay>`. Handles every `WsCustomFieldType`; `entity_ref` renders `<EntityPicker>` (input) / `<EntityPickerChip>` (display). **No consumers yet** — see P1. |

### 📌 Open follow-ups (priority order — pick the top item without hunting)

#### P0 — high-impact, cheap

- ~~**Dead `getCrmEmployees()` call**~~ ✅ done 2026-05-06 — removed from `src/app/dashboard/hrm/payroll/employees/new/page.tsx` and `[employeeId]/edit/page.tsx`; `managers` prop dropped from `EmployeeForm` (the form now uses `<EntityPicker entity="employee">` for reporting-to). Action `getCrmEmployees` itself stays — still used by 25+ directory/payroll list pages.
- ~~**Proforma lineage**~~ ✅ done 2026-05-06 — `lineage?: LineageRef[]` added to `CrmProformaInvoice` in `src/lib/definitions.ts:3097`; the `proforma` kind now renders in `<LineageRail>`.
- ~~**PO edit page**~~ ✅ done 2026-05-06 — `src/app/dashboard/crm/purchases/orders/[orderId]/edit/page.tsx` shipped. `getPurchaseOrderById` added to `crm-purchase-orders.actions.ts`; `savePurchaseOrder` extended to UPDATE branch when hidden `orderId` is present (matchCount-checked, scoped by `userId`). `NewPurchaseOrderForm` now accepts optional `order?: WithId<CrmPurchaseOrder>`, hydrating `vendorId`, `warehouseId`, dates, currency, paymentTerms, notes, and lineItems. Listing page's "View" link swapped to "Edit" → reaches the new route.
- ~~**Receipt edit page**~~ ✅ done 2026-05-06 — `src/app/dashboard/crm/sales/receipts/[receiptId]/edit/page.tsx` (server) + `edit-receipt-form.tsx` (client). Light-edit only: `bankAccountId`, `notes`, `receiptDate` are editable. Payment records and invoice settlements are immutable — reverting them safely would require unwinding `paidAmount` mutations on linked invoices, which is out of scope. New `getPaymentReceiptById` + `updatePaymentReceipt` actions in `crm-payment-receipts.actions.ts`. Receipts listing got an Actions column with an Edit link.

#### P1 — wire the shipped foundation into more places

- **Custom-field display in entity edit forms**: render `<CustomFieldInput>` / `<CustomFieldDisplay>` (from `src/components/crm/custom-field-input.tsx`) in deal, account, ticket, employee edit forms. Foundation ready; deal dialog wired (F9/G1), quotation/invoice forms wired (I8/J1/J2). **Remaining:** account, ticket, employee edit forms.
- ~~**Build remaining doc types** so their lineage kinds light up: `CrmRfq`, `CrmVendorBid`, `CrmGrn`, `CrmBill`~~ ✅ done — TS interfaces in F4 (definitions.ts L1013-1152); Rust crates in L1-L4 (`crm-bills`, `crm-rfqs`, `crm-vendor-bids`, `crm-grns`).
- ~~**Backfill `lineage` propagation** beyond `convertInvoiceToCreditNote` + `saveInvoice` manual create: quotation → invoice, salesOrder → deliveryChallan, salesOrder → invoice, PO → bill, PO → GRN, GRN → bill~~ ✅ done — all 13 chain server actions now propagate (F5/F6/F7/F8/G1-G7).

#### P2 — performance + DX

- **Mongo text indexes** on each registry entity's `searchableFields`. Today's `$regex` is fine at small scale; index for big tenants (§13.9).
- **Server-side recents (Redis)** to replace `localStorage entityPicker.recent.*`. Key by `<tenantId>:<entity>` LRU of 1000 items per §13.9.
- **Swap TODO-empty registry entries** to `makeMongoLookup` once `crm_branches` and `crm_tags` collections land.
- **Pipelines collection migration**: when pipelines move from embedded-on-user to a real collection, replace the in-memory filter in `pipeline` and `stage` registry entries with a Mongo aggregation; preserve composite stage id `pipelineId:stageId`.
- **Cmd-K trigger button**: the `ZoruHomeShell` header has a `⌘K` chip that's purely visual — wire it to `useCommandPalette().open()`. Today the palette is keyboard-only.

#### P3 — broader form migration

Migrate remaining forms to `<EntityPicker>` (search for older `Smart*Select` and native `<Select>` references first):
- Lead, Deal, Contact, Task, Ticket forms.
- Item form: `vendor[]`, `category`, `salesAccount`/`purchaseAccount`/`stockAccount`/`cogsAccount`, `hsn`, `taxRate`.
- Credit-note, Debit-note, Delivery-challan forms.
- Salary-structure form.
- Drop `SmartDepartmentSelect` / `SmartDesignationSelect` from the employee form now that the registry has both.
- Backfill saved views / segments / dashboards to use the lookup registry as their filter source.
- **Broader `Smart*Select` codemod**: 12+ form files still import legacy components from `src/components/crm/**/smart-*-select.tsx`. Not 1:1 with the registry — `smart-vendor-type-select`, `smart-industry-select`, `smart-unit-select`, `smart-brand-select`, `smart-location-select` have no registry entity yet (need a registry addition or stay as static dropdowns). The rest (`smart-client-select`, `smart-vendor-select`, `smart-product-select`, `smart-warehouse-select`, `smart-pipeline-select`, `smart-department-select`, `smart-designation-select`, `smart-account-group-select`, `smart-ledger-select`, `smart-category-select`) can be swapped for `<EntityPicker>` directly.

#### P4 — flesh out the §12 skeleton pages with real features

(Skeleton routes already exist; replace the placeholder `page.tsx`.)
- Subscriptions & recurring billing — cron + dunning ladder.
- Contracts & e-signature — Aadhaar e-sign + Digio/Razorpay integration.
- RFQ → Bid → PO conversion flow (lineage already mapped).
- GRN, BOM, manufacturing job cards.
- POS terminal + online store.
- Tickets/help-desk + SLA engine + KB.
- Bookings/appointments.
- Fixed assets + depreciation runs.
- Budgets & forecasting.
- Petty cash, loans/advances.
- Custom dashboards (BI builder).
- Customer / vendor / employee portals.
- Audit log surface.
- Awards & recognition, disciplinary cases (HRM).

---

> When picking up: read §15 first, then jump to the highest-priority P-tier with capacity. Each item is small enough to dispatch as a single agent with a tight prompt — file paths and exports are noted above so the prompt can stay self-contained.

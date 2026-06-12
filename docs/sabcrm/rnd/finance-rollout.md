# R&D — SabCRM Finance rollout (task #13)

Execution spec for promoting every finance entity from its current minimal surface
(`FinanceDocClient` / `FinanceLedgerClient` / `FinanceJournalClient` dialogs) to a
full doc-surface-kit adopter: **full field set on form + list columns + detail
slots, real entity pickers, status workflow, lineage rail, KPIs, CSV export**.
Reference adopter: `/sabcrm/finance/invoices`.

World-class directive: minimal dialogs are non-compliant. Every field on the Rust
model that a user can reasonably author or read MUST surface somewhere
(form / list / detail). Party ids must always render as resolved labels.

---

## 0. Source-of-truth map

| Layer | Path |
| --- | --- |
| Kit | `src/app/sabcrm/finance/_components/doc-surface/` (`types.ts`, `index.ts`, `doc-list-page.tsx`, `doc-form.tsx`, `line-items-editor.tsx`, `entity-picker.tsx`, `doc-detail-page.tsx`, `status-flow.tsx`, `convert-menu.tsx`, `doc-surface.css`) |
| Reference adopter | `src/app/sabcrm/finance/invoices/{page.tsx,invoice-config.ts,invoices-client.tsx,[id]/page.tsx,[id]/invoice-detail-client.tsx}` |
| Flagship actions | `src/app/actions/sabcrm-finance-invoices.actions.ts` + `.types.ts` |
| Tranche CRUD actions | `src/app/actions/sabcrm-finance.actions.ts` + `.types.ts` (list/create/update/delete per entity, minimal payloads) |
| Statements actions | `src/app/actions/sabcrm-statements.actions.ts` + `.types.ts` |
| Rust TS client | `src/lib/rust-client/sabcrm-finance.ts` (`sabcrmFinance<Entity>Api` per entity), `src/lib/rust-client/sabcrm-supply.ts` (`sabcrmSupplyVendorsApi`, items) |
| Rust mounts | `rust/crates/api/src/router.rs` lines 745–795: `/v1/sabcrm/finance/{invoices,quotations,sales-orders,credit-notes,debit-notes,payment-receipts,bills,proforma-invoices,payment-accounts,bank-transactions,recurring-invoices,expenses,payouts,vouchers,petty-cash,budgets,reconciliation,accounts,account-groups,journal-entries,tds}` and `/v1/sabcrm/supply/vendors` (line 807) |
| Doc models | `rust/crates/crm-sales-types/src/{quotation,sales_order,proforma,credit_note,payment_receipt,line_item}.rs`; `rust/crates/crm-purchases-types/src/{bill,debit_note,payout_receipt,vendor}.rs` |
| Ledger models | `rust/crates/crm-{payment-accounts,bank-transactions,recurring-invoices,expense-claims,vouchers,voucher-entries,petty-cash,budgets,reconciliation,chart-of-accounts,tds,proforma-invoices}/src/types.rs` |
| Core fragments | `rust/crates/crm-core/src/{identity,audit,attribution,assignment,lineage,attachment}.rs` |
| Doc math | `src/lib/sabcrm/finance-doc-math.ts` (`DocLineInput`, `computeDocTotals`, `isBlankDocLine`) |
| Nav | `src/components/sabcrm/sabcrm-suite-frame.tsx` lines 265–290 (finance group; routes already exist) |

All wire formats are camelCase (`#[serde(rename_all = "camelCase")]` everywhere).

### Shared crm-core fragments (flattened onto every crm-sales-types / crm-purchases-types doc)

| Wire field | Type | Surface |
| --- | --- | --- |
| `_id`, `projectId`, `userId`, `tenantId?` | ObjectId hex | system only |
| `createdAt`, `updatedAt`, `createdBy?`, `updatedBy?` | ISO datetime / id | detail meta ("Created", "Updated") + activity feed |
| `assignedTo?`, `teamId?`, `pipelineId?`, `stageId?` | ObjectId hex | detail rail (Assignment card) — read-only v1 |
| `source?`, `referrerId?`, `campaignId?`, `utm{source,medium,campaign,term,content}` | Attribution | detail rail (read-only, only when present) |
| `lineage[]` | `{kind, id}[]` | detail related rail (resolved via per-kind lookups) |
| `attachments[]` | `{fileId, name?, mimeType?, size?}` | form (SabFiles picker, as on invoices) + detail attachments card |

The legacy-shape crates (`crm-payment-accounts`, `crm-bank-transactions`,
`crm-recurring-invoices`, `crm-expense-claims`, `crm-vouchers`,
`crm-voucher-entries`, `crm-petty-cash`, `crm-budgets`, `crm-reconciliation`,
`crm-chart-of-accounts`, `crm-tds`, `crm-proforma-invoices`) carry only
`_id/userId/projectId/createdAt/updatedAt` — no fragments, no lineage,
no attachments.

---

## 1. Kit extensions required (build FIRST — everything else configures them)

The kit API today (from `doc-surface/types.ts`):

- `DocListPageConfig<R>`: `title, description, icon, entity{singular,plural}, columns: DocListColumn<R>[], statuses: DocStatusDef[], fetchPage(filters: DocListFilters), fetchAllForCsv?, csvFileName?, rowHref?, rowLabel, partyFilter?{placeholder,search}, bulkActions?, pageSize?`. Column kinds: `text|party|money|date|status|badge|aging`.
- `DocFormConfig`: `entitySingular, numberLabel, partyLabel, partyPlaceholder, dateLabel, dueDateLabel, issueLabel?, searchParties, searchItems?, suggestNumber?, currencies?`. `DocFormValues`: `number, partyId, partyLabel, currency, date, dueDate, lines: DocLineDraft[], paymentTerms, customerNotes, termsAndConditions, attachments`.
- `DocDetailPageProps`: `backHref, backLabel, docNumber, entitySingular, statuses, flow, status, actions?, party: DocDetailParty|null, meta: {label,value}[], currency, lines: DocDetailLine[], totals: DocDetailTotals, notes?, terms?, related: DocRelatedRef[], attachments?, activity?, railExtra?, error?`.
- `StatusFlowProps`: `flow: string[], statuses, current`. `ConvertMenuProps`: `label?, heading?, items: ConvertMenuItem[]`. `EntityPickerProps`: `value, valueLabel?, onChange(opt|null), search, placeholder?, invalid?…`. `LineItemsEditorProps`: `lines, onChange, currency, searchItems?, disabled?`.

### 1.1 `DocForm` flexibility (edit `doc-form.tsx` + `types.ts`)

The form hardcodes party-required, dueDate-required, lines-required, and has no
slot for entity-specific fields. Add to `DocFormConfig` (all optional, defaults
preserve invoice behaviour exactly):

```ts
/** Hide the due-date field entirely (sales orders, credit notes, …). */
hideDueDate?: boolean;
/** Hide the line-items editor + treat lines as optional (receipts, payouts). */
hideLines?: boolean;
/** Hide the payment-terms input (entities whose DTO can't store it). */
hidePaymentTerms?: boolean;
/** Override the "Customer notes" label (e.g. "Notes"). */
notesLabel?: string;
/** Party optional (credit notes without invoice? NO — party stays required everywhere; keep this out). */
/** Entity-specific fields rendered inside the form grid, after Payment terms. */
extraFields?: (api: {
  values: DocFormValues;
  patch: (p: Partial<DocFormValues>) => void;
  busy: boolean;
}) => React.ReactNode;
```

And to `DocFormValues`:

```ts
/** Entity-specific extras bag; round-trips through onSubmit untouched. */
extras: Record<string, unknown>;
```

`emptyDocFormValues()` seeds `extras: {}`. Validation changes: skip dueDate
checks when `hideDueDate`, skip the lines check when `hideLines`. Entity-specific
validation lives in each surface's `onSubmit` (return `{ ok:false, error }` keeps
the drawer open — already supported).

### 1.2 New kit component — `allocations-editor.tsx`

For payment-receipt → invoices and payout → bills allocation tables
(`applyTo: {invoiceId|billId, amount}[]`).

```ts
export interface AllocationRow { rowId: string; docId: string | null; docLabel: string | null; openBalance?: number; amount: number; }
export interface AllocationsEditorProps {
  rows: AllocationRow[];
  onChange: (rows: AllocationRow[]) => void;
  currency: string;
  /** Searches open documents (invoices / bills). Option.meta shows balance. */
  searchDocs: (q: string) => Promise<DocEntityOption[]>;
  docLabel: string; // "Invoice" | "Bill"
  /** Total being allocated — renders allocated vs unallocated summary line. */
  totalAmount: number;
  disabled?: boolean;
}
```

Renders EntityPicker + amount input per row, add/remove row buttons, and a footer
line "Allocated ₹X of ₹Y — ₹Z unallocated". Export from `doc-surface/index.ts`.

### 1.3 New kit component — `journal-lines-editor.tsx`

For voucher-entry debit/credit legs. Two stacked tables (Debits / Credits), each
row = `{ rowId, accountId, accountLabel, amount, description? }` with an
account EntityPicker; footer shows `totalDebit`, `totalCredit` and a
balanced/unbalanced badge. Props:

```ts
export interface JournalLeg { rowId: string; accountId: string | null; accountLabel: string | null; amount: number; description?: string; }
export interface JournalLinesEditorProps {
  debits: JournalLeg[]; credits: JournalLeg[];
  onChange: (next: { debits: JournalLeg[]; credits: JournalLeg[] }) => void;
  searchAccounts: (q: string) => Promise<DocEntityOption[]>;
  currency: string; disabled?: boolean;
}
```

### 1.4 `DocListPage` URL-filter seeding (statements drill-down dependency)

Add optional prop `initialFilters?: Partial<DocListFilters>` to
`DocListPageProps`; when present, seed `q/status/partyId/range` state from it.
Server pages parse `searchParams` (`q`, `status`, `partyId`, `from`, `to`) and
pass them through — this is what lets statement rows deep-link into filtered
lists (§4).

No changes needed to `DocDetailPage`, `StatusFlow`, `ConvertMenu`,
`EntityPicker`, `LineItemsEditor`.

---

## 2. Shared actions to add (one file: `src/app/actions/sabcrm-finance-pickers.actions.ts` + per-entity action files)

Reuse as-is from `sabcrm-finance-invoices.actions.ts`:
`searchSabcrmFinanceParties` (records-engine `companies`+`people`, returns
`SabcrmPartyOption{id,label,meta,objectSlug}`), `resolveSabcrmFinanceParties`,
`searchSabcrmFinanceItems` (supply catalog → `SabcrmItemOption`),
`listSabcrmPaymentAccountOptions` (→ `SabcrmPaymentAccountOption{id,label}`).

New pickers (same gate pattern: session → project → RBAC `view` → plan gate):

| Action | Backing | Returns `DocEntityOption` |
| --- | --- | --- |
| `searchSabcrmFinanceVendors(q)` | `sabcrmSupplyVendorsApi.list(projectId, { q, limit: 12 })` (`/v1/sabcrm/supply/vendors`) | `label = displayName ?? name`, `meta = email ?? gstin ?? 'Vendor'` |
| `resolveSabcrmFinanceVendors(ids)` | same, by-id fetches | for list-row labels |
| `searchSabcrmFinanceInvoiceRefs(q, { openOnly?: boolean })` | `sabcrmFinanceApi` invoices list (`q` over `invoiceNo`) | `label = invoiceNo`, `meta = "₹balance · status"` — feeds credit-note link + receipt allocations |
| `searchSabcrmFinanceBillRefs(q, { openOnly? })` | `sabcrmFinanceBillsApi.list` | `label = billNo ?? vendorInvoiceNo`, `meta = "₹balance · status"` |
| `searchSabcrmFinanceLedgerAccounts(q)` | `sabcrmFinanceAccountsApi.list` (chart of accounts, `q` over name/code) | `label = name`, `meta = code · accountType` |
| `listSabcrmVoucherBookOptions()` | `sabcrmFinanceVouchersApi.list` (active only) | `label = name`, `meta = type` |
| `searchSabcrmFinanceQuotationRefs(q)` | quotations list | for SO `quotationRef` field |
| `searchSabcrmFinanceSalesOrderRefs(q)` | sales-orders list | for invoice/proforma "from SO" |

Per-entity "full" action files (mirror `sabcrm-finance-invoices.actions.ts`
structure exactly — `listSabcrm<X>Page(filters)`, `getSabcrm<X>Kpis()`,
`exportSabcrm<X>Rows(filters)`, `createSabcrm<X>Full(input)`,
`updateSabcrm<X>Full(id, patch)`, `transitionSabcrm<X>Status(id, next)`,
`getSabcrm<X>Related(id)`, `getNextSabcrm<X>Number()`):

- `sabcrm-finance-quotations.actions.ts`
- `sabcrm-finance-sales-orders.actions.ts`
- `sabcrm-finance-proforma.actions.ts`
- `sabcrm-finance-credit-notes.actions.ts`
- `sabcrm-finance-debit-notes.actions.ts`
- `sabcrm-finance-bills.actions.ts`
- `sabcrm-finance-payment-receipts.actions.ts`
- `sabcrm-finance-payouts.actions.ts`
- `sabcrm-finance-banking.actions.ts` (payment-accounts, bank-transactions, petty-cash, reconciliation — paged lists + full creates + KPIs)
- `sabcrm-finance-ledger.actions.ts` (vouchers, journal-entries, chart-of-accounts, budgets, tds, recurring-invoices, expenses — paged lists + full creates + KPIs)

Every Rust list endpoint already supports `page/limit/q/status` plus
entity-specific filters (verified: budgets adds `department/period`; bank-tx adds
`accountId/kind/category/from/to`; tds adds `financialYear/quarter/employeeId`;
expense-claims adds `employeeId/categoryId`; voucher-entries adds
`voucherBookId`). `DEFAULT_LIMIT = 20`, `MAX_LIMIT = 100`.

Number suggestion: copy `getNextSabcrmInvoiceNumber` pattern — scan page 1
sorted desc, regex the numeric tail, +1, zero-pad. Prefixes:
`QT-` `SO-` `PI-` `CN-` `DN-` `BILL-` `RCPT-` `PAY-` `EC-` `JV-`.

---

## 3. Per-entity specs

Legend for "Surface": **F** = create/edit form, **L** = list column,
**D** = detail page (paper meta / rail), **K** = feeds a KPI. Fields not listed
under a doc-type entity but present in §0's fragment table follow the fragment
rules. All routes live under `/sabcrm/finance/<entity>` and detail routes at
`/sabcrm/finance/<entity>/[id]` (new `[id]/page.tsx` + `<entity>-detail-client.tsx`
per doc entity, modeled on `invoices/[id]/`).

Per-entity file set (doc entities): `page.tsx` (server fetch via
`listSabcrm<X>Page` + KPIs), `<entity>-config.ts` (statuses/flow/filters mapper,
mirroring `invoice-config.ts`), `<entity>-client.tsx` (DocListPage + DocForm),
`[id]/page.tsx` + `[id]/<entity>-detail-client.tsx` (DocDetailPage + StatusFlow +
ConvertMenu + edit DocForm).

### 3.1 Quotations — `crm_sales_types::Quotation`, mount `/v1/sabcrm/finance/quotations`, client `sabcrmFinanceQuotationsApi`

Current page: `quotations/page.tsx` → `FinanceDocClient kind="quotations"` (number/amount/currency/date/status dialog; party shown as `…a1b2c3d4`). Non-compliant.

| Wire field | Type | Surface |
| --- | --- | --- |
| `quotationNo` | string | F(required, suggest `QT-`) L D |
| `date` | datetime | F L D |
| `validUntil` | datetime | F(use the kit dueDate slot, `dueDateLabel: 'Valid until'`) L D K(expiring) |
| `clientId` | ObjectId hex | F(EntityPicker → `searchSabcrmFinanceParties`) L(resolved label) D(party card) |
| `referenceNo?` | string | F(extraFields) D |
| `salesAgentId?` | ObjectId | D rail (read-only v1 — no agent picker action exists; Rust create DTO doesn't accept it: gap G2) |
| `dealId?` | ObjectId | D rail (lineage link when present) |
| `subject?` | string | F(extraFields, full-width input) L(secondary text under number — use `text` column) D |
| `currency` | string | F L(via money cols) D |
| `exchangeRate?` | f64 | D (create DTO gap G2) |
| `placeOfSupply?` | string | F(extraFields) D |
| `billingAddress?` / `shippingAddress?` | Address | D paper (create DTO gap G2) |
| `items[]` | LineItem[] | F(LineItemsEditor + `searchSabcrmFinanceItems`) D(lines table) |
| `totals` | Totals | L(`money` col — **compute from items client-side** until gap G1 lands) D(totals block) K |
| `termsAndConditions?` | string | F D |
| `customerNotes?` | string | F D |
| `attachments[]` | Attachment[] | D (create DTO gap G1; render when present) |
| `pdfStatus`, `templateId?`, `thumbnailFileId?`, `signatureImageFileId?`, `designMetadata?` | render plumbing | not surfaced v1 |
| `emailLog[]`, `whatsappSendLog[]` | comm logs | D activity feed entries |
| `status` | enum | F(create default draft) L D(StatusFlow) |
| `convertedTo[]`, `lineage[]`, `revisionHistory[]` | LineageRef / revisions | D related rail; revision count in activity feed |

Statuses (`QuotationStatus`, lowercase): `draft, sent, accepted, rejected, expired, converted`.
Tones: draft=neutral, sent=info, accepted=success, rejected=danger, expired=warning, converted=success.
Flow: `['draft','sent','accepted','converted']`. Transitions map (`SABCRM_QUOTATION_TRANSITIONS` in `quotation-config.ts`... actually in the `.types.ts` of its action file, mirroring `SABCRM_INVOICE_TRANSITIONS`):
`draft→[sent]`, `sent→[accepted,rejected,expired]`, `accepted→[]` (converted is set by convert actions), `rejected→[draft]`, `expired→[sent]`, `converted→[]`.
The Rust `UpdateQuotationInput.status: Option<String>` accepts the transition writes.

Lineage / ConvertMenu (detail page): **convert to Sales order** (calls
`createSabcrmSalesOrderFull` prefilled with `quotationRef: id`, `fromKind:'quotation'`, `fromId: id`, items copied; then `transitionSabcrmQuotationStatus(id,'converted')`),
**convert to Invoice** (existing `createSabcrmInvoiceFull` with `fromKind:'quotation'`),
**convert to Proforma**. Parents: `deal`/`lead` via `lineage[]`.

Pickers: parties, items. KPIs: open quote value (draft+sent Σ total), acceptance
rate (accepted+converted ÷ resolved), expiring in 7 days count, converted this
month. Kit fit: DocListPage + DocForm (with `extraFields` for subject /
referenceNo / placeOfSupply) + DocDetailPage — full coverage after §1.1.

### 3.2 Sales orders — `crm_sales_types::SalesOrder`, mount `/v1/sabcrm/finance/sales-orders`, client `sabcrmFinanceSalesOrdersApi`

| Wire field | Type | Surface |
| --- | --- | --- |
| `soNo` | string | F(suggest `SO-`) L D |
| `date` | datetime | F L D |
| `clientId` | ObjectId | F(parties picker) L D |
| `quotationRef?` | ObjectId | F(extraFields EntityPicker → `searchSabcrmFinanceQuotationRefs`) D(related rail parent) |
| `poNo?` / `poDate?` | string/date | F(extraFields pair) L(`poNo` text col) D |
| `expectedShipmentDate?` | datetime | F(extraFields DatePicker) L(date col) D K(due-to-ship) |
| `deliveryMethod?` | enum `courier,transporter,in_house,pickup,digital` (snake_case) | F(extraFields SelectField) D |
| `paymentTerms?` | string | F(built-in field) D |
| `shippingAddress?` | Address | D (DTO gap — create input omits it) |
| `currency`, `exchangeRate?` | string/f64 | F D |
| `items[]` | LineItem[] + fulfillment quartet `warehouseId?/qtyPending?/qtyDelivered?/qtyInvoiced?` | F(LineItemsEditor) D(lines table + a fulfillment column "Delivered x/y" when quartet present) |
| `totals` | Totals | L D K — **DTO accepts `totals`**: submit `computeDocTotals(lines)` |
| `customerNotes?` / `internalNotes?` | string | F(notes + extraFields textarea "Internal notes") D(internal notes in rail, not paper) |
| `status` | enum | F L D |
| `linkedDeliveryIds[]` / `linkedInvoiceIds[]` | ObjectId[] | D related rail (children) |
| `lineage[]` | LineageRef[] | D rail |

Statuses (lowercase): `open, partial, fulfilled, closed, cancelled`.
Tones: open=info, partial=warning, fulfilled=success, closed=neutral, cancelled=neutral.
Flow: `['open','partial','fulfilled']`. Transitions: `open→[partial,fulfilled,closed,cancelled]`,
`partial→[fulfilled,closed]`, `fulfilled→[closed]`, `closed→[]`, `cancelled→[open]`.
Form uses `hideDueDate: true`.

Convert: **to Invoice** (`createSabcrmInvoiceFull` + `fromKind:'salesOrder'`),
**to Proforma** (advance request). Parent: quotation. KPIs: open order value,
awaiting fulfillment count (open+partial), fulfilled this month, due-to-ship in
7 days. Kit fit: full after §1.1.

### 3.3 Proforma invoices — **mounted shape is the legacy crate** `crm-proforma-invoices/src/types.rs::CrmProformaInvoice` (collection `crm_proforma_invoices`), client `sabcrmFinanceProformaInvoicesApi`

⚠️ The canonical `crm_sales_types::ProformaInvoice` (advancePct/advanceAmount/
linkedSoId/paymentDueDate, lowercase statuses) is **NOT what the project mount
serves**. Spec against the mounted shape; advance handling is Rust gap G3.

| Wire field | Type | Surface |
| --- | --- | --- |
| `proformaNumber` | string | F(suggest `PI-`) L D |
| `accountId?` | ObjectId | F(parties picker — this is the customer ref) L D |
| `proformaDate` | datetime | F L D |
| `validTillDate?` | datetime | F(dueDate slot, label "Valid till") L D |
| `currency?` | string | F L D |
| `lineItems[]` | `{itemId?, description, quantity, rate, unit?, taxPct?, amount?}` | F(LineItemsEditor — map `qty→quantity`, `taxRatePct→taxPct`, line `total→amount`) D |
| `subtotal`, `total`, `taxTotal?`, `discountTotal?` | f64 | L(`total` money col) D totals block — submit from `computeDocTotals` |
| `termsAndConditions[]` | string[] | F(textarea, split on newlines) D |
| `notes?` | string | F D |
| `status?` | **TitleCase**: `Draft, Issued, Converted, Cancelled` (+ `archived`) | F L D |
| `designMetadata?` | doc | not surfaced |

Tones: Draft=neutral, Issued=info, Converted=success, Cancelled=neutral, archived=neutral.
Flow: `['Draft','Issued','Converted']`. Transitions: `Draft→[Issued,Cancelled]`,
`Issued→[Cancelled]` (Converted set by convert action), `Cancelled→[Draft]`.
Convert: **to Invoice** (`createSabcrmInvoiceFull`, `fromKind:'proforma'`) then
PATCH status `Converted`. No lineage[] on this shape — related rail is built from
the invoice's lineage back-reference (query invoices with `fromId`? not
supported; v1: store nothing extra, render rail only on the invoice side; note in
detail rail "Converted to invoice" via activity once G3 lands).
KPIs: outstanding proforma value (Issued Σ total), drafts count, converted this
month, average days Draft→Issued. Form: `hidePaymentTerms: true`. Kit fit: full
via field mapping above.

### 3.4 Credit notes — `crm_sales_types::CreditNote`, mount `/v1/sabcrm/finance/credit-notes`, client `sabcrmFinanceCreditNotesApi`

| Wire field | Type | Surface |
| --- | --- | --- |
| `cnNo` | string | F(suggest `CN-`) L D |
| `date` | datetime | F L D |
| `clientId` | ObjectId | F(parties picker) L D |
| `linkedInvoiceId?` | ObjectId | F(extraFields EntityPicker → `searchSabcrmFinanceInvoiceRefs`) D(related rail parent) |
| `reason` | enum `return, discount, price_adjust, cancel, other` (snake_case) | F(extraFields SelectField, **required**) L(`badge` col, neutral tone) D K |
| `currency`, `exchangeRate?` | | F D |
| `items[]` / `totals` | | F(LineItemsEditor) L(money) D — DTO accepts `totals` |
| `taxRecalc` | bool | F(extraFields Switch "Recompute taxes from line rates") D meta |
| `refundMode` | enum `cash, credit, replacement` (lowercase) | F(extraFields SelectField, **required**) L(badge) D |
| `refundTxnId?` | string | F(extraFields, shown when refundMode=cash) D |
| `autoApply` | bool | F(extraFields Switch "Auto-apply to next invoice") D meta |
| `notes?` | string | F(notesLabel:'Notes') D |
| `status` | enum | F L D |
| `lineage[]` | | D rail |

Statuses (snake_case): `draft, issued, refunded, cancelled`. Tones: draft=neutral,
issued=info, refunded=success, cancelled=neutral. Flow `['draft','issued','refunded']`.
Transitions: `draft→[issued,cancelled]`, `issued→[refunded,cancelled]`,
`refunded→[]`, `cancelled→[draft]`. Form: `hideDueDate: true`, `hidePaymentTerms: true`.
Convert: none forward; parent = linked invoice. The invoice detail's ConvertMenu
gains "Create credit note" pointing here prefilled.
KPIs: credited total (issued+refunded), refunds pending (issued, refundMode=cash),
this month count, reason split (top reason). Kit fit: full after §1.1.

### 3.5 Debit notes — `crm_purchases_types::DebitNote`, mount `/v1/sabcrm/finance/debit-notes`, client `sabcrmFinanceDebitNotesApi`

Vendor-side mirror of 3.4. Differences only:

| Wire field | Type | Surface |
| --- | --- | --- |
| `dnNo` | string | F(suggest `DN-`) L D |
| `vendorId` | ObjectId | F(**`searchSabcrmFinanceVendors`**) L(resolved via `resolveSabcrmFinanceVendors`) D |
| `linkedBillId?` | ObjectId | F(EntityPicker → `searchSabcrmFinanceBillRefs`) D parent |
| `reason` | same enum, wire accepts string | F L D |
| `refundMode` / `refundTxnId?` | string | F D ("credit" = credit held against vendor) |
| no `taxRecalc`, no `autoApply` | | — |

Statuses/flow/transitions identical to credit notes. DTO note: `items`/`totals`
are passthrough `serde_json::Value` — send the same camelCase LineItem/Totals
JSON. KPIs: vendor-side mirror of 3.4. Kit fit: full.

### 3.6 Bills — `crm_purchases_types::Bill`, mount `/v1/sabcrm/finance/bills`, client `sabcrmFinanceBillsApi`

| Wire field | Type | Surface |
| --- | --- | --- |
| `billNo?` | string | F(suggest `BILL-`) L D |
| `vendorInvoiceNo?` | string | F(extraFields) L(text col) D |
| `billDate` | datetime | F L D |
| `dueDate?` | datetime | F(dueDate slot, optional — relax in onSubmit) L D K(aging col) |
| `vendorId` | ObjectId | F(vendors picker) L D |
| `items[]` | LineItem[] (goods) | F(LineItemsEditor) D |
| `expenseLines[]` | `{accountId, description?, amount, taxRatePct?, cgst/sgst/igstAmount?, projectId?}` | F(extraFields: second editor — reuse AllocationsEditor pattern with `searchSabcrmFinanceLedgerAccounts` + amount + description) D(own table under items) |
| `tdsSection?` / `tdsAmount?` | string/f64 | F(extraFields pair) D K |
| `reverseCharge` | bool | F(extraFields Switch) D meta |
| `placeOfSupply?` | string | F(extraFields) D |
| `currency`, `exchangeRate?` | | F D |
| `totals` | Totals (passthrough Value) | L D — submit computed |
| `amountPaid`, `balance` | f64 (system-managed) | L(`balance` money col) D totals block K |
| `recurring?` | RecurringConfig (Value passthrough) | D meta badge "Recurring" (form support deferred) |
| `notes?` | string | F D |
| `status` | enum | F L D |
| `linkedPoId?`, `linkedGrnIds[]` | ObjectId(s) | D related rail parents |
| `lineage[]` | | D rail |

Statuses (snake_case): `draft, submitted, approved, paid, partially_paid, overdue, cancelled`.
Tones: draft=neutral, submitted=info, approved=info, paid=success,
partially_paid=warning, overdue=danger, cancelled=neutral.
Flow `['draft','submitted','approved','paid']`. Transitions:
`draft→[submitted,cancelled]`, `submitted→[approved,cancelled]`,
`approved→[overdue,cancelled]`, `partially_paid→[cancelled]`, `overdue→[cancelled]`,
`paid→[]`, `cancelled→[draft]` (paid/partially_paid otherwise driven by payouts).
Detail actions: **Record payout** dialog (mirror invoice `recordSabcrmInvoicePayment`:
amount/date/mode/bankAccountId/reference → `createSabcrmPayoutFull` with
`applyTo:[{billId,amount}]`, then status flip to paid/partially_paid in the
action). Convert: **Create debit note**.
KPIs: payable outstanding (Σ balance), overdue count, due in 7 days, booked this
month. List columns: number, vendor(party), billDate, dueDate, status, total,
balance, aging. Kit fit: needs §1.1 extras + expense-lines editor; the rest fits.

### 3.7 Payment receipts — `crm_sales_types::PaymentReceipt`, mount `/v1/sabcrm/finance/payment-receipts`, client `sabcrmFinancePaymentReceiptsApi`

No line items, no due date — `hideLines: true`, `hideDueDate: true`,
`hidePaymentTerms: true`; amount + allocation UI in `extraFields`.

| Wire field | Type | Surface |
| --- | --- | --- |
| `receiptNo` | string | F(suggest `RCPT-`) L D |
| `date` | datetime | F L D |
| `clientId` | ObjectId | F(parties picker) L D |
| `mode` | enum `cash, cheque, upi, neft, rtgs, imps, card, wallet` | F(SelectField, required) L(badge) D |
| `bankAccountId` | ObjectId (FK `crm_payment_accounts`) | F(SelectField over `listSabcrmPaymentAccountOptions`, **required**) D(resolved label) |
| `chequeNo?` / `chequeDate?` | string/date | F(shown when mode=cheque) D |
| `txnId?` | string | F(shown for upi/neft/rtgs/imps/card) D |
| `reference?` | string | F D |
| `amount` | f64 | F(required > 0) L(money) D K |
| `currency`, `exchangeRate?` | | F D |
| `applyTo[]` | `{invoiceId, amount}[]` | F(**AllocationsEditor** → `searchSabcrmFinanceInvoiceRefs(openOnly)`) D(allocation table in rail with links) |
| `excessAsAdvance` | bool | F(Switch "Park excess as customer advance") D meta |
| `tdsDeducted?` / `bankCharges?` | f64 | F(pair) D totals block lines |
| `notes?` | string | F D |
| `status` | enum | L D |
| `lineage[]` | | D rail (parent invoices) |

Statuses (lowercase): `received, cleared, bounced`. Tones: received=info,
cleared=success, bounced=danger. Flow `['received','cleared']`. Transitions:
`received→[cleared,bounced]`, `cleared→[]`, `bounced→[received]`.
DTO caveat: `UpdatePaymentReceiptInput` cannot change `amount/mode/applyTo/clientId`
— edit form locks those fields (disabled with help text) in edit mode.
KPIs: collected this month, uncleared total (received), bounced count, TDS
deducted FY-to-date. List columns: receiptNo, customer, date, mode(badge),
amount, status. Detail: `DocDetailPage` with `lines: []` and a custom totals
block (amount / tds / bankCharges / net) via `meta` + `railExtra` allocation card.

### 3.8 Payouts — `crm_purchases_types::PayoutReceipt`, mount `/v1/sabcrm/finance/payouts`, client `sabcrmFinancePayoutsApi`

Vendor-side mirror of 3.7. Differences: `paymentNo` (suggest `PAY-`),
`vendorId` (vendors picker), `applyTo[] = {billId, amount}` (AllocationsEditor →
`searchSabcrmFinanceBillRefs(openOnly)`), `tdsDeducted?` ("TDS withheld"), no
`bankCharges`. Statuses: `sent, cleared, failed` (sent=info, cleared=success,
failed=danger), flow `['sent','cleared']`, transitions `sent→[cleared,failed]`,
`failed→[sent]`, `cleared→[]`. `UpdatePayoutInput` is full — edit form fully
unlocked. KPIs: paid out this month, uncleared, failed count, TDS withheld
FY-to-date. The create action must also flip target bill statuses
(paid/partially_paid by comparing Σ applyTo vs bill totals) — same logic as
`recordSabcrmInvoicePayment` does for invoices.

### 3.9 Payment accounts — `crm-payment-accounts::CrmPaymentAccount` (`crm_payment_accounts`), client `sabcrmFinancePaymentAccountsApi`

Current: bespoke `payment-accounts-client.tsx` dialog (name/type/balance/currency).
Upgrade to DocListPage + bespoke Dialog form (DocForm is wrong shape here — no
party/lines/dates). Keep a dialog, but **full field set**:

| Wire field | Type | Surface |
| --- | --- | --- |
| `accountName` | string | F(required) L D |
| `accountType` | `bank, cash, upi, wallet, employee` | F(SelectField) L(badge) |
| `status` | `active, inactive, archived` | F L(status col) |
| `openingBalance` | f64 | F L(money) K |
| `openingBalanceDate` | datetime | F(DatePicker — DTO accepts `openingBalanceDate`) L(date) |
| `currency?` | string | F L |
| `isDefault` | bool | F(Switch) L(badge "Default") |
| `bankDetails?` | `{bankName?, accountNumber?, ifsc?, branch?, accountHolder?}` | F(collapsible "Bank details" section, shown when type=bank) D-dialog |

No detail route — row click opens an edit dialog (full patch via
`sabcrmFinancePaymentAccountsApi.update`). Statuses: active=success,
inactive=neutral, archived=neutral; no flow rail. KPIs: total opening balance,
active accounts, computed current balance (opening + Σ bank-transactions credit −
debit per account via `sabcrmFinanceBankTransactionsApi.list({accountId})` — cap
and mark sampled). Kit fit: DocListPage only; form stays a 20ui Dialog.

### 3.10 Bank transactions — `crm-bank-transactions::CrmBankTransaction` (`crm_bank_transactions`), client `sabcrmFinanceBankTransactionsApi`

| Wire field | Type | Surface |
| --- | --- | --- |
| `accountId` | ObjectId (→ payment accounts) | F(SelectField over `listSabcrmPaymentAccountOptions`, **required — today a placeholder id is minted; fix**) L(resolved label, `party` col kind) |
| `transactionDate` | datetime | F L |
| `amount` | f64 (always positive) | F L(money, red/green by kind) K |
| `type` (TS `kind`) | `debit, credit` | F(SelectField) L(badge: debit=danger, credit=success) |
| `description?` | string | F L(text) |
| `referenceNumber?` | string | F L |
| `balanceAfter?` | f64 | F(optional) L(money) |
| `category?` | string | F L(badge) |
| `voucherEntryId?` | ObjectId | D-dialog link to journal entry (read-only) |
| `status` | `pending, cleared, reconciled, archived` | F L |
| `sourceFileUrl?` | SabFile URL | F(`<SabFileUrlInput>` from `@/components/sabfiles` — statement CSV/PDF) |

Tones: pending=warning, cleared=info, reconciled=success, archived=neutral.
Flow `['pending','cleared','reconciled']`; transitions `pending→[cleared]`,
`cleared→[reconciled]` (reconciled set by reconciliation runs too).
List filters: kit partyFilter repurposed as **account filter** (search =
payment-account options), plus from/to date range (Rust supports `from/to`).
KPIs: inflow this month, outflow this month, net flow, unreconciled count.
Kit fit: DocListPage + Dialog form (no DocForm). No detail route.

### 3.11 Recurring invoices — `crm-recurring-invoices::CrmRecurringInvoice` (`crm_recurring_invoices`), client `sabcrmFinanceRecurringInvoicesApi`

| Wire field | Type | Surface |
| --- | --- | --- |
| `title?` | string | F L |
| `invoiceTemplateId?` | ObjectId | F(EntityPicker → `searchSabcrmFinanceInvoiceRefs` — "Invoice to clone") D-dialog link |
| `customerId` | ObjectId (required by DTO) | F(parties picker, **required — placeholder minting today; fix**) L(resolved) |
| `frequency` | `daily, weekly, monthly, quarterly, yearly` | F(SelectField) L(badge) |
| `startDate` | datetime | F(required) L |
| `endDate?` | datetime | F L |
| `nextRunAt?` / `lastRunAt?` | datetime | L(`nextRunAt` date col) K |
| `totalRuns?` | i64 | L |
| `status` | `active, paused, stopped, completed, archived` | F L + row action Pause/Resume (keep from `FinanceLedgerClient`) |
| `notes?` | string | F |

Tones: active=success, paused=warning, stopped=neutral, completed=info,
archived=neutral. Flow `['active','completed']`; transitions
`active→[paused,stopped]`, `paused→[active,stopped]`, `stopped→[]`.
KPIs: active schedules, runs due in 7 days, paused, lifetime generated runs.
Kit fit: DocListPage + Dialog form. No detail route v1.

### 3.12 Expenses (expense claims) — `crm-expense-claims::CrmExpenseClaim` (`crm_expense_claims`), client `sabcrmFinanceExpensesApi`

NOTE: this crate's struct is snake_case on the wire EXCEPT `userId/projectId/createdAt/updatedAt`
(no `rename_all` on the struct) — TS client field names follow `crm-expense-claims.ts`.

| Wire field | Type | Surface |
| --- | --- | --- |
| `claim_number` | string | F(suggest `EC-YYYYMM-NNNN`) L D-dialog |
| `employee_id` (string) + `employee_name?` | string | F(EntityPicker over `searchSabcrmFinanceParties` filtered to `people`; store id+label. Free-text fallback input for non-CRM employees) L(shows name) |
| `category_id?` + `category_name?` | string | F(free-text category input v1 — `/v1/sabcrm` has no expense-categories mount; gap G5) L(badge) |
| `amount` | f64 | F L(money) K |
| `currency?` | string | F L |
| `expense_date?` | datetime | F L |
| `description?` | string | F L(text, truncated) |
| `receipt_url?` + `receipt_name?` | SabFile URL | F(`<SabFileUrlInput>`) L(paperclip badge) |
| `status` | `draft, submitted, approved, rejected, reimbursed, cancelled, archived` | F L |
| `approver_id?` + `approver_name?` | string | set by Approve action (record session user) — L(approver) |

Tones: draft=neutral, submitted=info, approved=success, rejected=danger,
reimbursed=success, cancelled=neutral. Flow `['draft','submitted','approved','reimbursed']`.
Transitions: `draft→[submitted,cancelled]`, `submitted→[approved,rejected]`,
`approved→[reimbursed]`, `rejected→[submitted]`. Bulk actions: Approve selected,
Reject selected. KPIs: pending approval amount (submitted), reimbursed this
month, rejected count, average claim size. Kit fit: DocListPage + Dialog form
(no lines). No detail route v1; row click opens edit dialog.

### 3.13 Voucher books — `crm-vouchers::CrmVoucherBook` (`crm_voucher_books`), client `sabcrmFinanceVouchersApi`

| Wire field | Type | Surface |
| --- | --- | --- |
| `name` | string | F L |
| `type` | `payment, receipt, contra, journal, purchase, sales` | F(SelectField) L(badge) |
| `isDefault` | bool | F(Switch) L(badge) |
| `prefix?` / `suffix?` | string | F L(prefix) |
| `startingNumber?` / `padding?` | i64/i32 | F L(next number preview `prefix + pad(startingNumber)`) |
| `resetFrequency?` | `none, yearly, monthly` | F(SelectField) L |
| `approvalRequired` | bool | F(Switch) L(badge) |
| `isActive` / `status?` | bool / `active, archived` | F L |

No flow rail. KPIs: active books, approval-required count, books by type.
Kit fit: DocListPage + Dialog. Related: journal-entries list deep-links filtered
by `voucherBookId` (rust ListQuery supports it).

### 3.14 Journal entries (voucher entries) — `crm-voucher-entries::CrmVoucherEntry` (`crm_voucher_entries`), client `sabcrmFinanceJournalEntriesApi`

Current: `FinanceJournalClient` 2-line dialog (`SabcrmJournalEntryFormInput`).
Upgrade to **full multi-leg form** using §1.3 JournalLinesEditor.

| Wire field | Type | Surface |
| --- | --- | --- |
| `voucherBookId` | ObjectId | F(SelectField over `listSabcrmVoucherBookOptions`; default = the project's Journal book — keep the find-or-create logic from `createSabcrmJournalEntry`) L(resolved book name) |
| `voucherNumber` | string | F(suggest from book prefix/startingNumber, fallback `JV-<ts>`) L D-dialog |
| `date` | datetime | F L |
| `narration?` | string | F L(text) |
| `debitEntries[]` / `creditEntries[]` | `{accountId, amount, description?}[]` | F(**JournalLinesEditor** → `searchSabcrmFinanceLedgerAccounts`) detail-dialog tables |
| `totalDebit` / `totalCredit` | f64 | L(money) — computed client-side, must balance before submit |
| `status` | `draft, posted, archived` | F L |
| `reference?` | string | F L |

Tones: draft=neutral, posted=success, archived=neutral. Flow `['draft','posted']`;
transitions `draft→[posted]`, `posted→[]` (posted entries immutable — edit
disabled, only archive). KPIs: posted this month, drafts, debit volume this
month, books in use. Kit fit: DocListPage + Drawer form (use a 20ui Drawer like
DocForm, page-local component `journal-entries/_components/journal-entry-form.tsx`).

### 3.15 Petty cash — `crm-petty-cash::CrmPettyCashFloat` (`crm_petty_cash_floats`), client `sabcrmFinancePettyCashApi`

| Wire field | Type | Surface |
| --- | --- | --- |
| `branchName?` | string | F L |
| `custodianName?` + `custodianId?` | string/ObjectId | F(people picker writes both; free-text fallback) L |
| `openingBalance` | f64 | F(required) L(money) |
| `currentBalance` | f64 | L(money) K — system-managed |
| `currency?` | string | F |
| `status?` | `active, closed, archived` | F L |
| `notes?` | string | F |

Tones: active=success, closed=neutral, archived=neutral. Flow `['active','closed']`.
KPIs: total float balance, active floats, low-balance floats (current < 10% of
opening). Kit fit: DocListPage + Dialog.

### 3.16 Budgets — `crm-budgets::CrmBudget` (`crm_budgets`), client `sabcrmFinanceBudgetsApi`

| Wire field | Type | Surface |
| --- | --- | --- |
| `budgetHead` | string | F(required) L |
| `department?` | string | F L(badge) — Rust list filters on it |
| `period` | string (`FY 2026-27` / `2026-06`) | F(required) L |
| `plannedAmount` | f64 | F L(money) K |
| `actualAmount` | f64 | L(money) + utilization bar column (badge col `"82%"`, tone danger when >100%) K |
| `currency?` | string | F |
| `status?` | `draft, approved, rejected, locked, archived` | L + transitions |
| `locked`, `approvedBy?`, `approvedAt?`, `lockedAt?`, `rejectedAt?`, `rejectReason?` | audit trail | edit-dialog read-only footer |
| `notes?` | string | F |

Tones: draft=neutral, approved=success, rejected=danger, locked=info,
archived=neutral. Flow `['draft','approved','locked']`; transitions
`draft→[approved,rejected]`, `approved→[locked]`, `rejected→[draft]`, `locked→[]`.
NOTE: create DTO has **no status** — created as draft; transitions via update.
KPIs: planned total, actual total, utilization %, over-budget heads count.
Kit fit: DocListPage + Dialog.

### 3.17 Reconciliation — `crm-reconciliation::CrmReconciliation` (`crm_reconciliations`), client `sabcrmFinanceReconciliationApi`

| Wire field | Type | Surface |
| --- | --- | --- |
| `accountId` | ObjectId | F(SelectField over `listSabcrmPaymentAccountOptions`, **required — placeholder minting today; fix**) L(resolved) |
| `periodStart` / `periodEnd` | datetime | F(DateRange pair) L(two date cols) |
| `openingBalance?` / `closingBalance?` | f64 | F L(money) |
| `matchedCount` / `unmatchedCount` | i64 | L K — written by the matching flow |
| `notes?` | string | F |
| `status` | `in_progress, completed, archived` (default in_progress; `finalizedAt` set on completed) | L + "Complete run" action |
| `finalizedAt?` | datetime | L(date) |

Tones: in_progress=warning, completed=success, archived=neutral. Flow
`['in_progress','completed']`. Statement-line matching UI stays a follow-up
(the legacy matching engine lives in `src/app/actions/crm-reconciliation.actions.ts`
over native Mongo + `crm-reconciliation` crate — do NOT wire it here yet).
KPIs: last completed run, unmatched total, in-progress runs, difference
(closing − opening − net bank-tx). Kit fit: DocListPage + Dialog.

### 3.18 Chart of accounts — `crm-chart-of-accounts::CrmChartOfAccount` (`crm_chart_of_accounts`), client `sabcrmFinanceAccountsApi` (+ `sabcrmFinanceAccountGroupsApi`)

| Wire field | Type | Surface |
| --- | --- | --- |
| `name` | string | F L |
| `code?` | string | F L(text, mono) |
| `accountGroupId?` | ObjectId (FK `crm_account_groups`) | F(SelectField over `listSabcrmAccountGroups` — action exists in `sabcrm-finance.actions.ts`) L(group name) |
| `accountType?` | `asset, liability, income, expense, equity` | F(SelectField) L(badge, per-type tone) K |
| `parentId?` | ObjectId (hierarchy) | F(EntityPicker → `searchSabcrmFinanceLedgerAccounts`) L(parent name) |
| `openingBalance?` | f64 | F L(money) |
| `currency?` | string | F |
| `isActive` / `status` | bool / `active, archived` | F(Switch) L |
| `notes?` | string | F |

No flow rail. List: group rows by `accountType` (5 sections) — keep the grouped
rendering idea from the current page but on DocListPage columns; if grouping
proves awkward, ship flat list + type filter (statuses slot repurposed is NOT
allowed — add a SelectField in `primaryAction` toolbar custom node).
KPIs: counts per type, inactive count. Kit fit: DocListPage + Dialog.

### 3.19 TDS — `crm-tds::CrmTdsRecord` (`crm_tds_records`), client `sabcrmFinanceTdsApi`

| Wire field | Type | Surface |
| --- | --- | --- |
| `employeeId?` (string) + `employeeName` | string | F(people picker + free-text fallback) L |
| `financialYear` | string `2025-26` | F(SelectField of recent FYs) L K |
| `quarter` | `Q1..Q4` | F(SelectField) L(badge) |
| `tdsAmount` | f64 | F L(money) K |
| `grossAmount` | f64 | F L(money) |
| `certificateNumber?` | string | F L |
| `depositChallanNumber?` | string | F L |
| `depositDate?` | datetime | F L(date) |
| `status` | `pending, deposited, filed, archived` | F L |
| `notes?` | string | F |

Tones: pending=warning, deposited=info, filed=success, archived=neutral.
Flow `['pending','deposited','filed']`; transitions `pending→[deposited]`,
`deposited→[filed]`. List filters: FY + quarter SelectFields (Rust ListQuery
supports both). KPIs: pending deposit amount, deposited this quarter, filed
certificates, FY TDS total. Kit fit: DocListPage + Dialog.

---

## 4. Statements-page enrichment

Pages: `trial-balance`, `pnl`, `balance-sheet`, `cash-flow`, `gst`, `eway-bills`
(all server-rendered via `ReportShell`/`PeriodSwitcher`/`ReportEmpty`/`formatINR`
in `_components/finance-report.tsx`; data from `sabcrm-statements.actions.ts`:
`getSabcrmTrialBalance`, `getSabcrmPnl(fy)`, `getSabcrmBalanceSheet`,
`getSabcrmCashFlow`, `getSabcrmGstSummary`, `getSabcrmEwayReadiness`).

### 4.1 Drill-downs (needs §1.4 `initialFilters`)

Every aggregate cell links to the filtered source list:

- P&L month revenue → `/sabcrm/finance/invoices?from=YYYY-MM-01&to=YYYY-MM-31`
- P&L month expenses → `/sabcrm/finance/bills?from=…&to=…` and `/sabcrm/finance/expenses?from=…&to=…` (two links in a cell hover menu, or split Expenses into Bills/Claims columns and link each)
- Cash-flow month inflow → `/sabcrm/finance/payment-receipts?from=…&to=…`; outflow → `/sabcrm/finance/payouts?…`
- Balance-sheet AR line → `/sabcrm/finance/invoices?status=overdue` (and a no-status open filter); AP line → `/sabcrm/finance/bills`
- Trial-balance account row → `/sabcrm/finance/journal-entries?q=<account name>` v1 (account-id filter on journal list is a follow-up; rust ListQuery has no accountId — note as gap G6)
- GST GSTR-1 rows → `/sabcrm/finance/invoices?from=…&to=…`; ITC row → bills
- E-way "missing" rows already reference invoices — link each row to `/sabcrm/finance/invoices/<id>`

Implementation: plain `<Link>` cells (server components — zero client JS), the
doc list pages parse `searchParams` into `initialFilters`.

### 4.2 Period compare

- P&L + cash-flow: accept `?fy=<y>&compare=1`; the action gains an optional
  `compareFy` param (fetch both years in one action call —
  `getSabcrmPnl(fy, { compareWith: fy-1 })` returning `{ current, previous }`),
  table renders prev-year column + Δ% badge per month and per total.
- Trial balance + balance sheet: accept `?asOf=YYYY-MM-DD` (filter journal
  lines / docs by date ≤ asOf) with a month-end PeriodSwitcher (last 6
  month-ends + FY-end).
- GST: already monthly — add `?m=YYYY-MM` switcher if not present, plus
  prev-month Δ on the 3B summary cards.

### 4.3 Export

New shared client component
`src/app/sabcrm/finance/_components/statement-export-button.tsx`:
takes `rows: Record<string, string | number>[]`, `fileName`, serializes CSV
client-side (no server round-trip; data already on the page), renders a 20ui
`Button variant="secondary" iconLeft={Download}`. Mount in each `ReportShell`
`actions` slot next to the PeriodSwitcher. Also add "Print" (window.print —
`doc-surface.css` already carries print-friendly paper patterns to copy).

---

## 5. Rust / DTO gaps (file PRs alongside, do not block UI tranches)

| ID | Gap | Where | Workaround until fixed |
| --- | --- | --- | --- |
| G1 | `CreateQuotationInput` lacks `totals`, `attachments`, `status`; handler persists `Totals::default()` (`crm-quotations/src/handlers.rs` ~line 393) | `rust/crates/crm-quotations/src/dto.rs` + `handlers.rs` | compute display totals from `items[]` client-side; status set via follow-up PATCH (pattern already used by `createSabcrmBill`) |
| G2 | Quotation create/update lack `exchangeRate`, `salesAgentId`, `dealId`, `referenceNo`, `billingAddress`, `shippingAddress` | same | omit from form; show on detail when present |
| G3 | Project proforma mount serves legacy `crm_proforma_invoices` shape — canonical advance fields (`advancePct`, `advanceAmount`, `linkedSoId`, `paymentDueDate`, `expectedDelivery`) unavailable | `rust/crates/crm-proforma-invoices/` vs `crm-sales-types/src/proforma.rs` | ship against mounted shape (§3.3); advance UX deferred |
| G4 | `UpdatePaymentReceiptInput` can't patch `amount/mode/applyTo/clientId` | `crm-payment-receipts/src/dto.rs` | lock fields in edit mode |
| G5 | No `/v1/sabcrm/finance/expense-categories` mount (crate `crm-expense-categories` is legacy-only) | `rust/crates/api/src/router.rs` | free-text category on expense form |
| G6 | Journal-entries ListQuery has no `accountId` filter (trial-balance drill-down precision) | `crm-voucher-entries/src/dto.rs` | drill down via `q=` name search |
| G7 | `CreateSalesOrderInput` lacks `shippingAddress` | `crm-sales-orders/src/dto.rs` | detail-only render |

---

## 6. Build order (each step independently shippable)

1. **Kit extensions** (§1.1–§1.4) + `sabcrm-finance-pickers.actions.ts` (vendors + refs + ledger accounts + voucher books). Verify invoices surface unchanged (`npx tsc --noEmit` with 16GB heap per repo memory, plus manual `/sabcrm/finance/invoices` smoke).
2. **Customer-doc tranche**: quotations → sales-orders → proforma (3.1–3.3): per-entity actions files, configs, list clients, detail routes, converts.
3. **Vendor-doc tranche**: bills → debit-notes (3.5–3.6) + vendors picker wiring.
4. **Money tranche**: payment-receipts → payouts (3.7–3.8) incl. AllocationsEditor + bill/invoice status flips.
5. **Banking tranche**: payment-accounts, bank-transactions, petty-cash, reconciliation (3.9, 3.10, 3.15, 3.17).
6. **Ledger tranche**: vouchers, journal-entries (JournalLinesEditor), chart-of-accounts, budgets, tds, recurring-invoices, expenses (3.11–3.14, 3.16, 3.18–3.19).
7. **Statements enrichment** (§4) — depends on §1.4 only.
8. Delete `FinanceDocClient` / `FinanceLedgerClient` / `FinanceJournalClient` and the bespoke `payment-accounts-client.tsx` once their last consumer is migrated; grep `_components/finance-doc-client` etc. to confirm zero imports.

Rules of the road (repo memories): 20ui barrel imports only; SabFiles for every
file input; statuses/filters always typed in a `<entity>-config.ts`; every list
row renders resolved labels, never raw ObjectIds; every action re-runs the
session → project → RBAC → plan gate; run `graphify update .` after code changes.

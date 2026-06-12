# R&D — Supply + Commerce rollout onto the doc-surface kit (task #14)

> **Status:** R&D complete — execution spec for the build agent.
> **Scope:** 10 Supply entities + 9 Commerce entities re-built on the finance
> doc-surface kit, plus the POS **register** re-home at
> `/sabcrm/commerce/register`.
> **World-class directive:** every entity surface exposes its **FULL field
> set** — full create/edit forms, full list columns, full detail slots, with
> REAL entity pickers. The current `SupplyClient` / `CommerceClient` minimal
> dialogs are non-compliant and get retired by this phase.

---

## 1. Ground truth

### 1.1 The reusable kit (read these files, use these APIs verbatim)

Kit root: `src/app/sabcrm/finance/_components/doc-surface/`
(`index.ts` barrel; import as `../_components/doc-surface` from finance, or
`@/app/sabcrm/finance/_components/doc-surface` from supply/commerce — the
flagship adopter imports relatively; supply/commerce clients should use the
absolute alias since they live outside `finance/`).

| Export | File | Key API (real, current) |
|---|---|---|
| `DocListPage<R extends {id:string}>` | `doc-list-page.tsx` | props `{ config, kpis?, primaryAction?, initialRows, initialHasMore, initialError, refreshToken? }` |
| `DocListPageConfig<R>` | `types.ts` | `{ title, description, icon, entity:{singular,plural}, columns: DocListColumn<R>[], statuses: DocStatusDef[], fetchPage(filters)=>Promise<DocResult<{rows,hasMore}>>, fetchAllForCsv?, csvFileName?, rowHref?, rowLabel, partyFilter?:{placeholder, search}, bulkActions?, pageSize? }` |
| `DocListColumn<R>` | `types.ts` | `kind: 'text'\|'party'\|'money'\|'date'\|'status'\|'badge'\|'aging'`, `value(row)`, `currency?(row)`, `tone?(row)`, `csv?(row)` |
| `DocListFilters` | `types.ts` | `{ page, q, status, partyId, from?, to? }` — generic; map per entity like `toInvoiceFilters()` in `invoices/invoice-config.ts` |
| `DocForm` | `doc-form.tsx` | props `{ open, onOpenChange, config: DocFormConfig, mode:'create'\|'edit', initialValues?, onSubmit(values,{issue}) }` |
| `DocFormValues` | `types.ts` | **fixed shape**: `{ number, partyId, partyLabel, currency, date, dueDate, lines: DocLineDraft[], paymentTerms, customerNotes, termsAndConditions, attachments }` |
| `DocFormConfig` | `types.ts` | `{ entitySingular, numberLabel, partyLabel, partyPlaceholder, dateLabel, dueDateLabel, issueLabel?, searchParties, searchItems?, suggestNumber?, currencies? }` |
| `EntityPicker` | `entity-picker.tsx` | `{ value, valueLabel?, onChange(option\|null), search(q)=>Promise<DocEntityOption[]>, placeholder?, emptyText?, disabled?, invalid?, id?, 'aria-label'? }` — wraps 20ui `Combobox`, caches id→label |
| `LineItemsEditor` / `blankDocLine()` | `line-items-editor.tsx` | `{ lines: DocLineDraft[], onChange, currency, searchItems?, disabled? }` — columns qty/rate/discountPct/taxRatePct, INR-style money |
| `DocDetailPage` | `doc-detail-page.tsx` | `{ backHref, backLabel, docNumber, entitySingular, statuses, flow, status, actions?, party, meta:[{label,value}], currency, lines: DocDetailLine[], totals: DocDetailTotals, notes?, terms?, related: DocRelatedRef[], attachments?, activity?, railExtra?, error? }` |
| `StatusFlow` | `status-flow.tsx` | `{ flow: string[], statuses, current, className? }` |
| `ConvertMenu` | `convert-menu.tsx` | `{ label?, heading?, items: ConvertMenuItem[] ({key,label,icon?,description?,disabled?,danger?,onSelect,group?}), disabled? }` |

Line math: `DocLineInput` in `src/lib/sabcrm/finance-doc-math.ts` =
`{ itemId?, description?, hsnSac?, qty, unit?, rate, discountPct?, taxRatePct? }`;
`isBlankDocLine`, `computeDocTotals` live there too.

**Reference adopter (copy this file layout per entity):**

```
src/app/sabcrm/finance/invoices/
  invoice-config.ts          # statuses + flow + filter mapping + hrefs (client-safe)
  invoices-client.tsx        # 'use client' — DocListPageConfig + DocForm wiring
  page.tsx                   # server entry: initial fetch + KPIs → client
  [id]/page.tsx              # server entry: doc + party + related in parallel
  [id]/invoice-detail-client.tsx
```

Action-module convention: a per-surface `'use server'` module + sibling
`.actions.types.ts` (see `src/app/actions/sabcrm-finance-invoices.actions.ts`
— exports `listSabcrmInvoicesPage`, `searchSabcrmFinanceParties`,
`searchSabcrmFinanceItems`, `getNextSabcrmInvoiceNumber`,
`createSabcrmInvoiceFull`, `updateSabcrmInvoiceFull`,
`transitionSabcrmInvoiceStatus`, `exportSabcrmInvoiceRows`,
`getSabcrmInvoiceRelated`; transition vocabulary as a
`SABCRM_INVOICE_TRANSITIONS` record in the types module).

### 1.2 Current state — what gets replaced

- `src/app/sabcrm/supply/_components/supply-client.tsx` — ONE generic
  list+dialog client for all 10 supply pages (`SupplyRow`, `SupplyKind`).
  Minimal "New <thing>" dialogs (e.g. PO = poNo/date/vendor/amount only).
  **Non-compliant → retire after rollout.**
- `src/app/sabcrm/commerce/_components/commerce-client.tsx` — same pattern
  for the 9 commerce pages. **Non-compliant → retire.**
- Existing actions are list/create/delete only (plus a handful of status
  verbs). Full forms need **get/update/transition/search** actions added
  (§3/§4 below). Action input types live in
  `src/app/actions/sabcrm-supply.actions.types.ts` and
  `src/app/actions/sabcrm-commerce.actions.types.ts` — these "deliberately
  small dialog payloads" get superseded by full-DTO inputs.

### 1.3 Engine surface (all mounts verified in `rust/crates/api/src/router.rs` L796–820)

| Entity | Crate | Project mount | TS client | Envelope |
|---|---|---|---|---|
| items | `crm-items` | `/v1/sabcrm/supply/items` | `sabcrmSupplyItemsApi` | crm-common `{items,page,limit,hasMore}` |
| warehouses | `crm-warehouses` | `/v1/sabcrm/supply/warehouses` | `sabcrmSupplyWarehousesApi` | crm-common |
| stock-adjustments | `crm-stock-adjustments` | `/v1/sabcrm/supply/stock-adjustments` | `sabcrmSupplyStockAdjustmentsApi` | crm-common |
| purchase-orders | `crm-purchase-orders` | `/v1/sabcrm/supply/purchase-orders` | `sabcrmSupplyPurchaseOrdersApi` | Identity (flat `T[]`) |
| grn | `crm-grns` | `/v1/sabcrm/supply/grn` | `sabcrmSupplyGrnsApi` | Identity |
| vendors | `crm-vendors` | `/v1/sabcrm/supply/vendors` | `sabcrmSupplyVendorsApi` | crm-common |
| rfqs | `crm-rfqs` | `/v1/sabcrm/supply/rfqs` | `sabcrmSupplyRfqsApi` | Identity |
| vendor-bids | `crm-vendor-bids` | `/v1/sabcrm/supply/vendor-bids` | `sabcrmSupplyVendorBidsApi` | Identity |
| bom | `crm-bom` | `/v1/sabcrm/supply/bom` | `sabcrmSupplyBomApi` | crm-common |
| production-orders | `crm-production-orders` | `/v1/sabcrm/supply/production-orders` | `sabcrmSupplyProductionOrdersApi` | crm-common |
| pos-* | `crm-pos` | `/v1/sabcrm/commerce/pos` | `sabcrmCommercePosApi` | crm-common |
| orders / storefronts / shipping | `crm-store` | `/v1/sabcrm/commerce/store` | `sabcrmCommerceStoreApi` | crm-common |
| coupons | `crm-coupons` | `/v1/sabcrm/commerce/coupons` | `sabcrmCommerceCouponsApi` | crm-common |
| gift-cards | `crm-gift-cards` | `/v1/sabcrm/commerce/gift-cards` | `sabcrmCommerceGiftCardsApi` | crm-common |

Every supply client (`src/lib/rust-client/sabcrm-supply.ts`,
`makeSupplyClient`) already has `list / getById / create / update / delete`.
Commerce clients (`src/lib/rust-client/sabcrm-commerce.ts`) are per-verb;
gaps are called out where they matter.

Gating: copy the `gate(action, explicitProjectId)` pipeline from
`sabcrm-supply.actions.ts` (session → project membership →
`canServer('sabcrm', action, projectId)` → `sabcrmPlanFeature`) — verbs used
today: `'view' | 'create' | 'edit' | 'delete'`. Revalidate base paths
`/sabcrm/supply` and `/sabcrm/commerce` after mutations.

---

## 2. Cross-cutting work items

### WI-0 — Kit extension: declarative extra header fields + field toggles

`DocFormValues` is invoice-shaped. PO fits cleanly; GRN/RFQ/bid/etc. need
extra header fields (warehouse, RFQ ref, PO ref…) and some entities have no
document number or due date. Extend the kit **additively** (45 finance
adopters must not change):

In `types.ts`:

```ts
/** Declarative extra header field rendered between party and lines. */
export interface DocExtraFieldDef {
  key: string;                       // values.extra[key]
  label: string;
  kind: 'text' | 'number' | 'date' | 'select' | 'entity' | 'textarea';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];          // kind: 'select'
  search?: (q: string) => Promise<DocEntityOption[]>;    // kind: 'entity'
}

// DocFormValues — add:
//   extra?: Record<string, string | number | null>;
//   extraLabels?: Record<string, string | null>;   // entity-kind label cache
// DocFormConfig — add:
//   extraFields?: DocExtraFieldDef[];
//   show?: { number?: boolean; party?: boolean; dueDate?: boolean; lines?: boolean };
//     // all default true; false hides that built-in block
//   partyHeading?: string;   // DocDetailPage "Billed to" override (e.g. "Vendor")
```

In `doc-form.tsx`: render `config.extraFields` in a 2-col grid after the
party row; `kind:'entity'` renders `<EntityPicker value={values.extra?.[key]}
valueLabel={values.extraLabels?.[key]} search={def.search!} …/>`; respect
`config.show` flags; `emptyDocFormValues()` seeds `extra: {}, extraLabels: {}`.
In `doc-detail-page.tsx`: accept optional `partyHeading` (default
`'Billed to'`). **Run the finance invoices page after this change to prove
zero regression.**

### WI-1 — Supply shared plumbing (`src/app/actions/sabcrm-supply-docs.actions.ts` + `.types.ts`)

New `'use server'` module (the existing `sabcrm-supply.actions.ts` stays for
back-compat; new full-surface verbs live here). Copy the `gate`/`fail`
helpers verbatim. Add:

1. **Pickers** (all return `DocEntityOption[]`-shaped data
   `{id,label,meta?}`; trim/limit 10):
   - `searchSabcrmSupplyVendors(q)` → `sabcrmSupplyVendorsApi.list(projectId,{q,limit:10})`; label `name`, meta `email ?? vendorType`.
   - `searchSabcrmSupplyWarehouses(q)` → label `name`, meta `code ?? city`.
   - `searchSabcrmSupplyItemOptions(q)` → **reuse** `searchSabcrmFinanceItems`
     (already project-scoped over `sabcrmSupplyItemsApi`, returns
     `SabcrmItemOption {id,name,sku,sellingPrice,taxRate,hsnSac,currency}`);
     map to `DocItemOption {id,label:name,meta:sku,rate:sellingPrice,taxRatePct:taxRate,hsnSac}`.
   - `searchSabcrmSupplyRfqs(q)` → `sabcrmSupplyRfqsApi.list`; label `title`, meta status.
   - `searchSabcrmSupplyPurchaseOrders(q)` → label `poNo`, meta vendor/date.
   - `searchSabcrmSupplyBoms(q)` → label `bomNo — finishedGoodName`.
2. **Paged lists** — `DocListPage.fetchPage` needs `{rows, hasMore}`.
   `makeSupplyClient.list()` normalizes envelopes to `T[]` and **drops
   `hasMore`**. Fix in `src/lib/rust-client/sabcrm-supply.ts`: add
   `listPaged(projectId, params): Promise<{items: TDoc[]; hasMore: boolean}>`
   to the `SupplyClient` interface/factory — crm-common envelopes pass
   `hasMore` through; Identity (flat-array) crates derive
   `hasMore = items.length === limit` (their pages are 1-indexed; crm-common
   are 0-indexed — `makeSupplyClient` already documents this, keep the
   normalization in `listPaged`).
3. **Number suggestion** — generic `suggestNextSupplyNumber(kind)` cloning
   the regex-increment logic of `getNextSabcrmInvoiceNumber` (prefixes:
   `PO-<year>-0001`, `GRN-<year>-0001`, `ADJ-<year>-0001`, `BOM-001`,
   `MO-<year>-0001`).
4. **Per-entity get/update/transition** actions — listed in §3 per entity.

### WI-12 — Commerce shared plumbing (`src/app/actions/sabcrm-commerce-docs.actions.ts` + `.types.ts`)

Same recipe. The commerce envelope (`SabcrmCommerceList<T>`) **already
returns `hasMore`** — paged fetchers can call the existing client `list`
methods directly. Pickers to add: `searchSabcrmStorefronts(q)` (label
`name`, meta `slug`), `searchSabcrmPosSessions(q)` (label
`terminalId · openedAt`, filter `status:'open'` variant for the register),
`searchSabcrmPosTransactions(q)` (label `transactionNumber`). Customer
pickers reuse `searchSabcrmFinanceParties` / `resolveSabcrmFinanceParties` /
`getSabcrmFinancePartyContact` from `sabcrm-finance-invoices.actions.ts`
(records-engine companies/people — the same party model).

**Resolution rule (applies to every list/detail):** never render a raw
ObjectId. Batch-resolve referenced ids server-side in the page-list action
(vendor names via `sabcrmSupplyVendorsApi`, warehouse names, item names,
storefront names, session labels) and ship display-ready rows exactly like
`SabcrmInvoiceListRow.partyLabel`.

---

## 3. Supply entities (per-entity execution spec)

Common per-entity deliverables (the "kit adoption checklist"):

```
src/app/sabcrm/supply/<entity>/
  <entity>-config.ts      # DocStatusDef[] + flow + toFilters() + hrefs
  <entity>-client.tsx     # DocListPage + DocForm (or bespoke full-field drawer)
  page.tsx                # server entry (initial listPaged + error)
  [id]/page.tsx           # document entities only
  [id]/<entity>-detail-client.tsx
```

Status vocab notes: Identity-style crates **validate** status
(`ALLOWED_STATUSES` consts); crm-common crates store free-form
`Option<String>` — the UI vocabulary below is authoritative client-side and
must be the only thing the surface ever writes.

---

### WI-2 — Items `/sabcrm/supply/items` (master data)

- **Doc:** `CrmItemDoc` (mirrors `rust/crates/crm-items/src/types.rs::CrmProduct`):
  `_id, name, sku, description?, categoryId?, brandId?, unitId?, costPrice,
  sellingPrice, taxRate?, currency, hsnSac?, itemType? ('goods'|'service'),
  isTrackInventory, inventory: [{warehouseId, stock, reorderPoint?}],
  totalStock, dimensions? {length?,breadth?,height?,volume?},
  weight? {gross?,net?}, variants?, batches?, batchTracking?, images?,
  createdAt, updatedAt`. No status field → `statuses: []` (the toolbar select
  degrades to "All statuses" only — acceptable).
- **List columns:** `name`(text) · `sku`(text) · `itemType`(badge, tone
  `info` goods / `neutral` service) · `costPrice`(money,
  `currency:(r)=>r.currency`) · `sellingPrice`(money) · `taxRate`(text "%" )
  · `totalStock`(text, right-aligned) · `updatedAt`(date).
- **Form (bespoke full-field drawer — DocForm does NOT fit master data):**
  20ui `Sheet`/`Dialog` with sections: *Identity* (name★, sku★, description,
  itemType select, hsnSac), *Pricing* (costPrice, sellingPrice, taxRate,
  currency select), *Inventory* (isTrackInventory switch, batchTracking
  switch, per-warehouse rows: `EntityPicker` over
  `searchSabcrmSupplyWarehouses` + stock + reorderPoint, add/remove rows),
  *Physical* (dimensions L/B/H/volume, weight gross/net), *Images* —
  **`<SabFilePickerButton>` from `@/components/sabfiles` ONLY** (repo
  policy: never a URL paste). Payload = full
  `SabcrmItemCreateInput`/`CrmItemUpdateInput` (camelCase, every field above).
- **Actions:** exist `listSabcrmSupplyItems`, `createSabcrmSupplyItem`
  (extend its input to the full DTO or add `createSabcrmSupplyItemFull`),
  `deleteSabcrmSupplyItem`. **Add** `getSabcrmSupplyItem(id)`,
  `updateSabcrmSupplyItem(id, patch)`, `listSabcrmSupplyItemsPage(filters)`.
- **Detail:** edit drawer doubles as detail (`rowHref: null`; row click →
  open drawer in `mode:'edit'` seeded by `getSabcrmSupplyItem`). Surface
  per-warehouse stock table inside the drawer's Inventory section.
- **Gotcha:** `sku` is tenant-unique — surface the create error string in
  the form (kit `onSubmit` `{ok:false,error}` contract).

### WI-3 — Warehouses `/sabcrm/supply/warehouses` (master data)

- **Doc:** `CrmWarehouseDoc`: `name, code?, type? ('main'|'branch'|
  'franchise'|'3pl'|'virtual'; serde-renamed from kind), status?, address?,
  city?, state?, country?, pincode?, phone?, managerId?, managerName?,
  gstin?, capacityUnits?, capacitySqft?, climateControlled?, isDefault?,
  archived?`.
- **Statuses (UI vocab):** `active`(success) · `inactive`(neutral) ·
  `archived`(neutral). Flow `['active']`.
- **List columns:** `name` · `code` · `type`(badge) · `city` · `managerName`
  (party-kind w/ null→"Unknown") · `capacityUnits`(text) · `status`(status)
  · `isDefault`(badge "Default").
- **Form:** bespoke drawer, full `CreateWarehouseInput`: name★, code, type
  select, status select, address/city/state/country/pincode, phone,
  managerId (`EntityPicker` over `searchSabcrmFinanceParties` people) +
  managerName cache, gstin, capacityUnits, capacitySqft, climateControlled
  switch, isDefault switch.
- **Actions:** exist list/create/delete. **Add** `getSabcrmSupplyWarehouse`,
  `updateSabcrmSupplyWarehouse`, `listSabcrmSupplyWarehousesPage` (ListQuery
  also accepts `kind`, `city` filters — wire `type` as a second toolbar
  select via `partyFilter`-style extension or fold into `q`).
- **Detail:** edit drawer (no `[id]` page).

### WI-4 — Stock adjustments `/sabcrm/supply/stock-adjustments` (document)

- **Doc:** `CrmStockAdjustmentDoc`: `adjustmentNumber?, date, reason,
  referenceNumber?, warehouseId, productId, quantity, costPerUnit?,
  lines: [{productId, productName?, qtyBefore?, qtyAfter?, delta?, batch?,
  serial?, costPerUnit?}], status?, approvedBy?, approvedByName?,
  approvedAt?, approvalNotes?, notes?`.
- **Statuses (UI vocab, free-form crate):** `draft`(neutral) →
  `approved`(success); `cancelled`(neutral) exception. Flow
  `['draft','approved']`.
- **List columns:** `adjustmentNumber` · `date`(date) · `reason` ·
  warehouse label(party) · product label(party) · `quantity`(text, signed,
  right) · `status`(status) · `approvedByName`(text).
- **Form:** DocForm **with WI-0**: `show:{party:false, dueDate:false,
  lines:false}`; `numberLabel:'Adjustment #'`,
  `suggestNumber: ()=>suggestNextSupplyNumber('stock-adjustment')`;
  `extraFields`: reason★(text), warehouseId★(entity →
  `searchSabcrmSupplyWarehouses`), productId★(entity → items picker),
  quantity★(number, signed), costPerUnit(number), referenceNumber(text),
  date(date), notes(textarea). Multi-line `lines[]` editor is a fast-follow
  (the crate accepts `lines: LineInput[]`; v1 keeps the single
  product/quantity header the crate requires).
- **Actions:** exist list/create/delete. **Add** `getSabcrmSupplyStockAdjustment`,
  `updateSabcrmSupplyStockAdjustment`, `transitionSabcrmSupplyStockAdjustmentStatus`
  (PATCH `{status, approvalNotes?}`), `listSabcrmSupplyStockAdjustmentsPage`
  (ListQuery supports `status, warehouseId, productId, dateFrom, dateTo`).
- **Detail `[id]`:** `DocDetailPage` — `docNumber: adjustmentNumber ?? id`,
  `party`: warehouse (WI-0 `partyHeading:'Warehouse'`), meta: date, reason,
  reference #, product, quantity, costPerUnit, approvedByName/approvedAt;
  `lines`: map `lines[]` → `DocDetailLine {description: productName, qty:
  delta ?? quantity, rate: costPerUnit ?? 0, total: (delta??quantity)*(costPerUnit??0)}`;
  totals from the same; `actions`: Approve button (transition) +
  delete.

### WI-5 — Purchase orders `/sabcrm/supply/purchase-orders` (document — **flagship of this phase**)

- **Doc:** `CrmPurchaseOrderDoc` (`src/lib/rust-client/crm-purchase-orders.ts`):
  Identity-flattened `_id, identity?{projectId,userId}, audit?{createdAt,…},
  poNo, date, expectedDelivery?, vendorId, shipToWarehouseId?,
  billingBranchId?, paymentTerms?, currency, items:
  CrmPurchaseOrderLineItem[] {itemId?, description?, hsnSac?, qty, unit?,
  rate, discountPct?, taxRatePct?, cgstAmount?, sgstAmount?, igstAmount?,
  cessAmount?, total, warehouseId?, qtyPending?, qtyDelivered?,
  qtyInvoiced?}, totals: CrmPurchaseOrderTotals, termsAndConditions?,
  notes?, status, lineage`.
- **Statuses (crate-validated `ALLOWED_STATUSES`):** `draft`(neutral) ·
  `awaiting_approval`(warning) · `approved`(info) · `sent`(info) ·
  `partial`(warning) · `received`(success) · `closed`(neutral) ·
  `cancelled`(neutral). Flow
  `['draft','awaiting_approval','approved','sent','received','closed']`.
- **List columns:** `poNo` · vendor label(party) · `date`(date) ·
  `expectedDelivery`(date) · `status`(status) · `totals.total`(money) ·
  aging vs expectedDelivery(aging). `partyFilter`: vendors
  (`searchSabcrmSupplyVendors`; the crate ListQuery natively filters
  `vendorId`).
- **Form:** **DocForm fits natively.** `numberLabel:'PO number'`,
  `partyLabel:'Vendor'` (`searchParties: searchSabcrmSupplyVendors`),
  `dateLabel:'Order date'`, `dueDateLabel:'Expected delivery'`,
  `searchItems: searchSabcrmSupplyItemOptions`,
  `suggestNumber: 'PO-<year>-0001'` pattern, `issueLabel:'Save & send'`
  (issue ⇒ transition to `sent`). WI-0 `extraFields`:
  shipToWarehouseId(entity → warehouses), paymentTerms is built-in. Submit
  maps `DocFormValues.lines` → wire `items[]` via the finance-doc-math
  compute (totals are **server-recomputed** — `CreatePurchaseOrderInput`
  requires `items: Vec<Value>` + `totals: Value`; reuse `computeDocTotals`
  exactly like `createSabcrmInvoiceFull` does).
- **Actions:** exist list/create(minimal)/delete. **Add**
  `listSabcrmSupplyPurchaseOrdersPage` (resolve vendor labels in batch),
  `getSabcrmSupplyPurchaseOrder`, `createSabcrmSupplyPurchaseOrderFull`,
  `updateSabcrmSupplyPurchaseOrderFull`,
  `transitionSabcrmSupplyPurchaseOrderStatus` (validate against a
  `SABCRM_PO_TRANSITIONS` record mirroring the 8-status vocab),
  `exportSabcrmSupplyPurchaseOrderRows`.
- **Detail `[id]`:** `DocDetailPage` with party=vendor
  (`partyHeading:'Vendor'`, href → vendors surface is N/A → `href:null`),
  meta: order date, expected delivery, payment terms, ship-to warehouse,
  billing branch; lines+totals direct; `related`: lineage rail (the doc has
  `lineage[]` + `fromKind/fromId` seeding) — children = GRNs filtered by
  `poId` (`sabcrmSupplyGrnsApi.list(projectId,{poId})`).
- **ConvertMenu:** `Receive → create GRN` (route to GRN form prefilled:
  `poId`, `vendorId`, lines→`items[]` with `orderedQty=qty`), `Create bill`
  (disabled placeholder if finance bills don't accept fromKind yet — check
  `sabcrm-finance.actions.ts` at build time).

### WI-6 — GRN `/sabcrm/supply/grn` (document)

- **Doc:** `CrmGrnDoc` (mirrors `crm_extras_types::Grn`): `grnNo, date,
  poId?, vendorId, warehouseId, items: GrnLineItem[] {itemId, orderedQty,
  receivedQty, acceptedQty, rejectedQty, batch?, expiry?, serialNos[]},
  inspectorId?, attachments[], status, ginId?, mrnId?, lineage`.
- **Statuses (crate-validated):** `draft`(neutral) · `received`(info) ·
  `partial`(warning) · `inspected`(info) · `qc_failed`(danger) ·
  `posted`(success) · `closed`(neutral) · `rejected`(danger). Flow
  `['draft','received','inspected','posted','closed']`.
- **List columns:** `grnNo` · vendor(party) · warehouse(party) ·
  `date`(date) · PO ref(text, resolved `poNo`) · accepted/received Σ(text)
  · `status`(status).
- **Form:** DocForm + WI-0 (`show:{lines:false, dueDate:false}`,
  party=vendor) + **bespoke `GrnLinesEditor`** (new file
  `src/app/sabcrm/supply/grn/grn-lines-editor.tsx`): per-row item
  `EntityPicker`, orderedQty/receivedQty/acceptedQty/rejectedQty numbers,
  batch text, expiry date, serialNos tag-input. `extraFields`:
  poId(entity → `searchSabcrmSupplyPurchaseOrders`), warehouseId★(entity),
  inspectorId(entity → people). Attachments via the built-in DocForm
  attachments block (SabFiles). Prefill path from PO ConvertMenu via
  `sessionStorage`/searchParam `?fromPo=<id>` resolved server-side.
- **Actions:** exist list/create(minimal)/delete. **Add**
  `listSabcrmSupplyGrnsPage`, `getSabcrmSupplyGrn`,
  `createSabcrmSupplyGrnFull` (full `items: GrnLineItem[]`),
  `updateSabcrmSupplyGrnFull`, `transitionSabcrmSupplyGrnStatus`.
- **Detail `[id]`:** `DocDetailPage`, party=vendor; meta: date, PO,
  warehouse, inspector; lines map: `description=item label,
  qty=acceptedQty, rate=0, total=0` plus a `railExtra` card showing the
  ordered/received/accepted/rejected quartet table (DocDetailLine can't show
  4 qty columns — keep the paper lines simple, full quartet in the rail);
  related: parent PO.

### WI-7 — Vendors `/sabcrm/supply/vendors` (master data)

- **Doc:** `CrmVendorDoc`: `name, displayName?, industry?, industryId?,
  logoUrl?, email?, phone?, country?, state?, city?, pincode?, street?,
  gstin?, pan?, panName?, vendorType?, taxTreatment?, subject?,
  bankAccountDetails? {accountNumber?, accountHolder?, ifsc?, bankName?,
  accountType?, currency?, swiftCode?, …}, showEmailInInvoice?,
  showPhoneInInvoice?, attachments?: string[]`. No status → `statuses: []`.
- **List columns:** `name` · `displayName` · `email` · `phone` ·
  `vendorType`(badge) · `gstin` · `city`.
- **Form:** bespoke drawer, sections *Identity* (name★, displayName,
  industry, vendorType — seed options from `crm-vendor-types` client if
  present, else free text, logoUrl via SabFiles), *Contact* (email, phone),
  *Address* (street, city, state, country, pincode), *Tax* (gstin, pan,
  panName, taxTreatment), *Banking* (full `bankAccountDetails` group),
  *Invoice flags* (two switches), *Attachments* (SabFiles ids).
- **Actions:** exist list/create(minimal)/delete. **Add**
  `getSabcrmSupplyVendor`, `updateSabcrmSupplyVendor`,
  `listSabcrmSupplyVendorsPage`.
- **Detail:** edit drawer; vendors additionally appear as the party of
  POs/GRNs/bids — no `[id]` page this phase.

### WI-8 — RFQs `/sabcrm/supply/rfqs` (document)

- **Doc:** `CrmRfqDoc` (mirrors `crm_extras_types::Rfq`, Identity-flattened):
  `title, items: RfqLineItem[] {itemId, description?, qty, unit?, specs?},
  requiredBy?, vendorsInvited: string[], terms?, deadline?, status,
  attachments[], lineage`.
- **Statuses (`ALLOWED_RFQ_STATUSES` in `crm-vendor-bids/src/dto.rs`):**
  `draft`(neutral) · `open`(info) · `closed`(neutral) · `awarded`(success)
  · `cancelled`(neutral). Flow `['draft','open','awarded','closed']`.
- **List columns:** `title` · items count(text) · `requiredBy`(date) ·
  `deadline`(date) · invited count(text) · `status`(status) · bid count
  (resolved via `sabcrmSupplyVendorBidsApi.list({rfqId})` batch — or omit
  v1).
- **Form:** DocForm + WI-0: `show:{party:false, lines:false}`,
  `numberLabel:'Title'` is wrong — keep number hidden too
  (`show:{number:false}`) and use `extraFields`: title★(text),
  requiredBy(date — built-in `date` maps to requiredBy, `dueDate` maps to
  deadline; relabel via `dateLabel:'Required by'`,
  `dueDateLabel:'Bid deadline'`), terms(textarea), vendorsInvited —
  **multi-vendor invite** needs repeated entity rows (the kit has no
  multi-picker; render N `EntityPicker` rows in a bespoke section of the
  client, passed through `extra.vendorsInvited` as `string[]`). Lines:
  bespoke `RfqLinesEditor` (item picker, qty, unit, specs — **no rate
  column**, so `LineItemsEditor` is not reusable here).
- **Actions:** exist list/create(minimal)/delete. **Add**
  `listSabcrmSupplyRfqsPage`, `getSabcrmSupplyRfq`,
  `createSabcrmSupplyRfqFull`, `updateSabcrmSupplyRfqFull`,
  `transitionSabcrmSupplyRfqStatus`.
- **Detail `[id]`:** `DocDetailPage` — meta: requiredBy, deadline, invited
  vendors (resolved labels), terms; lines: `{description: item label +
  specs, qty, rate:0, total:0}`; `railExtra`: **bids table** (vendor label,
  totals.total, status, lead time) with shortlist/award buttons calling
  `updateSabcrmSupplyVendorBidStatus` (exists). Awarding a bid also
  transitions the RFQ to `awarded`.
- **ConvertMenu:** `Award → create PO` (prefill PO form: vendor = bid
  vendor, lines from bid items, `fromKind:'rfq', fromId`).

### WI-9 — Vendor bids `/sabcrm/supply/vendor-bids` (document)

- **Doc:** `CrmVendorBidDoc` (mirrors `crm_extras_types::VendorBid`):
  `rfqId, vendorId, items: BidLineItem[] {itemId, qty, rate, leadTimeDays?,
  notes?}, totals, currency, terms?, attachments[], status, submittedAt,
  lineage` (+ dto-level `vendorName?`).
- **Statuses (crate-validated):** `submitted`(info) · `shortlisted`(warning)
  · `awarded`(success) · `rejected`(danger) · `withdrawn`(neutral). Flow
  `['submitted','shortlisted','awarded']`.
- **List columns:** RFQ title(party-kind resolved) · vendor(party) ·
  `submittedAt`(date) · `totals.total`(money, `currency`) · lead time
  max(text) · `status`(status). `partyFilter`: vendors (crate ListQuery
  filters `rfqId` + `vendorId`).
- **Form:** DocForm: party=vendor (`searchSabcrmSupplyVendors`),
  `show:{number:false, dueDate:false}`, `extraFields`: rfqId★(entity →
  `searchSabcrmSupplyRfqs`), terms(textarea). Lines: `LineItemsEditor`
  **fits** (qty+rate; ignore discount/tax). Submit computes totals via
  `computeDocTotals` → `CreateVendorBidInput {rfqId, vendorId, items,
  totals, currency, terms, vendorName}`.
- **Actions:** exist list/create(minimal)/`updateSabcrmSupplyVendorBidStatus`/delete.
  **Add** `listSabcrmSupplyVendorBidsPage`, `getSabcrmSupplyVendorBid`,
  `createSabcrmSupplyVendorBidFull`, `updateSabcrmSupplyVendorBidFull`.
- **Detail `[id]`:** `DocDetailPage`, party=vendor; meta: RFQ(link to
  `/sabcrm/supply/rfqs/<rfqId>`), submittedAt, lead times; lines+totals
  native; actions: Shortlist/Award/Reject via existing status action;
  ConvertMenu: `Award → create PO`.

### WI-10 — BOM `/sabcrm/supply/bom` (document)

- **Doc:** `CrmBomDoc` (crate-local `crm-bom/src/types.rs::CrmBom` — NOT the
  extras-types `Bom`): `bomNo, finishedGoodName, finishedGoodId?, outputQty,
  unit, effectiveDate?, version: string, notes?, status?, active?,
  components: CrmBomComponent[] {itemId?, itemName, qty, unit, scrapPct,
  optional?, costPerUnit?}, labourCost?, overheadCost?, totalCost?`.
- **Statuses (UI vocab):** `draft`(neutral) · `active`(success) ·
  `obsolete`(neutral). Flow `['draft','active']`.
- **List columns:** `bomNo` · `finishedGoodName` · `outputQty` + `unit`
  (text) · components count(text) · `version` · `totalCost`(money) ·
  `status`(status).
- **Form:** DocForm + WI-0 (`show:{party:false, dueDate:false,
  lines:false}`): number=bomNo (`suggestNumber 'BOM-001'`), `extraFields`:
  finishedGoodName★(text) **and** finishedGoodId(entity → items picker —
  picking an item also fills the name), outputQty★(number), unit★(text),
  effectiveDate(date — built-in date slot), version(text, default `'1'`),
  labourCost/overheadCost(number), notes(textarea). Components: bespoke
  `BomComponentsEditor` (item picker filling itemId+itemName, qty, unit,
  scrapPct, optional switch, costPerUnit) — `LineItemsEditor` lacks
  scrap/optional columns.
- **Actions:** exist list/create(minimal)/delete. **Add**
  `listSabcrmSupplyBomsPage`, `getSabcrmSupplyBom`,
  `createSabcrmSupplyBomFull`, `updateSabcrmSupplyBomFull`,
  `transitionSabcrmSupplyBomStatus`.
- **Detail `[id]`:** `DocDetailPage` — docNumber=bomNo, no party
  (`party:null`); meta: finished good, output qty/unit, version,
  effectiveDate; lines: components → `{description: itemName, qty, unit,
  rate: costPerUnit??0, total: qty*(costPerUnit??0)}`; totals: subTotal=Σ,
  total=totalCost ?? Σ+labour+overhead; `railExtra` card: labour/overhead/
  total cost rollup. ConvertMenu: `Start production → create production
  order` (prefill components + finishedGood + bomRef/bomId).

### WI-11 — Production orders `/sabcrm/supply/production-orders` (document)

- **Doc:** `CrmProductionOrderDoc`: `orderNo, bomRef?, bomId?,
  finishedGoodId?, finishedGoodName, plannedQty, actualYield, scrap, unit,
  plannedStart?, plannedEnd?, machineId?, machineOperator?,
  machineOperatorId?, notes?, status?, components: ProductionComponent[]
  {itemId?, itemName, qty, unit, scrapPct, costPerUnit?}, labourCost?,
  overheadCost?, materialCost?, totalCost?`.
- **Statuses (UI vocab, mirrors extras `ProductionStatus`):**
  `planned`(neutral) · `in_progress`(info) · `completed`(success) ·
  `cancelled`(neutral). Flow `['planned','in_progress','completed']`.
- **List columns:** `orderNo` · `finishedGoodName` · `plannedQty`+`unit` ·
  `actualYield`(text) · `plannedStart`(date) · `plannedEnd`(date) ·
  `machineOperator`(text) · `totalCost`(money) · `status`(status).
- **Form:** DocForm + WI-0 (`show:{party:false, lines:false}`):
  number=orderNo (`suggestNumber 'MO-<year>-0001'`), date/dueDate slots →
  plannedStart/plannedEnd (relabel), `extraFields`: bomId(entity →
  `searchSabcrmSupplyBoms` — picking prefills components +
  finishedGoodName/Id via a follow-up `getSabcrmSupplyBom`),
  finishedGoodName★, plannedQty★(number), unit★, machineId(text),
  machineOperatorId(entity → people) + machineOperator label,
  labourCost/overheadCost(number), notes. Components: reuse
  `BomComponentsEditor` (same column set minus `optional`).
- **Actions:** exist list/create(minimal)/delete. **Add**
  `listSabcrmSupplyProductionOrdersPage`, `getSabcrmSupplyProductionOrder`,
  `createSabcrmSupplyProductionOrderFull`,
  `updateSabcrmSupplyProductionOrderFull`,
  `transitionSabcrmSupplyProductionOrderStatus` — the **complete** action
  variant also PATCHes `actualYield` + `scrap` (completion dialog with two
  number inputs).
- **Detail `[id]`:** `DocDetailPage`; meta: BOM ref(link), planned window,
  machine, operator, yield/scrap; lines = components; totals = material/
  labour/overhead/total rollup; `railExtra`: yield-vs-planned card.

---

## 4. Commerce entities (per-entity execution spec)

File layout mirrors §3 under `src/app/sabcrm/commerce/<entity>/`.

### WI-13 — Orders `/sabcrm/commerce/orders` (document, read-heavy)

- **Doc:** `CrmStoreOrderDoc` (`crm-store/src/types.rs::CrmStoreOrder`):
  `storefrontId, orderNumber, customerEmail, customerName, customerPhone?,
  shippingAddress {line1,line2?,city,state,postalCode,country},
  billingAddress?, lineItems: [{productId, sku, title, quantity, price,
  total}], subtotal, discount?, shippingTotal, taxTotal, total, currency,
  paymentStatus, paymentMethod, paymentRef?, fulfillmentStatus, placedAt,
  linkedInvoiceId?`.
- **Statuses:** payment: `pending`(warning) · `paid`(success) ·
  `refunded`(neutral) · `failed`(danger); fulfilment vocab (existing page
  map): `unfulfilled` · `partial` · `fulfilled` · `cancelled`. Kit `status`
  column = paymentStatus; fulfilment as a `badge` column; flow
  `['pending','paid']`.
- **List columns:** `orderNumber` · `placedAt`(date) · `customerName`(text,
  meta email via csv) · storefront label(party — resolve via
  `searchSabcrmStorefronts` batch) · `total`(money) ·
  paymentStatus(status) · fulfillment(badge) · `paymentMethod`(text).
  `partyFilter`: storefronts.
- **No create form** (orders originate from storefront checkout). Primary
  actions are transitions: existing `markSabcrmStoreOrderPaid(id,
  paymentRef?)`, `markSabcrmStoreOrderFulfilled(id, status?)`,
  `cancelSabcrmStoreOrder(id)` in `sabcrm-commerce.actions.ts` — expose as
  detail-page `actions` buttons + list `bulkActions`.
- **Actions to add:** `listSabcrmStoreOrdersPage` (envelope hasMore is
  available — current `listSabcrmStoreOrders` returns `res.items` only).
- **Detail `[id]` (upgrade existing `orders/[orderId]` detail-lite):**
  `DocDetailPage` — party = `{label: customerName, href: null, meta:
  customerEmail}`; meta: placedAt, storefront, payment method/ref, shipping
  address block, billing address, linkedInvoiceId(link to
  `/sabcrm/finance/invoices/<id>` when set); lines: lineItems →
  `{description: title, itemLabel: sku, qty: quantity, rate: price, total}`;
  totals `{subTotal: subtotal, discountTotal: discount, taxTotal, total}`
  (+ shippingTotal as a meta row — DocDetailTotals has no shipping slot;
  show in meta). Actions: Mark paid / Mark fulfilled / Cancel.

### WI-14 — Storefronts `/sabcrm/commerce/storefronts` (master data)

- **Doc:** `CrmStorefrontDoc`: `name, slug, domain?, currency, themeId?,
  logoUrl?, homepageBlocks: [{kind, config}], status`.
- **Statuses:** `draft`(neutral) · `published`(success) ·
  `archived`(neutral). Flow `['draft','published']`.
- **List columns:** `name` · `slug`(text, mono) · `domain` · `currency` ·
  blocks count(text) · `status`(status).
- **Form:** bespoke drawer: name★, slug★ (auto-slugified from name),
  domain, currency select, themeId, logoUrl via **SabFiles picker**,
  homepageBlocks v1 = repeatable rows (kind select:
  hero/products/banner/custom + JSON config textarea with validation).
- **Actions:** exist `listSabcrmStorefronts`, `createSabcrmStorefront`,
  `publishSabcrmStorefront`, `archiveSabcrmStorefront`; client
  `sabcrmCommerceStoreApi.storefronts.update` exists. **Add**
  `updateSabcrmStorefront(id, patch)`, `listSabcrmStorefrontsPage`.
- **Detail:** edit drawer; status actions inline (Publish/Archive).

### WI-15 — Coupons `/sabcrm/commerce/coupons` (master data)

- **Doc:** `CrmCouponDoc` (`crm-coupons/src/types.rs::CrmCoupon`): `code,
  type ('percent'|'fixed' — serde-renamed kind), value, minCart?, maxUses?,
  perCustomerLimit?, validFrom?, validTo?, applicableProducts: string[],
  stackable, status?, usedCount, notes?`.
- **Statuses:** `active`(success) · `inactive`(neutral) ·
  `archived`(neutral). Flow `['active']`.
- **List columns:** `code`(mono) · `type`(badge) · `value`(text — render
  `%` vs currency by type) · `minCart`(money) · `usedCount`/`maxUses`(text
  "3 / 100") · `validTo`(date) · `status`(status).
- **Form:** bespoke drawer with the FULL `CreateCouponInput`: code★, kind
  select★, value★, minCart, maxUses, perCustomerLimit, validFrom(date),
  validTo(date), applicableProducts (repeat-row `EntityPicker` over
  `searchSabcrmSupplyItemOptions`, stored as id strings), stackable switch,
  notes.
- **Actions:** exist list/create/`activateSabcrmCoupon`/`archiveSabcrmCoupon`.
  **Add** `updateSabcrmCoupon(id, patch)` (client method exists? — the
  `sabcrmCommerceCouponsApi` has create/list/setStatus/archive; add an
  `update` calling `PATCH /v1/sabcrm/commerce/coupons/{id}` which the crate
  supports via `UpdateCouponInput`), `listSabcrmCouponsPage`.
- **Detail:** edit drawer + usage stats row (usedCount).

### WI-16 — Gift cards `/sabcrm/commerce/gift-cards` (master data)

- **Doc:** `CrmGiftCardDoc`: `code, value, balance, issuedTo?,
  issuedToEmail?, expiryDate?, transferable, status?, notes?`.
- **Statuses:** `active`(success) · `redeemed`(neutral) ·
  `expired`(warning) · `archived`(neutral). Flow `['active','redeemed']`.
- **List columns:** `code`(mono) · `value`(money) · `balance`(money) ·
  `issuedTo`(text) · `issuedToEmail`(text) · `expiryDate`(date) ·
  `status`(status).
- **Form:** bespoke drawer: code (blank ⇒ server-generated), value★,
  issuedTo, issuedToEmail, expiryDate(date), transferable switch, notes.
  Edit mode additionally exposes balance adjustment (crate
  `UpdateGiftCardInput.balance`).
- **Actions:** exist list/create/archive. **Add** `updateSabcrmGiftCard`,
  `listSabcrmGiftCardsPage`.

### WI-17 — Shipping zones `/sabcrm/commerce/shipping` (master data)

- **Doc:** `CrmStoreShippingZoneDoc`: `storefrontId, name, countries:
  string[], states?: string[], methods: [{name, kind, rate,
  freeAboveSubtotal?}], status`.
- **Statuses:** `active`(success) · `archived`(neutral).
- **List columns:** `name` · storefront(party) · countries(text, joined) ·
  methods count(text) · cheapest rate(money) · `status`(status).
  `partyFilter`: storefronts.
- **Form:** bespoke drawer: storefrontId★(`EntityPicker` →
  `searchSabcrmStorefronts`), name★, countries (comma/tag input of ISO-2),
  states (tag input), **methods grid** (repeat rows: name★, kind select
  `flat`/`free`/`weight`, rate, freeAboveSubtotal) — replaces the current
  "single starter method" dialog.
- **Actions:** exist `listSabcrmShippingZones`, `createSabcrmShippingZone`
  (single-method input — supersede with full input), `archiveSabcrmShippingZone`.
  **Add** `updateSabcrmShippingZone`, `listSabcrmShippingZonesPage`,
  `createSabcrmShippingZoneFull`.

### WI-18 — POS sessions `/sabcrm/commerce/pos-sessions` (document-ish)

- **Doc:** `CrmPosSessionDoc` (`crm-pos/src/types.rs::CrmPosSession`):
  `terminalId, openedBy, openedAt, openingCash, closedAt?, closingCash?,
  expectedCash?, discrepancy?, status, notes?`.
- **Statuses:** `open`(info) · `closed`(warning) · `reconciled`(success) ·
  `archived`(neutral). Flow `['open','closed','reconciled']`.
- **List columns:** `terminalId`(text) · `openedAt`(date) ·
  `openingCash`(money INR) · `closedAt`(date) · `closingCash`(money) ·
  `discrepancy`(money, tone danger when ≠ 0 via badge col) ·
  `status`(status).
- **Form ("Open session")**: existing dialog payload is already the full
  crate input (`OpenSessionInput {terminalId, openingCash, notes}`) — keep
  `openSabcrmPosSession`, render with kit-consistent styling as the
  `primaryAction`.
- **Actions:** ALL exist (`listSabcrmPosSessions`, `openSabcrmPosSession`,
  `closeSabcrmPosSession`, `reconcileSabcrmPosSession`,
  `archiveSabcrmPosSession`). **Add** `listSabcrmPosSessionsPage` +
  `getSabcrmPosSession` (client `GET /sessions/{id}` exists in the crate;
  add `sabcrmCommercePosApi.sessions.getById`).
- **Detail `[id]`:** bespoke client (not DocDetailPage — no lines):
  `StatusFlow` header + cash summary cards (opening/expected/closing/
  discrepancy) + transactions table filtered `sessionId` via
  `listSabcrmPosTransactions({sessionId})` + Close/Reconcile dialogs
  (closingCash input). Link "Open register →
  `/sabcrm/commerce/register?sessionId=<id>`" when `status==='open'`.

### WI-19 — POS transactions `/sabcrm/commerce/pos-transactions` (document)

- **Doc:** `CrmPosTransactionDoc`: `sessionId, transactionNumber,
  customerId?, lineItems: [{itemId?, name, quantity, rate, taxRate,
  total}], subtotal, taxTotal, total, paymentMethod, paymentSplits?
  [{method, amount}], status, cashierId`.
- **Statuses:** `completed`(success) · `voided`(danger) ·
  `refunded`(neutral) · `partially_refunded`(warning). Flow
  `['completed']`.
- **List columns:** `transactionNumber`(mono) · `createdAt`(date) · session
  label(party) · customer label(party, resolved via
  `resolveSabcrmFinanceParties`; null → "Walk-in") · `total`(money) ·
  `paymentMethod`(badge) · `status`(status). Crate ListQuery filters
  `sessionId`, `customerId`, `cashierId`, `status`.
- **No create form here** — creation happens at the register (WI-22).
- **Actions:** exist `listSabcrmPosTransactions`,
  `voidSabcrmPosTransaction`. **Add** `getSabcrmPosTransaction` (client
  `transactions.getById` exists), `refundSabcrmPosTransaction` —
  crate endpoint `POST /transactions/{id}/refund` with
  `RefundTransactionInput {reason, refundedLineItems:
  [{originalLineItemIndex, quantity, refundAmount}], refundMethod}` exists;
  **client method missing → add `sabcrmCommercePosApi.transactions.refund`**.
  Plus `listSabcrmPosTransactionsPage`.
- **Detail `[id]`:** `DocDetailPage` is a NATURAL fit — docNumber =
  transactionNumber, party = customer (or "Walk-in"), meta: session(link),
  cashier, payment method + splits breakdown; lines = lineItems
  (`qty: quantity`); totals `{subTotal: subtotal, taxTotal, total}`;
  actions: Void (with reason dialog), Refund (line-pick dialog feeding
  `refundedLineItems`); related rail: refunds via
  `GET /transactions/{id}/refunds` (crate route exists — add client method
  `transactions.listRefunds`).

### WI-20 — POS refunds `/sabcrm/commerce/pos-refunds` (document, read-mostly)

- **Doc:** `CrmPosRefundDoc`: `originalTransactionId, reason,
  refundedLineItems: [{originalLineItemIndex, quantity, refundAmount}],
  refundTotal, refundMethod, processedBy, processedAt, status`.
- **Statuses:** `pending`(warning) · `completed`(success) ·
  `failed`(danger). Flow `['pending','completed']`.
- **List columns:** original txn number(party-kind, resolved + linked) ·
  `processedAt`(date) · `reason`(text) · `refundTotal`(money) ·
  `refundMethod`(badge) · `status`(status).
- **Creation** happens from the transaction detail (WI-19) — no standalone
  form.
- **Actions:** exist `listSabcrmPosRefunds`, `archiveSabcrmPosRefund`.
  **Add** `getSabcrmPosRefund` (+ client `refunds.getById` — crate route
  exists), `listSabcrmPosRefundsPage`,
  `updateSabcrmPosRefundStatus` (crate `UpdateRefundInput {status, reason}`).
- **Detail `[id]`:** `DocDetailPage` — lines from refundedLineItems joined
  against the original transaction's lineItems (fetch both in the server
  entry); related: parent transaction.

### WI-21 — POS holds `/sabcrm/commerce/pos-holds` (document, read-mostly)

- **Doc:** `CrmPosHoldDoc`: `sessionId, customerId?, lineItems[],
  holdReason?, heldBy, heldAt, recalledAt?, recalledTransactionId?,
  status`.
- **Statuses:** `held`(warning) · `recalled`(success) · `voided`(neutral).
  Flow `['held','recalled']`.
- **List columns:** `heldAt`(date) · session(party) · customer(party,
  "Walk-in" fallback) · items count(text) · cart value Σ(money) ·
  `holdReason`(text) · `status`(status).
- **Row action:** `Recall at register` → navigates to
  `/sabcrm/commerce/register?holdId=<id>` (WI-22). Void via existing
  `voidSabcrmPosHold`.
- **Actions:** exist list/void. **Add** `getSabcrmPosHold` (+ client
  `holds.getById` — crate `GET /holds/{holdId}` exists),
  `listSabcrmPosHoldsPage`.
- **Detail:** lightweight expand/dialog showing line items; no `[id]` page.

---

## 5. POS register re-home — deep feasibility (part of WI-22)

### 5.1 What the register is today

`src/app/dashboard/crm/pos/_components/pos-terminal-client.tsx` (681 lines,
`'use client'`). Two-pane: item grid + barcode search (left), cart +
customer + payment tabs Cash/Card/UPI/Split + hold + print-receipt dialog
(right). **Already 20ui-pure** — imports only
`@/components/sabcrm/20ui` (`Button, Card, CardBody, Input, Label,
Textarea, toast, Dialog…`) + lucide. No `.sabcrm-twenty` legacy, no raw
HTML form elements beyond styled buttons. The UI ports as-is.

Server entry today: `src/app/dashboard/crm/pos/terminal/page.tsx` —
resolves sessions via `getPosSessions`, initial catalogue via
`searchPosItems`, hold prefill via `searchParams.holdId`, and renders
`PosTerminalClient { session, initialItems, prefillHold }`.

### 5.2 Action dependency audit

All six imports come from `src/app/actions/crm-pos.actions.ts` — a
**Mongo-direct, `userId`-scoped** module (RBAC `requirePermission('crm_pos',…)`,
optional Rust delegation behind `USE_RUST_CRM`). None are project-scoped;
**none can be reused directly** under `/sabcrm`.

| Legacy action (used by the client) | What it does | Project-scoped replacement | Status |
|---|---|---|---|
| `searchPosItems(query, 50)` | Mongo `crm_products` by userId → `PosItemRow {_id,name,sku,sellingPrice,taxRate}` | `searchSabcrmFinanceItems` (exists; `sabcrmSupplyItemsApi.list({q,limit})`, returns `SabcrmItemOption` with sellingPrice/taxRate/sku) — wrap as `searchSabcrmRegisterItems(q, limit=50)` to lift the limit | **EXISTS (wrap)** |
| `createPosTransaction({sessionId, customerName, lineItems, paymentMethod, paymentSplits})` | Insert txn + number | NEW `createSabcrmPosTransaction` → `POST /v1/sabcrm/commerce/pos/transactions` (`CreateTransactionInput {projectId, sessionId, customerId?, lineItems: [{itemId?, name, quantity, rate, taxRate, total?}], paymentMethod, paymentSplits?}`) — crate handler `create_transaction` EXISTS; **client method `sabcrmCommercePosApi.transactions.create` MISSING → add** | **NEW action + client method** |
| `createPosHold({sessionId, customerName, lineItems, holdReason})` | Park ticket | NEW `createSabcrmPosHold` → `POST …/pos/holds` (`CreateHoldInput {sessionId, customerId?, lineItems, holdReason?}`) — handler EXISTS; client `holds.create` MISSING → add | **NEW action + client method** |
| `recallPosHold({holdId, paymentMethod, paymentSplits})` | One-shot: hold → completed transaction | **Semantics differ.** Rust `POST …/holds/{id}/recall` only flips `status:'held'→'recalled'` (+ optional `recalledTransactionId`) and returns `{hold, lineItems}`. NEW `recallSabcrmPosHold` composes: ① `transactions.create` from the hold's lineItems + chosen payment, ② `holds/{id}/recall` with `recalledTransactionId`. Client `holds.recall` MISSING → add | **NEW composed action** (non-atomic — see risks) |
| `registerPosTerminal(terminalId, sessionId)` | Upsert `crm_pos_terminals` (userId) presence | No rust equivalent in `crm-pos` routes. **v1 decision: DROP** the terminal-presence effect from the re-homed register (delete the `useEffect`); `terminalId` still displays from the session. Optional follow-up: project-scoped terminal registry action | **DROP (v1)** |
| `heartbeatPosTerminal(terminalId)` | 30s presence ping | Same — DROP with the effect | **DROP (v1)** |

Wire-shape deltas the port MUST handle (legacy Mongo doc vs
`crm-pos` crate):

1. **`qty` → `quantity`** on line items (`PosLineItemInput` field names:
   `itemId?, name, quantity, rate, taxRate, total?`). Keep the local
   `CartLine` type as-is and map at submit.
2. **`sku` is not persisted** by the crate line item — keep it client-side
   for display, drop from the payload.
3. **`customerName` free-text is GONE** — `CrmPosTransaction`/`CrmPosHold`
   only carry `customerId: Option<ObjectId>`. Replace the free-text
   "Customer" input with `<EntityPicker search={searchSabcrmFinanceParties}>`
   (walk-in = null). Hold prefill resolves the label via
   `resolveSabcrmFinanceParties([customerId])`.
4. **Response shape:** crate returns `CreateTransactionResponse {id,
   entity}` — receipt number is `entity.transactionNumber` (server-minted),
   not a top-level `transactionNumber`.
5. Totals (`subtotal/taxTotal/total`) are computed server-side by the
   handler from `lineItems` — keep the client preview math, never send
   totals.

### 5.3 Mount plan — `/sabcrm/commerce/register`

```
src/app/sabcrm/commerce/register/
  page.tsx                      # server entry (force-dynamic)
  _components/register-client.tsx   # port of pos-terminal-client.tsx
  _components/open-session-card.tsx # zero-open-session CTA → openSabcrmPosSession
```

`page.tsx` (server):
1. `searchParams: Promise<{ sessionId?, holdId? }>`.
2. `const sessions = await listSabcrmPosSessions({ status: 'open', limit: 20 })`
   (exists in `sabcrm-commerce.actions.ts`). Pick `sessionId` param match,
   else first open session; none ⇒ render `OpenSessionCard`
   (terminalId + openingCash + notes → `openSabcrmPosSession`, then
   `router.refresh()`).
3. `const initialItems = await searchSabcrmRegisterItems('', 50)`.
4. `holdId` ⇒ `getSabcrmPosHold(holdId)` (new) + customer label resolve.
5. Render `<RegisterClient session={…} initialItems={…} prefillHold={…} prefillCustomer={…} />`.

`register-client.tsx` (port checklist):
- Copy `pos-terminal-client.tsx` wholesale; change ONLY: the six action
  imports → `createSabcrmPosTransaction`, `createSabcrmPosHold`,
  `recallSabcrmPosHold`, `searchSabcrmRegisterItems` from
  `@/app/actions/sabcrm-commerce-docs.actions`; delete the
  terminal-registry `useEffect` (L126–138); customer input → EntityPicker
  (§5.2-3); submit mapping `qty→quantity` (§5.2-1/2); receipt from
  `res.data.entity.transactionNumber` (§5.2-4). `ActionResult` envelope
  (`{ok,data}/{ok,error}`) replaces the legacy `{success,error}` shape.
- Keep the print dialog and split-payment validation untouched.

Rust-client additions (`src/lib/rust-client/sabcrm-commerce.ts`,
`sabcrmCommercePosApi`): `sessions.getById`, `transactions.create`,
`transactions.refund`, `transactions.listRefunds`, `holds.create`,
`holds.getById`, `holds.recall` — all 1:1 against routes already in
`rust/crates/crm-pos/src/router.rs` (`pos_routes()` mounted via
`project_router` with `ScopeMode::Project`). **Zero Rust changes needed.**

Nav: add `{ group: 'commerce', id: 'register', label: 'Register',
href: '/sabcrm/commerce/register', icon: Store }` to the entries array in
`src/components/sabcrm/sabcrm-suite-frame.tsx` (~L301, before the POS rows).

**Verdict: FEASIBLE, moderate effort (~1 day).** The UI is already 20ui;
the entire backend exists on the project mount; the work is 7 thin
rust-client methods + 4 new gated actions + a mechanical client port. The
only semantic costs: free-text walk-in customer names are no longer
persisted (picker or null), and terminal presence/heartbeat is dropped in
v1.

---

## 6. Sequencing & verification (WI-23)

1. **WI-0** kit extension first (everything document-shaped depends on it);
   prove invoices unaffected (`/sabcrm/finance/invoices` create + edit +
   detail smoke).
2. **WI-1 / WI-12** shared plumbing (pickers, `listPaged`, number
   suggestions).
3. Supply flagship vertical: **WI-5 purchase orders** end-to-end (list +
   form + detail + transitions + GRN convert) — this exercises every kit
   feature; then WI-6 GRN, WI-8/9 RFQ/bids (the sourcing loop), then the
   master-data and remaining docs in any order (parallel-agent friendly:
   WI-2/3/7 vs WI-4/10/11 vs WI-13..17 vs WI-18..21 are independent).
4. **WI-22** register last (depends on WI-12 + WI-19/21 client methods).
5. Retire `supply-client.tsx` / `commerce-client.tsx` + their
   `*FormInput` minimal types once all pages are flipped; delete dead
   exports from `sabcrm-supply.actions.types.ts` /
   `sabcrm-commerce.actions.types.ts`.
6. Verification per entity: `npx tsc --noEmit` (16GB heap per repo memory),
   then engine-up smoke with the local stack
   (`sabnode-api` on :8080 — see `scripts/sabpay-e2e.mjs` memory for the
   JWT mint pattern): create → edit → transition → detail → CSV export →
   delete. Engine-down: every page must render the kit error state from
   `initialError`.

## 7. Risks

1. **WI-0 touches the shared kit** used by ~45 finance surfaces — keep
   every addition optional/default-true and regression-test invoices
   (create, edit reopen with party label, detail print) before any adopter
   lands.
2. **`recallSabcrmPosHold` is non-atomic** (create transaction, then flip
   hold): a crash between steps leaves the hold `held` with a completed
   transaction already minted → a retry double-charges. Mitigate: pass
   `recalledTransactionId` immediately, and on entry check the hold's
   status server-side; document the manual void path.
3. **crm-pos drops `customerName`/`sku`** vs the legacy Mongo docs —
   register parity changes (picker instead of free text); legacy dashboard
   data is untouched but the two POS lists will show different fields.
4. **Free-form statuses on crm-common crates** (warehouses,
   stock-adjustments, bom, production-orders, coupons, gift-cards): the
   engine validates nothing — UI vocab constants are the only guard; a
   stray writer can introduce unknown statuses (StatusFlow renders them as
   off-path pills, lists fall back to raw text).
5. **Identity vs crm-common envelope split**: paged fetchers must not mix
   the 0-indexed/1-indexed page conventions — `listPaged` (WI-1.2) is the
   single place this is normalized; do not hand-roll pagination in actions.
6. **Vendor/warehouse/item label resolution** adds N+1 risk on list pages —
   batch-resolve ids per page server-side (one list call per referenced
   collection, then map), mirroring `listSabcrmInvoicesPage`.
7. **`graphify update` is currently broken** (recursion bug per project
   memory) — skip the post-change graph refresh or run it guarded; don't
   block the rollout on it.
8. **Plan/RBAC**: every new action must run the full `gate()` pipeline —
   the register especially (`create` for checkout/hold, `edit` for recall,
   `view` for search); SabNode is multi-tenant SaaS, never trust a
   client-supplied `projectId`.

/**
 * SabCRM Finance — MongoDB extended-JSON deflation.
 *
 * The legacy finance crates (`crm-payouts`, `crm-expense-claims`,
 * `crm-petty-cash`, `crm-budgets`, …) serialize their entities with the
 * BSON-native serde impls, so `ObjectId` and `DateTime` fields arrive
 * over the wire as **extended JSON** objects rather than the plain
 * scalars the TS clients advertise:
 *
 *   - `_id` / `vendorId` / `applyTo[].billId` → `{ "$oid": "507f…" }`
 *   - `date` / `expense_date` / `approvedAt`  → `{ "$date": "2026-…Z" }`
 *     (or the canonical `{ "$date": { "$numberLong": "…" } }` form)
 *
 * Left untouched these `String()`-stringify to `"[object Object]"` —
 * broken row keys, `/finance/payouts/[object%20Object]` detail links and
 * dead date cells. `deflateExtJson` flattens both forms back into the
 * TS-friendly scalars BEFORE any action/UI code touches the document
 * (same approach as `crm-rfqs.ts`, hoisted here so every finance action
 * file can share it).
 *
 * NB: input DTOs are unaffected — the create/update handlers take plain
 * hex strings and RFC3339 dates (verified against the crate DTO tests).
 */

/** Recursively flatten `{$oid}` / `{$date}` wrappers into scalars. */
export function deflateExtJson(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value;

  if (Array.isArray(value)) return value.map(deflateExtJson);

  const obj = value as Record<string, unknown>;

  // { $oid: "hex" } → "hex"
  if (typeof obj.$oid === 'string' && Object.keys(obj).length === 1) {
    return obj.$oid;
  }

  // { $date: "iso" } | { $date: { $numberLong: "ms" } } → ISO string
  if ('$date' in obj && Object.keys(obj).length === 1) {
    const d = obj.$date;
    if (typeof d === 'string') return d;
    if (
      d != null &&
      typeof d === 'object' &&
      typeof (d as { $numberLong?: unknown }).$numberLong === 'string'
    ) {
      const ms = Number((d as { $numberLong: string }).$numberLong);
      return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
    }
    return undefined;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = deflateExtJson(v);
  }
  return out;
}

/** Deflate one document, keeping its TS-declared shape. */
export function deflateDoc<T>(doc: T): T {
  return deflateExtJson(doc) as T;
}

/** Deflate a list of documents. */
export function deflateDocs<T>(docs: T[]): T[] {
  return docs.map((d) => deflateExtJson(d) as T);
}

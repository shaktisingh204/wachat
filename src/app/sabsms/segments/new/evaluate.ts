/**
 * SabSMS segment predicate evaluator.
 *
 * Pure functions — no I/O, no Mongo, no React. Consumed by both the
 * builder preview (`predicate-canvas.tsx`) and the server-side
 * materialiser (`actions.ts` -> live-count, snapshot save, sample
 * matches). Keeping evaluation pure means we can run the exact same
 * predicate logic in tests, in the browser preview, and in the server
 * action without divergence.
 *
 * The shape is intentionally a small AST:
 *   group  := { kind: "group", op: "and" | "or", children: Node[] }
 *   leaf   := { kind: "leaf", field, op, value }
 *
 * Fields and operators are explicit unions so the type checker catches
 * builder bugs at compile time and so the SQL-style preview can render
 * a sensible translation without ad-hoc reflection.
 */

// ─── Field & operator unions ──────────────────────────────────────────────

/**
 * The contact fields the builder can address. The set is intentionally
 * small — these are the columns the SabSMS catalog calls out (Page 19
 * feature 2). Extend by adding to this union and to `FIELD_LABELS` /
 * `getContactField`.
 */
export type SegmentField =
  | "e164_prefix"
  | "last_sms_clicked_at"
  | "total_replies"
  | "unsubscribed"
  | "engagement_score"
  | "tag"
  | "source"
  | "country"
  | "locale";

export type SegmentOperator =
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "in"
  | "contains";

/** Display labels for fields — used by the SQL-style preview. */
export const FIELD_LABELS: Record<SegmentField, string> = {
  e164_prefix: "E.164 prefix",
  last_sms_clicked_at: "Last SMS clicked at",
  total_replies: "Total replies",
  unsubscribed: "Unsubscribed",
  engagement_score: "Engagement score",
  tag: "Tag",
  source: "Source",
  country: "Country",
  locale: "Locale",
};

export const OPERATOR_LABELS: Record<SegmentOperator, string> = {
  eq: "equals",
  neq: "not equals",
  gt: "greater than",
  lt: "less than",
  in: "in",
  contains: "contains",
};

// ─── AST ──────────────────────────────────────────────────────────────────

export interface SegmentLeaf {
  kind: "leaf";
  field: SegmentField;
  op: SegmentOperator;
  /**
   * For `in` this is an array of strings/numbers; for everything else a
   * scalar. We type as unknown so callers can keep the AST JSON-clean —
   * coercion happens inside the evaluator.
   */
  value: unknown;
}

export interface SegmentGroup {
  kind: "group";
  op: "and" | "or";
  children: SegmentNode[];
}

export type SegmentNode = SegmentLeaf | SegmentGroup;

/** Shape of the contact records the evaluator runs against. */
export interface SegmentContact {
  _id?: unknown;
  phone?: string;
  e164?: string;
  last_sms_clicked_at?: string | Date | null;
  total_replies?: number;
  unsubscribed?: boolean;
  engagement_score?: number;
  tags?: string[];
  tag?: string;
  source?: string;
  country?: string;
  locale?: string;
  [k: string]: unknown;
}

// ─── Field accessors ──────────────────────────────────────────────────────

function getContactField(contact: SegmentContact, field: SegmentField): unknown {
  switch (field) {
    case "e164_prefix": {
      const raw = contact.e164 ?? contact.phone ?? "";
      return typeof raw === "string" ? raw : "";
    }
    case "last_sms_clicked_at":
      return contact.last_sms_clicked_at ?? undefined;
    case "total_replies":
      return typeof contact.total_replies === "number" ? contact.total_replies : 0;
    case "unsubscribed":
      return Boolean(contact.unsubscribed);
    case "engagement_score":
      return typeof contact.engagement_score === "number"
        ? contact.engagement_score
        : 0;
    case "tag":
      // tag fields support either an array (`tags`) or a single string.
      if (Array.isArray(contact.tags)) return contact.tags;
      return contact.tag ?? undefined;
    case "source":
      return contact.source ?? undefined;
    case "country":
      return contact.country ?? undefined;
    case "locale":
      return contact.locale ?? undefined;
  }
}

// ─── Coercion helpers ─────────────────────────────────────────────────────

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toDateMs(v: unknown): number | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : undefined;
  }
  if (typeof v === "number") return v;
  return undefined;
}

function toStringSafe(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

/**
 * `eq` & `neq` for our domain: handle booleans, numbers, dates, strings
 * and "tag is one of" (array contains the value). String compare is
 * case-insensitive — matches user expectations for tag/country/locale.
 */
function leafEquals(left: unknown, right: unknown): boolean {
  if (typeof left === "boolean" || typeof right === "boolean") {
    return Boolean(left) === Boolean(right);
  }

  // Tag stored as array — equals means "array contains value".
  if (Array.isArray(left)) {
    const rs = toStringSafe(right)?.toLowerCase();
    if (rs === undefined) return false;
    return left.some(
      (item) =>
        typeof item === "string" && item.toLowerCase() === rs,
    );
  }

  // Numeric compare when both sides coerce to number.
  const ln = toNumber(left);
  const rn = toNumber(right);
  if (ln !== undefined && rn !== undefined) return ln === rn;

  const ls = toStringSafe(left)?.toLowerCase();
  const rs = toStringSafe(right)?.toLowerCase();
  if (ls === undefined || rs === undefined) return false;
  return ls === rs;
}

// ─── Public evaluator ─────────────────────────────────────────────────────

/**
 * Evaluate a predicate AST against a contact. `undefined`/missing
 * fields fail every operator except `neq` (where "not equals X" is true
 * when the field is missing — matches the principle of least surprise
 * for "exclude contacts where country = US" type rules).
 *
 * An empty group evaluates to `true` for AND (vacuously satisfied) and
 * `false` for OR (no child claimed it). This mirrors SQL's behaviour for
 * `WHERE TRUE` vs `WHERE FALSE`.
 */
export function evaluatePredicate(
  predicate: SegmentNode | null | undefined,
  contact: SegmentContact,
): boolean {
  if (!predicate) return true;

  if (predicate.kind === "group") {
    if (!predicate.children || predicate.children.length === 0) {
      return predicate.op === "and";
    }
    if (predicate.op === "and") {
      for (const child of predicate.children) {
        if (!evaluatePredicate(child, contact)) return false;
      }
      return true;
    }
    // or
    for (const child of predicate.children) {
      if (evaluatePredicate(child, contact)) return true;
    }
    return false;
  }

  // Leaf evaluation
  const value = getContactField(contact, predicate.field);

  switch (predicate.op) {
    case "eq":
      return leafEquals(value, predicate.value);

    case "neq":
      // `neq` on a missing field is true — "user has no country" still
      // satisfies "country != 'US'".
      if (value === undefined || value === null) return true;
      return !leafEquals(value, predicate.value);

    case "gt": {
      // Treat as date if either side parses as date; otherwise number.
      const lDate = toDateMs(value);
      const rDate = toDateMs(predicate.value);
      if (lDate !== undefined && rDate !== undefined) return lDate > rDate;
      const ln = toNumber(value);
      const rn = toNumber(predicate.value);
      if (ln === undefined || rn === undefined) return false;
      return ln > rn;
    }

    case "lt": {
      const lDate = toDateMs(value);
      const rDate = toDateMs(predicate.value);
      if (lDate !== undefined && rDate !== undefined) return lDate < rDate;
      const ln = toNumber(value);
      const rn = toNumber(predicate.value);
      if (ln === undefined || rn === undefined) return false;
      return ln < rn;
    }

    case "in": {
      const list: unknown[] = Array.isArray(predicate.value)
        ? predicate.value
        : typeof predicate.value === "string"
          ? predicate.value.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
      if (list.length === 0) return false;
      // For e164_prefix `in` means "phone starts with one of the prefixes".
      if (predicate.field === "e164_prefix") {
        const phone = (toStringSafe(value) ?? "").trim();
        return list.some(
          (p) => typeof p === "string" && phone.startsWith(p),
        );
      }
      // For tag arrays — value is in [list] when any item in the
      // contact's tags is in the predicate list.
      if (Array.isArray(value)) {
        return value.some((item) =>
          list.some((target) => leafEquals(item, target)),
        );
      }
      return list.some((target) => leafEquals(value, target));
    }

    case "contains": {
      // e164_prefix `contains` => phone starts with prefix (Page 19 #2).
      if (predicate.field === "e164_prefix") {
        const phone = (toStringSafe(value) ?? "").trim();
        const prefix = (toStringSafe(predicate.value) ?? "").trim();
        if (!prefix) return false;
        return phone.startsWith(prefix);
      }
      // Tag stored as array — "contains" matches list membership.
      if (Array.isArray(value)) {
        const target = toStringSafe(predicate.value)?.toLowerCase();
        if (!target) return false;
        return value.some(
          (item) =>
            typeof item === "string" && item.toLowerCase().includes(target),
        );
      }
      const ls = toStringSafe(value)?.toLowerCase();
      const rs = toStringSafe(predicate.value)?.toLowerCase();
      if (!ls || !rs) return false;
      return ls.includes(rs);
    }
  }
}

// ─── SQL-style preview (Page 19 feature 11) ───────────────────────────────

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (Array.isArray(v)) {
    return `(${v.map(formatValue).join(", ")})`;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

export function predicateToSql(node: SegmentNode | null | undefined): string {
  if (!node) return "TRUE";
  if (node.kind === "group") {
    if (!node.children || node.children.length === 0) {
      return node.op === "and" ? "TRUE" : "FALSE";
    }
    const parts = node.children.map(predicateToSql);
    return `(${parts.join(node.op === "and" ? " AND " : " OR ")})`;
  }
  const f = FIELD_LABELS[node.field] ?? node.field;
  switch (node.op) {
    case "eq":
      return `${f} = ${formatValue(node.value)}`;
    case "neq":
      return `${f} <> ${formatValue(node.value)}`;
    case "gt":
      return `${f} > ${formatValue(node.value)}`;
    case "lt":
      return `${f} < ${formatValue(node.value)}`;
    case "in":
      return `${f} IN ${formatValue(
        Array.isArray(node.value)
          ? node.value
          : typeof node.value === "string"
            ? node.value.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
      )}`;
    case "contains":
      return `${f} LIKE '%${
        typeof node.value === "string"
          ? node.value.replace(/'/g, "''")
          : String(node.value ?? "")
      }%'`;
  }
}

// ─── Helpers for the builder ──────────────────────────────────────────────

export function emptyGroup(op: "and" | "or" = "and"): SegmentGroup {
  return { kind: "group", op, children: [] };
}

export function emptyLeaf(field: SegmentField = "country"): SegmentLeaf {
  return { kind: "leaf", field, op: "eq", value: "" };
}

/**
 * Recursively check that a predicate contains a "must include consent"
 * leaf (Page 19 feature 13). Marketing segments must filter out the
 * unsubscribed list — we treat `unsubscribed eq false` (or `neq true`)
 * as the canonical consent gate.
 */
export function hasConsentGate(node: SegmentNode | null | undefined): boolean {
  if (!node) return false;
  if (node.kind === "leaf") {
    if (node.field !== "unsubscribed") return false;
    if (node.op === "eq") return node.value === false || node.value === "false";
    if (node.op === "neq") return node.value === true || node.value === "true";
    return false;
  }
  if (node.op === "and") {
    return node.children.some(hasConsentGate);
  }
  // For OR groups, every branch must include the gate to be safe.
  return node.children.length > 0 && node.children.every(hasConsentGate);
}

/** Count leaf nodes — useful for the predicate-summary chip. */
export function countLeaves(node: SegmentNode | null | undefined): number {
  if (!node) return 0;
  if (node.kind === "leaf") return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

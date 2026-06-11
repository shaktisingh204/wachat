/**
 * SabSheet pivot tables — persisted types.
 *
 * A pivot is a saved config bound to a workbook/sheet range. The actual values are
 * re-computed from the live grid at render time (so the pivot stays in sync with
 * edits); we only persist the range + config, mirroring how Excel stores a pivot's
 * source.
 *
 * Mongo collection: `sabsheet_pivots`. Tenancy follows the rest of SabSheet —
 * scoped to `ownerUserId = sessionUserId`.
 */

/** Aggregation applied to the value field per pivot cell. */
export type PivotAgg = "sum" | "count" | "average" | "min" | "max";

/**
 * What/how to pivot — the persisted, serializable pivot configuration. Field offsets
 * are 0-based column offsets *within the source range*.
 */
export interface PivotConfigPersisted {
  rowField: number;
  colField: number | null;
  valueField: number;
  agg: PivotAgg;
}

/** Source selection rectangle (1-based, inclusive) the pivot was built from. */
export interface PivotRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/** A persisted pivot document. `_id`, `ownerUserId`, `*Id` are stringified ObjectIds. */
export interface SabsheetPivot {
  _id: string;
  ownerUserId: string;
  workbookId: string;
  sheetId: string;
  range: PivotRange;
  config: PivotConfigPersisted;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/** Mongo collection name. */
export const SABSHEET_PIVOTS_COLLECTION = "sabsheet_pivots";

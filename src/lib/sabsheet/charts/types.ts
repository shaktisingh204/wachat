/**
 * SabSheet charts — persisted types.
 *
 * A chart is a saved spec bound to a workbook/sheet range. The actual values are
 * re-read from the live grid at render time (so the chart stays in sync with edits);
 * we only persist the range + spec, mirroring how Excel stores a chart's source.
 *
 * Mongo collection: `sabsheet_charts`. Tenancy follows the rest of SabSheet —
 * scoped to `ownerUserId = sessionUserId`.
 */

/** The chart kinds we can render. */
export type ChartType = "bar" | "line" | "area" | "pie";

/** What/how to draw — the persisted, serializable chart configuration. */
export interface ChartSpec {
  type: ChartType;
  title?: string;
  /** First row of the source range holds series names. */
  headerRow: boolean;
  /** First column of the source range holds category labels. */
  headerCol: boolean;
}

/** Source selection rectangle (1-based, inclusive) the chart was built from. */
export interface ChartRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/** A persisted chart document. `_id`, `ownerUserId`, `*Id` are stringified ObjectIds. */
export interface SabsheetChart {
  _id: string;
  ownerUserId: string;
  workbookId: string;
  sheetId: string;
  range: ChartRange;
  spec: ChartSpec;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/** Mongo collection name. */
export const SABSHEET_CHARTS_COLLECTION = "sabsheet_charts";

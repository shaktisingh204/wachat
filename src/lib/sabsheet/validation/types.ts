/**
 * Data validation rules for SabSheet. v1 supports dropdown LISTS (the most common Excel validation):
 * a cell in a list range edits via a `<select>` of allowed values. Persisted per workbook in
 * `sabsheet_data_validation`.
 */
export const SABSHEET_VALIDATION_COLLECTION = "sabsheet_data_validation";

export interface ValidationRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface DataValidationRule {
  id: string;
  /** 0-based sheet index. */
  sheet: number;
  range: ValidationRange;
  /** Only `"list"` for v1. */
  type: "list";
  /** Allowed values for a list rule. */
  list: string[];
}

export interface SabsheetDataValidation {
  _id: string;
  ownerUserId: string;
  workbookId: string;
  rules: DataValidationRule[];
}

/** The list of allowed values for a cell, or null if no list rule covers it. */
export function listForCell(
  rules: DataValidationRule[],
  sheet: number,
  row: number,
  col: number,
): string[] | null {
  for (const r of rules) {
    if (r.sheet !== sheet || r.type !== "list") continue;
    const b = r.range;
    if (row >= b.top && row <= b.bottom && col >= b.left && col <= b.right) return r.list;
  }
  return null;
}

/**
 * Conditional formatting rules for SabSheet. Rules are evaluated client-side over the viewport cells
 * and override the cell's fill/text color before paint (the canvas already renders CellView fill/color
 * after the wave-2 style work). Persisted per workbook in `sabsheet_conditional_formats`.
 */

export const SABSHEET_CFORMAT_COLLECTION = "sabsheet_conditional_formats";

export type CFOperator =
  | "greaterThan"
  | "lessThan"
  | "between"
  | "equalTo"
  | "notEqualTo"
  | "textContains"
  | "colorScale2";

export interface CFFormat {
  /** CSS hex background applied to matching cells. */
  fill?: string;
  /** CSS hex text color applied to matching cells. */
  color?: string;
}

export interface CFRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface CFRule {
  id: string;
  /** 0-based sheet index this rule applies to. */
  sheet: number;
  range: CFRange;
  operator: CFOperator;
  /** Comparison operand (number for numeric ops; substring for textContains). */
  value1?: string;
  /** Upper bound for `between`. */
  value2?: string;
  /** Boolean-rule format (ignored for colorScale2). */
  format?: CFFormat;
  /** colorScale2: low/high fill colors interpolated across the range's numeric min..max. */
  minColor?: string;
  maxColor?: string;
}

/** Persisted CF document (one per workbook holds the rule list). */
export interface SabsheetConditionalFormats {
  _id: string;
  ownerUserId: string;
  workbookId: string;
  rules: CFRule[];
}

import 'server-only';

/**
 * SabSheet Cells client — wraps `/v1/sabsheet/cells`. Includes the
 * formula-evaluation and full-workbook recompute endpoints.
 */
import { rustFetch } from './fetcher';

export type SabsheetCellValue = number | string | boolean | null;

export interface SabsheetCellRef {
  sheetId: string;
  row: number;
  col: number;
}

export interface SabsheetCellFormat {
  numFmt?: string;
  bg?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right';
  [k: string]: unknown;
}

export interface SabsheetCellDoc {
  _id: string;
  sheetId: string;
  workbookId: string;
  ownerUserId: string;
  row: number;
  col: number;
  value?: SabsheetCellValue;
  formula?: string;
  formatJson?: SabsheetCellFormat;
  dependsOn?: SabsheetCellRef[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SabsheetCellListResponse {
  items: SabsheetCellDoc[];
}

export interface SabsheetCellSetInput {
  sheetId: string;
  row: number;
  col: number;
  valueOrFormula?: string | null;
  format?: SabsheetCellFormat;
}

export interface SabsheetCellSetResponse {
  entity: SabsheetCellDoc;
  computed: SabsheetCellValue | null;
  affected: string[];
}

export interface SabsheetEvaluateInput {
  workbookId: string;
  formula: string;
}

export interface SabsheetEvaluateResponse {
  display: string;
  kind: 'number' | 'text' | 'bool' | 'empty' | 'error';
  error?: string;
}

export interface SabsheetRecomputeResponse {
  recomputed: number;
}

const BASE = '/v1/sabsheet/cells';

export async function listSabsheetCells(
  sheetId: string,
  viewport?: { minRow?: number; maxRow?: number; minCol?: number; maxCol?: number },
): Promise<SabsheetCellListResponse> {
  const sp = new URLSearchParams();
  sp.set('sheetId', sheetId);
  if (viewport?.minRow !== undefined) sp.set('minRow', String(viewport.minRow));
  if (viewport?.maxRow !== undefined) sp.set('maxRow', String(viewport.maxRow));
  if (viewport?.minCol !== undefined) sp.set('minCol', String(viewport.minCol));
  if (viewport?.maxCol !== undefined) sp.set('maxCol', String(viewport.maxCol));
  return rustFetch<SabsheetCellListResponse>(`${BASE}?${sp.toString()}`);
}

export async function setSabsheetCellRust(
  input: SabsheetCellSetInput,
): Promise<SabsheetCellSetResponse> {
  return rustFetch(`${BASE}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function evaluateSabsheetFormulaRust(
  input: SabsheetEvaluateInput,
): Promise<SabsheetEvaluateResponse> {
  return rustFetch(`${BASE}/evaluate`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function recomputeSabsheetWorkbookRust(
  workbookId: string,
): Promise<SabsheetRecomputeResponse> {
  return rustFetch(`${BASE}/recompute`, {
    method: 'POST',
    body: JSON.stringify({ workbookId }),
  });
}

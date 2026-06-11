/**
 * SabSheet Forms — public, Airtable-style intake forms that append a row to a
 * sheet on submit.
 *
 * A form belongs to a workbook + a specific sheet. Each field maps to a 0-based
 * spreadsheet column (`columnIndex`); on submit the public action appends a new
 * row, writing each value into `setCell(sheetIndex, nextRow, columnIndex)`.
 *
 * Persisted in the `sabsheet_forms` Mongo collection. The string shapes mirror
 * the serialized DTO returned by the server actions (ObjectIds → strings).
 */

/** Collection name for SabSheet forms. */
export const COLL_SABSHEET_FORMS = 'sabsheet_forms';

/** Input control kinds a form field can render. */
export type SabsheetFormFieldType = 'text' | 'number' | 'email' | 'date' | 'select';

/** One field of a form, bound to a single spreadsheet column. */
export interface SabsheetFormField {
  /** 0-based spreadsheet column this field writes into on submit. */
  columnIndex: number;
  /** Label shown above the input. */
  label: string;
  /** Renderer hint + client-side validation kind. */
  type: SabsheetFormFieldType;
  /** Whether the field must be filled before the form can be submitted. */
  required: boolean;
  /** Options for `select` fields. Ignored for other types. */
  options?: string[];
}

/** A public intake form bound to a workbook + sheet. */
export interface SabsheetForm {
  /** Mongo id (stringified). */
  _id: string;
  /** Owner user id (stringified) — the principal rows are written as. */
  ownerUserId: string;
  /** Workbook the target sheet lives in (stringified). */
  workbookId: string;
  /** Target sheet (stringified Mongo id of the `sabsheet_sheets` doc). */
  sheetId: string;
  /** Opaque public token used in the form URL (`/sabsheet/form/:token`). */
  token: string;
  /** Form title shown to respondents. */
  title: string;
  /** Optional description / instructions. */
  description?: string;
  /** Ordered list of fields. */
  fields: SabsheetFormField[];
  /** `closed` forms reject submissions. */
  status: 'active' | 'closed';
  /** Number of successful submissions. */
  submitCount: number;
}

/** Create payload for {@link createForm}. */
export interface SabsheetFormCreateInput {
  workbookId: string;
  sheetId: string;
  title: string;
  description?: string;
  fields?: SabsheetFormField[];
  status?: 'active' | 'closed';
}

/** Patch payload for {@link updateForm}. */
export interface SabsheetFormPatch {
  title?: string;
  description?: string;
  sheetId?: string;
  fields?: SabsheetFormField[];
  status?: 'active' | 'closed';
}

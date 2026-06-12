/**
 * SabCRM Forms — action input/output types.
 *
 * Lives beside `sabcrm-forms.actions.ts` because `'use server'` modules
 * may only export async functions; shared types go here (mirrors the
 * `sabcrm-finance.actions.types.ts` convention).
 */

/** Allowed builder field types (v1 of the minimal builder). */
export type SabcrmFormBuilderFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'select';

/**
 * One field row in the "New form" minimal builder. Maps 1:1 onto the Rust
 * `CrmFormField` wire shape (`name`/`label`/`type`/`required`/`options`/
 * `mapping`).
 */
export interface SabcrmFormBuilderField {
  /** Stable field key — becomes the submission `data` key. Required. */
  key: string;
  /** Human label shown on the public form. */
  label: string;
  type: SabcrmFormBuilderFieldType;
  required?: boolean;
  placeholder?: string;
  /** Options for `select` fields (one per entry). */
  options?: string[];
  /**
   * SabCRM record `data.*` key this field writes to when a submission is
   * converted into a record. Empty → falls back to `key`.
   */
  mapping?: string;
}

/**
 * The "New form" / "Edit form" builder payload. `saveSabcrmForm` creates
 * when `id` is absent and partial-updates when present.
 */
export interface SabcrmFormBuilderInput {
  /** Present when editing an existing form. */
  id?: string;
  name: string;
  description?: string;
  /** Ordered field list (order is preserved on the public form). */
  fields: SabcrmFormBuilderField[];
  /** SabCRM object slug submissions convert into. Default `leads`. */
  targetObject?: string;
  /** Shown after a successful submit (when no redirect is set). */
  successMessage?: string;
  /** Hard redirect after a successful submit (wins over the message). */
  redirectUrl?: string;
  /** Webhook fired on every public submission (HMAC-signed when secret set). */
  webhookUrl?: string;
  webhookSecret?: string;
  /** `"draft" | "published" | "archived"`. Default `published`. */
  status?: string;
}

/** Flat list row the forms page renders (serializable, no server-only types). */
export interface SabcrmFormRow {
  id: string;
  name: string;
  description: string;
  status: string;
  submissionCount: number;
  /** Public id used in the share link (`slug` when set, else `id`). */
  publicId: string;
  fieldCount: number;
  createdAt: string;
}

/** Flat submission row the submissions page renders. */
export interface SabcrmFormSubmissionRow {
  id: string;
  /** Field key → display value (already stringified). */
  values: Record<string, string>;
  status: string;
  createdAt: string;
  sourceUrl: string;
}

/** Result of converting a submission into a SabCRM record. */
export interface SabcrmFormConvertResult {
  /** Object slug the record was created under (e.g. `leads`). */
  object: string;
  recordId: string;
}

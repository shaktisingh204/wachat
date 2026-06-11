/**
 * SabSheet v2 — Live data connections (Superpower C).
 *
 * A `SabsheetConnection` binds a region of a workbook sheet to an external or
 * internal data source. On refresh (manual or on an interval), the source is
 * polled, normalised into a 2D block of strings, and written into the sheet at
 * `target` (anchorRow/anchorCol, both 1-based to match the ops engine) with
 * `origin: 'connection'`.
 *
 * Persisted in the Mongo collection `sabsheet_connections`, scoped to
 * `ownerUserId` (every action requires a session and filters on it).
 *
 * Secrets never live in `config`. A connection that needs credentials points at
 * an encrypted credential blob via `credentialId`; the ciphertext is stored in
 * the connection doc's `credentialCipher` field (AES-256-GCM, see
 * `src/lib/sabflow/credentials/encryption.ts`) and decrypted only inside the
 * `'server-only'` run module.
 */

/** Collection name for connection docs. */
export const SABSHEET_CONNECTIONS_COLLECTION = 'sabsheet_connections';

/** The kinds of source a connection can pull from. */
export type SabsheetConnectionType = 'sabcrm' | 'rest' | 'csv';

/** Refresh policy. `interval` runs every `everyMinutes` via the cron tick. */
export type SabsheetConnectionScheduleMode = 'manual' | 'interval';

/** Lifecycle of a connection. `paused` connections are skipped by the cron tick. */
export type SabsheetConnectionStatus = 'active' | 'paused';

/** Outcome of the most recent refresh. */
export type SabsheetConnectionRunStatus = 'ok' | 'error';

/**
 * Per-type configuration. All three shapes are stored under `config`; the run
 * module narrows on `type` before reading.
 */

/** SabCRM source — list records of one object from the Rust CRM engine. */
export interface SabcrmConnectionConfig {
  /** The SabCRM project (tenant) id the records live under. */
  projectId: string;
  /** Object slug (e.g. `people`, `companies`, `leads`). */
  object: string;
  /**
   * Ordered list of `data.<field>` keys to emit as columns. The first output
   * row is a header row of these keys. When empty, the run flattens each
   * record's `data` keys (union, stable order) instead.
   */
  fields?: string[];
  /** Optional free-text query passed straight to the engine's `q`. */
  q?: string;
  /** Max records to pull per refresh (engine caps apply; default 200). */
  limit?: number;
  /** Sort field key (`data.<field>`) + direction. */
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/** REST source — authed JSON fetch, projected to rows by a path + columns. */
export interface RestConnectionConfig {
  /** Absolute URL to GET. */
  url: string;
  /** HTTP method. Defaults to GET. */
  method?: 'GET' | 'POST';
  /** Static request headers merged on top of the credential headers. */
  headers?: Record<string, string>;
  /** Optional JSON body string for POST. */
  body?: string;
  /**
   * Dot-path into the JSON response that resolves to the array of row objects
   * (e.g. `data.items`). Empty/omitted ⇒ the response itself must be an array.
   */
  rowsPath?: string;
  /**
   * Column keys to project from each row object, in order. The first output
   * row is a header of these keys. When empty, the union of each row's own
   * keys is used (stable order).
   */
  columns?: string[];
  /** When true, omit the header row. */
  noHeader?: boolean;
}

/** CSV source — raw CSV text in `csv`, or a SabFiles `fileId` (v2). */
export interface CsvConnectionConfig {
  /** Raw CSV text. v1 path: paste/store the CSV directly. */
  csv?: string;
  /**
   * SabFiles file id. NOTE(v1): fetching CSV bytes from SabFiles is not wired
   * here yet — the run module falls back to `csv` when `fileId` is set but the
   * fetch is unavailable, and records an error otherwise. Left as a v2 follow-up.
   */
  fileId?: string;
  /** Field delimiter. Defaults to `,`. */
  delimiter?: string;
}

export type SabsheetConnectionConfig =
  | SabcrmConnectionConfig
  | RestConnectionConfig
  | CsvConnectionConfig;

/** Where the 2D block lands in the sheet (1-based, matching the ops engine). */
export interface SabsheetConnectionTarget {
  anchorRow: number;
  anchorCol: number;
}

/** Refresh schedule. */
export interface SabsheetConnectionSchedule {
  mode: SabsheetConnectionScheduleMode;
  /** Interval in minutes when `mode === 'interval'`. */
  everyMinutes?: number;
}

/**
 * A live data connection. `_id`, `ownerUserId`, `workbookId`, and `sheetId`
 * are hex-string ids in the wire/DTO shape (the Mongo docs hold `ObjectId`s;
 * the actions stringify on the way out).
 */
export interface SabsheetConnection {
  _id: string;
  ownerUserId: string;
  workbookId: string;
  /**
   * Target sheet (hex id of a `sabsheet_sheets` doc). Optional — when omitted
   * the workbook's first sheet (index 0) is used. The run module resolves the
   * sheet's 0-based engine index from its `position`.
   */
  sheetId?: string;
  type: SabsheetConnectionType;
  config: SabsheetConnectionConfig;
  target: SabsheetConnectionTarget;
  schedule: SabsheetConnectionSchedule;
  /** Logical credential id (when the source needs auth). */
  credentialId?: string;
  /** ISO timestamp of the last completed run (success or failure). */
  lastRunAt?: string;
  lastStatus?: SabsheetConnectionRunStatus;
  lastError?: string;
  /** Number of data rows written on the last successful run (excl. header). */
  rowCount?: number;
  status: SabsheetConnectionStatus;
  createdAt?: string;
  updatedAt?: string;
}

/** Input accepted by `createConnection`. */
export interface CreateSabsheetConnectionInput {
  workbookId: string;
  sheetId?: string;
  type: SabsheetConnectionType;
  config: SabsheetConnectionConfig;
  target: SabsheetConnectionTarget;
  schedule: SabsheetConnectionSchedule;
  /**
   * Plaintext secret (e.g. a bearer token / API key). Encrypted at rest before
   * storage; never returned to the client.
   */
  secret?: string;
  /** Optional opaque credential id label (for display / future credential refs). */
  credentialId?: string;
}

/** Patch accepted by `updateConnection`. */
export interface UpdateSabsheetConnectionPatch {
  sheetId?: string;
  config?: SabsheetConnectionConfig;
  target?: SabsheetConnectionTarget;
  schedule?: SabsheetConnectionSchedule;
  status?: SabsheetConnectionStatus;
  /** When provided, re-encrypts and replaces the stored secret. */
  secret?: string;
}

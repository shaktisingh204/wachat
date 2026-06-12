import 'server-only';

/**
 * SabCRM Sequences client — wraps the Rust `/v1/sabcrm/sequences` surface
 * (crate `sabcrm-sequences`, mounted by `sabnode-api`).
 *
 * HubSpot/Close-style cadences: a sequence is an ordered list of
 * email / task / wait steps; records are ENROLLED into a sequence and the
 * SabCRM scheduler tick (`src/lib/sabcrm/scheduler.ts`, cron
 * `/api/cron/sabcrm-workflows`) executes due enrollments step by step.
 *
 * Tenant scope is `projectId`; the Rust side requires a valid `AuthUser` JWT
 * and records the caller as `enrolledBy` on enroll. Wire shapes mirror
 * `rust/crates/sabcrm-sequences/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/** Lifecycle status of a sequence definition. */
export type SabcrmSequenceStatus = 'active' | 'paused';

/** Lifecycle status of one enrollment. */
export type SabcrmEnrollmentStatus =
  | 'active'
  | 'completed'
  | 'unenrolled'
  | 'failed';

/** What one sequence step does. */
export type SabcrmSequenceStepKind = 'email' | 'task' | 'wait';

/** Email payload of an `email` step (stored template OR inline subject/body). */
export interface SabcrmSequenceEmailConfig {
  /** Id of a stored `sabcrm_templates` template to render. */
  templateId?: string;
  /** Inline subject template (used when no `templateId`). */
  subject?: string;
  /** Inline body template (used when no `templateId`). */
  body?: string;
}

/** Task payload of a `task` step. */
export interface SabcrmSequenceTaskConfig {
  /** Task title (may carry `{{variable}}` placeholders). */
  title: string;
  /** Days from execution until the task is due. */
  dueInDays?: number;
}

/** One ordered step in a sequence. */
export interface SabcrmSequenceStep {
  id: string;
  kind: SabcrmSequenceStepKind;
  email?: SabcrmSequenceEmailConfig;
  task?: SabcrmSequenceTaskConfig;
  /** Pause length in days — required (>0) when `kind === 'wait'`. */
  waitDays?: number;
}

/** Sequence-level behaviour switches. */
export interface SabcrmSequenceSettings {
  /** Auto-unenroll a record when it replies. Defaults to `true`. */
  unenrollOnReply: boolean;
  /**
   * Auto-unenroll on stage change: absent → never; `[]` → ANY change;
   * non-empty → only when the new stage id is in the list.
   */
  unenrollOnStageChange?: string[];
}

/** A sequence definition as returned by the Rust engine. */
export interface SabcrmRustSequence {
  id: string;
  projectId: string;
  name: string;
  status: SabcrmSequenceStatus;
  steps: SabcrmSequenceStep[];
  settings: SabcrmSequenceSettings;
  createdAt: string;
  updatedAt: string;
}

/** One history line on an enrollment. */
export interface SabcrmEnrollmentHistoryEntry {
  /** Step id the line refers to (`null` for lifecycle lines). */
  stepId: string | null;
  /** RFC3339 timestamp. */
  at: string;
  /** Outcome slug (`email_sent` / `task_created` / `waited` / `failed:…`). */
  outcome: string;
}

/** One record's enrollment into one sequence. */
export interface SabcrmRustEnrollment {
  id: string;
  projectId: string;
  sequenceId: string;
  objectSlug: string;
  recordId: string;
  currentStepIndex: number;
  status: SabcrmEnrollmentStatus;
  /** RFC3339 — when the scheduler should run the current step. */
  nextRunAt: string;
  enrolledBy: string;
  history: SabcrmEnrollmentHistoryEntry[];
  /** Set when auto/manually unenrolled (`manual` / `reply` / `stage_changed` / `sequence_deleted`). */
  unenrollCause?: string;
  unenrolledAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Input for {@link sabcrmSequencesApi.create}. */
export interface SabcrmSequenceCreateInput {
  name: string;
  steps?: SabcrmSequenceStep[];
  settings?: Partial<SabcrmSequenceSettings>;
  status?: SabcrmSequenceStatus;
}

/** Flattened partial patch for {@link sabcrmSequencesApi.update}. */
export interface SabcrmSequenceUpdateInput {
  name?: string;
  status?: SabcrmSequenceStatus;
  steps?: SabcrmSequenceStep[];
  settings?: Partial<SabcrmSequenceSettings>;
}

/** Filters + pagination for {@link sabcrmSequencesApi.list}. */
export interface SabcrmSequenceListParams {
  status?: SabcrmSequenceStatus;
  page?: number;
  limit?: number;
}

/** `GET /` response — one page of sequences plus the pagination envelope. */
export interface SabcrmSequenceListResponse {
  sequences: SabcrmRustSequence[];
  total: number;
  page: number;
  limit: number;
}

/** Filters + pagination for {@link sabcrmSequencesApi.listEnrollments}. */
export interface SabcrmEnrollmentListParams {
  sequenceId?: string;
  objectSlug?: string;
  recordId?: string;
  status?: SabcrmEnrollmentStatus;
  page?: number;
  limit?: number;
}

/** `GET /enrollments` response. */
export interface SabcrmEnrollmentListResponse {
  enrollments: SabcrmRustEnrollment[];
  total: number;
  page: number;
  limit: number;
}

/** `POST /{id}/enroll` response — created vs already-active skipped counts. */
export interface SabcrmEnrollResponse {
  enrollments: SabcrmRustEnrollment[];
  created: number;
  skipped: number;
}

/** Encode query params, dropping undefined/empty values. */
function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Raw `{ sequence }` envelope from `GET /{id}`, `POST /`, `PATCH /{id}`. */
interface SequenceEnvelope {
  sequence: SabcrmRustSequence;
}

/** Raw `{ enrollment }` envelope from `POST /enrollments/{id}/unenroll`. */
interface EnrollmentEnvelope {
  enrollment: SabcrmRustEnrollment;
}

const BASE = '/v1/sabcrm/sequences';

export const sabcrmSequencesApi = {
  /** `GET /v1/sabcrm/sequences` — list sequences, newest first, paginated. */
  list(
    projectId: string,
    params?: SabcrmSequenceListParams,
  ): Promise<SabcrmSequenceListResponse> {
    return rustFetch<SabcrmSequenceListResponse>(
      `${BASE}${qs({
        projectId,
        status: params?.status,
        page: params?.page,
        limit: params?.limit,
      })}`,
    );
  },

  /** `GET /v1/sabcrm/sequences/{id}` — fetch one sequence. */
  async get(projectId: string, id: string): Promise<SabcrmRustSequence> {
    const res = await rustFetch<SequenceEnvelope>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    );
    return res.sequence;
  },

  /** `POST /v1/sabcrm/sequences` — create a sequence definition. */
  async create(
    projectId: string,
    input: SabcrmSequenceCreateInput,
  ): Promise<SabcrmRustSequence> {
    const res = await rustFetch<SequenceEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
    return res.sequence;
  },

  /** `PATCH /v1/sabcrm/sequences/{id}` — partial update (flattened patch). */
  async update(
    projectId: string,
    id: string,
    input: SabcrmSequenceUpdateInput,
  ): Promise<SabcrmRustSequence> {
    const res = await rustFetch<SequenceEnvelope>(
      `${BASE}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ projectId, ...input }) },
    );
    return res.sequence;
  },

  /**
   * `DELETE /v1/sabcrm/sequences/{id}` — delete a sequence (its remaining
   * active enrollments are unenrolled server-side).
   */
  remove(projectId: string, id: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },

  /**
   * `POST /v1/sabcrm/sequences/{id}/enroll` — enroll record(s). Idempotent
   * per record (already-active enrollments are skipped, not duplicated).
   */
  enroll(
    projectId: string,
    id: string,
    objectSlug: string,
    recordIds: string[],
  ): Promise<SabcrmEnrollResponse> {
    return rustFetch<SabcrmEnrollResponse>(
      `${BASE}/${encodeURIComponent(id)}/enroll`,
      {
        method: 'POST',
        body: JSON.stringify({ projectId, objectSlug, recordIds }),
      },
    );
  },

  /**
   * `POST /v1/sabcrm/sequences/enrollments/{id}/unenroll` — manually stop one
   * active enrollment.
   */
  async unenroll(
    projectId: string,
    enrollmentId: string,
    reason?: string,
  ): Promise<SabcrmRustEnrollment> {
    const res = await rustFetch<EnrollmentEnvelope>(
      `${BASE}/enrollments/${encodeURIComponent(enrollmentId)}/unenroll`,
      { method: 'POST', body: JSON.stringify({ projectId, reason }) },
    );
    return res.enrollment;
  },

  /**
   * `GET /v1/sabcrm/sequences/enrollments` — list enrollments, newest first,
   * narrowed by sequence / record / status, paginated.
   */
  listEnrollments(
    projectId: string,
    params?: SabcrmEnrollmentListParams,
  ): Promise<SabcrmEnrollmentListResponse> {
    return rustFetch<SabcrmEnrollmentListResponse>(
      `${BASE}/enrollments${qs({
        projectId,
        sequenceId: params?.sequenceId,
        objectSlug: params?.objectSlug,
        recordId: params?.recordId,
        status: params?.status,
        page: params?.page,
        limit: params?.limit,
      })}`,
    );
  },
};

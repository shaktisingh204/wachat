import 'server-only';

/**
 * SabCRM Activities client — wraps the Rust `/v1/sabcrm/activities` surface
 * (crate `sabcrm-activities`, mounted by `sabnode-api`).
 *
 * The activities timeline is a per-project feed of NOTE / TASK / CALL /
 * MEETING / EMAIL / COMMENT entries, each attached to a single record via
 * `(targetObject, targetRecordId)`. Tenant scope is `projectId`; the Rust
 * side additionally requires a valid `AuthUser` JWT, which {@link rustFetch}
 * mints from the session cookie.
 *
 * The Rust handlers wrap responses in `{ activities: [...] }` (list) and
 * `{ activity: {...} }` (single); this client unwraps them so callers get the
 * raw rows. Wire shapes (camelCase) mirror the Rust handlers in
 * `rust/crates/sabcrm-activities/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/**
 * A SabFiles attachment ref carried by an activity. These are references into
 * the user's SabFiles library — never raw external URLs. Mirrors the
 * `Attachment` struct in `rust/crates/sabcrm-activities/src/dto.rs` and the
 * `SabcrmActivityDoc.attachments` shape in `src/lib/sabcrm/db.ts`.
 */
export interface SabcrmAttachment {
  /** SabFiles file id (the library reference). */
  fileId: string;
  /** Display name of the file. */
  name: string;
  /** MIME type (optional). */
  contentType?: string;
  /** Byte size (optional). */
  size?: number;
  /** Resolved SabFiles-served URL (optional; never an external URL). */
  url?: string;
}

/** A SabCRM activity as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustActivity {
  id: string;
  projectId: string;
  /** NOTE | TASK | CALL | MEETING | EMAIL | COMMENT. */
  type: string;
  title: string;
  body?: string;
  targetObject: string;
  targetRecordId: string;
  authorId: string;
  /** TASK-only workflow status (TODO | IN_PROGRESS | DONE). */
  status?: string;
  /** TASK-only assignee user id. */
  assigneeId?: string;
  /** TASK-only due date (RFC3339). */
  dueAt?: string;
  /** SabFiles attachment refs (absent on legacy rows). */
  attachments?: SabcrmAttachment[];
  createdAt: string;
  updatedAt: string;
}

/** `GET /` query params. `projectId` is required; the rest narrow / filter. */
export interface SabcrmActivityListParams {
  projectId: string;
  /** Object slug of the record whose timeline to read (optional). */
  targetObject?: string;
  /** Serialized id of the record whose timeline to read (optional). */
  targetRecordId?: string;
  /** Optional `type` filter (NOTE | TASK | CALL | MEETING | EMAIL | COMMENT). */
  type?: string;
  /** Page size. Clamped at 200 server-side; defaults to 50. */
  limit?: number;
}

/** `POST /` body — create a timeline activity. */
export interface SabcrmActivityCreateInput {
  projectId: string;
  /** Entry kind (NOTE | TASK | CALL | MEETING | EMAIL | COMMENT). */
  type: string;
  title: string;
  body?: string;
  targetObject: string;
  targetRecordId: string;
  authorId: string;
  status?: string;
  assigneeId?: string;
  dueAt?: string;
  /** SabFiles attachment refs (optional). */
  attachments?: SabcrmAttachment[];
}

/**
 * `PATCH /{id}` body — partial update. `projectId` scopes the row; every
 * other key is `$set` verbatim (e.g. `{ status: 'DONE' }`, or replacing the
 * `attachments` array).
 */
export interface SabcrmActivityUpdateInput {
  projectId: string;
  /** Optional replacement attachment list (`$set` verbatim). */
  attachments?: SabcrmAttachment[];
  [key: string]: unknown;
}

/**
 * A single emoji reaction aggregated by emoji. Mirrors the `ReactionGroup`
 * struct in `rust/crates/sabcrm-activities/src/dto.rs`: one entry per distinct
 * `emoji`, carrying the reacting member ids and a derived `count`.
 */
export interface SabcrmReactionGroup {
  /** The emoji (short string, e.g. "👍" or ":thumbsup:"). */
  emoji: string;
  /** Member ids who reacted with this emoji. */
  memberIds: string[];
  /** Convenience count = `memberIds.length`. */
  count: number;
}

/**
 * A comment stored as a subdocument on an activity's `comments` array.
 * Mirrors the `Comment` struct in
 * `rust/crates/sabcrm-activities/src/dto.rs`. `id` is a fresh ObjectId hex
 * assigned server-side; `createdAt` is RFC3339.
 */
export interface SabcrmComment {
  /** Comment id (ObjectId hex). */
  id: string;
  /** Free-form comment body. */
  body: string;
  /** Author user id. */
  authorId: string;
  /** Workspace member ids @mentioned in the body. */
  mentionIds: string[];
  /** Emoji reactions on this comment, grouped by emoji. */
  reactions: SabcrmReactionGroup[];
  /** Creation timestamp (RFC3339). */
  createdAt: string;
  /** Last edit timestamp (RFC3339); absent until the comment is edited. */
  editedAt?: string;
  /**
   * Human-friendly relative time derived from `createdAt` (e.g. "2h ago").
   * Computed server-side on read; never persisted.
   */
  createdAtRelative: string;
}

/** Raw `{ activities }` envelope from `GET /`. */
interface ListEnvelope {
  activities: SabcrmRustActivity[];
}

/** Raw `{ activity }` envelope from `POST /` and `PATCH /{id}`. */
interface SingleEnvelope {
  activity: SabcrmRustActivity;
}

/** Raw `{ comments }` envelope from `GET /{id}/comments`. */
interface CommentListEnvelope {
  comments: SabcrmComment[];
}

/** Raw `{ comment }` envelope from `POST /{id}/comments` and `PATCH /{id}/comments/{commentId}`. */
interface CommentEnvelope {
  comment: SabcrmComment;
}

/**
 * Raw `{ reactions }` envelope from the reaction-toggle endpoints — the updated
 * reaction groups for the target (activity or comment).
 */
interface ReactionsEnvelope {
  reactions: SabcrmReactionGroup[];
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

const BASE = '/v1/sabcrm/activities';

export const sabcrmActivitiesApi = {
  /** `GET /v1/sabcrm/activities` — timeline list, newest first. */
  async list(
    params: SabcrmActivityListParams,
  ): Promise<SabcrmRustActivity[]> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}${qs({
        projectId: params.projectId,
        targetObject: params.targetObject,
        targetRecordId: params.targetRecordId,
        type: params.type,
        limit: params.limit,
      })}`,
    );
    return res.activities;
  },

  /** `POST /v1/sabcrm/activities` — create a timeline entry. */
  async create(
    input: SabcrmActivityCreateInput,
  ): Promise<SabcrmRustActivity> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.activity;
  },

  /** `PATCH /v1/sabcrm/activities/{id}` — partial update. */
  async update(
    id: string,
    input: SabcrmActivityUpdateInput,
  ): Promise<SabcrmRustActivity> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    );
    return res.activity;
  },

  /** `DELETE /v1/sabcrm/activities/{id}` — scoped delete. */
  remove(id: string, projectId: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },

  /** `GET /v1/sabcrm/activities/{id}/comments` — the comments array. */
  async listComments(
    id: string,
    projectId: string,
  ): Promise<SabcrmComment[]> {
    const res = await rustFetch<CommentListEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/comments${qs({ projectId })}`,
    );
    return res.comments;
  },

  /**
   * `POST /v1/sabcrm/activities/{id}/comments` — append a comment, optionally
   * carrying @mentioned member ids.
   */
  async addComment(
    id: string,
    projectId: string,
    body: string,
    authorId: string,
    mentionIds?: string[],
  ): Promise<SabcrmComment> {
    const res = await rustFetch<CommentEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ projectId, body, authorId, mentionIds }),
      },
    );
    return res.comment;
  },

  /**
   * `PATCH /v1/sabcrm/activities/{id}/comments/{commentId}` — edit one's own
   * comment. Only the original author may edit (enforced server-side);
   * `editedAt` is bumped. `mentionIds`, when present, replaces the set.
   */
  async editComment(
    id: string,
    commentId: string,
    projectId: string,
    body: string,
    mentionIds?: string[],
  ): Promise<SabcrmComment> {
    const res = await rustFetch<CommentEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/comments/${encodeURIComponent(
        commentId,
      )}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ projectId, body, mentionIds }),
      },
    );
    return res.comment;
  },

  /**
   * `DELETE /v1/sabcrm/activities/{id}/comments/{commentId}` — remove a
   * comment from the activity's `comments` array (delete-own, server-enforced).
   */
  deleteComment(
    id: string,
    commentId: string,
    projectId: string,
  ): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}/comments/${encodeURIComponent(
        commentId,
      )}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },

  /**
   * `POST /v1/sabcrm/activities/{id}/reactions` — toggle the authenticated
   * member's `emoji` reaction on the activity on/off. Returns the updated
   * reaction groups.
   */
  async toggleReaction(
    id: string,
    projectId: string,
    emoji: string,
  ): Promise<SabcrmReactionGroup[]> {
    const res = await rustFetch<ReactionsEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/reactions`,
      { method: 'POST', body: JSON.stringify({ projectId, emoji }) },
    );
    return res.reactions;
  },

  /**
   * `POST /v1/sabcrm/activities/{id}/comments/{commentId}/reactions` — toggle
   * the authenticated member's `emoji` reaction on a comment on/off. Returns
   * the updated reaction groups for that comment.
   */
  async toggleCommentReaction(
    id: string,
    commentId: string,
    projectId: string,
    emoji: string,
  ): Promise<SabcrmReactionGroup[]> {
    const res = await rustFetch<ReactionsEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/comments/${encodeURIComponent(
        commentId,
      )}/reactions`,
      { method: 'POST', body: JSON.stringify({ projectId, emoji }) },
    );
    return res.reactions;
  },
};

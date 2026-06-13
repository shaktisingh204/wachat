/**
 * SabCRM — threaded record comments + @mentions — PURE helpers.
 *
 * The structural twin of `./scoring.ts`: a `'server-only'`- and I/O-free module
 * so the unit tests (`tsx --test`) AND the `'use client'` comments panel can
 * import the parsing/rendering/threading math directly. The Mongo side effects
 * + notification fan-out live in `./comments.server.ts`, which re-exports the
 * types from here. Nothing in this file touches the DB, the network, or any
 * `server-only` import.
 *
 * ## Mention token format
 *
 * Identical to the repo's existing mention editor
 * (`src/components/crm/mention-textarea.tsx`):
 *
 *     @[Display Name](user:USER_ID)
 *
 * `parseMentions(body)` extracts the `{ userId, name }` tokens from a raw body;
 * `renderCommentHtml(body, members)` HTML-escapes the body and turns each token
 * into a safe `<span class="sabcrm-mention">@Name</span>` (resolving the live
 * display name from the member roster when available). No raw HTML from the
 * author ever reaches the output — everything is escaped first, then mentions
 * are substituted with a controlled span.
 *
 * ## Threading
 *
 * A comment is either a root (no `parentId`) or a reply (`parentId` → another
 * comment's id). `nestComments` turns the flat, time-ordered list the store
 * returns into a one-level-deep tree (root → its replies), which is what the
 * panel renders. Deeper nesting is deliberately flattened onto the nearest
 * root so the thread never becomes an unbounded staircase.
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/** A workspace member referenced by a comment author / mention. */
export interface CommentMember {
  /** User id (hex) — the mention token target + the author key. */
  userId: string;
  /** Display name snapshot. */
  name: string;
  /** Avatar URL, when known. */
  avatarUrl?: string;
}

/** A mention resolved against the workspace roster. */
export interface CommentMention {
  /** Mentioned user id (hex). */
  userId: string;
  /** Display-name snapshot from the token (may be stale vs. the roster). */
  name: string;
}

/**
 * A comment in its serialisable API shape. `_id`/`parentId` are hex strings;
 * `createdAt`/`updatedAt` are ISO strings (transport-safe across the action
 * boundary). The body is the RAW author text (still carrying mention tokens) —
 * the panel renders it through {@link renderCommentHtml}.
 */
export interface CrmComment {
  _id: string;
  /** Tenant scope. */
  projectId: string;
  /** Object slug of the record this comment is attached to. */
  object: string;
  /** Id of the record this comment is attached to. */
  recordId: string;
  /** Parent comment id when this is a reply, else null (a root comment). */
  parentId: string | null;
  /** Author user id (hex). */
  authorId: string;
  /** Raw author body (carries `@[Name](user:ID)` tokens). */
  body: string;
  /** Mentions resolved at write time. Always present (possibly empty). */
  mentions: CommentMention[];
  createdAt: string;
  updatedAt: string;
}

/** A root comment with its (one-level) replies, as rendered by the panel. */
export interface CommentNode extends CrmComment {
  replies: CrmComment[];
}

/** Shape accepted by the add action (server stamps ids / timestamps / author). */
export interface AddCommentInput {
  object: string;
  recordId: string;
  /** Raw body with mention tokens. */
  body: string;
  /** Optional parent comment id → makes this a reply. */
  parentId?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Mention parsing                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Mention token: `@[Display Name](user:USER_ID)`. Mirrors the editor's
 * `MENTION_TOKEN_RE` so a token typed in the composer parses back identically.
 * `g` flag → reused with `matchAll`; the name is non-`]`, the id alnum/_/-.
 */
const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(user:([a-zA-Z0-9_-]+)\)/g;

/**
 * Extract the deduped `{ userId, name }` mention tokens from a raw body, in
 * first-seen order. Pure — no roster lookup; the name is taken verbatim from
 * the token (the server later snapshots the live name). Returns `[]` for an
 * empty / token-free body.
 */
export function parseMentions(body: string): CommentMention[] {
  if (!body) return [];
  const out: CommentMention[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(MENTION_TOKEN_RE)) {
    const name = m[1];
    const userId = m[2];
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    out.push({ userId, name });
  }
  return out;
}

/** Just the deduped mentioned user ids, in first-seen order. */
export function mentionedUserIds(body: string): string[] {
  return parseMentions(body).map((m) => m.userId);
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * HTML-escape a string so author text can never inject markup. Covers the five
 * characters that matter in an HTML text/attribute context.
 */
export function escapeHtml(input: string): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render a raw comment body to SAFE HTML:
 *   1. the WHOLE body is HTML-escaped first (no author markup survives),
 *   2. each mention token is then replaced by a controlled
 *      `<span class="sabcrm-mention" data-user-id="…">@Name</span>`, resolving
 *      the live display name from `members` (falling back to the token's name),
 *   3. newlines become `<br/>`.
 *
 * Because step 1 escapes everything and step 2 only ever emits a fixed,
 * attribute-escaped span, the result is injection-safe for `dangerouslySet…`.
 *
 * Implementation note: we escape the body BEFORE substituting, so the regex
 * runs against the escaped text. The literal token characters `@ [ ] ( ) :`
 * are NOT among the escaped set, so the token survives escaping intact and the
 * (escaped) display name inside it is re-escaped via {@link escapeHtml} when we
 * emit the span — double-escaping a name is avoided by sourcing it from the raw
 * token / roster, not from the escaped string.
 */
export function renderCommentHtml(
  body: string,
  members: ReadonlyArray<CommentMember> = [],
): string {
  if (!body) return '';
  const nameById = new Map<string, string>();
  for (const m of members) {
    if (m && m.userId) nameById.set(m.userId, m.name);
  }
  const escaped = escapeHtml(body);
  const withMentions = escaped.replace(
    MENTION_TOKEN_RE,
    (_full, tokenName: string, userId: string) => {
      const display = (nameById.get(userId) || tokenName || 'someone').trim();
      return (
        `<span class="sabcrm-mention" data-user-id="${escapeHtml(userId)}">` +
        `@${escapeHtml(display)}</span>`
      );
    },
  );
  return withMentions.replace(/\r\n|\r|\n/g, '<br/>');
}

/**
 * A plain-text preview of a body (mention tokens → `@Name`, no HTML). Used for
 * the notification body so the inbox row reads naturally. Collapses whitespace
 * and truncates to `max` chars with an ellipsis.
 */
export function commentPreview(body: string, max = 140): string {
  if (!body) return '';
  const text = body
    .replace(MENTION_TOKEN_RE, (_f, name: string) => `@${name}`)
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/* -------------------------------------------------------------------------- */
/* Threading                                                                   */
/* -------------------------------------------------------------------------- */

/** Sort comments oldest → newest by `createdAt`, ties broken by `_id`. */
export function sortByCreatedAsc(comments: CrmComment[]): CrmComment[] {
  return [...comments].sort((a, b) => {
    const ta = Date.parse(a.createdAt) || 0;
    const tb = Date.parse(b.createdAt) || 0;
    if (ta !== tb) return ta - tb;
    return a._id < b._id ? -1 : a._id > b._id ? 1 : 0;
  });
}

/**
 * Nest a flat comment list into a one-level tree: roots (oldest → newest), each
 * carrying its replies (oldest → newest). A reply whose `parentId` is missing,
 * unknown, or itself a reply is re-homed onto the nearest known ROOT (so the
 * thread never staircases and an orphan reply is never dropped). A reply that
 * cannot be resolved to any root is promoted to a root itself.
 */
export function nestComments(comments: CrmComment[]): CommentNode[] {
  const sorted = sortByCreatedAsc(comments);
  const byId = new Map<string, CrmComment>();
  for (const c of sorted) byId.set(c._id, c);

  /** Walk parent links up to the first root (no/own/unknown parent → self). */
  const rootIdOf = (c: CrmComment): string => {
    let cur = c;
    const guard = new Set<string>();
    while (cur.parentId && byId.has(cur.parentId) && !guard.has(cur._id)) {
      guard.add(cur._id);
      cur = byId.get(cur.parentId) as CrmComment;
    }
    return cur._id;
  };

  const nodes = new Map<string, CommentNode>();
  const order: string[] = [];

  // First pass: every TRUE root (no resolvable parent) becomes a node.
  for (const c of sorted) {
    const isRoot = !c.parentId || !byId.has(c.parentId);
    if (isRoot) {
      nodes.set(c._id, { ...c, replies: [] });
      order.push(c._id);
    }
  }

  // Second pass: attach replies to their resolved root (promote if none).
  for (const c of sorted) {
    const isRoot = !c.parentId || !byId.has(c.parentId);
    if (isRoot) continue;
    const rootId = rootIdOf(c);
    const root = nodes.get(rootId);
    if (root) {
      root.replies.push(c);
    } else {
      nodes.set(c._id, { ...c, replies: [] });
      order.push(c._id);
    }
  }

  return order.map((id) => nodes.get(id) as CommentNode);
}

/** Total comment count across roots + replies (for the tab badge). */
export function countComments(nodes: CommentNode[]): number {
  return nodes.reduce((n, root) => n + 1 + root.replies.length, 0);
}

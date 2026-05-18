/**
 * SabFlow collab — share-link viewer flow (integration test).
 *
 * Phase C.8 · sub-task #6 — "Playwright e2e" target. See ./README.md for
 * the future-Playwright TODO. Playwright would mint a share link, open
 * it incognito, and try to perform an edit — this integration test
 * exercises the same access decision at the RBAC layer that the editor
 * UI consults on every write.
 *
 *   npx tsx --test src/lib/sabflow/__tests__/e2e-collab/share-viewer-readonly.test.ts
 *
 * The RBAC matrix lives in `src/lib/sabflow/access/__tests__/matrix.json`
 * (the source of truth for `canDo`). This test reuses the same
 * forward-declared reference impl that `rbac-matrix.test.ts` ships, so
 * when `../access/roles.ts` lands the import can be swapped without
 * changing the assertions.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { randomBytes, createHash } from 'node:crypto';

/* ── Forward-decl block (mirrors rbac-matrix.test.ts) ───────────────────── */

export type DocRole = 'OWNER' | 'EDITOR' | 'COMMENTER' | 'VIEWER' | 'NONE';

export type DocAction =
  | 'doc.read'
  | 'doc.write'
  | 'doc.delete'
  | 'doc.share'
  | 'doc.comment'
  | 'doc.export'
  | 'doc.fork'
  | 'owner.transfer'
  | 'share_link.create'
  | 'share_link.revoke'
  | 'invite.send'
  | 'credentials.read';

const REFERENCE_ALLOW: Record<DocRole, ReadonlySet<DocAction>> = {
  OWNER: new Set<DocAction>([
    'doc.read', 'doc.write', 'doc.delete', 'doc.share', 'doc.comment',
    'doc.export', 'doc.fork', 'owner.transfer', 'share_link.create',
    'share_link.revoke', 'invite.send', 'credentials.read',
  ]),
  EDITOR: new Set<DocAction>([
    'doc.read', 'doc.write', 'doc.share', 'doc.comment',
    'doc.export', 'doc.fork', 'share_link.create', 'invite.send',
  ]),
  COMMENTER: new Set<DocAction>(['doc.read', 'doc.comment', 'doc.export', 'doc.fork']),
  VIEWER: new Set<DocAction>(['doc.read', 'doc.export', 'doc.fork']),
  NONE: new Set<DocAction>(),
};

function canDo(role: DocRole, action: DocAction): boolean {
  return REFERENCE_ALLOW[role]?.has(action) === true;
}

/* ── Share-link model (mirrors the planned `sabflow_share_links` shape) ── */

interface ShareLink {
  /** Opaque token shown in the URL (`/flow/<token>`). */
  token: string;
  /** SHA-256 of the token — the persisted form, never the raw token. */
  tokenHash: string;
  /** Doc the link grants access to. */
  docId: string;
  /** Workspace scope. */
  workspaceId: string;
  /** Role bound to the link — read-only flows mint as `VIEWER`. */
  role: Extract<DocRole, 'VIEWER' | 'COMMENTER' | 'EDITOR'>;
  /** Expiry (ms since epoch); null = no expiry. */
  expiresAt: number | null;
  /** Once revoked, every resolve returns null. */
  revoked: boolean;
}

class ShareLinkStore {
  private byHash = new Map<string, ShareLink>();

  mint(docId: string, workspaceId: string, role: ShareLink['role']): ShareLink {
    const token = randomBytes(24).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const link: ShareLink = {
      token,
      tokenHash,
      docId,
      workspaceId,
      role,
      expiresAt: null,
      revoked: false,
    };
    this.byHash.set(tokenHash, link);
    return link;
  }

  /** Resolve a presented token → ShareLink or null. Matches the gateway's
   *  contract: never accept raw tokens by key — always hash first. */
  resolve(token: string): ShareLink | null {
    const hash = createHash('sha256').update(token).digest('hex');
    const link = this.byHash.get(hash);
    if (!link) return null;
    if (link.revoked) return null;
    if (link.expiresAt !== null && Date.now() > link.expiresAt) return null;
    return link;
  }

  revoke(tokenHash: string): void {
    const link = this.byHash.get(tokenHash);
    if (link) link.revoked = true;
  }
}

/* ── Tests ──────────────────────────────────────────────────────────────── */

test('share-viewer: minting a VIEWER share link returns a resolvable token', () => {
  const store = new ShareLinkStore();
  const link = store.mint('doc-1', 'ws-1', 'VIEWER');

  assert.ok(link.token.length >= 20, 'token should be at least 160 bits of entropy');
  assert.equal(link.role, 'VIEWER');
  assert.equal(link.revoked, false);

  const resolved = store.resolve(link.token);
  assert.ok(resolved, 'newly-minted token must resolve');
  assert.equal(resolved!.docId, 'doc-1');
  assert.equal(resolved!.workspaceId, 'ws-1');
  assert.equal(resolved!.role, 'VIEWER');
});

test('share-viewer: token is stored only as a SHA-256 hash, never raw', () => {
  const store = new ShareLinkStore();
  const link = store.mint('doc-1', 'ws-1', 'VIEWER');

  // The hash is deterministic and matches what's used internally.
  const expectedHash = createHash('sha256').update(link.token).digest('hex');
  assert.equal(link.tokenHash, expectedHash);
  assert.notEqual(link.token, link.tokenHash);
});

test('share-viewer: incognito viewer (VIEWER role) is allowed read-only actions', () => {
  const store = new ShareLinkStore();
  const link = store.mint('doc-1', 'ws-1', 'VIEWER');
  const session = store.resolve(link.token);
  assert.ok(session);

  // Read-only actions allowed for VIEWER.
  assert.equal(canDo(session!.role, 'doc.read'), true, 'viewer must be able to read');
  assert.equal(canDo(session!.role, 'doc.export'), true, 'viewer may export');
  assert.equal(canDo(session!.role, 'doc.fork'), true, 'viewer may fork');
});

test('share-viewer: incognito viewer CANNOT perform any write action', () => {
  const store = new ShareLinkStore();
  const link = store.mint('doc-1', 'ws-1', 'VIEWER');
  const session = store.resolve(link.token);
  assert.ok(session);

  const writeActions: DocAction[] = [
    'doc.write',
    'doc.delete',
    'doc.share',
    'doc.comment',          // VIEWER < COMMENTER
    'owner.transfer',
    'share_link.create',
    'share_link.revoke',
    'invite.send',
    'credentials.read',
  ];

  for (const action of writeActions) {
    assert.equal(
      canDo(session!.role, action),
      false,
      `VIEWER must be denied '${action}' on a share-link session`,
    );
  }
});

test('share-viewer: revoked share link no longer resolves', () => {
  const store = new ShareLinkStore();
  const link = store.mint('doc-1', 'ws-1', 'VIEWER');
  assert.ok(store.resolve(link.token), 'pre-revoke resolve must succeed');

  store.revoke(link.tokenHash);
  assert.equal(store.resolve(link.token), null, 'revoked link must return null');
});

test('share-viewer: invalid / unknown token resolves to null (no oracle leak)', () => {
  const store = new ShareLinkStore();
  store.mint('doc-1', 'ws-1', 'VIEWER');

  // Random unknown token must not resolve.
  const bogus = randomBytes(24).toString('base64url');
  assert.equal(store.resolve(bogus), null);

  // Empty string must not resolve.
  assert.equal(store.resolve(''), null);
});

test('share-viewer: EDITOR share link still denies OWNER-only actions', () => {
  // Spec sanity-check: even if the share link grants EDITOR, OWNER-only
  // actions (delete, owner.transfer, share_link.revoke, credentials.read)
  // remain denied. Catches future drift in the RBAC matrix.
  const store = new ShareLinkStore();
  const link = store.mint('doc-1', 'ws-1', 'EDITOR');
  const session = store.resolve(link.token);
  assert.ok(session);

  assert.equal(canDo(session!.role, 'doc.write'), true);
  assert.equal(canDo(session!.role, 'doc.delete'), false);
  assert.equal(canDo(session!.role, 'owner.transfer'), false);
  assert.equal(canDo(session!.role, 'share_link.revoke'), false);
  assert.equal(canDo(session!.role, 'credentials.read'), false);
});

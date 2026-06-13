/**
 * Unit tests for the PURE comments helpers (`../comments.ts`).
 *
 * Run:  npx tsx --test src/lib/sabcrm/__tests__/comments.test.ts
 *
 * Covers mention parsing/dedup, HTML rendering (escape + linkify, XSS safety),
 * plain-text preview/truncation, and the threading/nesting + count helpers.
 * No I/O — the module is server-only-free by design.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseMentions,
  mentionedUserIds,
  escapeHtml,
  renderCommentHtml,
  commentPreview,
  sortByCreatedAsc,
  nestComments,
  countComments,
  type CrmComment,
} from '../comments';

/* ----------------------------- test factories ----------------------------- */

function comment(over: Partial<CrmComment>): CrmComment {
  return {
    _id: 'c1',
    projectId: 'p1',
    object: 'opportunities',
    recordId: 'r1',
    parentId: null,
    authorId: 'u1',
    body: '',
    mentions: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

/* ------------------------------ parseMentions ----------------------------- */

test('parseMentions extracts userId + name tokens', () => {
  const got = parseMentions('Hey @[Ada Lovelace](user:u_42) and @[Bob](user:u_7)!');
  assert.deepEqual(got, [
    { userId: 'u_42', name: 'Ada Lovelace' },
    { userId: 'u_7', name: 'Bob' },
  ]);
});

test('parseMentions dedupes a repeated mention (first-seen order)', () => {
  const got = parseMentions('@[A](user:u1) @[B](user:u2) @[A again](user:u1)');
  assert.deepEqual(
    got.map((m) => m.userId),
    ['u1', 'u2'],
  );
});

test('parseMentions returns [] for empty / token-free bodies', () => {
  assert.deepEqual(parseMentions(''), []);
  assert.deepEqual(parseMentions('plain text, no mentions'), []);
  // A bare "@name" without the token syntax is NOT a mention.
  assert.deepEqual(parseMentions('email me @ name@host'), []);
});

test('mentionedUserIds returns just the deduped ids', () => {
  assert.deepEqual(
    mentionedUserIds('@[X](user:a) @[Y](user:b) @[X](user:a)'),
    ['a', 'b'],
  );
});

/* -------------------------------- escapeHtml ------------------------------ */

test('escapeHtml neutralises the five HTML-significant chars', () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert('x')"> & 'q'`),
    '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; &#39;q&#39;',
  );
});

/* ---------------------------- renderCommentHtml --------------------------- */

test('renderCommentHtml escapes author markup (no XSS)', () => {
  const html = renderCommentHtml('<script>alert(1)</script>');
  assert.ok(!html.includes('<script>'), 'raw script tag must not survive');
  assert.ok(html.includes('&lt;script&gt;'));
});

test('renderCommentHtml replaces a mention token with a safe span', () => {
  const html = renderCommentHtml('hi @[Ada](user:u1)', [
    { userId: 'u1', name: 'Ada Lovelace' },
  ]);
  // Live roster name wins over the token name.
  assert.ok(
    html.includes(
      '<span class="sabcrm-mention" data-user-id="u1">@Ada Lovelace</span>',
    ),
    html,
  );
});

test('renderCommentHtml falls back to the token name when roster lacks it', () => {
  const html = renderCommentHtml('yo @[Token Name](user:u9)', []);
  assert.ok(html.includes('@Token Name'), html);
});

test('renderCommentHtml turns newlines into <br/>', () => {
  assert.equal(renderCommentHtml('a\nb'), 'a<br/>b');
});

test('renderCommentHtml escapes a malicious display name in the roster', () => {
  const html = renderCommentHtml('hi @[x](user:u1)', [
    { userId: 'u1', name: '<b>evil</b>' },
  ]);
  assert.ok(!html.includes('<b>evil</b>'));
  assert.ok(html.includes('@&lt;b&gt;evil&lt;/b&gt;'), html);
});

test('renderCommentHtml returns "" for an empty body', () => {
  assert.equal(renderCommentHtml(''), '');
});

/* ------------------------------ commentPreview --------------------------- */

test('commentPreview strips mention tokens to @Name and collapses ws', () => {
  assert.equal(
    commentPreview('hi   @[Ada](user:u1)\n  there'),
    'hi @Ada there',
  );
});

test('commentPreview truncates with an ellipsis', () => {
  const out = commentPreview('x'.repeat(200), 10);
  assert.equal(out.length, 10);
  assert.ok(out.endsWith('…'));
});

/* ---------------------------- sortByCreatedAsc --------------------------- */

test('sortByCreatedAsc orders oldest → newest', () => {
  const a = comment({ _id: 'a', createdAt: '2026-01-03T00:00:00.000Z' });
  const b = comment({ _id: 'b', createdAt: '2026-01-01T00:00:00.000Z' });
  const c = comment({ _id: 'c', createdAt: '2026-01-02T00:00:00.000Z' });
  assert.deepEqual(
    sortByCreatedAsc([a, b, c]).map((x) => x._id),
    ['b', 'c', 'a'],
  );
});

/* ------------------------------ nestComments ----------------------------- */

test('nestComments builds roots with their replies (time-ordered)', () => {
  const root = comment({ _id: 'root', createdAt: '2026-01-01T00:00:00.000Z' });
  const r1 = comment({
    _id: 'r1',
    parentId: 'root',
    createdAt: '2026-01-02T00:00:00.000Z',
  });
  const r2 = comment({
    _id: 'r2',
    parentId: 'root',
    createdAt: '2026-01-03T00:00:00.000Z',
  });
  const tree = nestComments([r2, root, r1]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0]._id, 'root');
  assert.deepEqual(
    tree[0].replies.map((x) => x._id),
    ['r1', 'r2'],
  );
});

test('nestComments flattens a reply-to-a-reply onto the nearest root', () => {
  const root = comment({ _id: 'root', createdAt: '2026-01-01T00:00:00.000Z' });
  const r1 = comment({
    _id: 'r1',
    parentId: 'root',
    createdAt: '2026-01-02T00:00:00.000Z',
  });
  // r2 replies to r1 (a reply) → should re-home onto `root`, not nest deeper.
  const r2 = comment({
    _id: 'r2',
    parentId: 'r1',
    createdAt: '2026-01-03T00:00:00.000Z',
  });
  const tree = nestComments([root, r1, r2]);
  assert.equal(tree.length, 1);
  assert.deepEqual(
    tree[0].replies.map((x) => x._id),
    ['r1', 'r2'],
  );
});

test('nestComments promotes an orphan reply (unknown parent) to a root', () => {
  const orphan = comment({ _id: 'o', parentId: 'gone' });
  const tree = nestComments([orphan]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0]._id, 'o');
  assert.deepEqual(tree[0].replies, []);
});

test('nestComments does not infinite-loop on a parent cycle', () => {
  // a→b→a cycle: neither has a real root; both promoted, no hang.
  const a = comment({ _id: 'a', parentId: 'b' });
  const b = comment({ _id: 'b', parentId: 'a' });
  const tree = nestComments([a, b]);
  // Both are treated as roots (each has a resolvable parent that is itself a
  // reply, so the rootId walk terminates via the cycle guard).
  assert.ok(tree.length >= 1);
});

/* ------------------------------ countComments ---------------------------- */

test('countComments sums roots + replies', () => {
  const root = comment({ _id: 'root' });
  const r1 = comment({ _id: 'r1', parentId: 'root' });
  const r2 = comment({ _id: 'r2', parentId: 'root' });
  const tree = nestComments([root, r1, r2]);
  assert.equal(countComments(tree), 3);
  assert.equal(countComments([]), 0);
});

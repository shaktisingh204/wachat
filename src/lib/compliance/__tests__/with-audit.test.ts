/**
 * Pure unit tests for `with-audit.ts`, `redact.ts` and `event-feed.ts`.
 *
 * Runs with Node's built-in `node:test` + `tsx` so no extra deps are
 * needed:
 *
 *   npx tsx --test src/lib/compliance/__tests__/with-audit.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
    __resetAuditEmitter,
    __setAuditEmitter,
    withAudit,
} from '../with-audit';
import {
    __resetAuditFeed,
    auditSubscriberCount,
    subscribeToAudit,
} from '../event-feed';
import { redactPii } from '../redact';
import type { AuditEvent } from '../types';
import type { AuditInput } from '../audit-log';

/* ── Helpers ────────────────────────────────────────────────────────── */

interface Recorder {
    rows: AuditInput[];
    install(): void;
    uninstall(): void;
}

function makeRecorder(): Recorder {
    const rows: AuditInput[] = [];
    const fake = async (input: AuditInput): Promise<AuditEvent> => {
        rows.push(input);
        return {
            ...input,
            id: `evt_${rows.length}`,
            ts: new Date().toISOString(),
            prev_hash: '0'.repeat(64),
            hash: 'a'.repeat(64),
        } as AuditEvent;
    };
    return {
        rows,
        install() {
            __setAuditEmitter(fake);
        },
        uninstall() {
            __resetAuditEmitter();
            __resetAuditFeed();
        },
    };
}

/* ── 1: Successful return ───────────────────────────────────────────── */

test('withAudit records a success row when the wrapped fn resolves', async () => {
    const rec = makeRecorder();
    rec.install();
    try {
        const action = withAudit(
            async (id: string, name: string) => ({ id, name }),
            {
                action: 'contact.create',
                resource: ({ args }) => `contacts/${args[0]}`,
                tenantId: 'tenant_42',
                actor: 'user:123',
                captureAfter: ({ result }) =>
                    result as Record<string, unknown>,
            },
        );

        const out = await action('c_1', 'Alice');
        assert.deepEqual(out, { id: 'c_1', name: 'Alice' });
        assert.equal(rec.rows.length, 1);
        const row = rec.rows[0];
        assert.equal(row.tenantId, 'tenant_42');
        assert.equal(row.actor, 'user:123');
        assert.equal(row.action, 'contact.create');
        assert.equal(row.resource, 'contacts/c_1');
        assert.deepEqual(row.after, { id: 'c_1', name: 'Alice' });
        assert.equal(
            (row.metadata as Record<string, unknown>).outcome,
            'success',
        );
    } finally {
        rec.uninstall();
    }
});

/* ── 2: Thrown error path ───────────────────────────────────────────── */

test('withAudit logs a failed-action row and rethrows by default', async () => {
    const rec = makeRecorder();
    rec.install();
    try {
        const action = withAudit(
            async () => {
                throw new Error('boom');
            },
            {
                action: 'contact.delete',
                resource: 'contacts/x',
                tenantId: 't1',
                actor: 'user:7',
            },
        );

        await assert.rejects(() => action(), /boom/);
        assert.equal(rec.rows.length, 1);
        const meta = rec.rows[0].metadata as Record<string, unknown>;
        assert.equal(meta.outcome, 'error');
        assert.equal(meta.error, 'boom');
        assert.equal(rec.rows[0].action, 'contact.delete');
    } finally {
        rec.uninstall();
    }
});

test('withAudit returns structured error envelope when rethrow=false', async () => {
    const rec = makeRecorder();
    rec.install();
    try {
        const action = withAudit(
            async () => {
                throw new Error('nope');
            },
            {
                action: 'x.y',
                resource: 'x',
                tenantId: 't',
                actor: 'a',
                rethrow: false,
            },
        );
        const result = (await action()) as { ok: false; error: string };
        assert.equal(result.ok, false);
        assert.equal(result.error, 'nope');
        assert.equal(rec.rows.length, 1);
    } finally {
        rec.uninstall();
    }
});

/* ── 3: PII redaction ───────────────────────────────────────────────── */

test('redactPii scrubs email/phone/credit_card and counts replacements', () => {
    const input = {
        user: 'alice@example.com',
        phone: '+14155552671',
        card: '4111 1111 1111 1111', // Luhn-valid Visa test number
        nested: { contact: 'bob@bob.io' },
        plain: 'no secrets here',
    };
    const { data, redactions } = redactPii(input);
    assert.ok(redactions >= 3, `expected >=3 redactions, got ${redactions}`);
    assert.notEqual(data.user, input.user);
    assert.ok(!String(data.user).includes('alice'));
    assert.ok(!String(data.card).includes('4111 1111 1111 1111'));
    assert.equal(
        (data.nested as { contact: string }).contact.includes('bob@bob.io'),
        false,
    );
    assert.equal(data.plain, 'no secrets here');
});

test('withAudit redacts PII in before/after snapshots before persisting', async () => {
    const rec = makeRecorder();
    rec.install();
    try {
        const action = withAudit(
            async (_id: string) => ({
                id: 'c_1',
                email: 'alice@example.com',
            }),
            {
                action: 'contact.update',
                resource: 'contacts/c_1',
                tenantId: 't',
                actor: 'a',
                captureBefore: () => ({ email: 'old@example.com' }),
                captureAfter: ({ result }) =>
                    result as Record<string, unknown>,
            },
        );

        await action('c_1');
        assert.equal(rec.rows.length, 1);
        const row = rec.rows[0];
        const before = row.before as Record<string, unknown>;
        const after = row.after as Record<string, unknown>;
        assert.ok(!JSON.stringify(before).includes('old@example.com'));
        assert.ok(!JSON.stringify(after).includes('alice@example.com'));
    } finally {
        rec.uninstall();
    }
});

/* ── 4: Subscriber feed ─────────────────────────────────────────────── */

test('subscribeToAudit receives every emitted event and unsubscribe stops it', async () => {
    const rec = makeRecorder();
    rec.install();
    try {
        const seen: AuditEvent[] = [];
        const unsub = subscribeToAudit((e) => {
            seen.push(e);
        });
        assert.equal(auditSubscriberCount(), 1);

        const action = withAudit(async () => 'ok', {
            action: 'noop',
            resource: 'r',
            tenantId: 't',
            actor: 'a',
        });
        await action();
        assert.equal(seen.length, 1);

        unsub();
        assert.equal(auditSubscriberCount(), 0);
        await action();
        assert.equal(seen.length, 1, 'no events after unsubscribe');
    } finally {
        rec.uninstall();
    }
});

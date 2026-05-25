 * Re-declared here to avoid importing a `'use client'` TSX module under
/**
 * Smoke test for the CRM canonical sales chain lineage rail
 * (Lead → Deal → Quote → SO → DC → Inv → Receipt).
 *
 * The §1D contract is that every chain-doc page renders a `<LineageRail>`
 * sourced from the doc's persisted `lineage` array. For the rail to
 * surface a complete chain, each child create-action must:
 *
 *   1. Read `(fromKind, fromId)` from the caller (form / query params).
 *   2. Look up the parent doc.
 *   3. Stamp the new doc's `lineage` field with
 *      `buildLineageFromParent({ kind, id, no, status, lineage })`
 *      so it carries the parent's full ancestry + the parent itself.
 *   4. Best-effort append a back-ref onto the parent (`appendLineage`).
 *
 * This file does NOT spin up Mongo. Instead it:
 *
 *   - Exercises the shared `buildLineageFromParent` / `appendLineage`
 *     helpers (`src/lib/lineage.ts`) end-to-end across all six edges.
 *     Every chain action that ships a lineage stamp delegates to these
 *     helpers, so a green test here proves the contract holds for any
 *     edge that consumes them.
 *   - Snapshots the action-file source for each child kind and asserts
 *     it actually imports/uses the helper. This catches actions that
 *     silently skip the stamp (e.g. delivery-challan).
 *
 * Run with:  npx tsx --test src/lib/__tests__/crm-lineage-chain.smoke.test.ts
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { appendLineage, buildLineageFromParent } from '../lineage';
import type { LineageKind, LineageRef } from '../definitions';

/**
 * Mirror of `SALES_CHAIN` from `src/components/crm/lineage-rail.tsx`.
 * `tsx --test` (which would drag in Next.js + JSX runtime). The chain
 * test below asserts these two stay aligned.
 */
const SALES_CHAIN: LineageKind[] = [
    'lead',
    'deal',
    'quotation',
    'salesOrder',
    'deliveryChallan',
    'invoice',
    'paymentReceipt',
];

/* ─── Helpers ─────────────────────────────────────────────────────── */

interface ChainDoc {
    kind: LineageKind;
    id: string;
    no: string;
    status: string;
    lineage?: LineageRef[];
}

/**
 * Simulates an action's "create child from parent" code path using the
 * shared helpers. Returns the lineage array that would be persisted on
 * the child and the back-ref that would be appended to the parent.
 */
function convertChild(parent: ChainDoc, child: ChainDoc): {
    childLineage: LineageRef[];
    parentLineageAfter: LineageRef[];
} {
    const childLineage = buildLineageFromParent({
        kind: parent.kind,
        id: parent.id,
        no: parent.no,
        status: parent.status,
        lineage: parent.lineage,
    });
    const parentLineageAfter = appendLineage(parent.lineage, {
        kind: child.kind,
        id: child.id,
        no: child.no,
        status: child.status,
        createdAt: new Date().toISOString(),
    });
    return { childLineage, parentLineageAfter };
}

/** Pretty-printable edge tag for assertion messages. */
function edge(from: LineageKind, to: LineageKind): string {
    return `${from} → ${to}`;
}

const ACTIONS_DIR = resolve(
    import.meta.dirname ?? new URL('.', import.meta.url).pathname,
    '../../app/actions',
);

function actionSource(file: string): string {
    return readFileSync(resolve(ACTIONS_DIR, file), 'utf8');
}

/**
 * Each chain child must (a) import the lineage helper and (b) wire it
 * into its create path. This catches actions that drop the stamp.
 */
function assertActionUsesLineageHelper(file: string, edgeLabel: string): void {
    const src = actionSource(file);
    assert.match(
        src,
        /from\s+['"]@\/lib\/lineage['"]/,
        `${edgeLabel}: ${file} does not import from @/lib/lineage — lineage stamp missing`,
    );
    assert.match(
        src,
        /buildLineageFromParent\s*\(/,
        `${edgeLabel}: ${file} never calls buildLineageFromParent() — lineage stamp missing`,
    );
}

/* ─── Pure-helper sanity tests ────────────────────────────────────── */

test('helper: buildLineageFromParent appends parent ref to existing lineage', () => {
    const grandparent: LineageRef = { kind: 'lead', id: 'l1', no: 'LEAD-001' };
    const out = buildLineageFromParent({
        kind: 'deal',
        id: 'd1',
        no: 'DEAL-001',
        lineage: [grandparent],
    });
    assert.equal(out.length, 2, 'parent + grandparent expected');
    assert.deepEqual(
        out.map((r) => r.kind),
        ['lead', 'deal'],
        'order: ancestors-first, parent last',
    );
});

test('helper: appendLineage dedupes by (kind, id)', () => {
    const a: LineageRef = { kind: 'lead', id: 'l1' };
    const b: LineageRef = { kind: 'lead', id: 'l1', no: 'duplicate' };
    const out = appendLineage([a], b);
    assert.equal(out.length, 1);
});

/* ─── Walk every edge of the canonical sales chain ───────────────── */

test('chain: local SALES_CHAIN mirror matches lineage-rail.tsx source', () => {
    // Re-extract the canonical chain from the component source so the
    // test fails loudly if the rail's chain ever drifts from our copy.
    const railSrc = readFileSync(
        resolve(ACTIONS_DIR, '../../components/crm/lineage-rail.tsx'),
        'utf8',
    );
    const match = railSrc.match(
        /SALES_CHAIN\s*:\s*LineageKind\[\]\s*=\s*\[([\s\S]*?)\];/,
    );
    assert.ok(match, 'SALES_CHAIN declaration not found in lineage-rail.tsx');
    const railChain = match![1]
        .split(',')
        .map((s) => s.replace(/['"\s]/g, ''))
        .filter(Boolean);
    assert.deepEqual(railChain, SALES_CHAIN);
});

test('edge[lead→deal]: child lineage carries lead', () => {
    const lead: ChainDoc = { kind: 'lead', id: 'l1', no: 'LEAD-001', status: 'new' };
    const deal: ChainDoc = { kind: 'deal', id: 'd1', no: 'DEAL-001', status: 'open' };
    const { childLineage } = convertChild(lead, deal);

    assert.equal(childLineage.length, 1, edge('lead', 'deal'));
    assert.equal(childLineage[0].kind, 'lead');
    assert.equal(childLineage[0].id, 'l1');
    assertActionUsesLineageHelper('crm-deals.actions.ts', edge('lead', 'deal'));
});

test('edge[deal→quotation]: child lineage carries lead + deal', () => {
    const lead: ChainDoc = { kind: 'lead', id: 'l1', no: 'LEAD-001', status: 'new' };
    const deal: ChainDoc = {
        kind: 'deal',
        id: 'd1',
        no: 'DEAL-001',
        status: 'open',
        lineage: buildLineageFromParent({
            kind: 'lead',
            id: lead.id,
            no: lead.no,
            lineage: lead.lineage,
        }),
    };
    const quote: ChainDoc = { kind: 'quotation', id: 'q1', no: 'Q-001', status: 'draft' };
    const { childLineage } = convertChild(deal, quote);

    assert.deepEqual(
        childLineage.map((r) => r.kind),
        ['lead', 'deal'],
        edge('deal', 'quotation'),
    );
    assertActionUsesLineageHelper('crm-quotations.actions.ts', edge('deal', 'quotation'));
});

test('edge[quotation→salesOrder]: child lineage carries lead + deal + quote', () => {
    const lead: ChainDoc = { kind: 'lead', id: 'l1', no: 'LEAD-001', status: 'new' };
    const deal: ChainDoc = {
        kind: 'deal',
        id: 'd1',
        no: 'DEAL-001',
        status: 'open',
        lineage: buildLineageFromParent({ kind: 'lead', id: lead.id, no: lead.no }),
    };
    const quote: ChainDoc = {
        kind: 'quotation',
        id: 'q1',
        no: 'Q-001',
        status: 'sent',
        lineage: buildLineageFromParent({
            kind: 'deal',
            id: deal.id,
            no: deal.no,
            lineage: deal.lineage,
        }),
    };
    const so: ChainDoc = { kind: 'salesOrder', id: 'so1', no: 'SO-001', status: 'open' };
    const { childLineage } = convertChild(quote, so);

    assert.deepEqual(
        childLineage.map((r) => r.kind),
        ['lead', 'deal', 'quotation'],
        edge('quotation', 'salesOrder'),
    );
    assertActionUsesLineageHelper('crm-sales-orders.actions.ts', edge('quotation', 'salesOrder'));
});

test('edge[salesOrder→deliveryChallan]: child lineage carries lead + deal + quote + so', () => {
    // Synthesize an SO with full lineage prefix.
    const soLineage = buildLineageFromParent({
        kind: 'quotation',
        id: 'q1',
        no: 'Q-001',
        lineage: buildLineageFromParent({
            kind: 'deal',
            id: 'd1',
            no: 'DEAL-001',
            lineage: buildLineageFromParent({ kind: 'lead', id: 'l1', no: 'LEAD-001' }),
        }),
    });
    const so: ChainDoc = {
        kind: 'salesOrder',
        id: 'so1',
        no: 'SO-001',
        status: 'open',
        lineage: soLineage,
    };
    const dc: ChainDoc = {
        kind: 'deliveryChallan',
        id: 'dc1',
        no: 'DC-001',
        status: 'Draft',
    };
    const { childLineage } = convertChild(so, dc);

    // Helper-level chain is fine — the chain semantics must hold.
    assert.deepEqual(
        childLineage.map((r) => r.kind),
        ['lead', 'deal', 'quotation', 'salesOrder'],
        `${edge('salesOrder', 'deliveryChallan')} (helper)`,
    );

    // Unlike the other chain edges, the DC action delegates lineage
    // seeding to the Rust handler (`crm-delivery-challans` crate,
    // `seed_lineage_from_parent`). The TS action no longer needs to
    // call `buildLineageFromParent` on the Rust path — instead it
    // forwards `fromKind` + `fromId` to the Rust client. Assert that
    // contract here so a future refactor can't silently drop the
    // forwarding.
    const dcSrc = actionSource('crm-delivery-challans.actions.ts');
    assert.match(
        dcSrc,
        /crmDeliveryChallansApi\.create\s*\(/,
        `${edge('salesOrder', 'deliveryChallan')}: action does not call crmDeliveryChallansApi.create — Rust create path missing`,
    );
    assert.match(
        dcSrc,
        /fromKind/,
        `${edge('salesOrder', 'deliveryChallan')}: action does not forward fromKind — Rust lineage seed disabled`,
    );
    assert.match(
        dcSrc,
        /fromId/,
        `${edge('salesOrder', 'deliveryChallan')}: action does not forward fromId — Rust lineage seed disabled`,
    );
});

test('edge[salesOrder→invoice]: child lineage carries lead + deal + quote + so', () => {
    const soLineage = buildLineageFromParent({
        kind: 'quotation',
        id: 'q1',
        no: 'Q-001',
        lineage: buildLineageFromParent({
            kind: 'deal',
            id: 'd1',
            no: 'DEAL-001',
            lineage: buildLineageFromParent({ kind: 'lead', id: 'l1', no: 'LEAD-001' }),
        }),
    });
    const so: ChainDoc = {
        kind: 'salesOrder',
        id: 'so1',
        no: 'SO-001',
        status: 'open',
        lineage: soLineage,
    };
    const inv: ChainDoc = { kind: 'invoice', id: 'inv1', no: 'INV-001', status: 'draft' };
    const { childLineage } = convertChild(so, inv);

    assert.deepEqual(
        childLineage.map((r) => r.kind),
        ['lead', 'deal', 'quotation', 'salesOrder'],
        edge('salesOrder', 'invoice'),
    );
    assertActionUsesLineageHelper('crm-invoices.actions.ts', edge('salesOrder', 'invoice'));
});

test('edge[invoice→paymentReceipt]: child lineage carries lead + deal + quote + so + invoice', () => {
    const invLineage = buildLineageFromParent({
        kind: 'salesOrder',
        id: 'so1',
        no: 'SO-001',
        lineage: buildLineageFromParent({
            kind: 'quotation',
            id: 'q1',
            no: 'Q-001',
            lineage: buildLineageFromParent({
                kind: 'deal',
                id: 'd1',
                no: 'DEAL-001',
                lineage: buildLineageFromParent({ kind: 'lead', id: 'l1', no: 'LEAD-001' }),
            }),
        }),
    });
    const inv: ChainDoc = {
        kind: 'invoice',
        id: 'inv1',
        no: 'INV-001',
        status: 'sent',
        lineage: invLineage,
    };
    const receipt: ChainDoc = {
        kind: 'paymentReceipt',
        id: 'r1',
        no: 'PR-001',
        status: 'completed',
    };
    const { childLineage } = convertChild(inv, receipt);

    assert.deepEqual(
        childLineage.map((r) => r.kind),
        ['lead', 'deal', 'quotation', 'salesOrder', 'invoice'],
        edge('invoice', 'paymentReceipt'),
    );
    assertActionUsesLineageHelper(
        'crm-payment-receipts.actions.ts',
        edge('invoice', 'paymentReceipt'),
    );
});

/* ─── Back-ref correctness on parents ─────────────────────────────── */

test('back-ref: parent gets child ref appended after conversion', () => {
    const lead: ChainDoc = { kind: 'lead', id: 'l1', no: 'LEAD-001', status: 'new' };
    const deal: ChainDoc = { kind: 'deal', id: 'd1', no: 'DEAL-001', status: 'open' };
    const { parentLineageAfter } = convertChild(lead, deal);
    assert.equal(parentLineageAfter.length, 1);
    assert.equal(parentLineageAfter[0].kind, 'deal');
    assert.equal(parentLineageAfter[0].id, 'd1');
});

test('full-chain reconstruction: rail can render every step', () => {
    // Walk Lead→…→Receipt and feed each doc's lineage to the rail's
    // kind→ref map. Every chain kind must be reachable from the receipt.
    const lead: ChainDoc = { kind: 'lead', id: 'l1', no: 'LEAD-001', status: 'new' };
    const dealLineage = buildLineageFromParent(lead);
    const deal: ChainDoc = { kind: 'deal', id: 'd1', no: 'DEAL-001', status: 'open', lineage: dealLineage };
    const quoteLineage = buildLineageFromParent(deal);
    const quote: ChainDoc = { kind: 'quotation', id: 'q1', no: 'Q-001', status: 'sent', lineage: quoteLineage };
    const soLineage = buildLineageFromParent(quote);
    const so: ChainDoc = { kind: 'salesOrder', id: 'so1', no: 'SO-001', status: 'open', lineage: soLineage };
    const invLineage = buildLineageFromParent(so);
    const inv: ChainDoc = { kind: 'invoice', id: 'inv1', no: 'INV-001', status: 'sent', lineage: invLineage };
    const receiptLineage = buildLineageFromParent(inv);

    const seen = new Set<LineageKind>(receiptLineage.map((r) => r.kind));
    seen.add('paymentReceipt'); // current doc is implicitly visible
    for (const kind of SALES_CHAIN) {
        // deliveryChallan is allowed to be absent from receipt's lineage
        // (DC is a side-branch off SO, not a parent of the invoice).
        if (kind === 'deliveryChallan') continue;
        assert.ok(seen.has(kind), `rail step "${kind}" not reachable from receipt lineage`);
    }
});

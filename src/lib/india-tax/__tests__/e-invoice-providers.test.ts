/**
 * Unit tests for `src/lib/india-tax/e-invoice-providers.ts`.
 *
 *   npx tsx --test src/lib/india-tax/__tests__/e-invoice-providers.test.ts
 *
 * Covers (§6.10):
 *   • InternalProvider is deterministic — same (invoiceId, gstin) →
 *     same IRN, ackNo, and QR payload.
 *   • NicProvider.generate throws "not configured. Set NIC_IRP_CLIENT_ID."
 *   • CleartaxProvider.generate throws "not configured. Set CLEARTAX_API_TOKEN."
 *   • MastersIndiaProvider.generate throws "not configured. Set MASTERS_INDIA_CLIENT_ID."
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
    CleartaxProvider,
    InternalProvider,
    MastersIndiaProvider,
    NicProvider,
    getEInvoiceProvider,
    type EInvoiceRequest,
} from '../e-invoice-providers';

const sampleInvoice = (): EInvoiceRequest => ({
    invoiceId: '662a000000000000000000aa',
    sellerGstin: '29AAAAA0000A1Z5',
    buyerGstin: '29BBBBB0000B1Z3',
    invoiceNumber: 'INV-001',
    invoiceDate: '2026-05-01',
    totalValue: 11800,
    currency: 'INR',
});

test('InternalProvider.generate is deterministic + populates required fields', async () => {
    const inv = sampleInvoice();
    const a = await InternalProvider.generate(inv, null);
    const b = await InternalProvider.generate(inv, null);

    assert.equal(a.status, 'success');
    assert.equal(a.irn, b.irn, 'IRN must be deterministic per (invoiceId, gstin)');
    assert.equal(a.ackNo, b.ackNo, 'ackNo must be deterministic per IRN');
    assert.match(a.irn, /^MOCK-[0-9a-f]{16}$/);
    assert.equal(a.ackNo.length, 14);
    assert.match(a.ackNo, /^\d{14}$/);

    // QR payload decodes to JSON with our marker fields.
    const qr = JSON.parse(Buffer.from(a.qrCodeData, 'base64').toString('utf8'));
    assert.equal(qr.irn, a.irn);
    assert.equal(qr.gstin, inv.sellerGstin);
    assert.equal(qr.total, inv.totalValue);
    assert.equal(qr.signed, false);

    // Different invoice id → different IRN.
    const other = await InternalProvider.generate(
        { ...inv, invoiceId: '662a000000000000000000bb' },
        null,
    );
    assert.notEqual(other.irn, a.irn);

    // getEInvoiceProvider with no id and unknown id both fall back to internal.
    assert.equal(getEInvoiceProvider().id, 'internal');
    assert.equal(getEInvoiceProvider('does-not-exist').id, 'internal');
    assert.equal(getEInvoiceProvider('nic').id, 'nic');
});

test('NicProvider.generate throws with NIC_IRP_CLIENT_ID marker', async () => {
    await assert.rejects(
        () => NicProvider.generate(sampleInvoice(), null),
        (err: Error) =>
            /NIC IRP/.test(err.message) && /NIC_IRP_CLIENT_ID/.test(err.message),
    );
});

test('CleartaxProvider.generate throws with CLEARTAX_API_TOKEN marker', async () => {
    await assert.rejects(
        () => CleartaxProvider.generate(sampleInvoice(), null),
        (err: Error) =>
            /Cleartax/.test(err.message) && /CLEARTAX_API_TOKEN/.test(err.message),
    );
});

test('MastersIndiaProvider.generate throws with MASTERS_INDIA_CLIENT_ID marker', async () => {
    await assert.rejects(
        () => MastersIndiaProvider.generate(sampleInvoice(), null),
        (err: Error) =>
            /Masters India/.test(err.message) &&
            /MASTERS_INDIA_CLIENT_ID/.test(err.message),
    );
});

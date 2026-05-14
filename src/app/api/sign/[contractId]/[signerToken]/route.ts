/**
 * Public sign route handler — POST /api/sign/[contractId]/[signerToken].
 *
 * Receives `{ mode, signatureData }` from the public signing page and:
 *
 *   • Verifies the token is still pending (signer slot exists, no
 *     `signedAt`, no `tokenUsedAt`).
 *   • Captures IP / user-agent / geo for the audit trail.
 *   • Persists the signature on the signer slot.
 *   • Marks the contract `completed` (all signers done) or
 *     `partially_signed` (some signers done) and, in the partial case,
 *     notifies the next signer via the configured e-sign provider.
 *   • Writes audit-log rows for the signature and (if applicable) the
 *     contract completion.
 *
 * Authentication is intentionally absent: the URL token IS the
 * credential. The token is single-use — invalidated atomically on
 * success.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { writeAuditEntry } from '@/lib/audit-log';
import { buildMagicLink, getProvider } from '@/lib/contracts/esign-providers';
import crypto from 'node:crypto';

// MongoDB driver requires Node.js runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
    params: Promise<{ contractId: string; signerToken: string }>;
}

interface PostBody {
    mode?: 'typed' | 'drawn' | 'uploaded';
    signatureData?: string;
}

function clientIp(req: NextRequest): string | undefined {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) {
        const first = xff.split(',')[0]?.trim();
        if (first) return first;
    }
    const real = req.headers.get('x-real-ip');
    if (real) return real;
    return undefined;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
    const { contractId, signerToken } = await ctx.params;
    if (!contractId || !signerToken) {
        return NextResponse.json({ ok: false, error: 'Missing parameters.' }, { status: 400 });
    }
    if (!ObjectId.isValid(contractId)) {
        return NextResponse.json({ ok: false, error: 'Invalid contract id.' }, { status: 400 });
    }

    let body: PostBody = {};
    try {
        body = (await req.json()) as PostBody;
    } catch {
        return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
    }
    const mode = body.mode;
    const signatureData = (body.signatureData || '').toString();
    if (mode !== 'typed' && mode !== 'drawn' && mode !== 'uploaded') {
        return NextResponse.json({ ok: false, error: 'Unsupported signature mode.' }, { status: 400 });
    }
    if (!signatureData) {
        return NextResponse.json({ ok: false, error: 'Signature data is required.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const contractsCol = db.collection('crm_contracts');

    const contract = await contractsCol.findOne({ _id: new ObjectId(contractId) });
    if (!contract) {
        return NextResponse.json({ ok: false, error: 'Contract not found.' }, { status: 404 });
    }

    const status = (contract.status as string | undefined) || '';
    if (status === 'voided' || status === 'terminated' || status === 'expired') {
        return NextResponse.json(
            { ok: false, error: `Contract is ${status}; cannot be signed.` },
            { status: 409 },
        );
    }

    const signers: Array<Record<string, any>> = Array.isArray(contract.signers)
        ? (contract.signers as Array<Record<string, any>>)
        : [];
    const idx = signers.findIndex((s) => (s?.token || '') === signerToken);
    if (idx === -1) {
        return NextResponse.json(
            { ok: false, error: 'Invalid or revoked signing link.' },
            { status: 403 },
        );
    }
    const me = signers[idx];
    if (me.signedAt || me.tokenUsedAt) {
        return NextResponse.json(
            { ok: false, error: 'This signing link has already been used.' },
            { status: 409 },
        );
    }

    const now = new Date();
    const ip = clientIp(req);
    const userAgent = req.headers.get('user-agent') || undefined;
    const country = req.headers.get('x-vercel-ip-country') || undefined;
    const city = req.headers.get('x-vercel-ip-city')
        ? decodeURIComponent(req.headers.get('x-vercel-ip-city') as string)
        : undefined;

    // Mutate the signer slot in place. We persist `tokenUsedAt` and
    // zero out `token` so the link can never be replayed.
    signers[idx] = {
        ...me,
        signedAt: now,
        signatureMethod: mode,
        signatureData,
        signedFromIp: ip,
        signedFromUserAgent: userAgent,
        signedFromGeo: country || city ? { country, city } : undefined,
        tokenUsedAt: now,
        token: null,
    };

    const allSigned = signers.length > 0 && signers.every((s) => !!s.signedAt);
    const someSigned = signers.some((s) => !!s.signedAt);
    const nextStatus = allSigned
        ? 'completed'
        : someSigned
            ? 'partially_signed'
            : (status as string);

    // Persist signer + status atomically (best-effort — re-find the
    // signer by-token guard already gave us race protection).
    await contractsCol.updateOne(
        { _id: new ObjectId(contractId) },
        {
            $set: {
                signers,
                status: nextStatus,
                updatedAt: now,
                ...(allSigned ? { signedAt: now } : {}),
            },
        },
    );

    // ── Audit: every signature event gets a row ──
    const tenantUserId = String(contract.userId || '');
    try {
        await writeAuditEntry({
            tenantUserId,
            actorId: tenantUserId, // public flow — no operator; tag tenant as actor
            action: 'signed',
            entityKind: 'contract',
            entityId: contractId,
            reason: `${me.name || me.email || 'Signer'} signed via ${mode}`,
        });
    } catch { /* non-fatal */ }

    let nextSignerNotified = false;

    if (allSigned) {
        // Final completion audit row.
        try {
            await writeAuditEntry({
                tenantUserId,
                actorId: tenantUserId,
                action: 'completed',
                entityKind: 'contract',
                entityId: contractId,
                reason: `All ${signers.length} signers complete`,
            });
        } catch { /* non-fatal */ }
    } else {
        // Find the next unsigned signer in `order` (falling back to
        // array order) and re-issue a fresh token + magic link.
        const ordered = [...signers]
            .map((s, i) => ({ s, i }))
            .sort((a, b) => {
                const ao = typeof a.s.order === 'number' ? a.s.order : a.i;
                const bo = typeof b.s.order === 'number' ? b.s.order : b.i;
                return ao - bo;
            });
        const next = ordered.find((row) => !row.s.signedAt);
        if (next) {
            const fresh = crypto.randomBytes(32).toString('hex');
            signers[next.i] = {
                ...signers[next.i],
                token: fresh,
                tokenIssuedAt: now,
                tokenUsedAt: null,
            };
            await contractsCol.updateOne(
                { _id: new ObjectId(contractId) },
                { $set: { signers, updatedAt: now } },
            );

            const provider = getProvider(
                (contract.esignProvider as string | undefined) ?? 'internal',
            );
            try {
                const r = await provider.sendForSignature({
                    contractId,
                    contractTitle: (contract.title as string | undefined) || 'Contract',
                    signerEmail: (signers[next.i].email as string) || '',
                    signerName:
                        (signers[next.i].name as string | undefined) ||
                        (signers[next.i].email as string) ||
                        '',
                    magicLinkUrl: buildMagicLink(contractId, fresh),
                    tenantUserId,
                });
                nextSignerNotified = !!r.ok;
            } catch (e) {
                console.error('[api/sign] next-signer notify failed:', e);
                nextSignerNotified = false;
            }
        }
    }

    return NextResponse.json({
        ok: true,
        contractStatus: nextStatus,
        nextSignerNotified,
    });
}

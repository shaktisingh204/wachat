'use server';

/**
 * §6.2 Contract e-signature actions.
 *
 * This module owns the *new* HMAC-token signature flow:
 *
 *   • `requestContractSignature` — sender-side gated action. Mints an
 *     HMAC token for one signer and returns the public signing URL.
 *     Callers (the email/WhatsApp sender flow) drop that URL into the
 *     outbound message.
 *
 *   • `getContractByToken` — public lookup used by the
 *     `/sign/[contractId]/[signerToken]` route. Validates the token
 *     (HMAC OR legacy opaque token), returns a *redacted* contract
 *     suitable for showing to the signer.
 *
 *   • `submitContractSignature` — public submission. Appends to
 *     `signers[]` (or fills the matching slot), stamps
 *     ip/geo/ua/signedAt/mode, advances `status` to
 *     `partially_signed` / `fully_signed` when applicable. Idempotent
 *     by token — calling twice with the same token returns the same
 *     `{ ok, status, alreadySigned: true }` result.
 *
 * Audit: every successful submission writes a `signed` audit row.
 *
 * IP / UA / geo come from the Next.js async request-headers API.
 * GeoIP enrichment beyond the request-header pass-through is left to
 * an ops follow-up (see TODO marker below).
 */

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import {
    buildMagicLink,
} from '@/lib/contracts/esign-providers';
import {
    issueSignerToken,
    looksLikeSignerToken,
    verifySignerToken,
} from '@/lib/contracts/signer-tokens';

// ──────────────────────────────────────────────────────────────────
// Public-facing types
// ──────────────────────────────────────────────────────────────────

export type SignatureMode = 'typed' | 'drawn' | 'uploaded';

export type SignatureStatus =
    | 'draft'
    | 'sent'
    | 'partially_signed'
    | 'fully_signed'
    | 'expired'
    | 'voided'
    | 'terminated';

export interface RedactedSigner {
    name?: string;
    email?: string;
    role?: string;
    order?: number;
    signedAt?: string;
    signatureMethod?: SignatureMode | string;
}

export interface RedactedContract {
    _id: string;
    title?: string;
    type?: string;
    body?: string;
    notes?: string;
    status?: string;
    partyName?: string;
    effectiveDate?: string;
    expiryDate?: string;
    value?: number;
    currency?: string;
    signers: RedactedSigner[];
    /** Index of the signer whose token we matched on. */
    signerIndex: number;
}

export interface GetByTokenResult {
    ok: boolean;
    contract?: RedactedContract;
    error?: string;
    code?: 'not_found' | 'invalid_token' | 'already_signed' | 'voided' | 'expired';
}

export interface SubmitArgs {
    mode: SignatureMode;
    /** Typed name, drawn data URL, or SabFiles node id. */
    value: string;
    signerName: string;
    signerEmail?: string;
}

export interface SubmitResult {
    ok: boolean;
    status?: SignatureStatus | string;
    alreadySigned?: boolean;
    nextSignerEmail?: string;
    error?: string;
}

export interface RequestResult {
    ok: boolean;
    signUrl?: string;
    token?: string;
    error?: string;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

export interface SignerDoc {
    name?: string;
    email?: string;
    role?: string;
    order?: number;
    token?: string | null;
    tokenIssuedAt?: Date | string;
    tokenUsedAt?: Date | string | null;
    signedAt?: Date | string;
    signatureMethod?: string;
    signatureData?: string;
    signedFromIp?: string;
    signedFromUserAgent?: string;
    signedFromGeo?: { country?: string; city?: string };
}

export interface ContractDoc {
    _id: ObjectId;
    userId?: ObjectId;
    title?: string;
    type?: string;
    body?: string;
    notes?: string;
    status?: string;
    partyName?: string;
    effectiveDate?: Date;
    expiryDate?: Date;
    value?: number;
    currency?: string;
    signers?: SignerDoc[];
    esignProvider?: string;
}

function toDateString(d?: Date | string): string | undefined {
    if (!d) return undefined;
    const v = d instanceof Date ? d : new Date(d);
    return Number.isNaN(v.getTime()) ? undefined : v.toISOString();
}

function redactContract(c: ContractDoc, signerIndex: number): RedactedContract {
    const signers: RedactedSigner[] = (c.signers ?? []).map((s) => ({
        name: s.name,
        email: s.email,
        role: s.role,
        order: s.order,
        signedAt: toDateString(s.signedAt),
        signatureMethod: s.signatureMethod,
    }));
    return {
        _id: c._id.toString(),
        title: c.title,
        type: c.type,
        body: c.body,
        notes: c.notes,
        status: c.status,
        partyName: c.partyName,
        effectiveDate: toDateString(c.effectiveDate),
        expiryDate: toDateString(c.expiryDate),
        value: c.value,
        currency: c.currency,
        signers,
        signerIndex,
    };
}

/** Resolve `{ ip, ua, geo }` from request headers. */
async function readRequestContext(): Promise<{
    ip?: string;
    ua?: string;
    geo?: { country?: string; city?: string };
}> {
    const h = await headers();
    const xff = h.get('x-forwarded-for') || '';
    const ip =
        xff.split(',')[0]?.trim() ||
        h.get('x-real-ip') ||
        undefined;
    const ua = h.get('user-agent') || undefined;
    const country = h.get('x-vercel-ip-country') || undefined;
    const cityRaw = h.get('x-vercel-ip-city');
    const city = cityRaw ? safeDecode(cityRaw) : undefined;
    // TODO(ops): enrich `geo` via a MaxMind / Vercel Edge lookup in a
    // background job. For now we only persist the request-time hints.
    const geo = country || city ? { country: country ?? undefined, city } : undefined;
    return { ip: ip ?? undefined, ua, geo };
}

function safeDecode(s: string): string | undefined {
    try {
        return decodeURIComponent(s);
    } catch {
        return s;
    }
}

/**
 * Locate the signer index for an arbitrary token. Accepts both the
 * new HMAC tokens (verified by `verifySignerToken`) and the legacy
 * opaque tokens stored on `signers[].token`.
 */
function resolveSignerIndex(
    contract: ContractDoc,
    contractId: string,
    token: string,
): { idx: number; email?: string } | null {
    const signers = contract.signers ?? [];
    // 1) HMAC path
    if (looksLikeSignerToken(token)) {
        const v = verifySignerToken(token, { contractId });
        if (v.valid && v.signerEmail) {
            const idx = signers.findIndex(
                (s) => (s.email || '').toLowerCase() === v.signerEmail,
            );
            if (idx !== -1) return { idx, email: v.signerEmail };
            return null;
        }
        return null;
    }
    // 2) Opaque token path (legacy / existing `sendContractForSignature`)
    const idx = signers.findIndex((s) => (s.token || '') === token);
    if (idx === -1) return null;
    return { idx, email: signers[idx].email };
}

// ──────────────────────────────────────────────────────────────────
// Sender-side: mint a token + return the sign URL.
// ──────────────────────────────────────────────────────────────────

export async function requestContractSignature(
    contractId: string,
    signerEmail: string,
    signerName: string,
): Promise<RequestResult> {
    if (!contractId || !ObjectId.isValid(contractId)) {
        return { ok: false, error: 'Invalid contract id.' };
    }
    const email = (signerEmail || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
        return { ok: false, error: 'A valid signer email is required.' };
    }
    const name = (signerName || '').trim() || email;

    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_contract', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const tenantUserId = String(session.user._id);
        const contract = await db.collection('crm_contracts').findOne({
            _id: new ObjectId(contractId),
            userId: new ObjectId(tenantUserId),
        });
        if (!contract) return { ok: false, error: 'Contract not found.' };

        const token = issueSignerToken({
            contractId,
            signerEmail: email,
            tenantUserId,
        });
        const now = new Date();
        const signers: SignerDoc[] = Array.isArray(contract.signers)
            ? (contract.signers as SignerDoc[])
            : [];
        const idx = signers.findIndex(
            (s) => (s.email || '').toLowerCase() === email,
        );
        const signerSlot: SignerDoc = {
            ...(idx >= 0 ? signers[idx] : {}),
            email,
            name: signers[idx]?.name || name,
            role: signers[idx]?.role,
            order: signers[idx]?.order ?? (idx >= 0 ? idx : signers.length),
            // Mirror the legacy token field so the existing API route
            // continues to resolve this signer when needed.
            token,
            tokenIssuedAt: now,
            tokenUsedAt: null,
        };
        if (idx >= 0) signers[idx] = signerSlot;
        else signers.push(signerSlot);

        await db.collection('crm_contracts').updateOne(
            { _id: new ObjectId(contractId) },
            {
                $set: {
                    signers,
                    status: contract.status === 'draft' ? 'sent' : contract.status,
                    updatedAt: now,
                },
            },
        );

        try {
            await writeAuditEntry({
                tenantUserId,
                actorId: tenantUserId,
                action: 'send',
                entityKind: 'contract',
                entityId: contractId,
                reason: `Issued signer token for ${email}`,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath(`/dashboard/crm/sales/contracts/${contractId}`);
        return { ok: true, signUrl: buildMagicLink(contractId, token), token };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? 'Failed to issue signer token.' };
    }
}

// ──────────────────────────────────────────────────────────────────
// Public: look up the contract for a given token (no auth).
// ──────────────────────────────────────────────────────────────────

export async function getContractByToken(
    contractId: string,
    signerToken: string,
): Promise<GetByTokenResult> {
    if (!contractId || !signerToken) {
        return { ok: false, error: 'Missing parameters.', code: 'invalid_token' };
    }
    if (!ObjectId.isValid(contractId)) {
        return { ok: false, error: 'Invalid contract id.', code: 'invalid_token' };
    }
    try {
        const { db } = await connectToDatabase();
        const raw = await db.collection('crm_contracts').findOne({
            _id: new ObjectId(contractId),
        });
        if (!raw) {
            return { ok: false, error: 'Contract not found.', code: 'not_found' };
        }
        const contract = raw as unknown as ContractDoc;
        const status = String(contract.status || '');
        if (status === 'voided' || status === 'terminated') {
            return { ok: false, error: 'Contract has been voided.', code: 'voided' };
        }
        if (status === 'expired') {
            return { ok: false, error: 'Contract has expired.', code: 'expired' };
        }
        const match = resolveSignerIndex(contract, contractId, signerToken);
        if (!match) {
            return {
                ok: false,
                error: 'Signing link is invalid or revoked.',
                code: 'invalid_token',
            };
        }
        const me = (contract.signers ?? [])[match.idx];
        if (me?.signedAt || me?.tokenUsedAt) {
            return {
                ok: false,
                error: 'This signing link has already been used.',
                code: 'already_signed',
            };
        }
        return { ok: true, contract: redactContract(contract, match.idx) };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? 'Lookup failed.' };
    }
}

// ──────────────────────────────────────────────────────────────────
// Public: submit a signature (no auth).
// ──────────────────────────────────────────────────────────────────

export async function submitContractSignature(
    contractId: string,
    signerToken: string,
    payload: SubmitArgs,
): Promise<SubmitResult> {
    if (!contractId || !ObjectId.isValid(contractId)) {
        return { ok: false, error: 'Invalid contract id.' };
    }
    if (!signerToken) return { ok: false, error: 'Missing signer token.' };
    if (payload.mode !== 'typed' && payload.mode !== 'drawn' && payload.mode !== 'uploaded') {
        return { ok: false, error: 'Unsupported signature mode.' };
    }
    if (!payload.value?.trim()) {
        return { ok: false, error: 'Signature data is required.' };
    }

    const { ip, ua, geo } = await readRequestContext();
    const now = new Date();

    try {
        const { db } = await connectToDatabase();
        const contractsCol = db.collection('crm_contracts');
        const raw = await contractsCol.findOne({ _id: new ObjectId(contractId) });
        if (!raw) return { ok: false, error: 'Contract not found.' };
        const contract = raw as unknown as ContractDoc;
        const status = String(contract.status || '');
        if (status === 'voided' || status === 'terminated' || status === 'expired') {
            return { ok: false, error: `Contract is ${status}; cannot be signed.` };
        }

        const match = resolveSignerIndex(contract, contractId, signerToken);
        if (!match) {
            return { ok: false, error: 'Invalid or revoked signing link.' };
        }

        const signers: SignerDoc[] = Array.isArray(contract.signers)
            ? [...(contract.signers as SignerDoc[])]
            : [];
        const me = signers[match.idx];

        // Idempotency: if this signer already signed, treat re-submission
        // as a no-op success so a double-click on the client never causes
        // a 409.
        if (me?.signedAt) {
            const tenantUserId = String(contract.userId || '');
            return {
                ok: true,
                alreadySigned: true,
                status: contract.status,
                ...(tenantUserId ? {} : {}),
            };
        }

        signers[match.idx] = {
            ...me,
            email: me?.email || payload.signerEmail || match.email,
            name: me?.name || payload.signerName,
            signedAt: now,
            signatureMethod: payload.mode,
            signatureData: payload.value,
            signedFromIp: ip,
            signedFromUserAgent: ua,
            signedFromGeo: geo,
            tokenUsedAt: now,
            // Zero the opaque token so it can never be replayed; HMAC
            // tokens for this signer are now also invalid because
            // `signedAt` is set and `resolveSignerIndex` will land on a
            // slot whose `signedAt` rejects further submissions.
            token: null,
        };

        const allSigned = signers.length > 0 && signers.every((s) => !!s.signedAt);
        const someSigned = signers.some((s) => !!s.signedAt);
        const nextStatus: SignatureStatus = allSigned
            ? 'fully_signed'
            : someSigned
                ? 'partially_signed'
                : (status as SignatureStatus);

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

        const tenantUserId = String(contract.userId || '');
        if (tenantUserId) {
            try {
                await writeAuditEntry({
                    tenantUserId,
                    actorId: payload.signerEmail || me?.email || tenantUserId,
                    action: 'signed',
                    entityKind: 'contract',
                    entityId: contractId,
                    reason: `${payload.signerName || me?.email || 'Signer'} signed via ${payload.mode}`,
                    diff: {
                        status: { before: status, after: nextStatus },
                    },
                });
            } catch {
                /* non-fatal */
            }
        }

        const nextSigner = signers.find((s) => !s.signedAt);
        return {
            ok: true,
            status: nextStatus,
            nextSignerEmail: nextSigner?.email,
        };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? 'Submission failed.' };
    }
}

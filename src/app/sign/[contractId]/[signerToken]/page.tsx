import { Badge, Card, ZoruCardContent } from '@/components/zoruui';
import {
  ObjectId } from 'mongodb';
import { AlertCircle,
  CalendarDays,
  FileText,
  ShieldCheck,
  User } from 'lucide-react';

import { connectToDatabase } from '@/lib/mongodb';

/**
 * Public contract-signing page — `/sign/[contractId]/[signerToken]`.
 *
 * This route is intentionally **unauthenticated**: the signer token
 * in the URL IS the credential. The token is single-use; we verify it
 * on every render and surface a clear error state when invalid /
 * already-used / expired.
 *
 * Layout:
 *   1. Contract preview     — title, parties, body, dates.
 *   2. Signer block         — who we believe is signing (read-only).
 *   3. Signature capture    — client island with typed / drawn /
 *                             uploaded modes (see _components/).
 *
 * On successful sign the client posts to the route handler at
 * `/api/sign/[contractId]/[signerToken]` and is redirected to the
 * `/done` confirmation child route.
 *
 * Dynamic by design — uses request-time data (route params, no
 * caching). No `'use cache'` directives.
 */

import { SignatureCapture } from './_components/signature-capture';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
    params: Promise<{ contractId: string; signerToken: string }>;
}

interface SignerDoc {
    name?: string;
    email?: string;
    role?: string;
    order?: number;
    token?: string;
    tokenIssuedAt?: string | Date;
    tokenUsedAt?: string | Date | null;
    signedAt?: string | Date;
    signatureMethod?: string;
    signatureData?: string;
}

interface ContractDoc {
    _id: string;
    title?: string;
    body?: string;
    notes?: string;
    type?: string;
    status?: string;
    partyName?: string;
    partyEmail?: string;
    clientName?: string;
    effectiveDate?: string | Date;
    startDate?: string | Date;
    expiryDate?: string | Date;
    endDate?: string | Date;
    value?: number;
    currency?: string;
    signers?: SignerDoc[];
    voidedAt?: string | Date;
}

type LoadResult =
    | { kind: 'ok'; contract: ContractDoc; signerIndex: number }
    | { kind: 'invalid'; reason: string };

async function loadContractForToken(
    contractId: string,
    signerToken: string,
): Promise<LoadResult> {
    if (!contractId || !signerToken) {
        return { kind: 'invalid', reason: 'Missing link parameters.' };
    }
    if (!ObjectId.isValid(contractId)) {
        return { kind: 'invalid', reason: 'This signing link is malformed.' };
    }
    const { db } = await connectToDatabase();
    const raw = await db.collection('crm_contracts').findOne({
        _id: new ObjectId(contractId),
    });
    if (!raw) {
        return { kind: 'invalid', reason: 'We could not find this contract.' };
    }
    const status = String(raw.status || '');
    if (status === 'voided' || status === 'terminated') {
        return { kind: 'invalid', reason: 'This contract has been voided and can no longer be signed.' };
    }
    if (status === 'expired') {
        return { kind: 'invalid', reason: 'This contract has expired.' };
    }

    const signers: SignerDoc[] = Array.isArray(raw.signers)
        ? (raw.signers as SignerDoc[])
        : [];
    const idx = signers.findIndex((s) => (s?.token || '') === signerToken);
    if (idx === -1) {
        return { kind: 'invalid', reason: 'This signing link is no longer valid.' };
    }
    const me = signers[idx];
    if (me.signedAt || me.tokenUsedAt) {
        return {
            kind: 'invalid',
            reason: 'This signing link has already been used. If you need a copy of the signed contract, contact the sender.',
        };
    }

    const contract: ContractDoc = JSON.parse(JSON.stringify(raw));
    return { kind: 'ok', contract, signerIndex: idx };
}

function fmtDate(d?: string | Date): string {
    if (!d) return '—';
    const v = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(v.getTime())) return '—';
    return v.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtAmount(value?: number, currency?: string): string | null {
    if (typeof value !== 'number' || Number.isNaN(value)) return null;
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currency || 'INR',
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        return `${value} ${currency || ''}`.trim();
    }
}

function InvalidState({ reason }: { reason: string }) {
    const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@sabnode.com';
    return (
        <main className="zoruui min-h-screen bg-zoru-bg text-zoru-ink">
            <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-10">
                <Card className="w-full p-0">
                    <ZoruCardContent className="flex flex-col items-center gap-4 p-8 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zoru-surface text-zoru-danger">
                            <AlertCircle className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-zoru-ink">
                                Signing link unavailable
                            </h1>
                            <p className="mt-2 text-sm leading-6 text-zoru-ink-muted">
                                {reason}
                            </p>
                        </div>
                        <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-4 py-3 text-sm">
                            <p className="text-zoru-ink-muted">
                                Need help? Contact{' '}
                                <a
                                    href={`mailto:${supportEmail}`}
                                    className="font-medium text-zoru-ink underline underline-offset-2"
                                >
                                    {supportEmail}
                                </a>
                                .
                            </p>
                        </div>
                    </ZoruCardContent>
                </Card>
            </div>
        </main>
    );
}

export default async function SignContractPage({ params }: PageProps) {
    const { contractId, signerToken } = await params;
    const result = await loadContractForToken(contractId, signerToken);

    if (result.kind === 'invalid') {
        return <InvalidState reason={result.reason} />;
    }

    const { contract, signerIndex } = result;
    const signers = contract.signers || [];
    const me = signers[signerIndex];

    const effectiveDate = fmtDate(contract.effectiveDate ?? contract.startDate);
    const expiryDate = fmtDate(contract.expiryDate ?? contract.endDate);
    const amount = fmtAmount(contract.value, contract.currency);
    const counterparty = contract.partyName || contract.clientName || '—';

    const totalSigners = signers.length;
    const completed = signers.filter((s) => !!s.signedAt).length;

    return (
        <main className="zoruui min-h-screen bg-zoru-bg text-zoru-ink">
            <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
                <header className="mb-6 flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold tracking-wide text-zoru-ink-muted">
                        SabNode · Contract signing
                    </span>
                    <Badge variant="success">
                        <ShieldCheck />
                        Secure link
                    </Badge>
                </header>

                {/* ── 1. Contract preview ───────────────────────────── */}
                <Card className="p-0">
                    <ZoruCardContent className="space-y-5 p-6">
                        <div>
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zoru-ink-muted">
                                <FileText className="h-3.5 w-3.5" />
                                {(contract.type || 'Contract').toUpperCase()}
                            </div>
                            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zoru-ink sm:text-3xl">
                                {contract.title || 'Untitled contract'}
                            </h1>
                            <p className="mt-2 text-sm text-zoru-ink-muted">
                                Please review the document below and complete your signature at the bottom.
                            </p>
                        </div>

                        <dl className="grid gap-3 sm:grid-cols-2">
                            <Field label="Counter-party" value={counterparty} />
                            <Field
                                label="Effective date"
                                value={
                                    <span className="inline-flex items-center gap-1.5">
                                        <CalendarDays className="h-3.5 w-3.5 text-zoru-ink-muted" />
                                        {effectiveDate}
                                    </span>
                                }
                            />
                            <Field
                                label="Expiry date"
                                value={
                                    <span className="inline-flex items-center gap-1.5">
                                        <CalendarDays className="h-3.5 w-3.5 text-zoru-ink-muted" />
                                        {expiryDate}
                                    </span>
                                }
                            />
                            {amount ? <Field label="Value" value={amount} /> : null}
                            <Field
                                label="Signers"
                                value={`${completed} of ${totalSigners} complete`}
                            />
                        </dl>

                        {(contract.body || contract.notes) ? (
                            <section>
                                <h2 className="mb-2 text-sm font-semibold text-zoru-ink">
                                    Document
                                </h2>
                                <div className="max-h-[60vh] overflow-auto rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4 text-sm leading-7 text-zoru-ink">
                                    <pre className="whitespace-pre-wrap font-sans">
                                        {contract.body || contract.notes}
                                    </pre>
                                </div>
                            </section>
                        ) : (
                            <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface p-4 text-sm text-zoru-ink-muted">
                                The sender did not include an inline document body. The contract
                                metadata above is the full record being signed.
                            </div>
                        )}
                    </ZoruCardContent>
                </Card>

                {/* ── 2. Signer block ───────────────────────────────── */}
                <Card className="mt-4 p-0">
                    <ZoruCardContent className="p-6">
                        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zoru-ink">
                            <User className="h-4 w-4 text-zoru-ink-muted" />
                            Signing as
                        </h2>
                        <dl className="grid gap-3 sm:grid-cols-3">
                            <Field label="Name" value={me?.name || '—'} />
                            <Field label="Email" value={me?.email || '—'} />
                            <Field label="Role" value={me?.role || 'Counter-party'} />
                        </dl>
                        <p className="mt-3 text-xs leading-5 text-zoru-ink-muted">
                            If any of the details above are incorrect, please contact the sender
                            before signing.
                        </p>
                    </ZoruCardContent>
                </Card>

                {/* ── 3. Signature capture (client island) ─────────── */}
                <Card className="mt-4 p-0">
                    <ZoruCardContent className="p-6">
                        <h2 className="mb-3 text-sm font-semibold text-zoru-ink">
                            Your signature
                        </h2>
                        <SignatureCapture
                            contractId={contractId}
                            signerToken={signerToken}
                            signerName={me?.name || ''}
                        />
                    </ZoruCardContent>
                </Card>

                <footer className="mt-6 text-center text-xs leading-5 text-zoru-ink-muted">
                    This page is served over a single-use secure link. Your signature, IP
                    address, browser, and timestamp are recorded for audit purposes.
                </footer>
            </div>
        </main>
    );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3">
            <dt className="text-xs text-zoru-ink-muted">{label}</dt>
            <dd className="mt-1 min-w-0 break-words text-sm font-medium text-zoru-ink">
                {value}
            </dd>
        </div>
    );
}

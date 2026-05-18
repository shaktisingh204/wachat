import { ZoruBadge, ZoruCard, ZoruCardContent } from '@/components/zoruui';
import {
  ObjectId } from 'mongodb';
import { CheckCircle2,
  MailCheck } from 'lucide-react';

import { connectToDatabase } from '@/lib/mongodb';

/**
 * Sign-flow confirmation — `/sign/[contractId]/[signerToken]/done`.
 *
 * Shown immediately after a successful signature. The page itself is
 * idempotent — it just shows status and does not perform any writes.
 * We re-load the contract by id so we can show whether more signers
 * are still pending.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
    params: Promise<{ contractId: string; signerToken: string }>;
}

interface SignerLite {
    name?: string;
    email?: string;
    role?: string;
    signedAt?: string | Date;
    signatureMethod?: string;
}

export default async function SignDonePage({ params }: PageProps) {
    const { contractId, signerToken } = await params;

    let title = 'Contract';
    let status = '';
    let me: SignerLite | null = null;
    let totalSigners = 0;
    let completed = 0;

    if (ObjectId.isValid(contractId)) {
        try {
            const { db } = await connectToDatabase();
            const doc = await db.collection('crm_contracts').findOne({
                _id: new ObjectId(contractId),
            });
            if (doc) {
                title = (doc.title as string | undefined) || 'Contract';
                status = (doc.status as string | undefined) || '';
                const signers = Array.isArray(doc.signers) ? (doc.signers as SignerLite[]) : [];
                totalSigners = signers.length;
                completed = signers.filter((s) => !!s.signedAt).length;
                const found =
                    signers.find((s: any) => (s?.token || '') === signerToken) ||
                    // Token has been zeroed after use — fall back to most-recently-signed.
                    [...signers].sort((a, b) => {
                        const ta = a.signedAt ? new Date(a.signedAt).getTime() : 0;
                        const tb = b.signedAt ? new Date(b.signedAt).getTime() : 0;
                        return tb - ta;
                    })[0] || null;
                me = found || null;
            }
        } catch {
            // Render the generic confirmation even when the DB read
            // hiccups — the signer's submission already succeeded.
        }
    }

    const isCompleted = status === 'completed' || status === 'signed';
    const stillPending = totalSigners > 0 && completed < totalSigners;

    return (
        <main className="zoruui min-h-screen bg-zoru-bg text-zoru-ink">
            <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-10">
                <ZoruCard className="w-full p-0">
                    <ZoruCardContent className="flex flex-col items-center gap-5 p-8 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                            <CheckCircle2 className="h-8 w-8" />
                        </div>

                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight text-zoru-ink">
                                Signature recorded
                            </h1>
                            <p className="mt-2 text-sm leading-6 text-zoru-ink-muted">
                                Thanks{me?.name ? `, ${me.name}` : ''} — your signature for{' '}
                                <strong>{title}</strong> has been captured. You can close this
                                window.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {isCompleted ? (
                                <ZoruBadge variant="success">
                                    <CheckCircle2 />
                                    All signers complete
                                </ZoruBadge>
                            ) : stillPending ? (
                                <ZoruBadge variant="warning">
                                    <MailCheck />
                                    Waiting on {totalSigners - completed} more
                                </ZoruBadge>
                            ) : (
                                <ZoruBadge variant="success">
                                    <CheckCircle2 />
                                    Done
                                </ZoruBadge>
                            )}
                            {me?.signatureMethod ? (
                                <ZoruBadge variant="ghost">
                                    Method: {me.signatureMethod}
                                </ZoruBadge>
                            ) : null}
                        </div>

                        <div className="w-full rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4 text-left text-sm">
                            <div className="mb-1 font-medium text-zoru-ink">What happens next</div>
                            <ul className="space-y-1 text-zoru-ink-muted">
                                <li>
                                    A copy of the executed contract will be emailed to all signers
                                    once everyone has signed.
                                </li>
                                {stillPending ? (
                                    <li>
                                        The next signer is being notified now and will receive their
                                        own secure link shortly.
                                    </li>
                                ) : null}
                                <li>
                                    Your signature is bound to the IP address, browser, and
                                    timestamp recorded at the moment of signing.
                                </li>
                            </ul>
                        </div>
                    </ZoruCardContent>
                </ZoruCard>
            </div>
        </main>
    );
}

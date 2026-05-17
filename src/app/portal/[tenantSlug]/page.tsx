/**
 * Portal dashboard — the post-sign-in landing surface for a customer /
 * vendor / employee end-user. Verifies the `portal_session` cookie, loads
 * the matching `crm_portal_users` row, and renders a minimal grid of
 * role-aware placeholder cards.
 *
 * The sub-routes the cards link to are NOT built in this PR — that's
 * Phase 6.6 follow-up work.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getPortalSession } from '@/lib/portal/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Portal',
    robots: { index: false, follow: false },
};

type PortalRole = 'customer' | 'vendor' | 'employee';

interface PortalUserView {
    _id: string;
    name: string;
    email: string;
    portalType: PortalRole;
}

interface CardSpec {
    title: string;
    description: string;
    href: string;
}

function cardsForRole(role: PortalRole, tenantSlug: string): CardSpec[] {
    const base = `/portal/${encodeURIComponent(tenantSlug)}`;
    if (role === 'vendor') {
        return [
            { title: 'Your purchase orders', description: 'Open POs awaiting acknowledgement.', href: `${base}/purchase-orders` },
            { title: 'Your bills', description: 'Submitted bills and their payment status.', href: `${base}/bills` },
            { title: 'Your RFQs', description: 'Requests for quotation you can respond to.', href: `${base}/rfqs` },
            { title: 'Your contracts', description: 'Master service agreements and signed contracts.', href: `${base}/contracts` },
        ];
    }
    if (role === 'employee') {
        return [
            { title: 'Your payslips', description: 'Latest payslips and tax statements.', href: `${base}/payslips` },
            { title: 'Your leaves', description: 'Leave balance and pending requests.', href: `${base}/leaves` },
            { title: 'Your tasks', description: 'Items assigned to you across projects.', href: `${base}/tasks` },
            { title: 'Your documents', description: 'Onboarding documents and policies.', href: `${base}/documents` },
        ];
    }
    // customer (default)
    return [
        { title: 'Your orders', description: 'Sales orders and their fulfilment status.', href: `${base}/orders` },
        { title: 'Your invoices', description: 'Open invoices, receipts, and statements.', href: `${base}/invoices` },
        { title: 'Your tickets', description: 'Support tickets you have opened.', href: `${base}/tickets` },
        { title: 'Your contracts', description: 'Service contracts and renewals.', href: `${base}/contracts` },
    ];
}

interface PageProps {
    params: Promise<{ tenantSlug: string }>;
}

async function loadPortalUser(
    userId: string,
    tenantId: string,
): Promise<PortalUserView | null> {
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(tenantId)) return null;
    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_portal_users').findOne(
            {
                _id: new ObjectId(userId),
                userId: new ObjectId(tenantId),
                status: { $ne: 'suspended' },
            } as never,
            { projection: { name: 1, email: 1, portalType: 1 } },
        );
        if (!doc) return null;
        const portalType = (doc.portalType ?? 'customer') as PortalRole;
        return {
            _id: String(doc._id),
            name: (doc.name as string) ?? '',
            email: (doc.email as string) ?? '',
            portalType: portalType === 'vendor' || portalType === 'employee' ? portalType : 'customer',
        };
    } catch {
        return null;
    }
}

export default async function PortalDashboardPage({ params }: PageProps) {
    const { tenantSlug } = await params;

    const session = await getPortalSession();
    if (!session) {
        redirect(`/portal/${encodeURIComponent(tenantSlug)}/login`);
    }

    const portalUser = await loadPortalUser(session.userId, session.tenantId);
    if (!portalUser) {
        // Session was valid but row is gone / suspended — bounce to login
        // (a clean state machine; the cookie will be re-issued on next sign-in).
        redirect(`/portal/${encodeURIComponent(tenantSlug)}/login?error=no_account`);
    }

    const cards = cardsForRole(portalUser.portalType, tenantSlug);
    const roleLabel =
        portalUser.portalType.charAt(0).toUpperCase() + portalUser.portalType.slice(1);

    return (
        <main
            style={{
                minHeight: '100vh',
                background: '#f9fafb',
                padding: 32,
                fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            }}
        >
            <header
                style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    maxWidth: 1080,
                    margin: '0 auto 24px',
                }}
            >
                <div>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                        Welcome back
                    </p>
                    <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
                        {portalUser.name || portalUser.email}
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
                        Signed in as <strong>{roleLabel}</strong>
                    </p>
                </div>
                <form action={`/portal/${encodeURIComponent(tenantSlug)}/auth/sign-out`} method="post">
                    {/*
                     * A dedicated POST endpoint isn't built in this shell PR;
                     * we surface the action so the next pass only has to
                     * implement the route handler. Until it lands, this link
                     * is a no-op when JS is off — acceptable for the shell.
                     */}
                    <button
                        type="submit"
                        style={{
                            background: 'transparent',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            padding: '8px 12px',
                            borderRadius: 8,
                            fontSize: 13,
                            cursor: 'pointer',
                        }}
                    >
                        Sign out
                    </button>
                </form>
            </header>

            <section
                style={{
                    maxWidth: 1080,
                    margin: '0 auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 16,
                }}
            >
                {cards.map((c) => (
                    <Link
                        key={c.title}
                        href={c.href}
                        style={{
                            display: 'block',
                            background: 'white',
                            borderRadius: 14,
                            padding: 20,
                            border: '1px solid #e2e8f0',
                            color: 'inherit',
                            textDecoration: 'none',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        }}
                    >
                        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
                            {c.title}
                        </h2>
                        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#64748b' }}>
                            {c.description}
                        </p>
                    </Link>
                ))}
            </section>
        </main>
    );
}

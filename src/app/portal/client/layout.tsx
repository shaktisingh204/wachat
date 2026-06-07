/**
 * /portal/client layout - Client Portal shell.
 *
 * Server Component. Authentication boundary:
 *   - If no session, redirect to `/login?return=/portal/client`.
 *   - If session.user.role !== 'client', redirect to `/login?return=/portal/client`
 *     (so admins and other roles can't reach this surface. They bounce to
 *     login and can sign in as a client).
 *
 * Renders a minimal layout, distinct from the dashboard's app shell:
 *   - Slim top bar with the tenant `companies` brand logo + user dropdown
 *   - Lean left sidebar with only client-facing routes
 *   - Padded scrolling <main>
 *
 * Intentionally lightweight. No app rail, no command palette, no
 * RBAC guard. The portal is its own surface, not part of the dashboard.
 */

export const dynamic = 'force-dynamic';

import 'server-only';

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { getSession } from '@/app/actions/user.actions';
import { getClientPortalBrand } from '@/app/actions/client-portal.actions';
import { ClientPortalSidebar } from '@/components/client-portal/sidebar';
import { ClientPortalTopbar } from '@/components/client-portal/topbar';

export default async function ClientPortalLayout({
    children,
}: {
    children: ReactNode;
}) {
    const session = await getSession();
    const user = (session as { user?: { _id?: string; name?: string; email?: string; image?: string; role?: string } } | null)?.user;
    if (!user || user.role !== 'client') {
        redirect('/login?return=/portal/client');
    }

    const brand = await getClientPortalBrand();

    return (
        <div className="ui20 flex h-screen w-full overflow-hidden bg-[var(--st-bg)] text-[var(--st-text)]">
            <ClientPortalSidebar />
            <div className="relative flex min-w-0 flex-1 flex-col">
                <ClientPortalTopbar
                    brandName={brand.name}
                    brandLogo={brand.logo}
                    user={{
                        name: user.name ?? '',
                        email: user.email ?? '',
                        avatar: user.image ?? null,
                    }}
                />
                <main className="flex-1 overflow-y-auto px-6 py-6">
                    <div className="mx-auto max-w-6xl">{children}</div>
                </main>
            </div>
        </div>
    );
}

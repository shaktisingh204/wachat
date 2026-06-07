import React from 'react';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-session';
import { Skeleton } from '@/components/sabcrm/20ui';
import { AdminSidebarNav } from '@/components/zoruui-domain/admin-sidebar-nav';
import { AdminTopBar } from '@/components/zoruui-domain/admin-top-bar';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Server-side auth guard, no flash, no race condition.
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) {
        redirect('/admin-login');
    }

    return (
        <div className="ui20 flex h-screen bg-[var(--st-bg-secondary)] text-[var(--st-text)] overflow-hidden">
            {/* Sidebar */}
            <AdminSidebarNav />

            {/* Main column */}
            <div className="flex flex-1 flex-col min-w-0">
                <AdminTopBar />
                <main className="flex-1 overflow-y-auto">
                    <div className="p-4 md:p-6 lg:p-8 space-y-6">
                        <React.Suspense
                            fallback={
                                <div className="space-y-4">
                                    {[...Array(3)].map((_, i) => (
                                        <Skeleton
                                            key={i}
                                            height={128}
                                            radius={16}
                                            className="block w-full"
                                        />
                                    ))}
                                </div>
                            }
                        >
                            {children}
                        </React.Suspense>
                    </div>
                </main>
            </div>
        </div>
    );
}

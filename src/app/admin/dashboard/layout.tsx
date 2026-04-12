import React from 'react';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-session';
import { AdminSidebarNav } from '@/components/wabasimplify/admin-sidebar-nav';
import { AdminTopBar } from '@/components/wabasimplify/admin-top-bar';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Server-side auth guard — no flash, no race condition
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) {
        redirect('/admin-login');
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            {/* Sidebar */}
            <AdminSidebarNav />

            {/* Main column */}
            <div className="flex flex-1 flex-col min-w-0">
                <AdminTopBar />
                <main className="flex-1 overflow-y-auto">
                    <div className="p-4 md:p-6 lg:p-8 space-y-6">
                        <React.Suspense fallback={
                            <div className="space-y-4">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="h-32 rounded-2xl bg-white animate-pulse" />
                                ))}
                            </div>
                        }>
                            {children}
                        </React.Suspense>
                    </div>
                </main>
            </div>
        </div>
    );
}

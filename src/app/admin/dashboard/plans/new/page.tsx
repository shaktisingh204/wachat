import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { AdminPageHeader, AdminCard } from '@/components/admin';
import { NewPlanForm } from './_components/NewPlanForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Create Plan | SabNode Admin' };

export default function NewPlanPage() {
    return (
        <div className="space-y-6">
            <Link
                href="/admin/dashboard/plans"
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back to plans
            </Link>

            <AdminPageHeader
                eyebrow="Plans"
                title="Create new plan"
                description="Set the basics — billing, signup credits and core limits. You'll be able to fine-tune permissions and feature flags on the edit screen after creation."
            />

            <AdminCard className="max-w-2xl">
                <div className="p-6">
                    <NewPlanForm />
                </div>
            </AdminCard>
        </div>
    );
}

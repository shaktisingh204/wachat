import { Button } from '@/components/sabcrm/20ui/compat';
import { getPlans } from '@/app/actions/plan.actions';
import type { Plan, WithId } from '@/lib/definitions';
import Link from 'next/link';

import { PlusCircle } from 'lucide-react';
import { PlanListErrorToast } from './_components/PlanListErrorToast';
import { SortablePlansGrid } from './_components/SortablePlansGrid';

export const dynamic = 'force-dynamic';

export default async function PlansManagementPage() {
    let plans: WithId<Plan>[] = [];
    let fetchFailed = false;
    try { 
        plans = await getPlans(); 
    } catch { 
        fetchFailed = true; 
    }

    return (
        <div className="space-y-6">
            {fetchFailed && <PlanListErrorToast />}
            
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--st-text)]">Subscription Plans</h1>
                    <p className="text-sm text-[var(--st-text-secondary)] mt-1">Create and manage platform subscription tiers.</p>
                </div>
                <Button asChild className="bg-[var(--st-text)] hover:bg-[var(--st-bg-muted)] text-[var(--st-text)] shadow-lg shadow-[var(--st-border)]/25">
                    <Link href="/admin/dashboard/plans/new">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Plan
                    </Link>
                </Button>
            </div>

            <SortablePlansGrid initialPlans={plans} fetchFailed={fetchFailed} />
        </div>
    );
}

import { Button } from '@/components/zoruui';
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
                    <h1 className="text-2xl font-bold text-zoru-ink">Subscription Plans</h1>
                    <p className="text-sm text-zoru-ink-muted mt-1">Create and manage platform subscription tiers.</p>
                </div>
                <Button asChild className="bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/25">
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

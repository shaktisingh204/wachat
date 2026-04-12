import { getPlans } from '@/app/actions/plan.actions';
import type { Plan, WithId } from '@/lib/definitions';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AdminDeletePlanButton } from '@/components/wabasimplify/admin-delete-plan-button';
import { AdminPlanPermissionsDialog } from '@/components/wabasimplify/admin-plan-permissions-dialog';
import { PlusCircle, Edit, CheckCircle2, XCircle, CreditCard } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PlansManagementPage() {
    let plans: WithId<Plan>[] = [];
    try { plans = await getPlans(); } catch { /* fail gracefully */ }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Subscription Plans</h1>
                    <p className="text-sm text-slate-500 mt-1">Create and manage platform subscription tiers.</p>
                </div>
                <Button asChild className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold shadow-lg shadow-amber-500/25">
                    <Link href="/admin/dashboard/plans/new">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Plan
                    </Link>
                </Button>
            </div>

            {/* Plan cards grid */}
            {plans.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {plans.map((plan) => (
                        <div
                            key={plan._id.toString()}
                            className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-4 hover:border-slate-300 transition-colors"
                        >
                            {/* Plan name + badges */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-9 w-9 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center shrink-0">
                                        <CreditCard className="h-4 w-4 text-slate-700" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                                        <p className="text-xs text-slate-500">{plan.appCategory || 'All-In-One'}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                    {plan.isDefault && (
                                        <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                                            Default
                                        </span>
                                    )}
                                    {plan.isPublic && (
                                        <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                                            Public
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Price */}
                            <div className="rounded-xl bg-slate-100 border border-slate-200 px-4 py-3">
                                <span className="text-2xl font-bold text-slate-900">{plan.currency} {plan.price}</span>
                                <span className="text-sm text-slate-500">/month</span>
                            </div>

                            {/* Limits grid */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                {[
                                    ['Signup Credits', (plan.signupCredits || 0).toLocaleString()],
                                    ['Projects', plan.projectLimit ?? '—'],
                                    ['Agents', plan.agentLimit ?? '—'],
                                    ['Templates', plan.templateLimit ?? '—'],
                                    ['Flows', plan.flowLimit ?? '—'],
                                    ['Meta Flows', plan.metaFlowLimit ?? '—'],
                                ].map(([label, val]) => (
                                    <div key={label as string} className="flex flex-col gap-0.5">
                                        <span className="text-slate-500">{label}</span>
                                        <span className="font-semibold text-slate-900">{val}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                                <Button asChild variant="ghost" size="sm"
                                    className="flex-1 border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-xl">
                                    <Link href={`/admin/dashboard/plans/${plan._id.toString()}`}>
                                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                                        Edit
                                    </Link>
                                </Button>
                                <AdminPlanPermissionsDialog
                                    planId={plan._id.toString()}
                                    planName={plan.name}
                                    initialPermissions={plan.permissions}
                                />
                                <AdminDeletePlanButton planId={plan._id.toString()} planName={plan.name} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center">
                    <CreditCard className="mx-auto h-10 w-10 text-slate-400 mb-4" />
                    <h3 className="text-slate-700 font-medium">No plans yet</h3>
                    <p className="text-slate-500 text-sm mt-1">Create your first subscription plan to get started.</p>
                    <Button asChild className="mt-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold">
                        <Link href="/admin/dashboard/plans/new">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create Plan
                        </Link>
                    </Button>
                </div>
            )}
        </div>
    );
}

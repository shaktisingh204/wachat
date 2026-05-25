'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/zoruui';
import { useZoruToast } from '@/components/zoruui';
import { Edit, CreditCard, PlusCircle, GripHorizontal } from 'lucide-react';
import { AdminDeletePlanButton } from '@/components/wabasimplify/admin-delete-plan-button';
import { AdminPlanPermissionsDialog } from '@/components/wabasimplify/admin-plan-permissions-dialog';
import { AdminDuplicatePlanButton } from '@/components/wabasimplify/admin-duplicate-plan-button';
import { updatePlanOrder } from '@/app/actions/plan.actions';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortablePlanCard({ plan }: { plan: any }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: plan._id.toString() });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.8 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`rounded-2xl border ${isDragging ? 'border-amber-500 shadow-xl' : 'border-slate-200'} bg-white p-5 flex flex-col gap-4 hover:border-slate-300 transition-colors relative group`}
        >
            {/* Drag Handle */}
            <div 
                {...attributes} 
                {...listeners} 
                className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-slate-100 text-slate-400 transition-opacity"
            >
                <GripHorizontal className="w-5 h-5" />
            </div>

            {/* Plan name + badges */}
            <div className="flex items-start justify-between gap-2 mt-2">
                <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center shrink-0">
                        <CreditCard className="h-4 w-4 text-slate-700" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                        <p className="text-xs text-slate-500">{plan.appCategory || 'All-In-One'}</p>
                    </div>
                </div>
                <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
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
            <div className="flex items-center gap-2 pt-1 border-t border-slate-200 mt-auto">
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
                <AdminDuplicatePlanButton planId={plan._id.toString()} planName={plan.name} />
                <AdminDeletePlanButton planId={plan._id.toString()} planName={plan.name} />
            </div>
        </div>
    );
}

export function SortablePlansGrid({ initialPlans, fetchFailed }: { initialPlans: any[], fetchFailed?: boolean }) {
    const [plans, setPlans] = useState(initialPlans);
    const [, startTransition] = useTransition();
    const { toast } = useZoruToast();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    if (fetchFailed) {
        return (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-16 text-center">
                <CreditCard className="mx-auto h-10 w-10 text-red-400 mb-4" />
                <h3 className="text-red-700 font-medium">Failed to load plans</h3>
                <p className="text-red-500 text-sm mt-1">There was an error fetching the subscription plans.</p>
            </div>
        );
    }

    if (plans.length === 0) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center">
                <CreditCard className="mx-auto h-10 w-10 text-slate-400 mb-4" />
                <h3 className="text-slate-700 font-medium">No plans yet</h3>
                <p className="text-slate-500 text-sm mt-1">Create your first subscription plan to get started.</p>
                <Button asChild className="mt-4 bg-amber-500 hover:bg-amber-400 text-zinc-950">
                    <Link href="/admin/dashboard/plans/new">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Plan
                    </Link>
                </Button>
            </div>
        );
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = plans.findIndex((p) => p._id.toString() === active.id);
            const newIndex = plans.findIndex((p) => p._id.toString() === over.id);
            
            const newPlans = arrayMove(plans, oldIndex, newIndex);
            setPlans(newPlans);
            
            startTransition(async () => {
                const planIds = newPlans.map(p => p._id.toString());
                const result = await updatePlanOrder(planIds);
                
                if (result.error) {
                    toast({
                        title: 'Error',
                        description: result.error,
                        variant: 'destructive',
                    });
                    // Revert to initial on error (optional, or just fetch again)
                } else {
                    toast({
                        title: 'Order Updated',
                        description: 'Plan display order saved.',
                    });
                }
            });
        }
    };

    return (
        <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <SortableContext 
                    items={plans.map(p => p._id.toString())}
                    strategy={rectSortingStrategy}
                >
                    {plans.map((plan) => (
                        <SortablePlanCard key={plan._id.toString()} plan={plan} />
                    ))}
                </SortableContext>
            </div>
        </DndContext>
    );
}

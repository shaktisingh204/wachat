'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/sabcrm/20ui';
import { useToast } from '@/components/sabcrm/20ui';
import { Edit, CreditCard, PlusCircle, GripHorizontal } from 'lucide-react';
import { AdminDeletePlanButton } from '@/components/zoruui-domain/admin-delete-plan-button';
import { AdminPlanPermissionsDialog } from '@/components/zoruui-domain/admin-plan-permissions-dialog';
import { AdminDuplicatePlanButton } from '@/components/zoruui-domain/admin-duplicate-plan-button';
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
            className={`rounded-2xl border ${isDragging ? 'border-[var(--st-border)] shadow-xl' : 'border-[var(--st-border)]'} bg-[var(--st-bg)] p-5 flex flex-col gap-4 hover:border-[var(--st-border)] transition-colors relative group`}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] transition-opacity"
            >
                <GripHorizontal className="w-5 h-5" />
            </div>

            {/* Plan name + badges */}
            <div className="flex items-start justify-between gap-2 mt-2">
                <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-[var(--st-bg-secondary)] border border-[var(--st-border)] flex items-center justify-center shrink-0">
                        <CreditCard className="h-4 w-4 text-[var(--st-text)]" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-[var(--st-text)]">{plan.name}</h3>
                        <p className="text-xs text-[var(--st-text-secondary)]">{plan.appCategory || 'All-In-One'}</p>
                    </div>
                </div>
                <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                    {plan.isDefault && (
                        <span className="rounded-full bg-[var(--st-bg-muted)] border border-[var(--st-border)] px-2 py-0.5 text-[10px] font-bold text-[var(--st-text)] uppercase tracking-wider">
                            Default
                        </span>
                    )}
                    {plan.isPublic && (
                        <span className="rounded-full bg-[var(--st-bg-muted)] border border-[var(--st-border)] px-2 py-0.5 text-[10px] font-bold text-[var(--st-text)] uppercase tracking-wider">
                            Public
                        </span>
                    )}
                </div>
            </div>

            {/* Price */}
            <div className="rounded-xl bg-[var(--st-bg-secondary)] border border-[var(--st-border)] px-4 py-3">
                <span className="text-2xl font-bold text-[var(--st-text)]">{plan.currency} {plan.price}</span>
                <span className="text-sm text-[var(--st-text-secondary)]">/month</span>
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
                        <span className="text-[var(--st-text-secondary)]">{label}</span>
                        <span className="font-semibold text-[var(--st-text)]">{val}</span>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1 border-t border-[var(--st-border)] mt-auto">
                <Button asChild variant="ghost" size="sm"
                    className="flex-1 border border-[var(--st-border)] text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)] rounded-xl">
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
    const { toast } = useToast();

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
            <div className="rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-16 text-center">
                <CreditCard className="mx-auto h-10 w-10 text-[var(--st-text-secondary)] mb-4" />
                <h3 className="text-[var(--st-text)] font-medium">Failed to load plans</h3>
                <p className="text-[var(--st-text)] text-sm mt-1">There was an error fetching the subscription plans.</p>
            </div>
        );
    }

    if (plans.length === 0) {
        return (
            <div className="rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)] p-16 text-center">
                <CreditCard className="mx-auto h-10 w-10 text-[var(--st-text-secondary)] mb-4" />
                <h3 className="text-[var(--st-text)] font-medium">No plans yet</h3>
                <p className="text-[var(--st-text-secondary)] text-sm mt-1">Create your first subscription plan to get started.</p>
                <Button asChild className="mt-4 bg-[var(--st-text)] hover:bg-[var(--st-bg-muted)] text-[var(--st-text)]">
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

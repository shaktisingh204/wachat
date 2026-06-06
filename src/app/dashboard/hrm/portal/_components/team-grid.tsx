'use client';

import { useState } from 'react';
import { Card, Badge, Button, EmptyState } from '@/components/sabcrm/20ui/compat';
import { AssignTaskDrawer } from './assign-task-drawer';
import { ClipboardPlus, Users } from 'lucide-react';
import type { PortalTeamMember } from '@/app/actions/hrm-portal.actions.types';

interface TeamGridProps {
    members: PortalTeamMember[];
    onTaskAssigned?: () => void;
}

function initials(first: string, last: string): string {
    return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

function statusVariant(status: PortalTeamMember['status']) {
    if (status === 'Active') return 'success' as const;
    if (status === 'Inactive') return 'warning' as const;
    return 'danger' as const;
}

export function TeamGrid({ members, onTaskAssigned }: TeamGridProps) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selected, setSelected] = useState<PortalTeamMember | null>(null);

    function openDrawer(member: PortalTeamMember) {
        setSelected(member);
        setDrawerOpen(true);
    }

    return (
        <>
            {members.length === 0 ? (
                <EmptyState
                    icon={<Users className="h-8 w-8" />}
                    title="No direct reports"
                    description="You have no direct reports linked to your profile yet."
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {members.map((member) => (
                        <Card
                            key={member._id}
                            className="flex flex-col gap-3 p-5"
                            variant="soft"
                        >
                            {/* Avatar + status */}
                            <div className="flex items-start justify-between">
                                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--st-text)]/10 text-[15px] font-semibold text-[var(--st-text)]">
                                    {initials(member.firstName, member.lastName)}
                                </div>
                                <Badge variant={statusVariant(member.status)} className="text-[11px]">
                                    {member.status}
                                </Badge>
                            </div>

                            {/* Name + designation */}
                            <div className="min-w-0">
                                <p className="truncate text-[14px] font-medium text-[var(--st-text)]">
                                    {member.firstName} {member.lastName}
                                </p>
                                {member.designationName && (
                                    <p className="mt-0.5 truncate text-[12px] text-[var(--st-text-secondary)]">
                                        {member.designationName}
                                    </p>
                                )}
                                {member.departmentName && (
                                    <p className="truncate text-[11.5px] text-[var(--st-text-secondary)]/70">
                                        {member.departmentName}
                                    </p>
                                )}
                            </div>

                            <Button
                                size="sm"
                                variant="outline"
                                className="mt-auto w-full gap-1.5 text-[12.5px]"
                                onClick={() => openDrawer(member)}
                            >
                                <ClipboardPlus className="h-3.5 w-3.5" />
                                Assign Task
                            </Button>
                        </Card>
                    ))}
                </div>
            )}

            <AssignTaskDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                employee={selected}
                onSuccess={onTaskAssigned}
            />
        </>
    );
}

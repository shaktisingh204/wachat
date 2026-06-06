'use client';


import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/sabcrm/20ui/compat';
import { AssignTaskForm } from './assign-task-form';
import type { PortalTeamMember } from '@/app/actions/hrm-portal.actions.types';

interface AssignTaskDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employee: PortalTeamMember | null;
    onSuccess?: () => void;
}

export function AssignTaskDrawer({
    open,
    onOpenChange,
    employee,
    onSuccess,
}: AssignTaskDrawerProps) {
    function handleOpenChange(next: boolean) {
        onOpenChange(next);
    }

    return (
        <Sheet open={open} onOpenChange={handleOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Assign Task</SheetTitle>
                    <SheetDescription>
                        {employee
                            ? `Assigning task to ${employee.firstName} ${employee.lastName}`
                            : 'Select a team member to assign a task.'}
                    </SheetDescription>
                </SheetHeader>

                {employee && (
                    <AssignTaskForm 
                        employee={employee} 
                        onCancel={() => handleOpenChange(false)}
                        onSuccess={() => {
                            handleOpenChange(false);
                            onSuccess?.();
                        }}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}

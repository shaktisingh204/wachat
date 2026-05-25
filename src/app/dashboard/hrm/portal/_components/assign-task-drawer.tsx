'use client';


import {
    Sheet,
    ZoruSheetContent,
    ZoruSheetHeader,
    ZoruSheetTitle,
    ZoruSheetDescription,
} from '@/components/zoruui';
import type { PortalTeamMember } from '@/app/actions/hrm-portal.actions';
import { AssignTaskForm } from './assign-task-form';

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
            <ZoruSheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <ZoruSheetHeader>
                    <ZoruSheetTitle>Assign Task</ZoruSheetTitle>
                    <ZoruSheetDescription>
                        {employee
                            ? `Assigning task to ${employee.firstName} ${employee.lastName}`
                            : 'Select a team member to assign a task.'}
                    </ZoruSheetDescription>
                </ZoruSheetHeader>

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
            </ZoruSheetContent>
        </Sheet>
    );
}

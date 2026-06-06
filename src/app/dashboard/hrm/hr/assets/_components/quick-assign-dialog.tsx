'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    ZoruDialog,
    ZoruDialogContent,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruDialogFooter,
    Button,
    Label,
    Input,
    useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { saveAssetAssignment } from '@/app/actions/crm-asset-assignments.actions';
import type { CrmAssetDoc } from '@/lib/rust-client/crm-assets';

export function QuickAssignDialog({
    asset,
    open,
    onOpenChange,
    onSuccess,
}: {
    asset: CrmAssetDoc | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}) {
    const [employees, setEmployees] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(false);
    const { toast } = useZoruToast();
    const router = useRouter();

    React.useEffect(() => {
        if (open && employees.length === 0) {
            getCrmEmployees().then((res) => {
                setEmployees(res);
            }).catch(console.error);
        }
    }, [open, employees.length]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!asset) return;
        setLoading(true);
        try {
            const formData = new FormData(e.currentTarget);
            formData.set('asset_id', asset._id);
            formData.set('asset_name', asset.name);
            formData.set('status', 'assigned');

            const empId = formData.get('employee_id') as string;
            const emp = employees.find((x) => x._id === empId);
            if (emp) {
                formData.set('employee_name', `${emp.firstName} ${emp.lastName}`);
            }

            const res = await saveAssetAssignment(undefined, formData);
            if (res.error) {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            } else {
                toast({ title: 'Asset assigned successfully' });
                onOpenChange(false);
                onSuccess?.();
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <ZoruDialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogContent>
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Quick Assign: {asset?.name}</ZoruDialogTitle>
                </ZoruDialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Employee</Label>
                        <select
                            name="employee_id"
                            required
                            className="flex h-10 w-full items-center justify-between rounded-md border border-zoru-line bg-transparent px-3 py-2 text-[14px] ring-offset-zoru-surface placeholder:text-zoru-ink-muted focus:outline-none focus:ring-2 focus:ring-zoru-line focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="">Select employee...</option>
                            {employees.map((emp) => (
                                <option key={emp._id} value={emp._id}>
                                    {emp.firstName} {emp.lastName}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label>Condition at Assign</Label>
                        <EnumFormField enumName="assetCondition" name="condition_at_assign" initialId="good" />
                    </div>
                    <div className="space-y-2">
                        <Label>Date of Assignment</Label>
                        <Input type="date" name="assigned_at" defaultValue={new Date().toISOString().split('T')[0]} required />
                    </div>
                    <ZoruDialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Assigning...' : 'Assign'}
                        </Button>
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

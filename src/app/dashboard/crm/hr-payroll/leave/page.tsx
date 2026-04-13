'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { getCrmLeaveRequests, approveOrRejectLeave } from '@/app/actions/crm-hr.actions';
import type { WithId, CrmLeaveRequest } from '@/lib/definitions';
import { LoaderCircle, Check, X, CalendarOff } from 'lucide-react';
import { format, formatDistance } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ApplyForLeaveDialog } from '@/components/wabasimplify/crm-apply-leave-dialog';

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default function LeaveManagementPage() {
    const [requests, setRequests] = useState<WithId<CrmLeaveRequest>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();
    const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const data = await getCrmLeaveRequests();
            setRequests(data);
        });
    }, []);

    useEffect(() => { fetchData() }, [fetchData]);

    const handleAction = async (id: string, status: 'Approved' | 'Rejected') => {
        startTransition(async () => {
            const result = await approveOrRejectLeave(id, status);
            if (result.success) {
                toast({ title: 'Success', description: `Leave request ${status.toLowerCase()}.` });
                fetchData();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    const getStatusTone = (status: string): 'green' | 'red' | 'amber' => {
        switch(status) {
            case 'Approved': return 'green';
            case 'Rejected': return 'red';
            default: return 'amber';
        }
    }

    return (
        <>
            <ApplyForLeaveDialog
                isOpen={isApplyDialogOpen}
                onOpenChange={setIsApplyDialogOpen}
                onSuccess={fetchData}
            />
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    title="Leave Management"
                    subtitle="Approve or reject leave requests from your team."
                    icon={CalendarOff}
                    actions={
                        <ClayButton variant="obsidian" onClick={() => setIsApplyDialogOpen(true)}>
                            Apply for Leave
                        </ClayButton>
                    }
                />

                <ClayCard>
                    <div className="mb-4">
                        <h2 className="text-[16px] font-semibold text-clay-ink">Leave Requests</h2>
                    </div>
                    <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-clay-border hover:bg-transparent">
                                    <TableHead className="text-clay-ink-muted">Employee</TableHead>
                                    <TableHead className="text-clay-ink-muted">Leave Dates</TableHead>
                                    <TableHead className="text-clay-ink-muted">Days</TableHead>
                                    <TableHead className="text-clay-ink-muted">Reason</TableHead>
                                    <TableHead className="text-clay-ink-muted">Status</TableHead>
                                    <TableHead className="text-right text-clay-ink-muted">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow className="border-clay-border"><TableCell colSpan={6} className="h-48 text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-clay-ink-muted"/></TableCell></TableRow>
                                ) : requests.length > 0 ? (
                                    requests.map(req => (
                                        <TableRow key={req._id.toString()} className="border-clay-border">
                                            <TableCell className="text-[13px] font-medium text-clay-ink">{(req as any).employeeInfo?.firstName} {(req as any).employeeInfo?.lastName}</TableCell>
                                            <TableCell className="text-[13px] text-clay-ink">{format(new Date(req.startDate), 'dd/MM/yy')} - {format(new Date(req.endDate), 'dd/MM/yy')}</TableCell>
                                            <TableCell className="text-[13px] text-clay-ink">{formatDistance(new Date(req.endDate), new Date(req.startDate))}</TableCell>
                                            <TableCell className="text-[11.5px] text-clay-ink-muted">{req.reason}</TableCell>
                                            <TableCell><ClayBadge tone={getStatusTone(req.status)}>{req.status}</ClayBadge></TableCell>
                                            <TableCell className="text-right">
                                                {req.status === 'Pending' && (
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="outline" size="icon" onClick={() => handleAction(req._id.toString(), 'Approved')}><Check className="h-4 w-4"/></Button>
                                                        <Button variant="destructive" size="icon" onClick={() => handleAction(req._id.toString(), 'Rejected')}><X className="h-4 w-4"/></Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow className="border-clay-border"><TableCell colSpan={6} className="h-24 text-center text-[13px] text-clay-ink-muted">No leave requests found.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </ClayCard>
            </div>
        </>
    )
}

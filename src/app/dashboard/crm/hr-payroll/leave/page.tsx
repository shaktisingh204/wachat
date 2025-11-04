
'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCrmLeaveRequests, approveOrRejectLeave } from '@/app/actions/crm-hr.actions';
import type { WithId, CrmLeaveRequest } from '@/lib/definitions';
import { LoaderCircle, Check, X } from 'lucide-react';
import { format, formatDistance } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function LeaveManagementPage() {
    const [requests, setRequests] = useState<WithId<CrmLeaveRequest>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

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

    const getStatusVariant = (status: string) => {
        switch(status) {
            case 'Approved': return 'default';
            case 'Rejected': return 'destructive';
            default: return 'secondary';
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Leave Management</h1>
                    <p className="text-muted-foreground">Approve or reject leave requests from your team.</p>
                </div>
                <Button disabled>Apply for Leave</Button>
            </div>
            
             <Card>
                <CardHeader>
                    <CardTitle>Leave Requests</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Leave Dates</TableHead>
                                    <TableHead>Days</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="h-48 text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin"/></TableCell></TableRow>
                                ) : requests.length > 0 ? (
                                    requests.map(req => (
                                        <TableRow key={req._id.toString()}>
                                            <TableCell className="font-medium">{(req as any).employeeInfo?.firstName} {(req as any).employeeInfo?.lastName}</TableCell>
                                            <TableCell>{format(new Date(req.startDate), 'dd/MM/yy')} - {format(new Date(req.endDate), 'dd/MM/yy')}</TableCell>
                                            <TableCell>{formatDistance(new Date(req.endDate), new Date(req.startDate))}</TableCell>
                                            <TableCell className="text-muted-foreground text-xs">{req.reason}</TableCell>
                                            <TableCell><Badge variant={getStatusVariant(req.status)}>{req.status}</Badge></TableCell>
                                            <TableCell className="text-right">
                                                {req.status === 'Pending' && (
                                                    <div className="flex gap-2 justify-end">
                                                        <Button variant="outline" size="icon" onClick={() => handleAction(req._id.toString(), 'Approved')}><Check className="h-4 w-4"/></Button>
                                                        <Button variant="destructive" size="icon" onClick={() => handleAction(req._id.toString(), 'Rejected')}><X className="h-4 w-4"/></Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center">No leave requests found.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

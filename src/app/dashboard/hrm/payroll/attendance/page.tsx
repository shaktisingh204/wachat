'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { getCrmAttendance, markCrmAttendance } from '@/app/actions/crm-hr.actions';
import type { WithId, CrmEmployee, CrmAttendance } from '@/lib/definitions';
import { LoaderCircle, FileText, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

type EmployeeWithAttendance = WithId<CrmEmployee> & { attendanceStatus?: CrmAttendance['status'] };

export default function DailyAttendancePage() {
    const [employees, setEmployees] = useState<EmployeeWithAttendance[]>([]);
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [isLoading, startTransition] = useTransition();

    const fetchData = useCallback(() => {
        if (!date) return;
        startTransition(async () => {
            const [allEmployees, attendanceData] = await Promise.all([
                getCrmEmployees(),
                getCrmAttendance(date),
            ]);
            const attendanceMap = new Map(attendanceData.map(a => [a.employeeId.toString(), a.status]));
            const mergedData = allEmployees.map(emp => ({
                ...emp,
                attendanceStatus: attendanceMap.get(emp._id.toString()) || 'Absent'
            }));
            setEmployees(mergedData);
        });
    }, [date]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleStatusChange = (employeeId: string, status: CrmAttendance['status']) => {
        if(!date) return;
        startTransition(async () => {
            await markCrmAttendance(employeeId, status, date);
            fetchData();
        })
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Daily Attendance"
                subtitle="Mark and review attendance for your team."
                icon={CheckSquare}
                actions={
                    <>
                        <DatePicker date={date} setDate={setDate} />
                        <ClayButton variant="pill" leading={<FileText className="h-4 w-4" strokeWidth={1.75} />}>
                            Download Report
                        </ClayButton>
                    </>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Attendance for {date ? format(date, 'PPP') : '...'}</h2>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Employee</TableHead>
                                <TableHead className="text-clay-ink-muted">Department</TableHead>
                                <TableHead className="w-48 text-clay-ink-muted">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-clay-border"><TableCell colSpan={3} className="h-48 text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-clay-ink-muted"/></TableCell></TableRow>
                            ) : employees.length > 0 ? (
                                employees.map(emp => (
                                    <TableRow key={emp._id.toString()} className="border-clay-border">
                                        <TableCell className="text-[13px] font-medium text-clay-ink">{emp.firstName} {emp.lastName}</TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">{(emp as any).departmentName || 'N/A'}</TableCell>
                                        <TableCell>
                                            <Select value={emp.attendanceStatus} onValueChange={(val) => handleStatusChange(emp._id.toString(), val as any)}>
                                                <SelectTrigger className={emp.attendanceStatus === 'Present' ? 'border-clay-green' : emp.attendanceStatus === 'Absent' ? 'border-destructive' : ''}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Present">Present</SelectItem>
                                                    <SelectItem value="Absent">Absent</SelectItem>
                                                    <SelectItem value="Half Day">Half Day</SelectItem>
                                                    <SelectItem value="Leave">Leave</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-clay-border"><TableCell colSpan={3} className="h-24 text-center text-[13px] text-clay-ink-muted">No employees found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}

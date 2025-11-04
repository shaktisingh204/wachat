
'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { getCrmAttendance, markCrmAttendance } from '@/app/actions/crm-hr.actions';
import type { WithId, CrmEmployee, CrmAttendance } from '@/lib/definitions';
import { LoaderCircle, FileText } from 'lucide-react';
import { format } from 'date-fns';

type EmployeeWithAttendance = WithId<CrmEmployee> & { attendanceStatus?: CrmAttendance['status'] };

const getStatusVariant = (status: CrmAttendance['status']) => {
    switch(status) {
        case 'Present': return 'default';
        case 'Absent': return 'destructive';
        case 'Half Day': return 'secondary';
        case 'Leave': return 'outline';
        default: return 'outline';
    }
};

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
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Daily Attendance</h1>
                    <p className="text-muted-foreground">Mark and review attendance for your team.</p>
                </div>
                <div className="flex items-center gap-2">
                    <DatePicker date={date} setDate={setDate} />
                    <Button variant="outline"><FileText className="mr-2 h-4 w-4"/>Download Report</Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Attendance for {date ? format(date, 'PPP') : '...'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead className="w-48">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={3} className="h-48 text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin"/></TableCell></TableRow>
                                ) : employees.length > 0 ? (
                                    employees.map(emp => (
                                        <TableRow key={emp._id.toString()}>
                                            <TableCell className="font-medium">{emp.firstName} {emp.lastName}</TableCell>
                                            <TableCell>{(emp as any).departmentName || 'N/A'}</TableCell>
                                            <TableCell>
                                                <Select value={emp.attendanceStatus} onValueChange={(val) => handleStatusChange(emp._id.toString(), val as any)}>
                                                    <SelectTrigger className={emp.attendanceStatus === 'Present' ? 'border-primary' : emp.attendanceStatus === 'Absent' ? 'border-destructive' : ''}>
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
                                    <TableRow><TableCell colSpan={3} className="h-24 text-center">No employees found.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

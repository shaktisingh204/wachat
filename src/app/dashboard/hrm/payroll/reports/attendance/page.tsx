'use client';

import { Download, SlidersHorizontal, CalendarCheck, LoaderCircle, Users, TrendingUp, UserCheck, UserX } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateAttendanceReportData, getReportEmployees, getReportDepartments } from '@/app/actions/crm-hr-reports.actions';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

type AttendanceRow = {
    employeeId: string;
    employeeName: string;
    department: string;
    present: number;
    absent: number;
    late: number;
    wfh: number;
    halfDay: number;
    leave: number;
    totalWorkingDays: number;
    attendancePercentage: number;
};

type Summary = {
    totalEmployees: number;
    overallAttendance: number;
    totalPresent: number;
    totalAbsent: number;
};

type SelectItem = { _id: string; name: string };

const StatCard = ({ title, value, sub, icon: Icon }: { title: string; value: string; sub?: string; icon: React.ElementType }) => (
    <ClayCard className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-muted-foreground">{title}</p>
            <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        {sub ? <p className="text-[11.5px] text-muted-foreground">{sub}</p> : null}
    </ClayCard>
);

function attendanceBadgeTone(pct: number): 'green' | 'amber' | 'red' {
    if (pct >= 85) return 'green';
    if (pct >= 70) return 'amber';
    return 'red';
}

export default function AttendanceReportPage() {
    const [reportData, setReportData] = useState<AttendanceRow[]>([]);
    const [summary, setSummary] = useState<Summary>({ totalEmployees: 0, overallAttendance: 0, totalPresent: 0, totalAbsent: 0 });
    const [employees, setEmployees] = useState<SelectItem[]>([]);
    const [departments, setDepartments] = useState<SelectItem[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    const [startDate, setStartDate] = useState<Date | undefined>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [endDate, setEndDate] = useState<Date | undefined>(new Date());
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [selectedDept, setSelectedDept] = useState('');

    // Load filter options once
    useEffect(() => {
        getReportEmployees().then(r => { if (r.data) setEmployees(r.data); });
        getReportDepartments().then(r => { if (r.data) setDepartments(r.data); });
    }, []);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const result = await generateAttendanceReportData({
                startDate,
                endDate,
                employeeId: selectedEmployee || undefined,
                departmentId: selectedDept || undefined,
            });
            if (result.error) {
                toast({ title: 'Error generating report', description: result.error, variant: 'destructive' });
            } else {
                setReportData(result.data ?? []);
                setSummary(result.summary ?? { totalEmployees: 0, overallAttendance: 0, totalPresent: 0, totalAbsent: 0 });
            }
        });
    }, [startDate, endDate, selectedEmployee, selectedDept, toast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDownload = () => {
        if (reportData.length === 0) {
            toast({ title: 'No Data', description: 'There is no data to download.' });
            return;
        }
        const csv = Papa.unparse(reportData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${format(startDate ?? new Date(), 'yyyy-MM-dd')}_to_${format(endDate ?? new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Attendance Report"
                subtitle="Detailed attendance summary for your employees."
                icon={CalendarCheck}
                actions={
                    <>
                        <Popover>
                            <PopoverTrigger asChild>
                                <ClayButton variant="pill" leading={<SlidersHorizontal className="h-4 w-4" />}>
                                    Filters
                                </ClayButton>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 space-y-4 p-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[12.5px]">Start Date</Label>
                                    <DatePicker date={startDate} setDate={setStartDate} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[12.5px]">End Date</Label>
                                    <DatePicker date={endDate} setDate={setEndDate} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[12.5px]">Employee</Label>
                                    <select
                                        value={selectedEmployee}
                                        onChange={e => setSelectedEmployee(e.target.value)}
                                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        <option value="">All Employees</option>
                                        {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[12.5px]">Department</Label>
                                    <select
                                        value={selectedDept}
                                        onChange={e => setSelectedDept(e.target.value)}
                                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        <option value="">All Departments</option>
                                        {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                                    </select>
                                </div>
                                <ClayButton variant="obsidian" onClick={fetchData} disabled={isLoading} className="w-full">
                                    {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Apply Filters
                                </ClayButton>
                            </PopoverContent>
                        </Popover>
                        <ClayButton
                            variant="pill"
                            onClick={handleDownload}
                            disabled={isLoading || reportData.length === 0}
                            leading={<Download className="h-4 w-4" />}
                        >
                            Download CSV
                        </ClayButton>
                    </>
                }
            />

            {/* Summary stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Employees" value={summary.totalEmployees.toLocaleString()} icon={Users} />
                <StatCard title="Overall Attendance" value={`${summary.overallAttendance.toFixed(1)}%`} sub="Avg across all employees" icon={TrendingUp} />
                <StatCard title="Total Present Days" value={summary.totalPresent.toLocaleString()} icon={UserCheck} />
                <StatCard title="Total Absent Days" value={summary.totalAbsent.toLocaleString()} icon={UserX} />
            </div>

            <ClayCard>
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-[16px] font-semibold text-foreground">Employee Attendance Breakdown</h2>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                            {startDate && endDate
                                ? `${format(startDate, 'dd MMM yyyy')} – ${format(endDate, 'dd MMM yyyy')}`
                                : 'All time'}
                        </p>
                    </div>
                    {reportData.length > 0 && (
                        <span className="text-[12.5px] text-muted-foreground">{reportData.length} employee{reportData.length !== 1 ? 's' : ''}</span>
                    )}
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-border bg-secondary">
                                <th className="px-4 py-3 font-medium text-muted-foreground">Employee</th>
                                <th className="px-4 py-3 font-medium text-muted-foreground">Department</th>
                                <th className="px-4 py-3 text-center font-medium text-green-600">Present</th>
                                <th className="px-4 py-3 text-center font-medium text-red-600">Absent</th>
                                <th className="px-4 py-3 text-center font-medium text-amber-500">Late</th>
                                <th className="px-4 py-3 text-center font-medium text-sky-500">WFH</th>
                                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Half Day</th>
                                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Leave</th>
                                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Total Days</th>
                                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Attendance %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={10} className="h-48 text-center">
                                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                                    </td>
                                </tr>
                            ) : reportData.length > 0 ? (
                                <>
                                    {reportData.map(row => (
                                        <tr key={row.employeeId} className="border-b border-border last:border-0 hover:bg-secondary/50">
                                            <td className="px-4 py-3 font-medium text-foreground">{row.employeeName}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{row.department}</td>
                                            <td className="px-4 py-3 text-center font-semibold text-green-600">{row.present}</td>
                                            <td className="px-4 py-3 text-center font-semibold text-red-600">{row.absent}</td>
                                            <td className="px-4 py-3 text-center text-amber-500">{row.late}</td>
                                            <td className="px-4 py-3 text-center text-sky-500">{row.wfh}</td>
                                            <td className="px-4 py-3 text-center text-foreground">{row.halfDay}</td>
                                            <td className="px-4 py-3 text-center text-foreground">{row.leave}</td>
                                            <td className="px-4 py-3 text-center text-foreground">{row.totalWorkingDays}</td>
                                            <td className="px-4 py-3 text-center">
                                                <ClayBadge tone={attendanceBadgeTone(row.attendancePercentage)}>
                                                    {row.attendancePercentage.toFixed(1)}%
                                                </ClayBadge>
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Totals row */}
                                    <tr className="border-t-2 border-border bg-secondary font-semibold">
                                        <td className="px-4 py-3 text-foreground">Totals</td>
                                        <td className="px-4 py-3" />
                                        <td className="px-4 py-3 text-center text-green-600">{reportData.reduce((s, r) => s + r.present, 0)}</td>
                                        <td className="px-4 py-3 text-center text-red-600">{reportData.reduce((s, r) => s + r.absent, 0)}</td>
                                        <td className="px-4 py-3 text-center text-amber-500">{reportData.reduce((s, r) => s + r.late, 0)}</td>
                                        <td className="px-4 py-3 text-center text-sky-500">{reportData.reduce((s, r) => s + r.wfh, 0)}</td>
                                        <td className="px-4 py-3 text-center text-foreground">{reportData.reduce((s, r) => s + r.halfDay, 0)}</td>
                                        <td className="px-4 py-3 text-center text-foreground">{reportData.reduce((s, r) => s + r.leave, 0)}</td>
                                        <td className="px-4 py-3 text-center text-foreground">{reportData.reduce((s, r) => s + r.totalWorkingDays, 0)}</td>
                                        <td className="px-4 py-3 text-center text-foreground">
                                            {(reportData.reduce((s, r) => s + r.attendancePercentage, 0) / (reportData.length || 1)).toFixed(1)}%
                                        </td>
                                    </tr>
                                </>
                            ) : (
                                <tr>
                                    <td colSpan={10} className="h-24 text-center text-muted-foreground">
                                        No attendance data for the selected period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </ClayCard>
        </div>
    );
}

'use client';

import {
  Badge,
  Button,
  Card,
  Label,
  Popover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  useZoruToast,
  ZoruSelectItem,
} from '@/components/zoruui';
import {
  Download,
  SlidersHorizontal,
  LoaderCircle,
  Users,
  TrendingUp,
  UserCheck,
  UserX,
  FileText
} from 'lucide-react';
import { useState,
  useEffect,
  useTransition,
  useCallback } from 'react';
import { generateAttendanceReportData,
  getReportEmployees,
  getReportDepartments } from '@/app/actions/crm-hr-reports.actions';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ZoruDatePicker as DatePicker } from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';

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

type ZoruSelectItem = { _id: string; name: string };

const StatCard = ({ title, value, sub, icon: Icon }: { title: string; value: string; sub?: string; icon: React.ElementType }) => (
    <Card className="flex flex-col gap-1 p-6">
        <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-zoru-ink-muted">{title}</p>
            <Icon className="h-4 w-4 text-zoru-ink-muted" strokeWidth={1.75} />
        </div>
        <p className="mt-1 text-2xl text-zoru-ink">{value}</p>
        {sub ? <p className="text-[11.5px] text-zoru-ink-muted">{sub}</p> : null}
    </Card>
);

function attendanceBadgeVariant(pct: number): 'success' | 'warning' | 'danger' {
    if (pct >= 85) return 'success';
    if (pct >= 70) return 'warning';
    return 'danger';
}

export default function AttendanceReportPage() {
    const [reportData, setReportData] = useState<AttendanceRow[]>([]);
    const [summary, setSummary] = useState<Summary>({ totalEmployees: 0, overallAttendance: 0, totalPresent: 0, totalAbsent: 0 });
    const [employees, setEmployees] = useState<ZoruSelectItem[]>([]);
    const [departments, setDepartments] = useState<ZoruSelectItem[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useZoruToast();

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

    const handleDownloadCSV = () => {
        if (reportData.length === 0) {
            toast({ title: 'No Data', description: 'There is no data to download.' });
            return;
        }

        const worker = new Worker(new URL('./csv.worker.ts', import.meta.url));

        worker.onmessage = (e) => {
            const csv = e.data;
            const csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(csvBlob);
            const a = document.createElement('a');
            a.href = url;
            const startStr = startDate ? format(startDate, 'yyyy-MM-dd') : 'all-time';
            const endStr = endDate ? format(endDate, 'yyyy-MM-dd') : 'all-time';
            a.download = `attendance_${startStr}_to_${endStr}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            worker.terminate();
        };

        worker.postMessage(reportData);
    };

    const handleDownloadPDF = () => {
        if (reportData.length === 0) {
            toast({ title: 'No Data', description: 'There is no data to download.' });
            return;
        }

        const doc = new jsPDF();
        const startDateStr = startDate ? format(startDate, 'dd MMM yyyy') : 'All time';
        const endDateStr = endDate ? format(endDate, 'dd MMM yyyy') : 'All time';
        const period = startDate && endDate ? `${startDateStr} - ${endDateStr}` : 'All time';

        // Add Brand Background
        doc.setFillColor(41, 128, 185);
        doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('SabNode CRM', 14, 20);
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text('Management Attendance Report', 14, 30);
        
        // Reset Text Color for the rest of the document
        doc.setTextColor(0);
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Period: ${period}`, 14, 50);
        doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 56);
        
        // Add Summary
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary Overview', 14, 66);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(`Total Employees: ${summary.totalEmployees}`, 14, 72);
        doc.text(`Overall Attendance: ${summary.overallAttendance.toFixed(1)}%`, 80, 72);
        doc.text(`Total Present Days: ${summary.totalPresent}`, 14, 78);
        doc.text(`Total Absent Days: ${summary.totalAbsent}`, 80, 78);

        // Table Data
        const tableData = reportData.map(row => [
            row.employeeName,
            row.department,
            row.present,
            row.absent,
            row.late,
            row.wfh,
            row.halfDay,
            row.leave,
            row.totalWorkingDays,
            `${row.attendancePercentage.toFixed(1)}%`
        ]);

        // Totals row for table
        tableData.push([
            'Totals',
            '',
            reportData.reduce((s, r) => s + r.present, 0).toString(),
            reportData.reduce((s, r) => s + r.absent, 0).toString(),
            reportData.reduce((s, r) => s + r.late, 0).toString(),
            reportData.reduce((s, r) => s + r.wfh, 0).toString(),
            reportData.reduce((s, r) => s + r.halfDay, 0).toString(),
            reportData.reduce((s, r) => s + r.leave, 0).toString(),
            reportData.reduce((s, r) => s + r.totalWorkingDays, 0).toString(),
            `${(reportData.reduce((s, r) => s + r.attendancePercentage, 0) / (reportData.length || 1)).toFixed(1)}%`
        ]);

        autoTable(doc, {
            startY: 85,
            head: [['Employee', 'Department', 'Present', 'Absent', 'Late', 'WFH', 'Half Day', 'Leave', 'Total Days', 'Attendance %']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] },
            styles: { fontSize: 8 },
            willDrawCell: (data) => {
                if (data.row.index === tableData.length - 1) {
                    doc.setFont('helvetica', 'bold');
                }
            },
        });

        // Add Footer with Page Numbers
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
            doc.text('Confidential - Internal Use Only', 14, doc.internal.pageSize.height - 10);
        }

        const startStr = startDate ? format(startDate, 'yyyy-MM-dd') : 'all-time';
        const endStr = endDate ? format(endDate, 'yyyy-MM-dd') : 'all-time';
        doc.save(`Attendance_Report_${startStr}_to_${endStr}.pdf`);
    };

    return (
        <EntityListShell
            title="Attendance Report"
            subtitle="Detailed attendance summary for your employees."
            primaryAction={
                <>
                    <Popover>
                        <ZoruPopoverTrigger asChild>
                            <Button variant="outline">
                                <SlidersHorizontal className="h-4 w-4" />
                                Filters
                            </Button>
                        </ZoruPopoverTrigger>
                            <ZoruPopoverContent className="w-80 space-y-4 p-4">
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
                                        className="w-full rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2 text-[13px] text-zoru-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                                        className="w-full rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2 text-[13px] text-zoru-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        <option value="">All Departments</option>
                                        {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                                    </select>
                                </div>
                                <Button onClick={fetchData} disabled={isLoading} className="w-full">
                                    {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Apply Filters
                                </Button>
                            </ZoruPopoverContent>
                        </Popover>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={handleDownloadCSV}
                                disabled={isLoading || reportData.length === 0}
                            >
                                <Download className="h-4 w-4" />
                                Download CSV
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleDownloadPDF}
                                disabled={isLoading || reportData.length === 0}
                            >
                                <FileText className="h-4 w-4" />
                                Download PDF
                            </Button>
                        </div>
                    </>
                }
        >

            {/* Summary stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Employees" value={summary.totalEmployees.toLocaleString()} icon={Users} />
                <StatCard title="Overall Attendance" value={`${summary.overallAttendance.toFixed(1)}%`} sub="Avg across all employees" icon={TrendingUp} />
                <StatCard title="Total Present Days" value={summary.totalPresent.toLocaleString()} icon={UserCheck} />
                <StatCard title="Total Absent Days" value={summary.totalAbsent.toLocaleString()} icon={UserX} />
            </div>

            <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-[16px] text-zoru-ink">Employee Attendance Breakdown</h2>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                            {startDate && endDate
                                ? `${format(startDate, 'dd MMM yyyy')} – ${format(endDate, 'dd MMM yyyy')}`
                                : 'All time'}
                        </p>
                    </div>
                    {reportData.length > 0 && (
                        <span className="text-[12.5px] text-zoru-ink-muted">{reportData.length} employee{reportData.length !== 1 ? 's' : ''}</span>
                    )}
                </div>

                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-zoru-line bg-zoru-surface-2">
                                <th className="px-4 py-3 font-medium text-zoru-ink-muted">Employee</th>
                                <th className="px-4 py-3 font-medium text-zoru-ink-muted">Department</th>
                                <th className="px-4 py-3 text-center font-medium text-green-600">Present</th>
                                <th className="px-4 py-3 text-center font-medium text-red-600">Absent</th>
                                <th className="px-4 py-3 text-center font-medium text-amber-500">Late</th>
                                <th className="px-4 py-3 text-center font-medium text-sky-500">WFH</th>
                                <th className="px-4 py-3 text-center font-medium text-zoru-ink-muted">Half Day</th>
                                <th className="px-4 py-3 text-center font-medium text-zoru-ink-muted">Leave</th>
                                <th className="px-4 py-3 text-center font-medium text-zoru-ink-muted">Total Days</th>
                                <th className="px-4 py-3 text-center font-medium text-zoru-ink-muted">Attendance %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={10} className="h-48 text-center">
                                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-zoru-ink-muted" />
                                    </td>
                                </tr>
                            ) : reportData.length > 0 ? (
                                <>
                                    {reportData.map(row => (
                                        <tr key={row.employeeId} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50">
                                            <td className="px-4 py-3 font-medium text-zoru-ink">{row.employeeName}</td>
                                            <td className="px-4 py-3 text-zoru-ink-muted">{row.department}</td>
                                            <td className="px-4 py-3 text-center font-semibold text-green-600">{row.present}</td>
                                            <td className="px-4 py-3 text-center font-semibold text-red-600">{row.absent}</td>
                                            <td className="px-4 py-3 text-center text-amber-500">{row.late}</td>
                                            <td className="px-4 py-3 text-center text-sky-500">{row.wfh}</td>
                                            <td className="px-4 py-3 text-center text-zoru-ink">{row.halfDay}</td>
                                            <td className="px-4 py-3 text-center text-zoru-ink">{row.leave}</td>
                                            <td className="px-4 py-3 text-center text-zoru-ink">{row.totalWorkingDays}</td>
                                            <td className="px-4 py-3 text-center">
                                                <Badge variant={attendanceBadgeVariant(row.attendancePercentage)}>
                                                    {row.attendancePercentage.toFixed(1)}%
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Totals row */}
                                    <tr className="border-t-2 border-zoru-line bg-zoru-surface-2 font-semibold">
                                        <td className="px-4 py-3 text-zoru-ink">Totals</td>
                                        <td className="px-4 py-3" />
                                        <td className="px-4 py-3 text-center text-green-600">{reportData.reduce((s, r) => s + r.present, 0)}</td>
                                        <td className="px-4 py-3 text-center text-red-600">{reportData.reduce((s, r) => s + r.absent, 0)}</td>
                                        <td className="px-4 py-3 text-center text-amber-500">{reportData.reduce((s, r) => s + r.late, 0)}</td>
                                        <td className="px-4 py-3 text-center text-sky-500">{reportData.reduce((s, r) => s + r.wfh, 0)}</td>
                                        <td className="px-4 py-3 text-center text-zoru-ink">{reportData.reduce((s, r) => s + r.halfDay, 0)}</td>
                                        <td className="px-4 py-3 text-center text-zoru-ink">{reportData.reduce((s, r) => s + r.leave, 0)}</td>
                                        <td className="px-4 py-3 text-center text-zoru-ink">{reportData.reduce((s, r) => s + r.totalWorkingDays, 0)}</td>
                                        <td className="px-4 py-3 text-center text-zoru-ink">
                                            {(reportData.reduce((s, r) => s + r.attendancePercentage, 0) / (reportData.length || 1)).toFixed(1)}%
                                        </td>
                                    </tr>
                                </>
                            ) : (
                                <tr>
                                    <td colSpan={10} className="h-24 text-center text-zoru-ink-muted">
                                        No attendance data for the selected period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </EntityListShell>
    );
}

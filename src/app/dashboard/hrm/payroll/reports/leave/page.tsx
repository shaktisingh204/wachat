'use client';

import { ZoruBadge, ZoruButton, ZoruCard, ZoruLabel, ZoruPopover, ZoruPopoverContent, ZoruPopoverTrigger, useZoruToast } from '@/components/zoruui';
import {
  Download,
  SlidersHorizontal,
  CalendarX,
  LoaderCircle,
  Users,
  CheckCircle2,
  Clock } from 'lucide-react';
import { useState,
  useEffect,
  useTransition,
  useCallback } from 'react';
import { generateLeaveReportData,
  getReportEmployees,
  getReportLeaveTypes } from '@/app/actions/crm-hr-reports.actions';
import Papa from 'papaparse';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

type LeaveRow = {
    employeeId: string;
    employeeName: string;
    leaveType: string;
    allocated: number;
    used: number;
    pending: number;
    remaining: number;
};

type Summary = { totalEmployees: number; totalUsed: number; totalPending: number };

type SelectItem = { _id: string; name: string };

const StatCard = ({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ElementType }) => (
    <ZoruCard className="flex flex-col gap-1 p-6">
        <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-zoru-ink-muted">{title}</p>
            <Icon className="h-4 w-4 text-zoru-ink-muted" strokeWidth={1.75} />
        </div>
        <p className="mt-1 text-2xl text-zoru-ink">{value}</p>
    </ZoruCard>
);

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

export default function LeaveReportPage() {
    const [reportData, setReportData] = useState<LeaveRow[]>([]);
    const [summary, setSummary] = useState<Summary>({ totalEmployees: 0, totalUsed: 0, totalPending: 0 });
    const [employees, setEmployees] = useState<SelectItem[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<string[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useZoruToast();

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [selectedLeaveType, setSelectedLeaveType] = useState('');

    useEffect(() => {
        getReportEmployees().then(r => { if (r.data) setEmployees(r.data); });
        getReportLeaveTypes().then(r => { if (r.data) setLeaveTypes(r.data); });
    }, []);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const result = await generateLeaveReportData({
                year: selectedYear,
                employeeId: selectedEmployee || undefined,
                leaveType: selectedLeaveType || undefined,
            });
            if (result.error) {
                toast({ title: 'Error generating report', description: result.error, variant: 'destructive' });
            } else {
                setReportData(result.data ?? []);
                setSummary(result.summary ?? { totalEmployees: 0, totalUsed: 0, totalPending: 0 });
            }
        });
    }, [selectedYear, selectedEmployee, selectedLeaveType, toast]);

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
        a.download = `leave_report_${selectedYear}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Leave Report"
                subtitle="Leave allocation, usage, pending requests, and remaining balances."
                icon={CalendarX}
                actions={
                    <>
                        <ZoruPopover>
                            <ZoruPopoverTrigger asChild>
                                <ZoruButton variant="outline">
                                    <SlidersHorizontal className="h-4 w-4" />
                                    Filters
                                </ZoruButton>
                            </ZoruPopoverTrigger>
                            <ZoruPopoverContent className="w-72 space-y-4 p-4">
                                <div className="space-y-1.5">
                                    <ZoruLabel className="text-[12.5px]">Year</ZoruLabel>
                                    <select
                                        value={selectedYear}
                                        onChange={e => setSelectedYear(Number(e.target.value))}
                                        className="w-full rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2 text-[13px] text-zoru-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <ZoruLabel className="text-[12.5px]">Employee</ZoruLabel>
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
                                    <ZoruLabel className="text-[12.5px]">Leave Type</ZoruLabel>
                                    <select
                                        value={selectedLeaveType}
                                        onChange={e => setSelectedLeaveType(e.target.value)}
                                        className="w-full rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2 text-[13px] text-zoru-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        <option value="">All Types</option>
                                        {leaveTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <ZoruButton onClick={fetchData} disabled={isLoading} className="w-full">
                                    {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Apply Filters
                                </ZoruButton>
                            </ZoruPopoverContent>
                        </ZoruPopover>
                        <ZoruButton
                            variant="outline"
                            onClick={handleDownload}
                            disabled={isLoading || reportData.length === 0}
                        >
                            <Download className="h-4 w-4" />
                            Download CSV
                        </ZoruButton>
                    </>
                }
            />

            {/* Summary stat cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard title="Employees with Leave" value={summary.totalEmployees} icon={Users} />
                <StatCard title="Total Days Used" value={summary.totalUsed} icon={CheckCircle2} />
                <StatCard title="Total Days Pending" value={summary.totalPending} icon={Clock} />
            </div>

            <ZoruCard className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-[16px] text-zoru-ink">Leave Consumption Summary</h2>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">Year {selectedYear}</p>
                    </div>
                    {reportData.length > 0 && (
                        <span className="text-[12.5px] text-zoru-ink-muted">{reportData.length} record{reportData.length !== 1 ? 's' : ''}</span>
                    )}
                </div>

                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-zoru-line bg-zoru-surface-2">
                                <th className="px-4 py-3 font-medium text-zoru-ink-muted">Employee</th>
                                <th className="px-4 py-3 font-medium text-zoru-ink-muted">Leave Type</th>
                                <th className="px-4 py-3 text-center font-medium text-zoru-ink-muted">Allocated</th>
                                <th className="px-4 py-3 text-center font-medium text-green-600">Used</th>
                                <th className="px-4 py-3 text-center font-medium text-amber-500">Pending</th>
                                <th className="px-4 py-3 text-center font-medium text-sky-500">Remaining</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="h-48 text-center">
                                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-zoru-ink-muted" />
                                    </td>
                                </tr>
                            ) : reportData.length > 0 ? (
                                <>
                                    {reportData.map((row, i) => (
                                        <tr key={`${row.employeeId}-${row.leaveType}-${i}`} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50">
                                            <td className="px-4 py-3 font-medium text-zoru-ink">{row.employeeName}</td>
                                            <td className="px-4 py-3">
                                                <ZoruBadge variant="secondary">{row.leaveType}</ZoruBadge>
                                            </td>
                                            <td className="px-4 py-3 text-center text-zoru-ink">{row.allocated}</td>
                                            <td className="px-4 py-3 text-center font-semibold text-green-600">{row.used}</td>
                                            <td className="px-4 py-3 text-center font-semibold text-amber-500">{row.pending}</td>
                                            <td className="px-4 py-3 text-center">
                                                <ZoruBadge variant={row.remaining > 0 ? 'info' : 'danger'}>{row.remaining}</ZoruBadge>
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Totals row */}
                                    <tr className="border-t-2 border-zoru-line bg-zoru-surface-2 font-semibold">
                                        <td className="px-4 py-3 text-zoru-ink">Totals</td>
                                        <td className="px-4 py-3" />
                                        <td className="px-4 py-3 text-center text-zoru-ink">{reportData.reduce((s, r) => s + r.allocated, 0)}</td>
                                        <td className="px-4 py-3 text-center text-green-600">{reportData.reduce((s, r) => s + r.used, 0)}</td>
                                        <td className="px-4 py-3 text-center text-amber-500">{reportData.reduce((s, r) => s + r.pending, 0)}</td>
                                        <td className="px-4 py-3 text-center text-zoru-ink">{reportData.reduce((s, r) => s + r.remaining, 0)}</td>
                                    </tr>
                                </>
                            ) : (
                                <tr>
                                    <td colSpan={6} className="h-24 text-center text-zoru-ink-muted">
                                        No leave data found for the selected filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </ZoruCard>
        </div>
    );
}

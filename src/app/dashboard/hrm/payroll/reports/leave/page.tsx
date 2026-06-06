'use client';

import { Badge, Button, Card, Label, Popover, PopoverContent, PopoverTrigger, useToast } from '@/components/sabcrm/20ui/compat';
import {
  Download,
  SlidersHorizontal,
  LoaderCircle,
  Users,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useState,
  useEffect,
  useTransition,
  useCallback,
  useMemo,
  Fragment } from 'react';
import { generateLeaveReportData,
  getReportEmployees,
  getReportLeaveTypes } from '@/app/actions/crm-hr-reports.actions';
import Papa from 'papaparse';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type LeaveRow = {
    employeeId: string;
    employeeName: string;
    leaveType: string;
    allocated: number;
    used: number;
    pending: number;
    remaining: number;
};



type SelectItem = { _id: string; name: string };

const StatCard = ({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ElementType }) => (
    <Card className="flex flex-col gap-1 p-6">
        <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)]">{title}</p>
            <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
        </div>
        <p className="mt-1 text-2xl text-[var(--st-text)]">{value}</p>
    </Card>
);

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export default function LeaveReportPage() {
    const [reportData, setReportData] = useState<LeaveRow[]>([]);

    const [employees, setEmployees] = useState<SelectItem[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<string[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [selectedLeaveType, setSelectedLeaveType] = useState('');
    
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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

                setExpandedRows(new Set()); // Reset expanded rows on new data
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

    const actualTotalEmployees = useMemo(() => new Set(reportData.map(r => r.employeeId)).size, [reportData]);
    const totalUsed = useMemo(() => reportData.reduce((sum, r) => sum + r.used, 0), [reportData]);
    const totalPending = useMemo(() => reportData.reduce((sum, r) => sum + r.pending, 0), [reportData]);

    const groupedData = useMemo(() => {
        const map = new Map<string, {
            employeeId: string;
            employeeName: string;
            allocated: number;
            used: number;
            pending: number;
            remaining: number;
            breakdown: LeaveRow[];
        }>();
        
        reportData.forEach(row => {
            if (!map.has(row.employeeId)) {
                map.set(row.employeeId, {
                    employeeId: row.employeeId,
                    employeeName: row.employeeName,
                    allocated: 0,
                    used: 0,
                    pending: 0,
                    remaining: 0,
                    breakdown: []
                });
            }
            const g = map.get(row.employeeId)!;
            g.allocated += row.allocated;
            g.used += row.used;
            g.pending += row.pending;
            g.remaining += row.remaining;
            g.breakdown.push(row);
        });
        
        return Array.from(map.values());
    }, [reportData]);

    const leaveTypeData = useMemo(() => {
        const map = new Map<string, number>();
        reportData.forEach(row => {
            map.set(row.leaveType, (map.get(row.leaveType) || 0) + row.used);
        });
        return Array.from(map.entries())
            .map(([name, value]) => ({ name, value }))
            .filter(item => item.value > 0);
    }, [reportData]);

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <EntityListShell
            title="Leave Report"
            subtitle="Leave allocation, usage, pending requests, and remaining balances."
            primaryAction={
                <>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline">
                                <SlidersHorizontal className="h-4 w-4" />
                                Filters
                            </Button>
                        </PopoverTrigger>
                            <PopoverContent className="w-72 space-y-4 p-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[12.5px]">Year</Label>
                                    <select
                                        value={selectedYear}
                                        onChange={e => setSelectedYear(Number(e.target.value))}
                                        className="w-full rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-[13px] text-[var(--st-text)] focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[12.5px]">Employee</Label>
                                    <select
                                        value={selectedEmployee}
                                        onChange={e => setSelectedEmployee(e.target.value)}
                                        className="w-full rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-[13px] text-[var(--st-text)] focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        <option value="">All Employees</option>
                                        {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[12.5px]">Leave Type</Label>
                                    <select
                                        value={selectedLeaveType}
                                        onChange={e => setSelectedLeaveType(e.target.value)}
                                        className="w-full rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-[13px] text-[var(--st-text)] focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        <option value="">All Types</option>
                                        {leaveTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <Button onClick={fetchData} disabled={isLoading} className="w-full">
                                    {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Apply Filters
                                </Button>
                            </PopoverContent>
                        </Popover>
                        <Button
                            variant="outline"
                            onClick={handleDownload}
                            disabled={isLoading || reportData.length === 0}
                        >
                            <Download className="h-4 w-4" />
                            Download CSV
                        </Button>
                    </>
                }
        >

            {/* Summary stat cards */}
            <div className="grid gap-4 sm:grid-cols-3 mb-4">
                <StatCard title="Employees with Leave" value={actualTotalEmployees} icon={Users} />
                <StatCard title="Total Days Used" value={totalUsed} icon={CheckCircle2} />
                <StatCard title="Total Days Pending" value={totalPending} icon={Clock} />
            </div>
            
            {/* Visualizations */}
            {reportData.length > 0 && !isLoading && leaveTypeData.length > 0 && (
                <Card className="p-6 mb-4">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-[16px] text-[var(--st-text)]">Leave Types Used</h2>
                            <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">Breakdown of consumed leaves by type</p>
                        </div>
                    </div>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={leaveTypeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="value"
                                    nameKey="name"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {leaveTypeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    formatter={(value: number) => [`${value} days`, 'Used']}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '13px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            )}

            <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-[16px] text-[var(--st-text)]">Leave Consumption Summary</h2>
                        <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">Year {selectedYear}</p>
                    </div>
                    {reportData.length > 0 && (
                        <span className="text-[12.5px] text-[var(--st-text-secondary)]">{groupedData.length} employee{groupedData.length !== 1 ? 's' : ''}</span>
                    )}
                </div>

                <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                                <th className="px-4 py-3 font-medium text-[var(--st-text-secondary)]">Employee</th>
                                <th className="px-4 py-3 font-medium text-[var(--st-text-secondary)]">Leave Type</th>
                                <th className="px-4 py-3 text-center font-medium text-[var(--st-text-secondary)]">Allocated</th>
                                <th className="px-4 py-3 text-center font-medium text-[var(--st-text)]">Used</th>
                                <th className="px-4 py-3 text-center font-medium text-[var(--st-text)]">Pending</th>
                                <th className="px-4 py-3 text-center font-medium text-[var(--st-text)]">Remaining</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="h-48 text-center">
                                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[var(--st-text-secondary)]" />
                                    </td>
                                </tr>
                            ) : groupedData.length > 0 ? (
                                <>
                                    {groupedData.map((group, i) => (
                                        <Fragment key={group.employeeId}>
                                            <tr 
                                                onClick={() => toggleRow(group.employeeId)} 
                                                className="cursor-pointer border-b border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]/50"
                                            >
                                                <td className="px-4 py-3 font-medium text-[var(--st-text)] flex items-center gap-2">
                                                    {expandedRows.has(group.employeeId) ? (
                                                        <ChevronDown className="h-4 w-4 text-[var(--st-text-secondary)]" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 text-[var(--st-text-secondary)]" />
                                                    )}
                                                    {group.employeeName}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-[var(--st-text-secondary)] text-[12.5px]">
                                                        {group.breakdown.length} Type{group.breakdown.length !== 1 ? 's' : ''}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center text-[var(--st-text)]">{group.allocated}</td>
                                                <td className="px-4 py-3 text-center font-semibold text-[var(--st-text)]">{group.used}</td>
                                                <td className="px-4 py-3 text-center font-semibold text-[var(--st-text)]">{group.pending}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge variant={group.remaining > 0 ? 'info' : 'danger'}>{group.remaining}</Badge>
                                                </td>
                                            </tr>
                                            {expandedRows.has(group.employeeId) && group.breakdown.map((row, j) => (
                                                <tr 
                                                    key={`${row.employeeId}-${row.leaveType}-${j}`} 
                                                    className="border-b border-[var(--st-border)]/50 bg-[var(--st-bg-muted)]/30 last:border-b-0 hover:bg-[var(--st-bg-muted)]/70"
                                                >
                                                    <td className="px-4 py-2 pl-10 text-[12.5px] text-[var(--st-text-secondary)]"></td>
                                                    <td className="px-4 py-2">
                                                        <Badge variant="secondary" className="text-[11px] font-medium">{row.leaveType}</Badge>
                                                    </td>
                                                    <td className="px-4 py-2 text-center text-[var(--st-text-secondary)]">{row.allocated}</td>
                                                    <td className="px-4 py-2 text-center font-medium text-[var(--st-text)]/80">{row.used}</td>
                                                    <td className="px-4 py-2 text-center font-medium text-[var(--st-text)]/80">{row.pending}</td>
                                                    <td className="px-4 py-2 text-center text-[var(--st-text-secondary)]">{row.remaining}</td>
                                                </tr>
                                            ))}
                                        </Fragment>
                                    ))}
                                    {/* Totals row */}
                                    <tr className="border-t-2 border-[var(--st-border)] bg-[var(--st-bg-muted)] font-semibold">
                                        <td className="px-4 py-3 text-[var(--st-text)]">Totals</td>
                                        <td className="px-4 py-3" />
                                        <td className="px-4 py-3 text-center text-[var(--st-text)]">{groupedData.reduce((s, r) => s + r.allocated, 0)}</td>
                                        <td className="px-4 py-3 text-center text-[var(--st-text)]">{groupedData.reduce((s, r) => s + r.used, 0)}</td>
                                        <td className="px-4 py-3 text-center text-[var(--st-text)]">{groupedData.reduce((s, r) => s + r.pending, 0)}</td>
                                        <td className="px-4 py-3 text-center text-[var(--st-text)]">{groupedData.reduce((s, r) => s + r.remaining, 0)}</td>
                                    </tr>
                                </>
                            ) : (
                                <tr>
                                    <td colSpan={6} className="h-24 text-center text-[var(--st-text-secondary)]">
                                        No leave data found for the selected filters.
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


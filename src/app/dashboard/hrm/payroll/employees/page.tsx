'use client';

import { useEffect, useState, useTransition } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Users, Search, Edit } from "lucide-react";
import Link from 'next/link';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WithId, CrmEmployee } from '@/lib/definitions';
import { format } from 'date-fns';

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

export default function EmployeeDirectoryPage() {
    const [employees, setEmployees] = useState<WithId<CrmEmployee>[]>([]);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const data = await getCrmEmployees();
            setEmployees(data);
        });
    }, []);

    const getStatusTone = (status: string): 'green' | 'neutral' | 'red' => {
        if (status === 'Active') return 'green';
        if (status === 'Inactive') return 'neutral';
        return 'red';
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Employee Directory"
                subtitle="Search and manage all employees in your organization."
                icon={Users}
                actions={
                    <Link href="/dashboard/hrm/payroll/employees/new">
                        <ClayButton
                            variant="obsidian"
                            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
                        >
                            Add Employee
                        </ClayButton>
                    </Link>
                }
            />

            <ClayCard>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] font-semibold text-foreground">All Employees</h2>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">Browse and manage employee records.</p>
                    </div>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="Search employees..." className="h-10 rounded-lg border-border bg-card pl-9 text-[13px]" />
                    </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Employee Name</TableHead>
                                <TableHead className="text-muted-foreground">Department</TableHead>
                                <TableHead className="text-muted-foreground">Designation</TableHead>
                                <TableHead className="text-muted-foreground">Date of Joining</TableHead>
                                <TableHead className="text-muted-foreground">Status</TableHead>
                                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-border"><TableCell colSpan={6} className="h-24 text-center text-[13px] text-muted-foreground">Loading...</TableCell></TableRow>
                            ) : employees.length > 0 ? (
                                employees.map(emp => (
                                    <TableRow key={emp._id.toString()} className="border-border">
                                        <TableCell>
                                            <div className="text-[13px] font-medium text-foreground">{emp.firstName} {emp.lastName}</div>
                                            <div className="text-[11.5px] text-muted-foreground">{emp.email}</div>
                                        </TableCell>
                                        <TableCell className="text-[13px] text-foreground">{(emp as any).departmentName || 'N/A'}</TableCell>
                                        <TableCell className="text-[13px] text-foreground">{(emp as any).designationName || 'N/A'}</TableCell>
                                        <TableCell className="text-[13px] text-foreground">{format(new Date(emp.dateOfJoining), 'PPP')}</TableCell>
                                        <TableCell><ClayBadge tone={getStatusTone(emp.status)}>{emp.status}</ClayBadge></TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" asChild>
                                                <Link href={`/dashboard/hrm/payroll/employees/${emp._id.toString()}/edit`}><Edit className="h-4 w-4"/></Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-border"><TableCell colSpan={6} className="h-24 text-center text-[13px] text-muted-foreground">No employees found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}

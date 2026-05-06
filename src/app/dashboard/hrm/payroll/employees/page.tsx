'use client';

import { useEffect, useState, useTransition } from 'react';
import {
    ZoruTable,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    ZoruInput,
    ZoruCard,
    ZoruBadge,
    ZoruButton,
} from '@/components/zoruui';
import { Plus, Users, Search, Edit } from "lucide-react";
import Link from 'next/link';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WithId, CrmEmployee } from '@/lib/definitions';
import { format } from 'date-fns';

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

    const getStatusVariant = (status: string): 'success' | 'secondary' | 'danger' => {
        if (status === 'Active') return 'success';
        if (status === 'Inactive') return 'secondary';
        return 'danger';
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Employee Directory"
                subtitle="Search and manage all employees in your organization."
                icon={Users}
                actions={
                    <Link href="/dashboard/hrm/payroll/employees/new">
                        <ZoruButton>
                            <Plus className="h-4 w-4" />
                            Add Employee
                        </ZoruButton>
                    </Link>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] text-zoru-ink">All Employees</h2>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">Browse and manage employee records.</p>
                    </div>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
                        <ZoruInput placeholder="Search employees..." className="h-10 rounded-lg border-zoru-line bg-zoru-bg pl-9 text-[13px]" />
                    </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Employee Name</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Department</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Designation</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Date of Joining</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-zoru-line"><ZoruTableCell colSpan={6} className="h-24 text-center text-[13px] text-zoru-ink-muted">Loading...</ZoruTableCell></ZoruTableRow>
                            ) : employees.length > 0 ? (
                                employees.map(emp => (
                                    <ZoruTableRow key={emp._id.toString()} className="border-zoru-line">
                                        <ZoruTableCell>
                                            <div className="text-[13px] text-zoru-ink">{emp.firstName} {emp.lastName}</div>
                                            <div className="text-[11.5px] text-zoru-ink-muted">{emp.email}</div>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-zoru-ink">{(emp as any).departmentName || 'N/A'}</ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-zoru-ink">{(emp as any).designationName || 'N/A'}</ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-zoru-ink">{format(new Date(emp.dateOfJoining), 'PPP')}</ZoruTableCell>
                                        <ZoruTableCell><ZoruBadge variant={getStatusVariant(emp.status)}>{emp.status}</ZoruBadge></ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <ZoruButton variant="ghost" size="icon" asChild>
                                                <Link href={`/dashboard/hrm/payroll/employees/${emp._id.toString()}/edit`}><Edit className="h-4 w-4"/></Link>
                                            </ZoruButton>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-zoru-line"><ZoruTableCell colSpan={6} className="h-24 text-center text-[13px] text-zoru-ink-muted">No employees found.</ZoruTableCell></ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    );
}

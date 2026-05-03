'use client';

import { EmployeeForm } from '@/components/wabasimplify/crm-employee-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCrmDepartments, getCrmDesignations, getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { useEffect, useState } from 'react';

import { ClayButton } from '@/components/clay';

export default function NewEmployeePage() {
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [managers, setManagers] = useState([]);

    useEffect(() => {
        Promise.all([
            getCrmDepartments(),
            getCrmDesignations(),
            getCrmEmployees(),
        ]).then(([depts, desigs, emps]) => {
            setDepartments(depts as any);
            setDesignations(desigs as any);
            setManagers(emps as any);
        });
    }, []);

    return (
        <div className="flex w-full max-w-4xl flex-col gap-6">
            <div>
                <Link href="/dashboard/hrm/payroll/employees" className="inline-flex">
                    <ClayButton variant="ghost" leading={<ArrowLeft className="h-4 w-4" strokeWidth={1.75} />}>
                        Back to Employee Directory
                    </ClayButton>
                </Link>
                <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight text-clay-ink">Add New Employee</h1>
                <p className="mt-1 text-[13px] text-clay-ink-muted">Enter the details for the new employee.</p>
            </div>
            <EmployeeForm departments={departments} designations={designations} managers={managers} />
        </div>
    );
}

import { Button } from '@/components/sabcrm/20ui/compat';
import {
  ArrowLeft } from 'lucide-react';

import { EmployeeForm } from '@/components/zoruui-domain/crm-employee-form';

import Link from 'next/link';

/**
 * `/new` is a server component — the rebuilt `EmployeeForm` uses
 * `<EntityFormField>` pickers that fetch on focus, so we no longer
 * need a client-side prefetch of departments + designations.
 */
export default function NewEmployeePage() {
    return (
        <div className="flex w-full max-w-4xl flex-col gap-6">
            <div>
                <Link href="/dashboard/hrm/payroll/employees" className="inline-flex">
                    <Button variant="ghost">
                        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
                        Back to Employee Directory
                    </Button>
                </Link>
                <h1 className="mt-2 text-[26px] leading-tight text-[var(--st-text)]">
                    Add New Employee
                </h1>
                <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
                    Enter the details for the new employee.
                </p>
            </div>
            <EmployeeForm />
        </div>
    );
}

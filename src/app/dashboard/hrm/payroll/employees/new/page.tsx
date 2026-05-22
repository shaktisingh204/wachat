import { Button } from '@/components/zoruui';
import {
  ArrowLeft } from 'lucide-react';

import { EmployeeForm } from '@/components/wabasimplify/crm-employee-form';

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
                    <ZoruButton variant="ghost">
                        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
                        Back to Employee Directory
                    </ZoruButton>
                </Link>
                <h1 className="mt-2 text-[26px] leading-tight text-zoru-ink">
                    Add New Employee
                </h1>
                <p className="mt-1 text-[13px] text-zoru-ink-muted">
                    Enter the details for the new employee.
                </p>
            </div>
            <EmployeeForm />
        </div>
    );
}

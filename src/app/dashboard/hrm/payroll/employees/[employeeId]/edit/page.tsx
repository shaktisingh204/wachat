import { Button } from '@/components/zoruui';
import {
  ArrowLeft } from 'lucide-react';
import { ObjectId } from 'mongodb';

import { EmployeeForm } from '@/components/wabasimplify/crm-employee-form';
import { getEmployeeDetailByEmployeeId } from '@/app/actions/worksuite/hr-ext.actions';
import { connectToDatabase } from '@/lib/mongodb';

import Link from 'next/link';

async function getEmployeeById(id: string) {
    if (!ObjectId.isValid(id)) return null;
    const { db } = await connectToDatabase();
    const employee = await db
        .collection('crm_employees')
        .findOne({ _id: new ObjectId(id) });
    return JSON.parse(JSON.stringify(employee));
}

export default async function EditEmployeePage(props: {
    params: Promise<{ employeeId: string }>;
}) {
    const params = await props.params;
    const employeeId = params.employeeId;

    // The rebuilt EmployeeForm uses <EntityFormField> pickers that
    // fetch on focus, so we no longer need to prefetch departments +
    // designations server-side.
    const [employee, detail] = await Promise.all([
        getEmployeeById(employeeId),
        getEmployeeDetailByEmployeeId(employeeId),
    ]);

    if (!employee) {
        return (
            <p className="text-[13px] text-zoru-ink-muted">Employee not found.</p>
        );
    }

    return (
        <div className="flex w-full max-w-4xl flex-col gap-6">
            <div>
                <Link href="/dashboard/hrm/payroll/employees" className="inline-flex">
                    <Button variant="ghost">
                        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
                        Back to Employee Directory
                    </Button>
                </Link>
                <h1 className="mt-2 text-[26px] leading-tight text-zoru-ink">
                    Edit Employee
                </h1>
            </div>

            <EmployeeForm
                employee={employee}
                detail={detail}
                redirectAfterSave={`/dashboard/hrm/payroll/employees`}
            />
        </div>
    );
}

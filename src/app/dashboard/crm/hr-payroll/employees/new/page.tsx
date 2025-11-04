'use client';

import { EmployeeForm } from '@/components/wabasimplify/crm-employee-form';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCrmDepartments, getCrmDesignations, getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { useEffect, useState } from 'react';

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
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <Button variant="ghost" asChild className="-ml-4">
                    <Link href="/dashboard/crm/hr-payroll/employees">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Employee Directory
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline mt-2">Add New Employee</h1>
                <p className="text-muted-foreground">Enter the details for the new employee.</p>
            </div>
            <EmployeeForm departments={departments} designations={designations} managers={managers} />
        </div>
    );
}

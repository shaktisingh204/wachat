'use client';

import { EmployeeForm } from '@/components/wabasimplify/crm-employee-form';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { getCrmDepartments, getCrmDesignations, getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { useEffect, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

async function getEmployeeById(id: string) {
    if (!ObjectId.isValid(id)) return null;
    const { db } = await connectToDatabase();
    const employee = await db.collection('crm_employees').findOne({ _id: new ObjectId(id) });
    return JSON.parse(JSON.stringify(employee));
}

export default function EditEmployeePage() {
    const params = useParams();
    const employeeId = params.employeeId as string;
    
    const [employee, setEmployee] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [managers, setManagers] = useState([]);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const [empData, depts, desigs, mgrs] = await Promise.all([
                getEmployeeById(employeeId),
                getCrmDepartments(),
                getCrmDesignations(),
                getCrmEmployees(),
            ]);
            setEmployee(empData);
            setDepartments(depts as any);
            setDesignations(desigs as any);
            setManagers(mgrs as any);
        });
    }, [employeeId]);

    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><LoaderCircle className="h-8 w-8 animate-spin" /></div>
    }

    if (!employee) {
        return <p>Employee not found.</p>
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <Button variant="ghost" asChild className="-ml-4">
                    <Link href="/dashboard/crm/hr-payroll/employees">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Employee Directory
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline mt-2">Edit Employee</h1>
            </div>
            <EmployeeForm employee={employee} departments={departments} designations={designations} managers={managers} />
        </div>
    );
}

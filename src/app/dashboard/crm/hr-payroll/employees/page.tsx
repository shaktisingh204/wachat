
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Users, Search, Edit } from "lucide-react";
import Link from 'next/link';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WithId, CrmEmployee } from '@/lib/definitions';
import { format } from 'date-fns';

export default function EmployeeDirectoryPage() {
    const [employees, setEmployees] = useState<WithId<CrmEmployee>[]>([]);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const data = await getCrmEmployees();
            setEmployees(data);
        });
    }, []);

    const getStatusVariant = (status: string) => {
        if (status === 'Active') return 'default';
        if (status === 'Inactive') return 'secondary';
        return 'destructive';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Users className="h-8 w-8" />
                        Employee Directory
                    </h1>
                    <p className="text-muted-foreground">Search and manage all employees in your organization.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button asChild><Link href="/dashboard/crm/hr-payroll/employees/new"><Plus className="mr-2 h-4 w-4" /> Add Employee</Link></Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search employees..." className="pl-8" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee Name</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Designation</TableHead>
                                    <TableHead>Date of Joining</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell></TableRow>
                                ) : employees.length > 0 ? (
                                    employees.map(emp => (
                                        <TableRow key={emp._id.toString()}>
                                            <TableCell>
                                                <div className="font-medium">{emp.firstName} {emp.lastName}</div>
                                                <div className="text-sm text-muted-foreground">{emp.email}</div>
                                            </TableCell>
                                            <TableCell>{(emp as any).departmentName || 'N/A'}</TableCell>
                                            <TableCell>{(emp as any).designationName || 'N/A'}</TableCell>
                                            <TableCell>{format(new Date(emp.dateOfJoining), 'PPP')}</TableCell>
                                            <TableCell><Badge variant={getStatusVariant(emp.status)}>{emp.status}</Badge></TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link href={`/dashboard/crm/hr-payroll/employees/${emp._id.toString()}/edit`}><Edit className="h-4 w-4"/></Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center">No employees found.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

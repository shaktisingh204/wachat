
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveCrmEmployee } from '@/app/actions';
import type { WithId, CrmEmployee, CrmDepartment, CrmDesignation } from '@/lib/definitions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DatePicker } from '../ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const initialState = { message: null, error: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} size="lg">
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Add Employee'}
        </Button>
    );
}

interface EmployeeFormProps {
    employee?: WithId<CrmEmployee> | null;
    departments: WithId<CrmDepartment>[];
    designations: WithId<CrmDesignation>[];
    managers: WithId<CrmEmployee>[];
}

export function EmployeeForm({ employee, departments, designations, managers }: EmployeeFormProps) {
    const [state, formAction] = useActionState(saveCrmEmployee, initialState);
    const { toast } = useToast();
    const router = useRouter();
    const isEditing = !!employee;

    const [dateOfJoining, setDateOfJoining] = useState<Date | undefined>(isEditing ? new Date(employee.dateOfJoining) : new Date());
    const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(isEditing && employee.dateOfBirth ? new Date(employee.dateOfBirth) : undefined);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/crm/hr-payroll/employees');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    return (
        <form action={formAction}>
            {isEditing && <input type="hidden" name="employeeId" value={employee._id.toString()} />}
            <input type="hidden" name="dateOfJoining" value={dateOfJoining?.toISOString()} />
            {dateOfBirth && <input type="hidden" name="dateOfBirth" value={dateOfBirth.toISOString()} />}
            
            <Card>
                <CardContent className="p-6">
                    <Accordion type="multiple" defaultValue={['personal', 'job']} className="w-full">
                        <AccordionItem value="personal">
                            <AccordionTrigger>Personal Information</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label htmlFor="firstName">First Name *</Label><Input id="firstName" name="firstName" defaultValue={employee?.firstName} required /></div>
                                    <div className="space-y-2"><Label htmlFor="lastName">Last Name *</Label><Input id="lastName" name="lastName" defaultValue={employee?.lastName} required /></div>
                                </div>
                                <div className="space-y-2"><Label htmlFor="dateOfBirth">Date of Birth</Label><DatePicker date={dateOfBirth} setDate={setDateOfBirth} /></div>
                                <div className="space-y-2"><Label htmlFor="personalEmail">Personal Email</Label><Input id="personalEmail" name="personalEmail" type="email" defaultValue={employee?.personalEmail} /></div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="job">
                            <AccordionTrigger>Job Information</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label htmlFor="employeeIdCode">Employee ID *</Label><Input id="employeeIdCode" name="employeeIdCode" defaultValue={employee?.employeeId} required /></div>
                                    <div className="space-y-2"><Label htmlFor="email">Work Email *</Label><Input id="email" name="email" type="email" defaultValue={employee?.email} required /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label htmlFor="departmentId">Department</Label><Select name="departmentId" defaultValue={employee?.departmentId?.toString()}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{departments.map(d => <SelectItem key={d._id.toString()} value={d._id.toString()}>{d.name}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-2"><Label htmlFor="designationId">Designation</Label><Select name="designationId" defaultValue={employee?.designationId?.toString()}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{designations.map(d => <SelectItem key={d._id.toString()} value={d._id.toString()}>{d.name}</SelectItem>)}</SelectContent></Select></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label htmlFor="dateOfJoining">Date of Joining *</Label><DatePicker date={dateOfJoining} setDate={setDateOfJoining} /></div>
                                    <div className="space-y-2"><Label htmlFor="status">Employment Status</Label><Select name="status" defaultValue={employee?.status || 'Active'}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem><SelectItem value="Terminated">Terminated</SelectItem></SelectContent></Select></div>
                                </div>
                                 <div className="space-y-2"><Label htmlFor="reportingManagerId">Reporting Manager</Label><Select name="reportingManagerId" defaultValue={employee?.reportingManagerId?.toString()}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{managers.map(m => <SelectItem key={m._id.toString()} value={m._id.toString()}>{m.firstName} {m.lastName}</SelectItem>)}</SelectContent></Select></div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
                <CardFooter>
                    <SubmitButton isEditing={isEditing} />
                </CardFooter>
            </Card>
        </form>
    );
}

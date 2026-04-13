
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClayCard, ClayButton } from '@/components/clay';
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveCrmEmployee } from '@/app/actions/index.ts';
import type { WithId, CrmEmployee, CrmDepartment, CrmDesignation } from '@/lib/definitions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DatePicker } from '../ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const initialState: { message?: string; error?: string } = { message: undefined, error: undefined };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ClayButton
            type="submit"
            disabled={pending}
            size="lg"
            variant="obsidian"
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
            {isEditing ? 'Save Changes' : 'Add Employee'}
        </ClayButton>
    );
}

interface EmployeeFormProps {
    employee?: WithId<CrmEmployee> | null;
    departments: WithId<CrmDepartment>[];
    designations: WithId<CrmDesignation>[];
    managers: WithId<CrmEmployee>[];
}

// ... (imports remain similar, assume new imports are added)
import { SmartDepartmentSelect } from '@/components/crm/hr-payroll/smart-department-select';
import { SmartDesignationSelect } from '@/components/crm/hr-payroll/smart-designation-select';
import { SmartLocationSelect } from '@/components/crm/smart-location-select';

// ... (props interface remains)

export function EmployeeForm({ employee, departments, designations, managers }: EmployeeFormProps) {
    const [state, formAction] = useActionState(saveCrmEmployee, initialState);
    const { toast } = useToast();
    const router = useRouter();
    const isEditing = !!employee;

    const [dateOfJoining, setDateOfJoining] = useState<Date | undefined>(isEditing ? new Date(employee.dateOfJoining) : new Date());
    const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(isEditing && employee.dateOfBirth ? new Date(employee.dateOfBirth) : undefined);

    // Controlled states for smart selects
    const [departmentId, setDepartmentId] = useState(employee?.departmentId?.toString() || '');
    const [designationId, setDesignationId] = useState(employee?.designationId?.toString() || '');
    // Location state
    const [workCountry, setWorkCountry] = useState(employee?.workCountry || '');
    const [workState, setWorkState] = useState(employee?.workState || '');
    const [workCity, setWorkCity] = useState(employee?.workCity || '');

    // ... (useEffect for state handling)

    // Sync if employee prop changes (optional but good practice)
    useEffect(() => {
        if (employee) {
            setWorkCountry(employee.workCountry || '');
            setWorkState(employee.workState || '');
            setWorkCity(employee.workCity || '');
        }
    }, [employee]);


    return (
        <form action={formAction}>
            {isEditing && <input type="hidden" name="employeeId" value={employee._id.toString()} />}
            <input type="hidden" name="dateOfJoining" value={dateOfJoining?.toISOString()} />
            {dateOfBirth && <input type="hidden" name="dateOfBirth" value={dateOfBirth.toISOString()} />}
            {/* Hidden inputs for smart select data */}
            <input type="hidden" name="departmentId" value={departmentId} />
            <input type="hidden" name="designationId" value={designationId} />

            <ClayCard padded={false}>
                <div className="p-6">
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
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="departmentId">Department</Label>
                                        <SmartDepartmentSelect
                                            value={departmentId}
                                            onSelect={setDepartmentId}
                                            initialOptions={departments.map(d => ({ value: d._id.toString(), label: d.name }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="designationId">Designation</Label>
                                        <SmartDesignationSelect
                                            value={designationId}
                                            onSelect={setDesignationId}
                                            initialOptions={designations.map(d => ({ value: d._id.toString(), label: d.name }))}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="workCountry">Work Country</Label>
                                        <SmartLocationSelect
                                            type="country"
                                            value={workCountry}
                                            onSelect={(val, label) => setWorkCountry(val)}
                                            placeholder="Select Country..."
                                        />
                                        <input type="hidden" name="workCountry" value={workCountry} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="workState">Work State</Label>
                                        <SmartLocationSelect
                                            type="state"
                                            selectedCountryCode={workCountry}
                                            value={workState}
                                            onSelect={(val, label) => setWorkState(val)}
                                            placeholder="Select State..."
                                            disabled={!workCountry}
                                        />
                                        <input type="hidden" name="workState" value={workState} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="workCity">Work City</Label>
                                        <SmartLocationSelect
                                            type="city"
                                            selectedCountryCode={workCountry}
                                            selectedStateCode={workState}
                                            value={workCity}
                                            onSelect={(val, label) => setWorkCity(label)} // City value is usually the name
                                            placeholder="Select City..."
                                            disabled={!workState}
                                        />
                                        <input type="hidden" name="workCity" value={workCity} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label htmlFor="dateOfJoining">Date of Joining *</Label><DatePicker date={dateOfJoining} setDate={setDateOfJoining} /></div>
                                    <div className="space-y-2"><Label htmlFor="status">Employment Status</Label><Select name="status" defaultValue={employee?.status || 'Active'}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem><SelectItem value="Terminated">Terminated</SelectItem></SelectContent></Select></div>
                                </div>
                                <div className="space-y-2"><Label htmlFor="reportingManagerId">Reporting Manager</Label><Select name="reportingManagerId" defaultValue={employee?.reportingManagerId?.toString()}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{managers.map(m => <SelectItem key={m._id.toString()} value={m._id.toString()}>{m.firstName} {m.lastName}</SelectItem>)}</SelectContent></Select></div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
                <div className="p-6 pt-0 border-t border-clay-border flex">
                    <SubmitButton isEditing={isEditing} />
                </div>
            </ClayCard>
        </form>
    );
}

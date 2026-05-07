
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ClayCard, ClayButton } from '@/components/clay';
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveCrmEmployee } from '@/app/actions/index.ts';
import type { WithId, CrmEmployee, CrmDepartment, CrmDesignation } from '@/lib/definitions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DatePicker } from '../ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { EntityPicker } from '@/components/crm/entity-picker';

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

interface ExtendedDetail {
    about_me?: string;
    marital_status?: string;
    gender?: string;
    date_of_birth?: string;
    blood_group?: string;
    religion?: string;
    nationality?: string;
    languages?: string;
    hobbies?: string;
    address?: string;
    marriage_anniversary_date?: string;
    employment_type?: string;
    probation_end_date?: string;
    last_date?: string;
    notice_period_end_date?: string;
    internship_end_date?: string;
    contract_end_date?: string;
    notice_period?: number;
    reporting_to?: string;
    overtime_hourly_rate?: number;
    hourly_rate?: number;
    slack_username?: string;
    bank_account_id?: string;
    bank_account_number?: string;
    bank_name?: string;
    tax_regime?: string;
    work_anniversary_notified?: boolean;
}

interface EmployeeFormProps {
    employee?: WithId<CrmEmployee> | null;
    departments: WithId<CrmDepartment>[];
    designations: WithId<CrmDesignation>[];
    detail?: ExtendedDetail | null;
}

function toDateInput(v: any): string {
    if (!v) return '';
    try { return new Date(v).toISOString().slice(0, 10); } catch { return ''; }
}

export function EmployeeForm({ employee, departments, designations, detail }: EmployeeFormProps) {
    const [state, formAction] = useActionState(saveCrmEmployee, initialState);
    const { toast } = useToast();
    const router = useRouter();
    const isEditing = !!employee;

    const [dateOfJoining, setDateOfJoining] = useState<Date | undefined>(
        isEditing ? new Date(employee.dateOfJoining) : new Date()
    );
    const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(
        isEditing && (employee as any).dateOfBirth ? new Date((employee as any).dateOfBirth) : undefined
    );

    const [departmentId, setDepartmentId] = useState(employee?.departmentId?.toString() || '');
    const [designationId, setDesignationId] = useState(employee?.designationId?.toString() || '');
    const [workCountry, setWorkCountry] = useState(employee?.workCountry || '');
    const [workState, setWorkState] = useState(employee?.workState || '');
    const [workCity, setWorkCity] = useState(employee?.workCity || '');
    const [reportingTo, setReportingTo] = useState(detail?.reporting_to || '');
    const [bankAccountId, setBankAccountId] = useState<string>(detail?.bank_account_id || '');

    useEffect(() => {
        if (employee) {
            setWorkCountry(employee.workCountry || '');
            setWorkState(employee.workState || '');
            setWorkCity(employee.workCity || '');
        }
    }, [employee]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Saved', description: state.message });
            if (!isEditing) router.push('/dashboard/hrm/payroll/employees');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state]);

    return (
        <form action={formAction}>
            {isEditing && <input type="hidden" name="employeeId" value={employee._id.toString()} />}
            <input type="hidden" name="dateOfJoining" value={dateOfJoining?.toISOString() ?? ''} />
            {dateOfBirth && <input type="hidden" name="dateOfBirth" value={dateOfBirth.toISOString()} />}
            <input type="hidden" name="departmentId" value={departmentId} />
            <input type="hidden" name="designationId" value={designationId} />
            <input type="hidden" name="workCountry" value={workCountry} />
            <input type="hidden" name="workState" value={workState} />
            <input type="hidden" name="workCity" value={workCity} />
            <input type="hidden" name="ext_reporting_to" value={reportingTo} />
            <input type="hidden" name="ext_bank_account_id" value={bankAccountId} />

            <ClayCard padded={false}>
                <div className="p-6">
                    <Accordion
                        type="multiple"
                        defaultValue={['personal', 'job', 'extended-personal', 'employment', 'banking']}
                        className="w-full"
                    >
                        {/* ── Basic Personal Info ─────────────────────── */}
                        <AccordionItem value="personal">
                            <AccordionTrigger>Personal Information</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="firstName">First Name *</Label>
                                        <Input id="firstName" name="firstName" defaultValue={employee?.firstName} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="lastName">Last Name *</Label>
                                        <Input id="lastName" name="lastName" defaultValue={employee?.lastName} required />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Work Email *</Label>
                                        <Input id="email" name="email" type="email" defaultValue={employee?.email} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone</Label>
                                        <Input id="phone" name="phone" type="tel" defaultValue={employee?.phone} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                                    <DatePicker date={dateOfBirth} setDate={setDateOfBirth} />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        {/* ── Job Info ────────────────────────────────── */}
                        <AccordionItem value="job">
                            <AccordionTrigger>Job Information</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="employeeIdCode">Employee ID *</Label>
                                        <Input id="employeeIdCode" name="employeeIdCode" defaultValue={employee?.employeeId} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Status</Label>
                                        <Select name="status" defaultValue={employee?.status || 'Active'}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Active">Active</SelectItem>
                                                <SelectItem value="Inactive">Inactive</SelectItem>
                                                <SelectItem value="Terminated">Terminated</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Department</Label>
                                        <EntityPicker
                                            entity="department"
                                            value={departmentId || null}
                                            onChange={(next) => {
                                                const id = Array.isArray(next) ? next[0] ?? '' : (next ?? '');
                                                setDepartmentId(id);
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Designation</Label>
                                        <EntityPicker
                                            entity="designation"
                                            value={designationId || null}
                                            onChange={(next) => {
                                                const id = Array.isArray(next) ? next[0] ?? '' : (next ?? '');
                                                setDesignationId(id);
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Work Country</Label>
                                        <EntityPicker
                                            entity="location"
                                            value={workCountry || null}
                                            placeholder="Select Country..."
                                            onChange={(next) => {
                                                const id = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
                                                setWorkCountry(id);
                                                setWorkState('');
                                                setWorkCity('');
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Work State</Label>
                                        <EntityPicker
                                            entity="location"
                                            value={workState || null}
                                            placeholder="Select State..."
                                            onChange={(next) => {
                                                const id = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
                                                setWorkState(id);
                                                setWorkCity('');
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Work City</Label>
                                        <EntityPicker
                                            entity="location"
                                            value={workCity || null}
                                            placeholder="Select City..."
                                            onChange={(next) => {
                                                const id = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
                                                setWorkCity(id);
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Date of Joining *</Label>
                                    <DatePicker date={dateOfJoining} setDate={setDateOfJoining} />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        {/* ── Extended Personal Info ───────────────────── */}
                        <AccordionItem value="extended-personal">
                            <AccordionTrigger>Extended Personal Info</AccordionTrigger>
                            <AccordionContent className="pt-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>About Me</Label>
                                        <Textarea name="about_me" rows={3} defaultValue={detail?.about_me || ''} className="rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Gender</Label>
                                        <Select name="gender" defaultValue={detail?.gender || '__none__'}>
                                            <SelectTrigger className="h-10 rounded-lg border-border bg-card text-[13px]"><SelectValue placeholder="Select…" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">— None —</SelectItem>
                                                <SelectItem value="male">Male</SelectItem>
                                                <SelectItem value="female">Female</SelectItem>
                                                <SelectItem value="others">Others</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Marital Status</Label>
                                        <Select name="marital_status" defaultValue={detail?.marital_status || '__none__'}>
                                            <SelectTrigger className="h-10 rounded-lg border-border bg-card text-[13px]"><SelectValue placeholder="Select…" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">— None —</SelectItem>
                                                <SelectItem value="single">Single</SelectItem>
                                                <SelectItem value="married">Married</SelectItem>
                                                <SelectItem value="divorced">Divorced</SelectItem>
                                                <SelectItem value="widowed">Widowed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Date of Birth</Label>
                                        <Input type="date" name="date_of_birth" defaultValue={toDateInput(detail?.date_of_birth)} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Blood Group</Label>
                                        <Select name="blood_group" defaultValue={detail?.blood_group || '__none__'}>
                                            <SelectTrigger className="h-10 rounded-lg border-border bg-card text-[13px]"><SelectValue placeholder="Select…" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">— None —</SelectItem>
                                                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Nationality</Label>
                                        <Input name="nationality" defaultValue={detail?.nationality || ''} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Religion</Label>
                                        <Input name="religion" defaultValue={detail?.religion || ''} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Languages (comma-separated)</Label>
                                        <Input name="languages" defaultValue={detail?.languages || ''} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Marriage Anniversary Date</Label>
                                        <Input type="date" name="marriage_anniversary_date" defaultValue={toDateInput(detail?.marriage_anniversary_date)} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Hobbies</Label>
                                        <Textarea name="hobbies" rows={2} defaultValue={detail?.hobbies || ''} className="rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Address</Label>
                                        <Textarea name="address" rows={2} defaultValue={detail?.address || ''} className="rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        {/* ── Employment Details ───────────────────────── */}
                        <AccordionItem value="employment">
                            <AccordionTrigger>Employment Details</AccordionTrigger>
                            <AccordionContent className="pt-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Employment Type</Label>
                                        <Select name="employment_type" defaultValue={detail?.employment_type || '__none__'}>
                                            <SelectTrigger className="h-10 rounded-lg border-border bg-card text-[13px]"><SelectValue placeholder="Select…" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">— None —</SelectItem>
                                                <SelectItem value="full-time">Full-time</SelectItem>
                                                <SelectItem value="part-time">Part-time</SelectItem>
                                                <SelectItem value="contract">Contract</SelectItem>
                                                <SelectItem value="internship">Internship</SelectItem>
                                                <SelectItem value="trainee">Trainee</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Reporting To</Label>
                                        <EntityPicker
                                            entity="employee"
                                            value={reportingTo || null}
                                            placeholder="Select manager…"
                                            filter={
                                                isEditing
                                                    ? { _id: { $ne: employee!._id } }
                                                    : undefined
                                            }
                                            onChange={(next) => {
                                                const id = Array.isArray(next) ? next[0] ?? '' : (next ?? '');
                                                setReportingTo(id);
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Probation End Date</Label>
                                        <Input type="date" name="probation_end_date" defaultValue={toDateInput(detail?.probation_end_date)} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Last Date</Label>
                                        <Input type="date" name="last_date" defaultValue={toDateInput(detail?.last_date)} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Notice Period (days)</Label>
                                        <Input type="number" name="notice_period" min="0" defaultValue={detail?.notice_period ?? ''} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Notice Period End Date</Label>
                                        <Input type="date" name="notice_period_end_date" defaultValue={toDateInput(detail?.notice_period_end_date)} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Internship End Date</Label>
                                        <Input type="date" name="internship_end_date" defaultValue={toDateInput(detail?.internship_end_date)} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Contract End Date</Label>
                                        <Input type="date" name="contract_end_date" defaultValue={toDateInput(detail?.contract_end_date)} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Hourly Rate</Label>
                                        <Input type="number" name="hourly_rate" min="0" step="0.01" defaultValue={detail?.hourly_rate ?? ''} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Overtime Hourly Rate</Label>
                                        <Input type="number" name="overtime_hourly_rate" min="0" step="0.01" defaultValue={detail?.overtime_hourly_rate ?? ''} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Slack Username</Label>
                                        <Input name="slack_username" defaultValue={detail?.slack_username || ''} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Work Anniversary Notified</Label>
                                        <Select name="work_anniversary_notified" defaultValue={detail?.work_anniversary_notified ? 'true' : 'false'}>
                                            <SelectTrigger className="h-10 rounded-lg border-border bg-card text-[13px]"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="false">No</SelectItem>
                                                <SelectItem value="true">Yes</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        {/* ── Banking & Tax ────────────────────────────── */}
                        <AccordionItem value="banking">
                            <AccordionTrigger>Banking &amp; Tax</AccordionTrigger>
                            <AccordionContent className="pt-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Linked Bank Account</Label>
                                        <EntityPicker
                                            entity="bankAccount"
                                            value={bankAccountId || null}
                                            placeholder="Select bank account…"
                                            onChange={(next) => {
                                                const id = Array.isArray(next) ? next[0] ?? '' : (next ?? '');
                                                setBankAccountId(id);
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Bank Account Number</Label>
                                        <Input name="bank_account_number" defaultValue={detail?.bank_account_number || ''} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Bank Name</Label>
                                        <Input name="bank_name" defaultValue={detail?.bank_name || ''} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Tax Regime</Label>
                                        <Select name="tax_regime" defaultValue={detail?.tax_regime || '__none__'}>
                                            <SelectTrigger className="h-10 rounded-lg border-border bg-card text-[13px]"><SelectValue placeholder="Select…" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">— None —</SelectItem>
                                                <SelectItem value="old">Old</SelectItem>
                                                <SelectItem value="new">New</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Gross Salary</Label>
                                        <Input type="number" name="grossSalary" min="0" defaultValue={(employee as any)?.salaryDetails?.grossSalary ?? ''} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>

                <div className="flex border-t border-border p-6 pt-4">
                    <SubmitButton isEditing={isEditing} />
                </div>
            </ClayCard>
        </form>
    );
}

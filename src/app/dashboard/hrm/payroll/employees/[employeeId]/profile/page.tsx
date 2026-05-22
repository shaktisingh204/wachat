import { Button, Card } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import {
  Briefcase,
  PenLine,
  PhoneCall,
  User,
  } from 'lucide-react';

/**
 * Employee profile sub-tab —
 *   `/dashboard/hrm/payroll/employees/[employeeId]/profile`.
 *
 * Server component. Reads the employee via `crmEmployeesApi.getById`
 * (no new collection). Renders two cards:
 *   • Personal info — name, dob, gender, blood group, marital status,
 *     address, emergency-contact summary
 *   • Employment info — joined_at, employment_type, manager,
 *     department, designation, status
 *
 * Edit button links to the existing
 *   `/dashboard/hrm/payroll/employees/[employeeId]/edit/page.tsx`.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getEmployee } from '@/app/actions/crm/employees.actions';
import { getCrmEmergencyContacts } from '@/app/actions/crm-emergency-contacts.actions';
import { requirePermission } from '@/lib/rbac-server';
import type { CrmEmployeeStatus } from '@/lib/rust-client/crm-employees';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<CrmEmployeeStatus, StatusTone> = {
    active: 'green',
    on_leave: 'amber',
    terminated: 'red',
    resigned: 'neutral',
};

const STATUS_LABEL: Record<CrmEmployeeStatus, string> = {
    active: 'Active',
    on_leave: 'On leave',
    terminated: 'Terminated',
    resigned: 'Resigned',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function pretty(s?: string): string {
    if (!s) return '—';
    return s.replace(/_/g, ' ');
}

function fmtAddress(addr?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    country?: string;
    pinCode?: string;
}): string {
    if (!addr) return '—';
    const parts = [
        addr.line1,
        addr.line2,
        addr.city,
        addr.state,
        addr.pinCode,
        addr.country,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '—';
}

export default async function EmployeeProfileSubPage({
    params,
}: {
    params: Promise<{ employeeId: string }>;
}) {
    const { employeeId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const guard = await requirePermission('crm_employee', 'view');
    if (!guard.ok) {
        return (
            <p className="p-6 text-[13px] text-zoru-ink-muted">{guard.error}</p>
        );
    }

    const { employee, error } = await getEmployee(employeeId);
    if (!employee) {
        if (error) {
            return (
                <div className="flex w-full flex-col gap-4 p-6">
                    <p className="text-[14px] text-zoru-ink">
                        Couldn&apos;t load this employee — {error}
                    </p>
                </div>
            );
        }
        notFound();
    }

    const contacts = await getCrmEmergencyContacts({
        employeeId,
        limit: 3,
    });
    const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];

    const fullName =
        employee.displayName ||
        [employee.firstName, employee.lastName].filter(Boolean).join(' ') ||
        employee.workEmail ||
        'Employee';

    const status = employee.status as CrmEmployeeStatus | undefined;
    const tone = status ? STATUS_TONE[status] ?? 'neutral' : 'neutral';
    const statusLabel = status ? STATUS_LABEL[status] ?? status : '—';

    const BASE = `/dashboard/hrm/payroll/employees/${employeeId}`;

    return (
        <EntityListShell
            title={fullName}
            subtitle="Personal and employment details."
            primaryAction={
                <Button asChild>
                    <Link href={`${BASE}/edit`}>
                        <PenLine className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >

            {/* Sub-tab navigation strip */}
            <div className="flex flex-wrap gap-1 border-b border-zoru-line">
                {[
                    { href: BASE, label: 'Overview' },
                    { href: `${BASE}/profile`, label: 'Profile', active: true },
                    { href: `${BASE}/documents`, label: 'Documents' },
                    {
                        href: `${BASE}/emergency-contacts`,
                        label: 'Emergency contacts',
                    },
                    { href: `${BASE}/leave-quotas`, label: 'Leave quotas' },
                    { href: `${BASE}/visa-details`, label: 'Visa details' },
                ].map((tab) => (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={`-mb-px border-b-2 px-3 py-2 text-[12.5px] transition-colors ${
                            tab.active
                                ? 'border-zoru-ink text-zoru-ink'
                                : 'border-transparent text-zoru-ink-muted hover:text-zoru-ink'
                        }`}
                    >
                        {tab.label}
                    </Link>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Personal info card */}
                <Card className="p-6">
                    <div className="mb-4 flex items-center gap-2">
                        <User className="h-4 w-4 text-zoru-ink-muted" />
                        <h2 className="text-[14px] font-medium text-zoru-ink">
                            Personal info
                        </h2>
                    </div>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
                        <Detail label="Full name" value={fullName} />
                        <Detail
                            label="Date of birth"
                            value={fmtDate(employee.dob)}
                        />
                        <Detail
                            label="Gender"
                            value={pretty(employee.gender)}
                            capitalize
                        />
                        <Detail
                            label="Blood group"
                            value={employee.bloodGroup || '—'}
                        />
                        <Detail
                            label="Marital status"
                            value={pretty(employee.maritalStatus)}
                            capitalize
                        />
                        <Detail
                            label="Nationality"
                            value={employee.nationality || '—'}
                        />
                        <Detail
                            label="Personal email"
                            value={employee.personalEmail || '—'}
                        />
                        <Detail
                            label="Personal phone"
                            value={employee.personalPhone || '—'}
                        />
                        <Detail
                            label="Current address"
                            value={fmtAddress(employee.address?.current)}
                            fullWidth
                        />
                        <Detail
                            label="Permanent address"
                            value={fmtAddress(employee.address?.permanent)}
                            fullWidth
                        />
                    </dl>

                    {/* Emergency contact summary */}
                    <div className="mt-6 border-t border-zoru-line pt-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <PhoneCall className="h-4 w-4 text-zoru-ink-muted" />
                                <h3 className="text-[13px] font-medium text-zoru-ink">
                                    Emergency contact
                                </h3>
                            </div>
                            <Link
                                href={`${BASE}/emergency-contacts`}
                                className="text-[12px] text-zoru-ink-muted hover:text-zoru-ink"
                            >
                                Manage →
                            </Link>
                        </div>
                        {primary ? (
                            <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3 text-[12.5px]">
                                <div className="text-zoru-ink">
                                    {primary.name}
                                    {primary.relationship ? (
                                        <span className="text-zoru-ink-muted">
                                            {' · '}
                                            {primary.relationship}
                                        </span>
                                    ) : null}
                                </div>
                                <div className="mt-0.5 text-zoru-ink-muted">
                                    {primary.phone || primary.email || '—'}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-4 text-center text-[12px] text-zoru-ink-muted">
                                No emergency contact on file.
                            </div>
                        )}
                    </div>
                </Card>

                {/* Employment info card */}
                <Card className="p-6">
                    <div className="mb-4 flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-zoru-ink-muted" />
                        <h2 className="text-[14px] font-medium text-zoru-ink">
                            Employment
                        </h2>
                    </div>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
                        <Detail
                            label="Employee code"
                            value={employee.employeeId || '—'}
                            mono
                        />
                        <div>
                            <dt className="text-[12px] text-zoru-ink-muted">
                                Status
                            </dt>
                            <dd className="mt-1">
                                <StatusPill label={statusLabel} tone={tone} />
                            </dd>
                        </div>
                        <Detail
                            label="Joined at"
                            value={fmtDate(employee.joiningDate)}
                        />
                        <Detail
                            label="Confirmation date"
                            value={fmtDate(employee.confirmationDate)}
                        />
                        <Detail
                            label="Employment type"
                            value={pretty(employee.employmentType)}
                            capitalize
                        />
                        <Detail
                            label="Work location"
                            value={employee.workLocation || '—'}
                        />
                        <div>
                            <dt className="text-[12px] text-zoru-ink-muted">
                                Department
                            </dt>
                            <dd className="mt-1 text-zoru-ink">
                                {employee.departmentId ? (
                                    <EntityPickerChip
                                        entity="department"
                                        id={employee.departmentId}
                                    />
                                ) : (
                                    '—'
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[12px] text-zoru-ink-muted">
                                Designation
                            </dt>
                            <dd className="mt-1 text-zoru-ink">
                                {employee.designationId ? (
                                    <EntityPickerChip
                                        entity="designation"
                                        id={employee.designationId}
                                    />
                                ) : (
                                    employee.designation || '—'
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[12px] text-zoru-ink-muted">
                                Reporting manager
                            </dt>
                            <dd className="mt-1 text-zoru-ink">
                                {employee.reportingManagerId ? (
                                    <EntityPickerChip
                                        entity="employee"
                                        id={employee.reportingManagerId}
                                    />
                                ) : (
                                    '—'
                                )}
                            </dd>
                        </div>
                        <Detail
                            label="Work email"
                            value={employee.workEmail || '—'}
                        />
                        <Detail
                            label="Work phone"
                            value={employee.workPhone || '—'}
                        />
                        <Detail
                            label="Notice period"
                            value={
                                employee.noticePeriodDays
                                    ? `${employee.noticePeriodDays} days`
                                    : '—'
                            }
                        />
                    </dl>
                </Card>
            </div>
        </EntityListShell>
    );
}

function Detail({
    label,
    value,
    mono,
    capitalize,
    fullWidth,
}: {
    label: string;
    value: string;
    mono?: boolean;
    capitalize?: boolean;
    fullWidth?: boolean;
}) {
    return (
        <div className={fullWidth ? 'sm:col-span-2' : ''}>
            <dt className="text-[12px] text-zoru-ink-muted">{label}</dt>
            <dd
                className={`mt-1 text-zoru-ink ${
                    mono ? 'font-mono text-[12px]' : ''
                } ${capitalize ? 'capitalize' : ''}`}
            >
                {value}
            </dd>
        </div>
    );
}

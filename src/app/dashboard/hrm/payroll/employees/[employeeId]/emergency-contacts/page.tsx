'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useParams } from 'next/navigation';
import {
    ArrowLeft,
  LoaderCircle,
  Pencil,
  PhoneCall,
  Plus,
  Trash2,
  } from 'lucide-react';

/**
 * Employee emergency contacts sub-tab —
 *   `/dashboard/hrm/payroll/employees/[employeeId]/emergency-contacts`.
 *
 * Lists `crm_emergency_contacts` for the employee with an inline-create
 * dialog. Client component: server actions are invoked through
 * `useActionState` for save + `await` for delete/list. RBAC permission
 * key: `crm_emergency_contact`.
 */

import * as React from 'react';
import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

import {
    deleteCrmEmergencyContact,
    getCrmEmergencyContacts,
    saveCrmEmergencyContact,
    type CrmEmergencyContactDoc,
} from '@/app/actions/crm-emergency-contacts.actions';

type FormState = {
    contactId: string;
    name: string;
    relationship: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
    isPrimary: boolean;
};

const EMPTY: FormState = {
    contactId: '',
    name: '',
    relationship: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    isPrimary: false,
};

export default function EmployeeEmergencyContactsSubPage() {
    const params = useParams<{ employeeId: string }>();
    const employeeId = params.employeeId;
    const BASE = `/dashboard/hrm/payroll/employees/${employeeId}`;

    const { toast } = useZoruToast();
    const [rows, setRows] = React.useState<CrmEmergencyContactDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [form, setForm] = React.useState<FormState>(EMPTY);
    const [pendingDelete, setPendingDelete] =
        React.useState<CrmEmergencyContactDoc | null>(null);
    const [saving, startSave] = React.useTransition();
    const [deleting, startDelete] = React.useTransition();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const items = await getCrmEmergencyContacts({
                employeeId,
                limit: 100,
            });
            setRows(items);
        } finally {
            setIsLoading(false);
        }
    }, [employeeId]);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    const openAdd = () => {
        setForm(EMPTY);
        setDialogOpen(true);
    };

    const openEdit = (row: CrmEmergencyContactDoc) => {
        setForm({
            contactId: row._id,
            name: row.name ?? '',
            relationship: row.relationship ?? '',
            phone: row.phone ?? '',
            email: row.email ?? '',
            address: row.address ?? '',
            notes: row.notes ?? '',
            isPrimary: !!row.isPrimary,
        });
        setDialogOpen(true);
    };

    const handleSave = () => {
        if (!form.name.trim()) {
            toast({
                title: 'Name required',
                description: 'Enter the contact’s name to continue.',
                variant: 'destructive',
            });
            return;
        }
        startSave(async () => {
            const fd = new FormData();
            if (form.contactId) fd.append('contactId', form.contactId);
            fd.append('employeeId', employeeId);
            fd.append('name', form.name);
            fd.append('relationship', form.relationship);
            fd.append('phone', form.phone);
            fd.append('email', form.email);
            fd.append('address', form.address);
            fd.append('notes', form.notes);
            if (form.isPrimary) fd.append('isPrimary', 'true');
            const r = await saveCrmEmergencyContact(undefined, fd);
            if (r.message) {
                toast({ title: 'Saved', description: r.message });
                setDialogOpen(false);
                await refresh();
            } else if (r.error) {
                toast({
                    title: 'Error',
                    description: r.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        startDelete(async () => {
            const r = await deleteCrmEmergencyContact(id);
            if (r.success) {
                toast({ title: 'Emergency contact deleted' });
                setPendingDelete(null);
                await refresh();
            } else if (r.error) {
                toast({
                    title: 'Error',
                    description: r.error,
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    breadcrumbs={[
                        { label: 'HR', href: '/dashboard/hrm/hr' },
                        {
                            label: 'Employees',
                            href: '/dashboard/hrm/payroll/employees',
                        },
                        { label: 'Employee', href: BASE },
                        { label: 'Emergency contacts' },
                    ]}
                    title="Emergency contacts"
                    subtitle="People to reach in case of an emergency."
                    icon={PhoneCall}
                    actions={
                        <div className="flex items-center gap-2">
                            <ZoruButton variant="outline" asChild>
                                <Link href={BASE}>
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Overview
                                </Link>
                            </ZoruButton>
                            <ZoruButton onClick={openAdd}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add contact
                            </ZoruButton>
                        </div>
                    }
                />

                <div className="flex flex-wrap gap-1 border-b border-zoru-line">
                    {[
                        { href: BASE, label: 'Overview' },
                        { href: `${BASE}/profile`, label: 'Profile' },
                        { href: `${BASE}/documents`, label: 'Documents' },
                        {
                            href: `${BASE}/emergency-contacts`,
                            label: 'Emergency contacts',
                            active: true,
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

                {isLoading && rows.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <LoaderCircle className="h-5 w-5 animate-spin text-zoru-ink-muted" />
                    </div>
                ) : rows.length === 0 ? (
                    <ZoruCard className="flex flex-col items-start gap-3 p-8">
                        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2">
                            <PhoneCall
                                className="h-5 w-5 text-zoru-ink-muted"
                                strokeWidth={1.75}
                            />
                        </div>
                        <div>
                            <h3 className="text-[15px] text-zoru-ink">
                                No emergency contacts yet
                            </h3>
                            <p className="mt-1 text-[13px] text-zoru-ink-muted">
                                Add at least one contact for emergencies. The
                                first contact marked primary is shown on the
                                profile.
                            </p>
                        </div>
                        <ZoruButton onClick={openAdd}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add contact
                        </ZoruButton>
                    </ZoruCard>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {rows.map((c) => (
                            <ZoruCard
                                key={c._id}
                                className="flex flex-col gap-2 p-4"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[14px] font-medium text-zoru-ink">
                                            {c.name}
                                        </div>
                                        {c.relationship ? (
                                            <div className="text-[12px] text-zoru-ink-muted">
                                                {c.relationship}
                                            </div>
                                        ) : null}
                                    </div>
                                    {c.isPrimary ? (
                                        <ZoruBadge variant="success">
                                            Primary
                                        </ZoruBadge>
                                    ) : null}
                                </div>
                                <dl className="grid gap-1 text-[12.5px]">
                                    {c.phone ? (
                                        <div className="flex justify-between gap-2">
                                            <dt className="text-zoru-ink-muted">
                                                Phone
                                            </dt>
                                            <dd className="text-zoru-ink">
                                                <a
                                                    href={`tel:${c.phone}`}
                                                    className="hover:underline"
                                                >
                                                    {c.phone}
                                                </a>
                                            </dd>
                                        </div>
                                    ) : null}
                                    {c.email ? (
                                        <div className="flex justify-between gap-2">
                                            <dt className="text-zoru-ink-muted">
                                                Email
                                            </dt>
                                            <dd className="truncate text-zoru-ink">
                                                <a
                                                    href={`mailto:${c.email}`}
                                                    className="hover:underline"
                                                >
                                                    {c.email}
                                                </a>
                                            </dd>
                                        </div>
                                    ) : null}
                                    {c.address ? (
                                        <div>
                                            <dt className="text-zoru-ink-muted">
                                                Address
                                            </dt>
                                            <dd className="text-zoru-ink">
                                                {c.address}
                                            </dd>
                                        </div>
                                    ) : null}
                                    {c.notes ? (
                                        <div>
                                            <dt className="text-zoru-ink-muted">
                                                Notes
                                            </dt>
                                            <dd className="text-zoru-ink">
                                                {c.notes}
                                            </dd>
                                        </div>
                                    ) : null}
                                </dl>
                                <div className="mt-auto flex justify-end gap-1 border-t border-zoru-line pt-2">
                                    <ZoruButton
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEdit(c)}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </ZoruButton>
                                    <ZoruButton
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setPendingDelete(c)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </ZoruButton>
                                </div>
                            </ZoruCard>
                        ))}
                    </div>
                )}
            </div>

            {/* Add / Edit dialog */}
            <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <ZoruDialogContent className="max-w-lg">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>
                            {form.contactId
                                ? 'Edit emergency contact'
                                : 'Add emergency contact'}
                        </ZoruDialogTitle>
                    </ZoruDialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="contact-name">
                                    Name *
                                </ZoruLabel>
                                <ZoruInput
                                    id="contact-name"
                                    value={form.name}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            name: e.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="contact-relationship">
                                    Relationship
                                </ZoruLabel>
                                <ZoruInput
                                    id="contact-relationship"
                                    placeholder="Spouse, Parent…"
                                    value={form.relationship}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            relationship: e.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="contact-phone">
                                    Phone
                                </ZoruLabel>
                                <ZoruInput
                                    id="contact-phone"
                                    type="tel"
                                    value={form.phone}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            phone: e.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="contact-email">
                                    Email
                                </ZoruLabel>
                                <ZoruInput
                                    id="contact-email"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            email: e.target.value,
                                        })
                                    }
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="contact-address">
                                Address
                            </ZoruLabel>
                            <ZoruTextarea
                                id="contact-address"
                                rows={2}
                                value={form.address}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        address: e.target.value,
                                    })
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="contact-notes">Notes</ZoruLabel>
                            <ZoruTextarea
                                id="contact-notes"
                                rows={2}
                                value={form.notes}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        notes: e.target.value,
                                    })
                                }
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <ZoruCheckbox
                                id="contact-primary"
                                checked={form.isPrimary}
                                onCheckedChange={(v) =>
                                    setForm({
                                        ...form,
                                        isPrimary: v === true,
                                    })
                                }
                            />
                            <ZoruLabel
                                htmlFor="contact-primary"
                                className="cursor-pointer"
                            >
                                Mark as primary contact
                            </ZoruLabel>
                        </div>
                    </div>
                    <ZoruDialogFooter className="gap-2">
                        <ZoruButton
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                        >
                            Cancel
                        </ZoruButton>
                        <ZoruButton onClick={handleSave} disabled={saving}>
                            {saving ? (
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            {form.contactId ? 'Save changes' : 'Add contact'}
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>
                            Delete emergency contact?
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            “{pendingDelete?.name}” will be removed from this
                            employee’s emergency contacts.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                        >
                            {deleting ? 'Deleting…' : 'Delete'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}

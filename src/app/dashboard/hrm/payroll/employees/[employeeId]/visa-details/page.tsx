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
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useParams } from 'next/navigation';
import {
  ExternalLink,
  FileUp,
  LoaderCircle,
  Pencil,
  Plane,
  Plus,
  Trash2,
  } from 'lucide-react';

/**
 * Employee visa-details sub-tab —
 *   `/dashboard/hrm/payroll/employees/[employeeId]/visa-details`.
 *
 * Manages `crm_visa_details` filtered to this employee. Inline-create
 * dialog. The visa document is uploaded via `<SabFilePickerButton>` —
 * never a free-text URL paste (SabFiles policy). Statuses:
 *   active · expired · cancelled · archived.
 */

import * as React from 'react';
import Link from 'next/link';

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    deleteCrmVisaDetail,
    getCrmVisaDetails,
    saveCrmVisaDetail,
    type CrmVisaDetailDoc,
    type CrmVisaStatus,
} from '@/app/actions/crm-visa-details.actions';

const STATUS_OPTIONS: Array<{ value: CrmVisaStatus; label: string }> = [
    { value: 'active', label: 'Active' },
    { value: 'expired', label: 'Expired' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'archived', label: 'Archived' },
];

const STATUS_TONE: Record<CrmVisaStatus, StatusTone> = {
    active: 'green',
    expired: 'red',
    cancelled: 'red',
    archived: 'neutral',
};

type FormState = {
    visaId: string;
    country: string;
    visaType: string;
    visaNumber: string;
    issueDate: string;
    expiryDate: string;
    sponsor: string;
    status: CrmVisaStatus;
    notes: string;
    documentUrl: string;
    documentName: string;
};

const EMPTY: FormState = {
    visaId: '',
    country: '',
    visaType: '',
    visaNumber: '',
    issueDate: '',
    expiryDate: '',
    sponsor: '',
    status: 'active',
    notes: '',
    documentUrl: '',
    documentName: '',
};

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}



function fileNameFromUrl(u?: string): string {
    if (!u) return '';
    try {
        const path = new URL(u, 'http://x').pathname;
        return decodeURIComponent(path.split('/').pop() ?? '') || u;
    } catch {
        return u;
    }
}

export default function EmployeeVisaDetailsSubPage() {
    const params = useParams<{ employeeId: string }>();
    const employeeId = params.employeeId;
    const BASE = `/dashboard/hrm/payroll/employees/${employeeId}`;

    const { toast } = useZoruToast();
    const [rows, setRows] = React.useState<CrmVisaDetailDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [form, setForm] = React.useState<FormState>(EMPTY);
    const [pendingDelete, setPendingDelete] =
        React.useState<CrmVisaDetailDoc | null>(null);
    const [saving, startSave] = React.useTransition();
    const [deleting, startDelete] = React.useTransition();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const items = await getCrmVisaDetails({
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

    const openEdit = (row: CrmVisaDetailDoc) => {
        setForm({
            visaId: row._id,
            country: row.country ?? '',
            visaType: row.visaType ?? '',
            visaNumber: row.visaNumber ?? '',
            issueDate: toDateInput(row.issueDate),
            expiryDate: toDateInput(row.expiryDate),
            sponsor: row.sponsor ?? '',
            status: row.status ?? 'active',
            notes: row.notes ?? '',
            documentUrl: row.documentUrl ?? '',
            documentName: fileNameFromUrl(row.documentUrl),
        });
        setDialogOpen(true);
    };

    const onPickDocument = (pick: SabFilePick) => {
        setForm((p) => ({
            ...p,
            documentUrl: pick.url,
            documentName: pick.name,
        }));
    };

    const handleSave = () => {
        if (!form.country.trim() || !form.visaType.trim()) {
            toast({
                title: 'Required fields missing',
                description: 'Country and visa type are required.',
                variant: 'destructive',
            });
            return;
        }
        startSave(async () => {
            const fd = new FormData();
            if (form.visaId) fd.append('visaId', form.visaId);
            fd.append('employeeId', employeeId);
            fd.append('country', form.country);
            fd.append('visaType', form.visaType);
            fd.append('visaNumber', form.visaNumber);
            fd.append('issueDate', form.issueDate);
            fd.append('expiryDate', form.expiryDate);
            fd.append('sponsor', form.sponsor);
            fd.append('status', form.status);
            fd.append('notes', form.notes);
            fd.append('documentUrl', form.documentUrl);
            const r = await saveCrmVisaDetail(undefined, fd);
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
            const r = await deleteCrmVisaDetail(id);
            if (r.success) {
                toast({ title: 'Visa detail deleted' });
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
            <EntityListShell
                title="Visa details"
                subtitle="Travel visas, sponsorship and supporting documents."
                primaryAction={
                    <Button onClick={openAdd}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add visa
                    </Button>
                }
            >

                <div className="flex flex-wrap gap-1 border-b border-zoru-line">
                    {[
                        { href: BASE, label: 'Overview' },
                        { href: `${BASE}/profile`, label: 'Profile' },
                        { href: `${BASE}/documents`, label: 'Documents' },
                        {
                            href: `${BASE}/emergency-contacts`,
                            label: 'Emergency contacts',
                        },
                        { href: `${BASE}/leave-quotas`, label: 'Leave quotas' },
                        {
                            href: `${BASE}/visa-details`,
                            label: 'Visa details',
                            active: true,
                        },
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
                    <Card className="flex flex-col items-start gap-3 p-8">
                        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2">
                            <Plane
                                className="h-5 w-5 text-zoru-ink-muted"
                                strokeWidth={1.75}
                            />
                        </div>
                        <div>
                            <h3 className="text-[15px] text-zoru-ink">
                                No visa records yet
                            </h3>
                            <p className="mt-1 text-[13px] text-zoru-ink-muted">
                                Capture work-visa or travel-visa details for
                                this employee. Attach the visa document from
                                SabFiles.
                            </p>
                        </div>
                        <Button onClick={openAdd}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add visa
                        </Button>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {rows.map((v) => {
                            const tone =
                                STATUS_TONE[v.status] ?? ('neutral' as StatusTone);
                            return (
                                <Card
                                    key={v._id}
                                    className="flex flex-col gap-3 p-4"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[14px] font-medium text-zoru-ink">
                                                {v.country}
                                                <span className="ml-1 text-zoru-ink-muted">
                                                    · {v.visaType}
                                                </span>
                                            </div>
                                            {v.visaNumber ? (
                                                <div className="mt-0.5 font-mono text-[12px] text-zoru-ink-muted">
                                                    {v.visaNumber}
                                                </div>
                                            ) : null}
                                        </div>
                                        <StatusPill
                                            label={v.status}
                                            tone={tone}
                                        />
                                    </div>
                                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px]">
                                        <div>
                                            <dt className="text-zoru-ink-muted">
                                                Issued
                                            </dt>
                                            <dd className="text-zoru-ink">
                                                {fmtDate(v.issueDate)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-zoru-ink-muted">
                                                Expires
                                            </dt>
                                            <dd className="text-zoru-ink">
                                                {fmtDate(v.expiryDate)}
                                            </dd>
                                        </div>
                                        {v.sponsor ? (
                                            <div className="col-span-2">
                                                <dt className="text-zoru-ink-muted">
                                                    Sponsor
                                                </dt>
                                                <dd className="text-zoru-ink">
                                                    {v.sponsor}
                                                </dd>
                                            </div>
                                        ) : null}
                                        {v.notes ? (
                                            <div className="col-span-2">
                                                <dt className="text-zoru-ink-muted">
                                                    Notes
                                                </dt>
                                                <dd className="text-zoru-ink">
                                                    {v.notes}
                                                </dd>
                                            </div>
                                        ) : null}
                                    </dl>
                                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-zoru-line pt-2">
                                        {v.documentUrl ? (
                                            <a
                                                href={v.documentUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[12px] text-zoru-ink hover:underline"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                                Open document
                                            </a>
                                        ) : (
                                            <span className="text-[12px] text-zoru-ink-muted">
                                                No document attached
                                            </span>
                                        )}
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openEdit(v)}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    setPendingDelete(v)
                                                }
                                            >
                                                <Trash2 className="h-3.5 w-3.5 text-zoru-ink" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </EntityListShell>

            {/* Add / Edit dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <ZoruDialogContent className="max-w-xl">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>
                            {form.visaId ? 'Edit visa' : 'Add visa'}
                        </ZoruDialogTitle>
                    </ZoruDialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="visa-country">
                                    Country *
                                </Label>
                                <Input
                                    id="visa-country"
                                    value={form.country}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            country: e.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="visa-type">
                                    Visa type *
                                </Label>
                                <Input
                                    id="visa-type"
                                    placeholder="H1-B, Schengen…"
                                    value={form.visaType}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            visaType: e.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="visa-number">
                                    Visa number
                                </Label>
                                <Input
                                    id="visa-number"
                                    value={form.visaNumber}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            visaNumber: e.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="visa-status">
                                    Status
                                </Label>
                                <Select
                                    value={form.status}
                                    onValueChange={(v) =>
                                        setForm({
                                            ...form,
                                            status: v as CrmVisaStatus,
                                        })
                                    }
                                >
                                    <ZoruSelectTrigger id="visa-status">
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {STATUS_OPTIONS.map((o) => (
                                            <ZoruSelectItem
                                                key={o.value}
                                                value={o.value}
                                            >
                                                {o.label}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="visa-issue">
                                    Issue date
                                </Label>
                                <Input
                                    id="visa-issue"
                                    type="date"
                                    value={form.issueDate}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            issueDate: e.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="visa-expiry">
                                    Expiry date
                                </Label>
                                <Input
                                    id="visa-expiry"
                                    type="date"
                                    value={form.expiryDate}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            expiryDate: e.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="visa-sponsor">
                                    Sponsor
                                </Label>
                                <Input
                                    id="visa-sponsor"
                                    placeholder="Employer / sponsoring entity"
                                    value={form.sponsor}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            sponsor: e.target.value,
                                        })
                                    }
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="visa-notes">Notes</Label>
                            <Textarea
                                id="visa-notes"
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
                        <div className="space-y-1.5">
                            <Label>Visa document</Label>
                            <div className="flex flex-wrap items-center gap-2">
                                <SabFilePickerButton
                                    accept="document"
                                    onPick={onPickDocument}
                                    title="Pick a visa document"
                                >
                                    <FileUp className="mr-1.5 h-4 w-4" />
                                    {form.documentUrl
                                        ? 'Replace document'
                                        : 'Choose from SabFiles'}
                                </SabFilePickerButton>
                                {form.documentUrl ? (
                                    <>
                                        <a
                                            href={form.documentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="max-w-[240px] truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                                        >
                                            {form.documentName ||
                                                form.documentUrl}
                                        </a>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                setForm({
                                                    ...form,
                                                    documentUrl: '',
                                                    documentName: '',
                                                })
                                            }
                                        >
                                            Remove
                                        </Button>
                                    </>
                                ) : (
                                    <span className="text-[12px] text-zoru-ink-muted">
                                        No document attached.
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <ZoruDialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? (
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            {form.visaId ? 'Save changes' : 'Add visa'}
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>
                            Delete visa record?
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            The {pendingDelete?.country} ·{' '}
                            {pendingDelete?.visaType} record will be removed.
                            The attached SabFile stays in your library.
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

'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  FileUp,
  LoaderCircle,
  Save } from 'lucide-react';

// TODO 1E.sweep: convert ZoruSelect (status) -> <EnumFormField enumName="certificationStatus">. Employee/issuer dropdowns -> <EntityFormField entity="employee">. See plan §1E.

/**
 * <CertificationForm /> — create + edit form for HR Certifications.
 *
 * Binds to the `saveCertification` server action via `useActionState`.
 * The `certificateUrl` slot uses `<SabFilePickerButton>` only — SabFiles
 * policy forbids any free-text URL paste for file inputs.
 */

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import {
    saveCertification,
    type CrmCertificationDoc,
    type CrmCertificationStatus,
} from '@/app/actions/crm-certifications.actions';

const BASE = '/dashboard/hrm/hr/certifications';

const STATUS_OPTIONS: Array<{ value: CrmCertificationStatus; label: string }> = [
    { value: 'active', label: 'Active' },
    { value: 'expired', label: 'Expired' },
    { value: 'revoked', label: 'Revoked' },
    { value: 'archived', label: 'Archived' },
];

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function nameFromUrl(url: string): string {
    if (!url) return '';
    try {
        const path = new URL(url, 'http://x').pathname;
        return decodeURIComponent(path.split('/').pop() ?? '') || url;
    } catch {
        return url;
    }
}

interface CertificationFormProps {
    initialData?: CrmCertificationDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create certification'}
        </ZoruButton>
    );
}

export function CertificationForm({ initialData }: CertificationFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveCertification, initialState);

    const [certificateUrl, setCertificateUrl] = useState<string>(
        initialData?.certificateUrl ?? '',
    );
    const [certificateName, setCertificateName] = useState<string>(() =>
        nameFromUrl(initialData?.certificateUrl ?? ''),
    );

    const [status, setStatus] = useState<CrmCertificationStatus>(
        (initialData?.status as CrmCertificationStatus) ?? 'active',
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            if (id) router.push(`${BASE}/${id}`);
            else router.push(BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const onPickFile = (pick: SabFilePick) => {
        setCertificateUrl(pick.url);
        setCertificateName(pick.name);
    };

    const clearFile = () => {
        setCertificateUrl('');
        setCertificateName('');
    };

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="certificationId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="certificateUrl" value={certificateUrl} />
                <input type="hidden" name="status" value={status} />

                {/* Row 1: Name + Issuer */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="name">Name *</ZoruLabel>
                        <ZoruInput
                            id="name"
                            name="name"
                            required
                            placeholder="e.g. AWS Solutions Architect — Professional"
                            defaultValue={initialData?.name ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="issuer">Issuer</ZoruLabel>
                        <ZoruInput
                            id="issuer"
                            name="issuer"
                            placeholder="e.g. Amazon Web Services"
                            defaultValue={initialData?.issuer ?? ''}
                        />
                    </div>
                </div>

                {/* Row 2: Employee link */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeName">Employee name</ZoruLabel>
                        <ZoruInput
                            id="employeeName"
                            name="employeeName"
                            placeholder="Display name (optional)"
                            defaultValue={initialData?.employeeName ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeId">Employee id</ZoruLabel>
                        <ZoruInput
                            id="employeeId"
                            name="employeeId"
                            placeholder="Optional employee ObjectId"
                            defaultValue={initialData?.employeeId ?? ''}
                        />
                    </div>
                </div>

                {/* Row 3: Certification number */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="certificationNumber">
                        Certification number
                    </ZoruLabel>
                    <ZoruInput
                        id="certificationNumber"
                        name="certificationNumber"
                        placeholder="e.g. AWS-ASA-123456"
                        defaultValue={initialData?.certificationNumber ?? ''}
                    />
                </div>

                {/* Row 4: Dates */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="issueDate">Issue date</ZoruLabel>
                        <ZoruInput
                            id="issueDate"
                            name="issueDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.issueDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="expiryDate">Expiry date</ZoruLabel>
                        <ZoruInput
                            id="expiryDate"
                            name="expiryDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.expiryDate)}
                        />
                    </div>
                </div>

                {/* Row 5: Certificate file (SabFile) */}
                <div className="space-y-1.5">
                    <ZoruLabel>Certificate file</ZoruLabel>
                    <div className="flex flex-wrap items-center gap-2">
                        <SabFilePickerButton
                            accept="document"
                            onPick={onPickFile}
                            title="Pick a certificate file"
                        >
                            <FileUp className="mr-1.5 h-4 w-4" />
                            {certificateUrl ? 'Replace file' : 'Choose from SabFiles'}
                        </SabFilePickerButton>
                        {certificateUrl ? (
                            <>
                                <a
                                    href={certificateUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="max-w-[260px] truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                                >
                                    {certificateName || certificateUrl}
                                </a>
                                <ZoruButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearFile}
                                >
                                    Remove
                                </ZoruButton>
                            </>
                        ) : (
                            <span className="text-[12px] text-zoru-ink-muted">
                                No file attached.
                            </span>
                        )}
                    </div>
                </div>

                {/* Row 6: Status */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                    <ZoruSelect
                        value={status}
                        onValueChange={(v) =>
                            setStatus(v as CrmCertificationStatus)
                        }
                    >
                        <ZoruSelectTrigger id="status-trigger" className="sm:w-1/2">
                            <ZoruSelectValue placeholder="Status" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {STATUS_OPTIONS.map((o) => (
                                <ZoruSelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to certifications
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}

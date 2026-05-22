'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Select,
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

// 1E.sweep: status converted to <EnumFormField enumName="form16Status">.
// TODOs remaining: financial-year (dynamic list); employee →
// <EntityFormField entity="employee">.

/**
 * <Form16Form /> — create + edit form for Form 16 records.
 *
 * Binds to `saveForm16` via `useActionState`. The `documentUrl` slot uses
 * `<SabFilePickerButton>` (SabFiles policy — no free-text URL paste).
 */

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveForm16, type CrmForm16Status } from '@/app/actions/crm-form-16.actions';

const BASE = '/dashboard/hrm/payroll/form-16';

function currentFY(): string {
    const now = new Date();
    const y = now.getFullYear();
    // FY rolls April–March; if before April, FY runs prev-year → current-year.
    const startYear = now.getMonth() < 3 ? y - 1 : y;
    return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function fyOptions(count = 6): string[] {
    const baseYear = (() => {
        const now = new Date();
        return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
    })();
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
        const sy = baseYear - i;
        out.push(`${sy}-${String(sy + 1).slice(-2)}`);
    }
    return out;
}

interface Form16FormProps {
    initialData?: Record<string, unknown> | null;
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
            {isEditing ? 'Save changes' : 'Create Form 16'}
        </ZoruButton>
    );
}

export function Form16Form({ initialData }: Form16FormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveForm16, initialState);

    const [documentUrl, setDocumentUrl] = useState<string>(
        (initialData?.documentUrl as string | undefined) ?? '',
    );
    const [documentName, setDocumentName] = useState<string>(() => {
        const u = initialData?.documentUrl as string | undefined;
        if (!u) return '';
        try {
            const path = new URL(u, 'http://x').pathname;
            return decodeURIComponent(path.split('/').pop() ?? '') || u;
        } catch {
            return u;
        }
    });

    const [financialYear, setFinancialYear] = useState<string>(
        (initialData?.financialYear as string | undefined) ?? currentFY(),
    );
    const [status, setStatus] = useState<CrmForm16Status>(
        ((initialData?.status as CrmForm16Status | undefined) ?? 'draft'),
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? (initialData?._id as string | undefined);
            router.push(id ? `${BASE}/${id}` : BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const onPickDocument = (pick: SabFilePick) => {
        setDocumentUrl(pick.url);
        setDocumentName(pick.name);
    };
    const clearDocument = () => {
        setDocumentUrl('');
        setDocumentName('');
    };

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="form16Id"
                        value={String(initialData!._id)}
                    />
                ) : null}
                <input type="hidden" name="documentUrl" value={documentUrl} />
                <input type="hidden" name="financialYear" value={financialYear} />
                <input type="hidden" name="status" value={status} />

                {/* Row 1: Employee */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeName">Employee name *</ZoruLabel>
                        <ZoruInput
                            id="employeeName"
                            name="employeeName"
                            required
                            placeholder="e.g. Priya Sharma"
                            defaultValue={(initialData?.employeeName as string | undefined) ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeId">Employee ID</ZoruLabel>
                        <ZoruInput
                            id="employeeId"
                            name="employeeId"
                            placeholder="Internal employee id"
                            defaultValue={(initialData?.employeeId as string | undefined) ?? ''}
                        />
                    </div>
                </div>

                {/* Row 2: FY + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="fy-trigger">Financial year</ZoruLabel>
                        {/* TODO 1E.sweep: dynamic list — needs <EnumFieldYearRange> variant (rolling 6-FY window) */}
                        <ZoruSelect value={financialYear} onValueChange={setFinancialYear}>
                            <ZoruSelectTrigger id="fy-trigger">
                                <ZoruSelectValue placeholder="Select FY" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {fyOptions(6).map((fy) => (
                                    <ZoruSelectItem key={fy} value={fy}>
                                        FY {fy}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Status</ZoruLabel>
                        <EnumFormField
                            name="status-picker"
                            enumName="form16Status"
                            initialId={status}
                            onChange={(id) =>
                                setStatus((id as CrmForm16Status) ?? 'draft')
                            }
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* Row 3: PAN + TAN */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="pan">PAN</ZoruLabel>
                        <ZoruInput
                            id="pan"
                            name="pan"
                            placeholder="ABCDE1234F"
                            maxLength={10}
                            defaultValue={(initialData?.pan as string | undefined) ?? ''}
                            className="uppercase"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="tanOfEmployer">TAN of employer</ZoruLabel>
                        <ZoruInput
                            id="tanOfEmployer"
                            name="tanOfEmployer"
                            placeholder="ABCD12345E"
                            maxLength={10}
                            defaultValue={(initialData?.tanOfEmployer as string | undefined) ?? ''}
                            className="uppercase"
                        />
                    </div>
                </div>

                {/* Row 4: Totals */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="totalIncome">Total income (₹)</ZoruLabel>
                        <ZoruInput
                            id="totalIncome"
                            name="totalIncome"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            defaultValue={
                                typeof initialData?.totalIncome === 'number'
                                    ? String(initialData.totalIncome)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="taxDeducted">Tax deducted (₹)</ZoruLabel>
                        <ZoruInput
                            id="taxDeducted"
                            name="taxDeducted"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            defaultValue={
                                typeof initialData?.taxDeducted === 'number'
                                    ? String(initialData.taxDeducted)
                                    : ''
                            }
                        />
                    </div>
                </div>

                {/* Row 5: Document (SabFile) */}
                <div className="space-y-1.5">
                    <ZoruLabel>Form 16 document</ZoruLabel>
                    <div className="flex flex-wrap items-center gap-2">
                        <SabFilePickerButton
                            accept="document"
                            onPick={onPickDocument}
                            title="Pick the generated Form 16 PDF"
                        >
                            <FileUp className="mr-1.5 h-4 w-4" />
                            {documentUrl ? 'Replace document' : 'Choose from SabFiles'}
                        </SabFilePickerButton>
                        {documentUrl ? (
                            <>
                                <a
                                    href={documentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="max-w-[260px] truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                                >
                                    {documentName || documentUrl}
                                </a>
                                <ZoruButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearDocument}
                                >
                                    Remove
                                </ZoruButton>
                            </>
                        ) : (
                            <span className="text-[12px] text-zoru-ink-muted">
                                No document attached.
                            </span>
                        )}
                    </div>
                    <p className="text-[11.5px] text-zoru-ink-muted">
                        Files come from your SabFiles library — no external URL pastes.
                    </p>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Form 16 list
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}

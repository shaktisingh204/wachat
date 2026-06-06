'use client';

import { Button, Card, Label, Textarea, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import {
  Loader2,
  Save } from 'lucide-react';

/**
 * File a new GDPR erase request.
 *
 * Picks a subject (contact / lead / employee) via <EntityFormField>,
 * a scope (soft_redact / hard_delete) and an optional reason. Submits
 * straight to `fileEraseRequest` and routes to the detail page.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

import {
    fileEraseRequest,
    type EraseScope,
    type EraseSubjectKind,
} from '@/app/actions/crm-erase-requests.actions';
import type { EntityKey } from '@/lib/lookup-registry';

const SUBJECT_KINDS: { value: EraseSubjectKind; entity: EntityKey; label: string }[] = [
    { value: 'contact', entity: 'contact', label: 'Contact' },
    { value: 'lead', entity: 'lead', label: 'Lead' },
    { value: 'employee', entity: 'employee', label: 'Employee' },
];

const SCOPES: { value: EraseScope; label: string; help: string }[] = [
    {
        value: 'soft_redact',
        label: 'Soft redact',
        help: 'Replace PII fields with a sentinel. Audit trail and IDs are preserved.',
    },
    {
        value: 'hard_delete',
        label: 'Hard delete',
        help: 'Delete the subject row and all child entities owned by the subject.',
    },
];

export default function NewGdprEraseRequestPage() {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [subjectKind, setSubjectKind] = React.useState<EraseSubjectKind>('contact');
    const [subjectId, setSubjectId] = React.useState<string | null>(null);
    const [subjectLabel, setSubjectLabel] = React.useState<string>('');
    const [subjectEmail, setSubjectEmail] = React.useState<string>('');
    const [scope, setScope] = React.useState<EraseScope>('soft_redact');
    const [reason, setReason] = React.useState('');
    const [isPending, startPending] = React.useTransition();

    const activeEntity = React.useMemo<EntityKey>(
        () =>
            SUBJECT_KINDS.find((s) => s.value === subjectKind)?.entity ?? 'contact',
        [subjectKind],
    );

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!subjectId) {
            toast({
                title: 'Subject required',
                description: 'Pick a subject before filing the request.',
                variant: 'destructive',
            });
            return;
        }
        startPending(async () => {
            const res = await fileEraseRequest({
                subjectKind,
                subjectId,
                subjectName: subjectLabel || undefined,
                subjectEmail: subjectEmail.trim() || undefined,
                scope,
                reason: reason.trim() || undefined,
            });
            if (res.ok) {
                toast({
                    title: 'Request filed',
                    description: 'GDPR erase request created — pending approval.',
                });
                router.push(
                    `/dashboard/crm/settings/gdpr/removal-requests/${res.id}`,
                );
            } else {
                toast({
                    title: 'Failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <EntityDetailShell
            eyebrow="GDPR"
            title="New GDPR erase request"
            back={{
                href: '/dashboard/crm/settings/gdpr/removal-requests',
                label: 'Erase Requests',
            }}
        >

            <form onSubmit={onSubmit}>
                <Card className="space-y-5 p-6">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="subject-kind">Subject kind</Label>
                            <EnumFormField
                                name="__subjectKind"
                                enumName="eraseSubjectKind"
                                initialId={subjectKind}
                                onChange={(id) => {
                                    setSubjectKind((id ?? 'contact') as EraseSubjectKind);
                                    setSubjectId(null);
                                    setSubjectLabel('');
                                }}
                                placeholder="Pick a kind"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Subject</Label>
                            <EntityFormField
                                entity={activeEntity}
                                name="subjectId"
                                initialId={subjectId}
                                initialLabel={subjectLabel}
                                onChange={(id, hydrated) => {
                                    setSubjectId(id);
                                    setSubjectLabel(hydrated?.chip.primary ?? '');
                                    // some pickers surface email in secondary; capture if present
                                    const sec = hydrated?.chip.secondary;
                                    if (typeof sec === 'string' && sec.includes('@')) {
                                        setSubjectEmail(sec);
                                    }
                                }}
                                placeholder={`Pick a ${activeEntity}…`}
                                required
                            />
                            <p className="text-[12px] text-zoru-ink-muted">
                                {subjectLabel
                                    ? `Selected: ${subjectLabel}`
                                    : 'Search by name or email.'}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="scope">Scope</Label>
                        <EnumFormField
                            name="__scope"
                            enumName="eraseScope"
                            initialId={scope}
                            onChange={(id) => setScope((id ?? 'soft_redact') as EraseScope)}
                            placeholder="Pick a scope"
                        />
                        <p className="text-[12px] text-zoru-ink-muted">
                            {SCOPES.find((s) => s.value === scope)?.help}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reason">Reason (optional)</Label>
                        <Textarea
                            id="reason"
                            rows={3}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Subject withdrew consent on 2026-05-12 via DPO email."
                        />
                    </div>

                    <div className="flex justify-end gap-2 border-t border-zoru-line pt-4">
                        <Button type="button" variant="outline" asChild>
                            <Link href="/dashboard/crm/settings/gdpr/removal-requests">
                                Cancel
                            </Link>
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="mr-2 h-4 w-4" />
                            )}
                            File request
                        </Button>
                    </div>
                </Card>
            </form>
        </EntityDetailShell>
    );
}

'use client';

import { Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { EntityFormShell } from '@/components/crm/entity-form-shell';
import { EnumFormField } from '@/components/crm/enum-form-field';

/**
 * Notice form (§1D.3) — shared by /new and /[id]/edit.
 *
 * Preserves FormData keys consumed by `saveNotice`: heading, description,
 * notice_to, department_id, employee_ids (JSON), pinned, file_attached.
 */

import * as React from 'react';

import { saveNotice } from '@/app/actions/worksuite/knowledge.actions';
import type { WsNotice } from '@/lib/worksuite/knowledge-types';

export interface NoticesFormProps {
    mode: 'new' | 'edit';
    notice?: (WsNotice & { _id: string }) | null;
}

export function NoticesForm({ mode, notice }: NoticesFormProps): React.JSX.Element {
    const router = useRouter();
    const { toast } = useToast();
    const [state, formAction] = useActionState(saveNotice, {
        message: '',
        error: '',
    } as { message?: string; error?: string });

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            router.push('/dashboard/crm/workspace/notices');
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    return (
        <EntityFormShell
            title={mode === 'edit' ? 'Edit notice' : 'New notice'}
            subtitle="Publish a notice to your team."
            action={formAction}
            cancelHref="/dashboard/crm/workspace/notices"
            submitLabel={mode === 'edit' ? 'Save changes' : 'Publish'}
            hiddenInputs={
                <>
                    {notice?._id ? <input type="hidden" name="id" value={notice._id} /> : null}
                    <input type="hidden" name="file_attached" value="false" />
                </>
            }
            error={state?.error}
            message={state?.message}
            sections={[
                {
                    id: 'content',
                    title: 'Content',
                    description: 'Heading and body of the notice.',
                    children: (
                        <div className="grid gap-4">
                            <div>
                                <Label htmlFor="heading">Heading *</Label>
                                <Input
                                    id="heading"
                                    name="heading"
                                    required
                                    defaultValue={notice?.heading ?? ''}
                                    className="mt-1.5 h-10"
                                />
                            </div>
                            <div>
                                <Label htmlFor="description">Description *</Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    rows={6}
                                    required
                                    defaultValue={notice?.description ?? ''}
                                    className="mt-1.5"
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'audience',
                    title: 'Audience & pin',
                    description: 'Who sees this notice and whether it stays at the top.',
                    children: (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <Label htmlFor="notice_to">Audience</Label>
                                <div className="mt-1.5">
                                    <EnumFormField
                                        name="notice_to"
                                        enumName="noticeAudience"
                                        initialId={notice?.notice_to ?? 'all'}
                                        allowInlineCreate={false}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="pinned">Pinned</Label>
                                <div className="mt-1.5">
                                    <EnumFormField
                                        name="pinned"
                                        enumName="yesNo"
                                        initialId={notice?.pinned ? 'yes' : 'no'}
                                        allowInlineCreate={false}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="department_id">Department id</Label>
                                <Input
                                    id="department_id"
                                    name="department_id"
                                    defaultValue={notice?.department_id ?? ''}
                                    className="mt-1.5 h-10"
                                    placeholder="When audience is Department"
                                />
                            </div>
                            <div>
                                <Label htmlFor="employee_ids">Employee ids (JSON)</Label>
                                <Input
                                    id="employee_ids"
                                    name="employee_ids"
                                    defaultValue={JSON.stringify(notice?.employee_ids ?? [])}
                                    className="mt-1.5 h-10 font-mono text-[12px]"
                                    placeholder='["empId1","empId2"]'
                                />
                            </div>
                        </div>
                    ),
                },
            ]}
        />
    );
}

export default NoticesForm;

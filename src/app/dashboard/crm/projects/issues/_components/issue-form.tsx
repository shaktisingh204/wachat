import { ZoruButton, ZoruButton } from '@/components/zoruui';
'use client';

/**
 * Shared <IssueForm> — used by /issues/new and /issues/[issueId]/edit
 * (§1B W7). The action `saveWsIssue` PATCHes when a hidden `_id` is set;
 * otherwise POSTs.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { LoaderCircle } from 'lucide-react';

import { ClayCard } from '@/components/clay';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import {
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
} from '@/components/zoruui';
import { useToast } from '@/hooks/use-toast';
import { saveWsIssue } from '@/app/actions/worksuite/projects.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';

export interface IssueFormInitial {
    _id?: string;
    title?: string;
    description?: string;
    projectId?: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
    assigneeName?: string;
    reporterId?: string;
    reporterName?: string;
}

export interface IssueFormProps {
    mode: 'new' | 'edit';
    initial?: IssueFormInitial;
}

export function IssueForm({ mode, initial }: IssueFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [state, action, isPending] = useActionState(saveWsIssue, {
        message: '',
        error: '',
    } as { message?: string; error?: string; id?: string });

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const target = state.id
                ? `/dashboard/crm/projects/issues/${state.id}`
                : '/dashboard/crm/projects/issues';
            router.push(target);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router]);

    return (
        <ClayCard>
            <form action={action} className="space-y-4">
                {initial?._id ? (
                    <input type="hidden" name="_id" value={initial._id} />
                ) : null}

                <div>
                    <ZoruLabel htmlFor="title" className="text-foreground">
                        Title <span className="text-destructive">*</span>
                    </ZoruLabel>
                    <ZoruInput
                        id="title"
                        name="title"
                        required
                        defaultValue={initial?.title ?? ''}
                        className="h-10 rounded-lg border-border bg-card text-[13px]"
                    />
                </div>

                <div>
                    <ZoruLabel htmlFor="description" className="text-foreground">
                        Description
                    </ZoruLabel>
                    <ZoruTextarea
                        id="description"
                        name="description"
                        rows={4}
                        defaultValue={initial?.description ?? ''}
                        className="rounded-lg border-border bg-card text-[13px]"
                    />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <ZoruLabel htmlFor="projectId" className="text-foreground">
                            Project
                        </ZoruLabel>
                        <EntityFormField
                            entity="project"
                            name="projectId"
                            initialId={initial?.projectId}
                            placeholder="ZoruSelect project (optional)"
                        />
                    </div>
                    <div>
                        <ZoruLabel htmlFor="status" className="text-foreground">
                            Status
                        </ZoruLabel>
                        <ZoruSelect name="status" defaultValue={initial?.status ?? 'open'}>
                            <ZoruSelectTrigger
                                id="status"
                                className="h-10 rounded-lg border-border bg-card text-[13px]"
                            >
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="open">Open</ZoruSelectItem>
                                <ZoruSelectItem value="in_progress">In progress</ZoruSelectItem>
                                <ZoruSelectItem value="resolved">Resolved</ZoruSelectItem>
                                <ZoruSelectItem value="closed">Closed</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <ZoruLabel htmlFor="priority" className="text-foreground">
                            Priority
                        </ZoruLabel>
                        <ZoruSelect
                            name="priority"
                            defaultValue={initial?.priority ?? 'medium'}
                        >
                            <ZoruSelectTrigger
                                id="priority"
                                className="h-10 rounded-lg border-border bg-card text-[13px]"
                            >
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="low">Low</ZoruSelectItem>
                                <ZoruSelectItem value="medium">Medium</ZoruSelectItem>
                                <ZoruSelectItem value="high">High</ZoruSelectItem>
                                <ZoruSelectItem value="urgent">Urgent</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div>
                        <ZoruLabel htmlFor="assigneeId" className="text-foreground">
                            Assignee
                        </ZoruLabel>
                        <EntityFormField
                            entity="employee"
                            name="assigneeId"
                            dualWriteName="assigneeName"
                            initialId={initial?.assigneeId}
                            initialLabel={initial?.assigneeName}
                            placeholder="ZoruSelect assignee"
                        />
                    </div>
                </div>

                <div>
                    <ZoruLabel htmlFor="reporterId" className="text-foreground">
                        Reporter
                    </ZoruLabel>
                    <EntityFormField
                        entity="user"
                        name="reporterId"
                        dualWriteName="reporterName"
                        initialId={initial?.reporterId}
                        initialLabel={initial?.reporterName}
                        placeholder="ZoruSelect reporter"
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <ZoruButton
                        type="button"
                        variant="pill"
                        onClick={() =>
                            router.push(
                                initial?._id
                                    ? `/dashboard/crm/projects/issues/${initial._id}`
                                    : '/dashboard/crm/projects/issues',
                            )
                        }
                    >
                        Cancel
                    </ZoruButton>
                    <ZoruButton
                        type="submit"
                        variant="obsidian"
                        disabled={isPending}
                        leading={
                            isPending ? (
                                <LoaderCircle
                                    className="h-4 w-4 animate-spin"
                                    strokeWidth={1.75}
                                />
                            ) : null
                        }
                    >
                        {mode === 'edit' ? 'Save changes' : 'Save'}
                    </ZoruButton>
                </div>
            </form>
        </ClayCard>
    );
}

export default IssueForm;

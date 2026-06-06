'use client';

import { Button, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import { LoaderCircle, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { recordAwardVote } from '@/app/actions/hr-status-flow.actions';

export function NominateForm({ programId, programName }: { programId: string, programName: string }) {
    const { toast } = useToast();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const nomineeRef = (formData.get('nomineeRef') as string)?.trim();
        const reason = (formData.get('reason') as string)?.trim();

        if (!nomineeRef) {
            toast({ title: 'Error', description: 'Nominee is required', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            const res = await recordAwardVote(programId, nomineeRef, reason);
            if (res.error) {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: 'Nomination submitted successfully.' });
                router.push(`/dashboard/hrm/hr/awards/${programId}`);
            }
        });
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="space-y-1.5">
                <Label htmlFor="nomineeRef">Nominee Name or ID *</Label>
                <Input
                    id="nomineeRef"
                    name="nomineeRef"
                    placeholder="e.g. John Doe"
                    required
                />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="reason">Reason for Nomination *</Label>
                <Textarea
                    id="reason"
                    name="reason"
                    placeholder={`Why does this person deserve the ${programName}?`}
                    required
                    rows={4}
                />
            </div>
            <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                    {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit Nomination
                </Button>
            </div>
        </form>
    );
}

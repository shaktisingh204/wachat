'use client';

/**
 * New-ticket drawer for the client portal. Opens the ZoruDrawer
 * with a small form (subject + priority + description) and submits
 * via the `createClientTicket` server action.
 *
 * The drawer auto-opens when the page URL carries `?new=1` (used by
 * the dashboard's "Create Ticket" quick link). It removes that flag
 * from the URL on close so refreshing doesn't re-open it.
 */

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui/compat';
import { Input } from '@/components/sabcrm/20ui/compat';
import { Label } from '@/components/sabcrm/20ui/compat';
import { Textarea } from '@/components/sabcrm/20ui/compat';
import {
    ZoruDrawer,
    ZoruDrawerContent,
    ZoruDrawerHeader,
    ZoruDrawerTitle,
    ZoruDrawerDescription,
    ZoruDrawerFooter,
} from '@/components/sabcrm/20ui/compat';
import { createClientTicket } from '@/app/actions/client-portal.actions';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
type Priority = (typeof PRIORITIES)[number];

export function NewTicketDrawer() {
    const router = useRouter();
    const search = useSearchParams();
    const [open, setOpen] = React.useState(false);
    const [subject, setSubject] = React.useState('');
    const [priority, setPriority] = React.useState<Priority>('medium');
    const [description, setDescription] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Auto-open if `?new=1` was passed (from the dashboard quick link).
    React.useEffect(() => {
        if (search?.get('new') === '1') setOpen(true);
    }, [search]);

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next && search?.get('new')) {
            const params = new URLSearchParams(search.toString());
            params.delete('new');
            const qs = params.toString();
            router.replace(`/portal/client/tickets${qs ? `?${qs}` : ''}`);
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSubmitting(true);
        const res = await createClientTicket({ subject, priority, description });
        setSubmitting(false);
        if (res.error) {
            setError(res.error);
            return;
        }
        setSubject('');
        setDescription('');
        setPriority('medium');
        setOpen(false);
        router.refresh();
        if (res.id) router.push(`/portal/client/tickets/${res.id}`);
    };

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> New Ticket
            </Button>
            <ZoruDrawer open={open} onOpenChange={handleOpenChange}>
                <ZoruDrawerContent>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <ZoruDrawerHeader>
                            <ZoruDrawerTitle>New support ticket</ZoruDrawerTitle>
                            <ZoruDrawerDescription>
                                Describe the issue and our team will reply soon.
                            </ZoruDrawerDescription>
                        </ZoruDrawerHeader>
                        <div className="flex flex-col gap-4 px-4">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="ct-subject">Subject</Label>
                                <Input
                                    id="ct-subject"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Short summary"
                                    required
                                    maxLength={200}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="ct-priority">Priority</Label>
                                <select
                                    id="ct-priority"
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value as Priority)}
                                    className="h-9 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2 text-sm text-[var(--st-text)]"
                                >
                                    {PRIORITIES.map((p) => (
                                        <option key={p} value={p}>
                                            {p.charAt(0).toUpperCase() + p.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="ct-desc">Description</Label>
                                <Textarea
                                    id="ct-desc"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={5}
                                    placeholder="What's going on?"
                                    required
                                />
                            </div>
                            {error ? (
                                <div className="text-sm text-[var(--st-danger)]" role="alert">
                                    {error}
                                </div>
                            ) : null}
                        </div>
                        <ZoruDrawerFooter>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? 'Submitting…' : 'Submit ticket'}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                                Cancel
                            </Button>
                        </ZoruDrawerFooter>
                    </form>
                </ZoruDrawerContent>
            </ZoruDrawer>
        </>
    );
}

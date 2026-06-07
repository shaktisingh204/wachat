'use client';

/**
 * New-ticket drawer for the client portal. Opens the Drawer
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

import {
    Button,
    Field,
    Input,
    Textarea,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerFooter,
} from '@/components/sabcrm/20ui';
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
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> New Ticket
            </Button>
            <Drawer open={open} onOpenChange={handleOpenChange}>
                <DrawerContent>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <DrawerHeader>
                            <DrawerTitle>New support ticket</DrawerTitle>
                            <DrawerDescription>
                                Describe the issue and our team will reply soon.
                            </DrawerDescription>
                        </DrawerHeader>
                        <div className="flex flex-col gap-4 px-4">
                            <Field label="Subject" id="ct-subject" required>
                                <Input
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Short summary"
                                    maxLength={200}
                                />
                            </Field>
                            <Field label="Priority" id="ct-priority">
                                <Select
                                    value={priority}
                                    onValueChange={(value) => setPriority(value as Priority)}
                                >
                                    <SelectTrigger id="ct-priority" aria-label="Priority">
                                        <SelectValue placeholder="Select priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PRIORITIES.map((p) => (
                                            <SelectItem key={p} value={p}>
                                                {p.charAt(0).toUpperCase() + p.slice(1)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Description" id="ct-desc" required>
                                <Textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={5}
                                    placeholder="What's going on?"
                                />
                            </Field>
                            {error ? (
                                <div className="text-sm text-[var(--st-danger)]" role="alert">
                                    {error}
                                </div>
                            ) : null}
                        </div>
                        <DrawerFooter>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? 'Submitting...' : 'Submit ticket'}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                                Cancel
                            </Button>
                        </DrawerFooter>
                    </form>
                </DrawerContent>
            </Drawer>
        </>
    );
}

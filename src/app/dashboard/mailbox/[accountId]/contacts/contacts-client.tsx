'use client';

/**
 * Webmail address book.
 *
 * - Search field (debounced; calls action layer)
 * - "Add contact" inline form
 * - Per-row delete
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Trash2, Users } from 'lucide-react';

import {
    createMailContact,
    deleteMailContact,
    listMailContacts,
} from '@/app/actions/mailbox.actions';
import type { MailContactDoc } from '@/lib/rust-client/mail-contacts-sync';
import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, EmptyState, Input, Label, useToast } from '@/components/sabcrm/20ui/compat';

export interface ContactsClientProps {
    accountId: string;
    initialContacts: MailContactDoc[];
}

export function ContactsClient({
    accountId,
    initialContacts,
}: ContactsClientProps) {
    const router = useRouter();
    const { toast } = useToast();

    const [contacts, setContacts] = React.useState(initialContacts);
    const [query, setQuery] = React.useState('');
    const [displayName, setDisplayName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);
    const [busyId, setBusyId] = React.useState<string | null>(null);

    // Debounced server search
    React.useEffect(() => {
        const handle = window.setTimeout(async () => {
            const rows = await listMailContacts(accountId, query.trim() || undefined);
            setContacts(rows);
        }, 250);
        return () => window.clearTimeout(handle);
    }, [accountId, query]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setSubmitting(true);
        const res = await createMailContact({
            accountId,
            displayName: displayName.trim() || undefined,
            emails: [email.trim()],
        });
        setSubmitting(false);
        if (!res.ok) {
            toast({ title: 'Could not add', description: res.error, variant: 'destructive' });
            return;
        }
        toast({ title: 'Contact added' });
        setEmail('');
        setDisplayName('');
        router.refresh();
    };

    const handleDelete = async (c: MailContactDoc) => {
        const id = c._id!;
        if (!window.confirm(`Remove ${c.displayName ?? c.emails?.[0] ?? 'contact'}?`)) return;
        setBusyId(id);
        const res = await deleteMailContact(id, accountId);
        setBusyId(null);
        if (!res.ok) {
            toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
            return;
        }
        setContacts((prev) => prev.filter((x) => x._id !== id));
        toast({ title: 'Removed' });
    };

    return (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Add contact
                    </CardTitle>
                    <CardDescription>
                        Quick add — full contact record lives in the CRM module.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <form
                        onSubmit={handleCreate}
                        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                    >
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="contact-name">Display name</Label>
                            <Input
                                id="contact-name"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Ada Lovelace"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="contact-email">Email</Label>
                            <Input
                                id="contact-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ada@example.com"
                                required
                            />
                        </div>
                        <Button type="submit" disabled={submitting || !email.trim()}>
                            <Plus className="mr-1 h-4 w-4" />
                            Add
                        </Button>
                    </form>
                </CardBody>
            </Card>

            <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-[var(--st-text-secondary)]" />
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search contacts…"
                />
            </div>

            {contacts.length === 0 ? (
                <EmptyState
                    icon={<Users className="h-8 w-8" />}
                    title="No contacts yet"
                    description="Address book entries appear here as you send and receive mail."
                />
            ) : (
                <div className="grid gap-2">
                    {contacts.map((c) => {
                        const id = c._id!;
                        const busy = busyId === id;
                        return (
                            <Card key={id}>
                                <CardBody className="flex flex-wrap items-center justify-between gap-3 p-3">
                                    <div className="min-w-0">
                                        <div className="font-medium">
                                            {c.displayName ?? c.emails?.[0] ?? '(unnamed)'}
                                        </div>
                                        <div className="flex flex-wrap gap-1 pt-1">
                                            {(c.emails ?? []).map((e) => (
                                                <Badge key={e} variant="secondary">
                                                    {e}
                                                </Badge>
                                            ))}
                                        </div>
                                        {(c.sendCount ?? 0) + (c.receiveCount ?? 0) > 0 ? (
                                            <div className="pt-1 text-xs text-[var(--st-text-secondary)]">
                                                Sent {c.sendCount ?? 0} · Received {c.receiveCount ?? 0}
                                            </div>
                                        ) : null}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        disabled={busy}
                                        onClick={() => handleDelete(c)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

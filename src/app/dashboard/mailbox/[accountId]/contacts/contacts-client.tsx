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
import { Plus, Search, Trash2, UserPlus, Users } from 'lucide-react';

import {
    createMailContact,
    deleteMailContact,
    listMailContacts,
} from '@/app/actions/mailbox.actions';
import type { MailContactDoc } from '@/lib/rust-client/mail-contacts-sync';
import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, EmptyState, Field, IconButton, Input, useToast } from '@/components/sabcrm/20ui';

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
            toast({ title: 'Could not add', description: res.error, tone: 'danger' });
            return;
        }
        toast({ title: 'Contact added', tone: 'success' });
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
            toast({ title: 'Delete failed', description: res.error, tone: 'danger' });
            return;
        }
        setContacts((prev) => prev.filter((x) => x._id !== id));
        toast({ title: 'Contact removed', tone: 'success' });
    };

    return (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                        Add contact
                    </CardTitle>
                    <CardDescription>
                        A quick entry for this mailbox. The full contact record lives in the CRM.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <form
                        onSubmit={handleCreate}
                        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                    >
                        <Field label="Display name" id="contact-name">
                            <Input
                                id="contact-name"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Ada Lovelace"
                            />
                        </Field>
                        <Field label="Email" id="contact-email">
                            <Input
                                id="contact-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ada@example.com"
                                required
                            />
                        </Field>
                        <Button
                            type="submit"
                            variant="primary"
                            iconLeft={Plus}
                            loading={submitting}
                            disabled={submitting || !email.trim()}
                        >
                            Add
                        </Button>
                    </form>
                </CardBody>
            </Card>

            <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--st-text)]">
                        <Users className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                        Address book
                        <span className="font-normal tabular-nums text-[var(--st-text-secondary)]">
                            ({contacts.length})
                        </span>
                    </h2>
                    <Input
                        inputSize="sm"
                        iconLeft={Search}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search contacts"
                        aria-label="Search contacts"
                        className="w-64"
                    />
                </div>

                {contacts.length === 0 ? (
                    <EmptyState
                        icon={Users}
                        title={query.trim() ? 'No matching contacts' : 'No contacts yet'}
                        description={
                            query.trim()
                                ? 'Try a different name or email address.'
                                : 'Address book entries appear here as you send and receive mail.'
                        }
                    />
                ) : (
                    <ul className="grid gap-2">
                        {contacts.map((c) => {
                            const id = c._id!;
                            const busy = busyId === id;
                            const interactions =
                                (c.sendCount ?? 0) + (c.receiveCount ?? 0);
                            return (
                                <li key={id}>
                                  <Card>
                                    <CardBody className="flex flex-wrap items-center justify-between gap-3 p-3">
                                        <div className="min-w-0">
                                            <div className="font-medium text-[var(--st-text)]">
                                                {c.displayName ?? c.emails?.[0] ?? '(unnamed)'}
                                            </div>
                                            <div className="flex flex-wrap gap-1 pt-1">
                                                {(c.emails ?? []).map((e) => (
                                                    <Badge key={e} tone="neutral">
                                                        {e}
                                                    </Badge>
                                                ))}
                                            </div>
                                            {interactions > 0 ? (
                                                <div className="pt-1 text-xs tabular-nums text-[var(--st-text-secondary)]">
                                                    Sent {c.sendCount ?? 0} · Received {c.receiveCount ?? 0}
                                                </div>
                                            ) : null}
                                        </div>
                                        <IconButton
                                            label={`Remove ${c.displayName ?? c.emails?.[0] ?? 'contact'}`}
                                            icon={Trash2}
                                            variant="danger"
                                            size="sm"
                                            disabled={busy}
                                            onClick={() => handleDelete(c)}
                                        />
                                    </CardBody>
                                  </Card>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}

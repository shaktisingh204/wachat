'use client';

/** Auth tab — end-user list + admin-create form. */
import React from 'react';
import { Plus, UserCheck, UserPlus, Users } from 'lucide-react';

import { signUpSabcatalystUser } from '@/app/actions/sabcatalyst.actions';
import {
    Alert,
    Avatar,
    Badge,
    Button,
    Card,
    CardBody,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    EmptyState,
    Field,
    Input,
} from '@/components/sabcrm/20ui';
import type { SabcatalystAuthUser } from '@/lib/rust-client/sabcatalyst-auth-users';

interface Props { projectId: string; initialUsers: SabcatalystAuthUser[] }

export function AuthTab({ projectId, initialUsers }: Props) {
    const [users, setUsers] = React.useState(initialUsers);
    const [open, setOpen] = React.useState(false);
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState<string | null>(null);

    async function create() {
        setBusy(true);
        setErr(null);
        try {
            const u = await signUpSabcatalystUser(projectId, email.trim(), password);
            setUsers((s) => [u, ...s]);
            setOpen(false);
            setEmail('');
            setPassword('');
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : 'Could not create the user.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
                    New end-user
                </Button>
            </div>
            {users.length === 0 ? (
                <Card>
                    <CardBody className="p-6">
                        <EmptyState
                            icon={Users}
                            title="No end-users yet"
                            description="These are users authenticated against your project, not SabNode accounts."
                            action={
                                <Button variant="primary" iconLeft={UserPlus} onClick={() => setOpen(true)}>
                                    Add an end-user
                                </Button>
                            }
                        />
                    </CardBody>
                </Card>
            ) : (
                <ul className="flex list-none flex-col gap-2 p-0">
                    {users.map((u) => (
                        <li key={u._id}>
                            <Card>
                                <CardBody className="flex items-center gap-3 p-4">
                                    <Avatar name={u.email} shape="round" size="sm" />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="truncate font-medium">{u.email}</h3>
                                            <Badge tone={u.status === 'active' ? 'success' : 'danger'}>
                                                {u.status}
                                            </Badge>
                                            {u.emailVerified ? (
                                                <Badge tone="info">
                                                    <span className="inline-flex items-center gap-1">
                                                        <UserCheck size={12} aria-hidden="true" />
                                                        verified
                                                    </span>
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <p className="mt-1 text-xs text-[var(--st-text-secondary)] tabular-nums">
                                            Last sign-in:{' '}
                                            {u.lastSignInAt
                                                ? new Date(u.lastSignInAt).toLocaleString()
                                                : 'never'}
                                        </p>
                                    </div>
                                </CardBody>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create end-user</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Field label="Email" required>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="user@example.com"
                                autoFocus
                            />
                        </Field>
                        <Field
                            label="Password"
                            required
                            help="Hashed (SHA-256) server-side before being sent to the backend."
                        >
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </Field>
                        {err ? (
                            <Alert tone="danger" title="Could not create user">
                                {err}
                            </Alert>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={create}
                            loading={busy}
                            disabled={busy || !email.trim() || !password}
                        >
                            Create user
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

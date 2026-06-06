'use client';

/** Auth tab — end-user list + admin-create form + revoke-session. */
import React from 'react';

import {
    signUpSabcatalystUser,
    revokeSabcatalystAuthSession,
} from '@/app/actions/sabcatalyst.actions';
import {
    Button,
    Card,
    Input,
    Label,
    EmptyState,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Badge,
} from '@/components/sabcrm/20ui/compat';
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
            setErr(e instanceof Error ? e.message : 'Failed');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={() => setOpen(true)}>+ New end-user</Button>
            </div>
            {users.length === 0 ? (
                <EmptyState
                    title="No end-users yet"
                    description="These are users authenticated against your project (not SabNode users)."
                />
            ) : (
                <div className="space-y-2">
                    {users.map((u) => (
                        <Card key={u._id} className="p-4 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold truncate">{u.email}</h3>
                                    <Badge variant={u.status === 'active' ? 'default' : 'destructive'}>
                                        {u.status}
                                    </Badge>
                                    {u.emailVerified ? <Badge variant="outline">verified</Badge> : null}
                                </div>
                                <p className="text-xs text-[var(--st-text-secondary)] mt-1">
                                    Last sign-in:{' '}
                                    {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString() : 'never'}
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                onClick={async () => {
                                    // Sessions are listed lazily — for now we just
                                    // expose a per-user revoke-all hook via the session id
                                    // when known. Wiring TODO: surface a sessions panel.
                                    const id = prompt('Session id to revoke (from logs):');
                                    if (id) await revokeSabcatalystAuthSession(id);
                                }}
                            >
                                Revoke session
                            </Button>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create end-user</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <p className="text-xs text-[var(--st-text-secondary)] mt-1">
                                Hashed (SHA-256) server-side before being sent to Rust.
                            </p>
                        </div>
                        {err ? <p className="text-sm text-[var(--st-text)]">{err}</p> : null}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                            Cancel
                        </Button>
                        <Button onClick={create} disabled={busy || !email.trim() || !password}>
                            {busy ? 'Creating…' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

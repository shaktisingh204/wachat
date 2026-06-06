'use client';

/**
 * "+ New project" CTA on the SabCatalyst home — opens a dialog and
 * calls the `createSabcatalystProject` server action.
 */
import React from 'react';
import { useRouter } from 'next/navigation';

import { createSabcatalystProject } from '@/app/actions/sabcatalyst.actions';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label, Textarea, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/sabcrm/20ui/compat';
import type { ProjectRuntime } from '@/lib/rust-client/sabcatalyst-projects';

const RUNTIMES: ProjectRuntime[] = ['nodejs20', 'python311', 'deno', 'bun'];

export function NewProjectButton() {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState('');
    const [slug, setSlug] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [runtime, setRuntime] = React.useState<ProjectRuntime>('nodejs20');
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState<string | null>(null);

    async function submit() {
        setErr(null);
        setBusy(true);
        try {
            const created = await createSabcatalystProject({
                name: name.trim(),
                slug: slug.trim().toLowerCase(),
                description: description.trim() || undefined,
                runtime,
            });
            setOpen(false);
            router.push(`/dashboard/sabcatalyst/${created._id}`);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : 'Failed to create project');
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Button onClick={() => setOpen(true)}>+ New project</Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create SabCatalyst project</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="My Backend"
                            />
                        </div>
                        <div>
                            <Label htmlFor="slug">Slug</Label>
                            <Input
                                id="slug"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                                placeholder="my-backend"
                            />
                            <p className="text-xs text-[var(--st-text-secondary)] mt-1">
                                Used in the runtime URL:{' '}
                                <code>/api/catalyst/{slug || 'your-slug'}/...</code>
                            </p>
                        </div>
                        <div>
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                            />
                        </div>
                        <div>
                            <Label>Runtime</Label>
                            <Select value={runtime} onValueChange={(v) => setRuntime(v as ProjectRuntime)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {RUNTIMES.map((r) => (
                                        <SelectItem key={r} value={r}>
                                            {r}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {err ? <p className="text-sm text-[var(--st-text)]">{err}</p> : null}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                            Cancel
                        </Button>
                        <Button onClick={submit} disabled={busy || !name.trim() || !slug.trim()}>
                            {busy ? 'Creating…' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

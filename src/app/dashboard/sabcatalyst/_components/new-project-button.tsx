'use client';

/**
 * "New project" CTA on the SabCatalyst home — opens a dialog and
 * calls the `createSabcatalystProject` server action.
 */
import React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { createSabcatalystProject } from '@/app/actions/sabcatalyst.actions';
import {
    Alert,
    Button,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Field,
    Input,
    Textarea,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/sabcrm/20ui';
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
            setErr(e instanceof Error ? e.message : 'Could not create the project.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
                New project
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create SabCatalyst project</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Field label="Name" required>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="My Backend"
                                autoFocus
                            />
                        </Field>
                        <Field
                            label="Slug"
                            required
                            help={`Used in the runtime URL: /api/catalyst/${slug || 'your-slug'}/...`}
                        >
                            <Input
                                value={slug}
                                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                                placeholder="my-backend"
                            />
                        </Field>
                        <Field label="Description">
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                placeholder="What this backend powers"
                            />
                        </Field>
                        <Field label="Runtime">
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
                        </Field>
                        {err ? (
                            <Alert tone="danger" title="Could not create project">
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
                            onClick={submit}
                            loading={busy}
                            disabled={busy || !name.trim() || !slug.trim()}
                        >
                            Create project
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

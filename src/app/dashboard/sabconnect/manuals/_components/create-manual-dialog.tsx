'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Textarea, Label, Checkbox } from '@/components/sabcrm/20ui';

import { createSabConnectManual } from '@/app/actions/sabconnect.actions';

export function CreateManualDialog() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [published, setPublished] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const submit = () => {
        if (!title.trim() || !body.trim()) {
            setError('Title and body are required.');
            return;
        }
        setError(null);
        startTransition(async () => {
            const res = await createSabConnectManual({
                title: title.trim(),
                body: body.trim(),
                published,
            });
            if ('error' in res) {
                setError(res.error);
                return;
            }
            setOpen(false);
            setTitle('');
            setBody('');
            setPublished(false);
            router.refresh();
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>New manual</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create a manual</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="manual-title">Title</Label>
                        <Input
                            id="manual-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="manual-body">Body (markdown)</Label>
                        <Textarea
                            id="manual-body"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={10}
                        />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[var(--st-text)]">
                        <Checkbox
                            checked={published}
                            onCheckedChange={(v) => setPublished(v === true)}
                        />
                        Publish immediately
                    </label>
                    {error ? (
                        <p role="alert" className="text-sm text-[var(--st-danger)]">
                            {error}
                        </p>
                    ) : null}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={pending}>
                        {pending ? 'Saving…' : 'Save manual'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

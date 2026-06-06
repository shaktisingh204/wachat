'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
    Button,
    Checkbox,
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Field,
    Input,
    Textarea,
} from '@/components/sabcrm/20ui';

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
                <Button variant="primary">New manual</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create a manual</DialogTitle>
                    <DialogDescription>
                        Write the manual content in markdown, then publish when it is ready.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                    <Field label="Title">
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </Field>
                    <Field label="Body (markdown)" error={error ?? undefined}>
                        <Textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={10}
                        />
                    </Field>
                    <Checkbox
                        checked={published}
                        onChange={(e) => setPublished(e.target.checked)}
                        label="Publish immediately"
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button variant="primary" onClick={submit} loading={pending}>
                        Save manual
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

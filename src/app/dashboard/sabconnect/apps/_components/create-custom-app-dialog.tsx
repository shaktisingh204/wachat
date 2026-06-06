'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
    Alert,
    Button,
    Dialog,
    DialogTrigger,
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
    useToast,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { createSabConnectCustomApp } from '@/app/actions/sabconnect.actions';
import type { SabConnectCustomAppOpenIn } from '@/lib/rust-client/sabconnect-custom-apps';

export function CreateCustomAppDialog() {
    const router = useRouter();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [description, setDescription] = useState('');
    const [openIn, setOpenIn] = useState<SabConnectCustomAppOpenIn>('new_tab');
    const [icon, setIcon] = useState<SabFilePick | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const submit = () => {
        if (!name.trim() || !url.trim()) {
            setError('Name and URL are required.');
            return;
        }
        setError(null);
        startTransition(async () => {
            const res = await createSabConnectCustomApp({
                name: name.trim(),
                url: url.trim(),
                description: description.trim() || undefined,
                openIn,
                iconFileId: icon?.id ?? undefined,
            });
            if ('error' in res) {
                setError(res.error);
                return;
            }
            setOpen(false);
            setName('');
            setUrl('');
            setDescription('');
            setIcon(null);
            toast.success('App pinned.');
            router.refresh();
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="primary">Pin app</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Pin a custom app</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                    <Field label="Name">
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </Field>
                    <Field label="URL">
                        <Input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://…"
                        />
                    </Field>
                    <Field label="Description">
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </Field>
                    <Field label="Open in">
                        <Select
                            value={openIn}
                            onValueChange={(v) => setOpenIn(v as SabConnectCustomAppOpenIn)}
                        >
                            <SelectTrigger aria-label="Open in">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="new_tab">New tab</SelectItem>
                                <SelectItem value="iframe">Embedded iframe</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Icon">
                        <SabFilePickerButton
                            accept="image"
                            onPick={(pick) => setIcon(pick)}
                        >
                            {icon ? icon.name : 'Pick icon'}
                        </SabFilePickerButton>
                    </Field>
                    {error ? (
                        <Alert tone="danger">{error}</Alert>
                    ) : null}
                </div>
                <DialogFooter>
                    <Button variant="secondary" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={submit} loading={pending}>
                        {pending ? 'Saving…' : 'Pin app'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

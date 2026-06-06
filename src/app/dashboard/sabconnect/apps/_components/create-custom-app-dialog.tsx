'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
    Button,
    Dialog,
    ZoruDialogTrigger,
    ZoruDialogContent,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruDialogFooter,
    Input,
    Textarea,
    Label,
    Select,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruSelectContent,
    ZoruSelectItem,
} from '@/components/sabcrm/20ui/compat';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { createSabConnectCustomApp } from '@/app/actions/sabconnect.actions';
import type { SabConnectCustomAppOpenIn } from '@/lib/rust-client/sabconnect-custom-apps';

export function CreateCustomAppDialog() {
    const router = useRouter();
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
            router.refresh();
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                <Button>Pin app</Button>
            </ZoruDialogTrigger>
            <ZoruDialogContent>
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Pin a custom app</ZoruDialogTitle>
                </ZoruDialogHeader>
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="app-name">Name</Label>
                        <Input
                            id="app-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="app-url">URL</Label>
                        <Input
                            id="app-url"
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://…"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="app-desc">Description</Label>
                        <Textarea
                            id="app-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label>Open in</Label>
                        <Select
                            value={openIn}
                            onValueChange={(v) => setOpenIn(v as SabConnectCustomAppOpenIn)}
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="new_tab">New tab</ZoruSelectItem>
                                <ZoruSelectItem value="iframe">Embedded iframe</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label>Icon</Label>
                        <SabFilePickerButton
                            accept="image"
                            onPick={(pick) => setIcon(pick)}
                        >
                            {icon ? icon.name : 'Pick icon'}
                        </SabFilePickerButton>
                    </div>
                    {error ? (
                        <p role="alert" className="text-sm text-zoru-danger">
                            {error}
                        </p>
                    ) : null}
                </div>
                <ZoruDialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={pending}>
                        {pending ? 'Saving…' : 'Pin app'}
                    </Button>
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </Dialog>
    );
}

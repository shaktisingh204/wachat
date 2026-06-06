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

import { createSabConnectGroup } from '@/app/actions/sabconnect.actions';
import type { SabConnectGroupVisibility } from '@/lib/rust-client/sabconnect-groups';

export function CreateGroupDialog() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState<SabConnectGroupVisibility>('open');
    const [cover, setCover] = useState<SabFilePick | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const submit = () => {
        if (!name.trim()) {
            setError('Name is required.');
            return;
        }
        setError(null);
        startTransition(async () => {
            const res = await createSabConnectGroup({
                name: name.trim(),
                description: description.trim() || undefined,
                visibility,
                coverFileId: cover?.id ?? undefined,
            });
            if ('error' in res) {
                setError(res.error);
                return;
            }
            setOpen(false);
            setName('');
            setDescription('');
            setVisibility('open');
            setCover(null);
            router.refresh();
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                <Button>New group</Button>
            </ZoruDialogTrigger>
            <ZoruDialogContent>
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Create a group</ZoruDialogTitle>
                </ZoruDialogHeader>
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="group-name">Name</Label>
                        <Input
                            id="group-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Engineering"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="group-desc">Description</Label>
                        <Textarea
                            id="group-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What is this group for?"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label>Visibility</Label>
                        <Select
                            value={visibility}
                            onValueChange={(v) => setVisibility(v as SabConnectGroupVisibility)}
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="open">Open — anyone can join</ZoruSelectItem>
                                <ZoruSelectItem value="closed">
                                    Closed — request to join
                                </ZoruSelectItem>
                                <ZoruSelectItem value="secret">Secret — invite only</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label>Cover image</Label>
                        <SabFilePickerButton
                            accept="image"
                            onPick={(pick) => setCover(pick)}
                        >
                            {cover ? cover.name : 'Pick cover'}
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
                        {pending ? 'Creating…' : 'Create group'}
                    </Button>
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </Dialog>
    );
}

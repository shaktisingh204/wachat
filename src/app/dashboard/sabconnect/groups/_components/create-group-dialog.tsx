'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
    Button,
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
    Field,
    Input,
    Textarea,
    Label,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    useToast,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { createSabConnectGroup } from '@/app/actions/sabconnect.actions';
import type { SabConnectGroupVisibility } from '@/lib/rust-client/sabconnect-groups';

export function CreateGroupDialog() {
    const router = useRouter();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState<SabConnectGroupVisibility>('open');
    const [cover, setCover] = useState<SabFilePick | null>(null);
    const [nameError, setNameError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const submit = () => {
        if (!name.trim()) {
            setNameError('Name is required.');
            return;
        }
        setNameError(null);
        startTransition(async () => {
            const res = await createSabConnectGroup({
                name: name.trim(),
                description: description.trim() || undefined,
                visibility,
                coverFileId: cover?.id ?? undefined,
            });
            if ('error' in res) {
                toast.error(res.error);
                return;
            }
            toast.success('Group created.');
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
            <DialogTrigger asChild>
                <Button variant="primary">New group</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create a group</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                    <Field
                        label="Name"
                        required
                        error={nameError ?? undefined}
                    >
                        <Input
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                if (nameError) setNameError(null);
                            }}
                            placeholder="e.g. Engineering"
                        />
                    </Field>
                    <Field label="Description">
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What is this group for?"
                        />
                    </Field>
                    <Field label="Visibility">
                        <Select
                            value={visibility}
                            onValueChange={(v) => setVisibility(v as SabConnectGroupVisibility)}
                        >
                            <SelectTrigger aria-label="Visibility">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="open">Open, anyone can join</SelectItem>
                                <SelectItem value="closed">Closed, request to join</SelectItem>
                                <SelectItem value="secret">Secret, invite only</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <div className="flex flex-col gap-1.5">
                        <Label>Cover image</Label>
                        <SabFilePickerButton
                            accept="image"
                            onPick={(pick) => setCover(pick)}
                        >
                            {cover ? cover.name : 'Pick cover'}
                        </SabFilePickerButton>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button variant="primary" onClick={submit} loading={pending}>
                        {pending ? 'Creating' : 'Create group'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

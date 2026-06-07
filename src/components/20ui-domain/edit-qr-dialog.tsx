'use client';

import { useState, useTransition } from 'react';
import { updateQrCode } from '@/app/actions/qr-code.actions';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Button,
    IconButton,
    Field,
    Input,
    ColorPicker,
    useToast,
} from '@/components/sabcrm/20ui';
import type { QrCodeWithShortUrl } from '@/lib/definitions';
import { Pencil } from 'lucide-react';

interface EditQrDialogProps {
    qrCode: QrCodeWithShortUrl;
    onComplete: () => void;
}

export function EditQrDialog({ qrCode, onComplete }: EditQrDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [name, setName] = useState(qrCode.name);
    const [color, setColor] = useState(qrCode.config?.color ?? '#000000');
    const [bgColor, setBgColor] = useState(qrCode.config?.bgColor ?? '#FFFFFF');

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateQrCode(qrCode._id.toString(), {
                name,
                config: { ...qrCode.config, color, bgColor },
            });
            if (result.success) {
                toast({ title: 'QR code updated', tone: 'success' });
                setOpen(false);
                onComplete();
            } else {
                toast({ title: result.error ?? 'Failed to update', tone: 'danger' });
            }
        });
    };

    return (
        <>
            <IconButton
                label="Edit QR code"
                icon={Pencil}
                variant="ghost"
                size="sm"
                onClick={() => setOpen(true)}
            />
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Edit QR Code</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <Field label="Name">
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="QR code name"
                            />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Foreground">
                                <ColorPicker value={color} onChange={setColor} />
                            </Field>
                            <Field label="Background">
                                <ColorPicker value={bgColor} onChange={setBgColor} />
                            </Field>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSave}
                            loading={isPending}
                            disabled={!name.trim()}
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

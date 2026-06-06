'use client';

import { useState, useTransition } from 'react';
import { updateQrCode } from '@/app/actions/qr-code.actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Input, Label, cn, useToast } from '@/components/sabcrm/20ui';
import type { QrCodeWithShortUrl } from '@/lib/definitions';
import { LoaderCircle, Pencil } from 'lucide-react';

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
                toast({ title: 'QR code updated', variant: 'success' });
                setOpen(false);
                onComplete();
            } else {
                toast({ title: result.error ?? 'Failed to update', variant: 'destructive' });
            }
        });
    };

    return (
        <>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} title="Edit">
                <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Edit QR Code</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-[12.5px] text-[var(--st-text-secondary)]">Name</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="QR code name"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[12.5px] text-[var(--st-text-secondary)]">Foreground</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className="h-8 w-10 cursor-pointer rounded border border-[var(--st-border)] bg-transparent p-0.5"
                                    />
                                    <Input
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className="text-[12px] font-mono h-8"
                                        maxLength={7}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[12.5px] text-[var(--st-text-secondary)]">Background</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={bgColor}
                                        onChange={(e) => setBgColor(e.target.value)}
                                        className="h-8 w-10 cursor-pointer rounded border border-[var(--st-border)] bg-transparent p-0.5"
                                    />
                                    <Input
                                        value={bgColor}
                                        onChange={(e) => setBgColor(e.target.value)}
                                        className="text-[12px] font-mono h-8"
                                        maxLength={7}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSave} disabled={isPending || !name.trim()}>
                            {isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
                            Save
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

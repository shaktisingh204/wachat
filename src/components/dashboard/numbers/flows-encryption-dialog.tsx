'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Button, Badge, Alert, AlertDescription, AlertTitle } from '@/components/sabcrm/20ui/compat';
import {
  useState,
  useTransition } from 'react';
import { Project,
  PhoneNumber } from '@/lib/definitions';

import { Loader2, Lock, ShieldCheck, Upload, Key, CheckCircle, AlertTriangle } from 'lucide-react';
import { generateAndSaveFlowsKeys, uploadPublicKeyToMeta } from '@/app/actions/flows-encryption.actions';
import { useToast } from '@/hooks/use-toast';

interface FlowsEncryptionDialogProps {
    project: Project;
    phone: PhoneNumber;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
}

export function FlowsEncryptionDialog({ project, phone, trigger, open: controlledOpen, onOpenChange: setControlledOpen, onSuccess }: FlowsEncryptionDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? setControlledOpen! : setInternalOpen;
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const config = phone.flowsEncryptionConfig;
    const hasKeys = !!config?.privateKey && !!config?.publicKey;
    const isUploaded = config?.metaStatus === 'UPLOADED';
    const isFailed = config?.metaStatus === 'FAILED';

    const handleGenerateKeys = () => {
        startTransition(async () => {
            const result = await generateAndSaveFlowsKeys(project._id.toString(), phone.id);
            if (result.success) {
                toast({ title: "Keys Generated", description: result.message });
                // Re-fetch the parent so the Upload button unlocks without a reload.
                if (onSuccess) onSuccess();
            } else {
                toast({ title: "Error", description: result.error, variant: "destructive" });
            }
        });
    };

    const handleUploadToMeta = () => {
        startTransition(async () => {
            const result = await uploadPublicKeyToMeta(project._id.toString(), phone.id);
            if (result.success) {
                toast({ title: "Success", description: result.message });
                if (onSuccess) onSuccess();
            } else {
                toast({ title: "Upload Failed", description: result.error, variant: "destructive" });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="w-full">
                        <Lock className="mr-2 h-4 w-4" />
                        Flows Encryption
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>WhatsApp Flows Encryption</DialogTitle>
                    <DialogDescription>
                        To send Flows, you must sign payloads with a private key and upload the corresponding public key to Meta.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-[var(--st-bg-muted)]/50">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${hasKeys ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)]' : 'bg-[var(--st-bg-muted)] text-[var(--st-text)]'}`}>
                                <Key className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-medium">RSA Key Pair</span>
                                <span className="text-xs text-[var(--st-text-secondary)]">
                                    {hasKeys ? 'Generated and stored securely' : 'Not generated yet'}
                                </span>
                            </div>
                        </div>
                        {hasKeys ? (
                            <Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]">Ready</Badge>
                        ) : (
                            <Button size="sm" onClick={handleGenerateKeys} disabled={isPending}>
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg bg-[var(--st-bg-muted)]/50">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${isUploaded ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)]' : 'bg-[var(--st-bg-muted)] text-[var(--st-text)]'}`}>
                                <Upload className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-medium">Meta Upload</span>
                                <span className="text-xs text-[var(--st-text-secondary)]">
                                    {isUploaded ? 'Public Key synced with Meta' : 'Required to enable Flows'}
                                </span>
                            </div>
                        </div>
                        {isUploaded ? (
                            <Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]">Synced</Badge>
                        ) : (
                            <Button
                                size="sm"
                                onClick={handleUploadToMeta}
                                disabled={isPending || !hasKeys}
                                variant={isFailed ? "destructive" : "default"}
                            >
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isFailed ? 'Retry' : 'Upload'}
                            </Button>
                        )}
                    </div>

                    {isUploaded && (
                        <Alert className="bg-[var(--st-bg-muted)] border-[var(--st-border)]">
                            <ShieldCheck className="h-4 w-4 text-[var(--st-text)]" />
                            <AlertTitle className="text-[var(--st-text)]">Fully Configured</AlertTitle>
                            <AlertDescription className="text-[var(--st-text)]">
                                This phone number is ready to send and receive encrypted WhatsApp Flows.
                            </AlertDescription>
                        </Alert>
                    )}

                    {!hasKeys && (
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Action Required</AlertTitle>
                            <AlertDescription>
                                Generate keys first, then upload the public key to Meta to resolve encryption errors.
                            </AlertDescription>
                        </Alert>
                    )}
                    {hasKeys && config?.privateKey && (
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-[var(--st-bg-muted)]/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                                    <Lock className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-medium">Private Key</span>
                                    <span className="text-xs text-[var(--st-text-secondary)]">Download for safekeeping</span>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    const blob = new Blob([config.privateKey], { type: 'text/plain' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `private_key_${phone.display_phone_number}_${Date.now()}.pem`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                    toast({ title: "Downloaded", description: "Private Key downloaded successfully." });
                                }}
                            >
                                <Upload className="mr-2 h-4 w-4 rotate-180" />
                                Download
                            </Button>
                        </div>
                    )}
                </div>

                <DialogFooter className="sm:justify-start">
                    {/* DialogFooter left empty intentionally if no other actions needed */}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

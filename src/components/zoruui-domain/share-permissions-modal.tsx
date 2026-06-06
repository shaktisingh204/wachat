'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import {
    Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle,
    Button, Input, Label, Badge, Select,
    ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue,
    Skeleton, Separator, cn, useZoruToast
} from '@/components/sabcrm/20ui/compat';
import { Share2, Trash2, LoaderCircle, UserPlus, Mail, Eye, Pencil } from 'lucide-react';
import {
    getShares, createShare, revokeShare, updateShareRole,
    type ResourceShare, type ShareRole,
} from '@/app/actions/sharing.actions';

interface Props {
    resourceType: 'url' | 'qr';
    resourceId: string;
    resourceName?: string;
}

export function SharePermissionsModal({ resourceType, resourceId, resourceName }: Props) {
    const [open, setOpen] = useState(false);
    const [shares, setShares] = useState<ResourceShare[]>([]);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<ShareRole>('viewer');
    const [isPending, startTransition] = useTransition();
    const { toast } = useZoruToast();

    const load = useCallback(() => {
        setLoading(true);
        startTransition(async () => {
            const data = await getShares(resourceType, resourceId);
            setShares(data);
            setLoading(false);
        });
    }, [resourceType, resourceId]);

    useEffect(() => { if (open) load(); }, [open, load]);

    const handleInvite = () => {
        if (!email.trim()) return;
        startTransition(async () => {
            const result = await createShare(resourceType, resourceId, email, role);
            if (result.success) {
                setEmail('');
                toast({ title: 'Invite sent', variant: 'success' });
                load();
            } else {
                toast({ title: result.error ?? 'Failed', variant: 'destructive' });
            }
        });
    };

    const handleRevoke = (shareId: string) => {
        startTransition(async () => {
            const result = await revokeShare(shareId);
            if (result.success) load();
            else toast({ title: result.error ?? 'Failed', variant: 'destructive' });
        });
    };

    const handleRoleChange = (shareId: string, newRole: ShareRole) => {
        startTransition(async () => {
            await updateShareRole(shareId, newRole);
            load();
        });
    };

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <Share2 className="h-3.5 w-3.5" />
                Share
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <ZoruDialogContent className="max-w-md">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>
                            Share {resourceType === 'url' ? 'Link' : 'QR Code'}
                            {resourceName ? ` — ${resourceName}` : ''}
                        </ZoruDialogTitle>
                    </ZoruDialogHeader>

                    {/* Invite row */}
                    <div className="space-y-2">
                        <Label className="text-[12.5px] text-[var(--st-text-secondary)]">Invite by email</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="colleague@company.com"
                                    className="pl-8 text-[13px]"
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
                                />
                            </div>
                            <Select value={role} onValueChange={(v) => setRole(v as ShareRole)}>
                                <ZoruSelectTrigger className="w-[110px]">
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="viewer">
                                        <span className="flex items-center gap-1.5">
                                            <Eye className="h-3 w-3" /> Viewer
                                        </span>
                                    </ZoruSelectItem>
                                    <ZoruSelectItem value="editor">
                                        <span className="flex items-center gap-1.5">
                                            <Pencil className="h-3 w-3" /> Editor
                                        </span>
                                    </ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                            <Button
                                size="sm"
                                onClick={handleInvite}
                                disabled={isPending || !email.trim()}
                            >
                                {isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                            </Button>
                        </div>
                        <p className="text-[11px] text-[var(--st-text-secondary)]/70">
                            <strong>Viewer</strong> can see analytics only. <strong>Editor</strong> can change the destination URL and settings.
                        </p>
                    </div>

                    <Separator />

                    {/* People with access */}
                    <div className="space-y-2">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--st-text-secondary)]/60">
                            {shares.length > 0 ? `${shares.length} ${shares.length === 1 ? 'person' : 'people'} with access` : 'No one else has access'}
                        </p>
                        {loading ? (
                            <div className="space-y-2">
                                {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                            </div>
                        ) : (
                            <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                                {shares.map((share) => (
                                    <div
                                        key={share._id}
                                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-md border border-[var(--st-border)] hover:bg-[var(--st-text)] transition-colors"
                                    >
                                        <div className="h-7 w-7 rounded-full bg-[var(--st-text)] flex items-center justify-center flex-shrink-0">
                                            <span className="text-[11px] font-medium text-[var(--st-text)]">
                                                {share.sharedWithEmail[0].toUpperCase()}
                                            </span>
                                        </div>
                                        <span className="flex-1 text-[12.5px] text-[var(--st-text)] truncate">
                                            {share.sharedWithEmail}
                                        </span>
                                        <Select
                                            value={share.role}
                                            onValueChange={(v) => handleRoleChange(share._id, v as ShareRole)}
                                        >
                                            <ZoruSelectTrigger className="h-7 w-[90px] text-[11.5px]">
                                                <ZoruSelectValue />
                                            </ZoruSelectTrigger>
                                            <ZoruSelectContent>
                                                <ZoruSelectItem value="viewer">Viewer</ZoruSelectItem>
                                                <ZoruSelectItem value="editor">Editor</ZoruSelectItem>
                                            </ZoruSelectContent>
                                        </Select>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => handleRevoke(share._id)}
                                            disabled={isPending}
                                            title="Revoke access"
                                        >
                                            <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </ZoruDialogContent>
            </Dialog>
        </>
    );
}

'use client';

import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updatePlanPermissions } from '@/app/actions/admin.actions';
import {
    PlanPermissionsMatrix,
    type PlanPermissionsMap,
} from './plan-permissions-matrix';
import { moduleCategories } from '@/lib/permission-modules';

interface AdminPlanPermissionsDialogProps {
    planId: string;
    planName: string;
    initialPermissions?: any;
}

function normalizeLegacy(raw: any): PlanPermissionsMap {
    if (!raw || typeof raw !== 'object') return {};
    const known = new Set(Object.values(moduleCategories).flatMap((m) => m));
    const flatMatches = Object.keys(raw).filter((k) => known.has(k));
    if (flatMatches.length > 0) return raw as PlanPermissionsMap;
    if (raw.agent && typeof raw.agent === 'object') return raw.agent as PlanPermissionsMap;
    return {};
}

export function AdminPlanPermissionsDialog({
    planId,
    planName,
    initialPermissions = {},
}: AdminPlanPermissionsDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [permissions, setPermissions] = React.useState<PlanPermissionsMap>(() =>
        normalizeLegacy(initialPermissions),
    );
    const { toast } = useToast();

    // Re-sync when dialog opens (in case initialPermissions changed via revalidate)
    React.useEffect(() => {
        if (open) setPermissions(normalizeLegacy(initialPermissions));
    }, [open, initialPermissions]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            // Save as flat structure — what RBACGuard reads.
            const result = await updatePlanPermissions(planId, permissions);
            if (result.success) {
                toast({
                    title: 'Permissions updated',
                    description: `Master controls for ${planName} saved.`,
                });
                setOpen(false);
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Save failed',
                    description: result.error || 'Could not update permissions.',
                });
            }
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Unexpected error',
                description: 'Something went wrong while saving permissions.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    title="Manage plan permissions"
                    className="rounded-lg hover:bg-primary/10"
                >
                    <ShieldCheck className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] flex flex-col rounded-2xl border-white/10 bg-background/95 backdrop-blur-xl p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/10 bg-gradient-to-r from-primary/10 via-transparent to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg">
                                Master Permissions — {planName}
                            </DialogTitle>
                            <DialogDescription className="mt-0.5">
                                Every switch here is a hard ceiling. Unchecked actions are blocked
                                for all users on this plan, even owners.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <PlanPermissionsMatrix
                        value={permissions}
                        onChange={setPermissions}
                        compact
                    />
                </div>

                <DialogFooter className="px-6 py-4 border-t border-white/10 bg-white/[0.02]">
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        className="rounded-xl border-white/10 bg-white/5"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="rounded-xl gap-2"
                    >
                        {isLoading && <LoaderCircle className="h-4 w-4 animate-spin" />}
                        Save Permissions
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

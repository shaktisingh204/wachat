'use client';

import { useState, useTransition } from 'react';
import {
    Button,
    DropdownMenu,
    ZoruDropdownMenuTrigger,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
    ZoruDropdownMenuLabel,
    ZoruDropdownMenuSeparator,
    ZoruAlertDialog,
    ZoruAlertDialogContent,
    ZoruAlertDialogHeader,
    ZoruAlertDialogTitle,
    ZoruAlertDialogDescription,
    ZoruAlertDialogFooter,
    ZoruAlertDialogCancel,
} from '@/components/sabcrm/20ui/compat';
import {
    MoreHorizontal,
    LoaderCircle,
    Ban,
    CheckCircle2,
    LogOut,
    Smartphone,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    setUserSuspended,
    forceUserLogout,
    resetUserTwoFactor,
} from '@/app/actions/admin-hardening.actions';

type Action = 'suspend' | 'activate' | 'logout' | 'reset2fa';

interface Props {
    userId: string;
    userName: string;
    isSuspended?: boolean;
}

const COPY: Record<
    Action,
    { title: string; description: string; cta: string; danger?: boolean }
> = {
    suspend: {
        title: 'Suspend this user?',
        description:
            'They will be blocked from signing in and any active sessions will be invalidated on their next request.',
        cta: 'Suspend user',
        danger: true,
    },
    activate: {
        title: 'Re-activate this user?',
        description:
            'They will be able to sign in again. Existing sessions are not automatically restored — they will need to log in fresh.',
        cta: 'Activate user',
    },
    logout: {
        title: 'Force this user to log out?',
        description:
            'All of their active sessions across browsers and devices will be invalidated immediately.',
        cta: 'Force log out',
        danger: true,
    },
    reset2fa: {
        title: 'Reset two-factor authentication?',
        description:
            'Their current 2FA secret and backup codes will be removed. They will be prompted to re-enroll on next login.',
        cta: 'Reset 2FA',
        danger: true,
    },
};

export function AdminUserActionsMenu({ userId, userName, isSuspended }: Props) {
    const [pendingAction, setPendingAction] = useState<Action | null>(null);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const runAction = (action: Action) => {
        startTransition(async () => {
            let result: { success: boolean; error?: string };
            if (action === 'suspend') result = await setUserSuspended(userId, true);
            else if (action === 'activate') result = await setUserSuspended(userId, false);
            else if (action === 'logout') result = await forceUserLogout(userId);
            else result = await resetUserTwoFactor(userId);

            if (result.success) {
                const msg = {
                    suspend: `${userName} has been suspended.`,
                    activate: `${userName} has been re-activated.`,
                    logout: `${userName} was logged out from all sessions.`,
                    reset2fa: `2FA reset for ${userName}.`,
                }[action];
                toast({ title: 'Done', description: msg });
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'The action failed.',
                    variant: 'destructive',
                });
            }
            setPendingAction(null);
        });
    };

    const copy = pendingAction ? COPY[pendingAction] : null;

    return (
        <>
            <DropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zoru-ink hover:text-zoru-ink hover:bg-zoru-surface-2"
                        aria-label={`Actions for ${userName}`}
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end" className="w-52">
                    <ZoruDropdownMenuLabel className="text-xs text-zoru-ink">
                        Account
                    </ZoruDropdownMenuLabel>
                    {isSuspended ? (
                        <ZoruDropdownMenuItem onSelect={() => setPendingAction('activate')}>
                            <CheckCircle2 className="mr-2 h-4 w-4 text-zoru-ink" />
                            Re-activate user
                        </ZoruDropdownMenuItem>
                    ) : (
                        <ZoruDropdownMenuItem
                            onSelect={() => setPendingAction('suspend')}
                            className="text-zoru-ink focus:text-zoru-ink"
                        >
                            <Ban className="mr-2 h-4 w-4" />
                            Suspend user
                        </ZoruDropdownMenuItem>
                    )}
                    <ZoruDropdownMenuSeparator />
                    <ZoruDropdownMenuLabel className="text-xs text-zoru-ink">
                        Security
                    </ZoruDropdownMenuLabel>
                    <ZoruDropdownMenuItem onSelect={() => setPendingAction('logout')}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Force log out
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuItem onSelect={() => setPendingAction('reset2fa')}>
                        <Smartphone className="mr-2 h-4 w-4" />
                        Reset 2FA
                    </ZoruDropdownMenuItem>
                </ZoruDropdownMenuContent>
            </DropdownMenu>

            <ZoruAlertDialog
                open={pendingAction !== null}
                onOpenChange={(v) => !v && setPendingAction(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>{copy?.title}</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            {copy?.description}
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter className="mt-4">
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <Button
                            variant={copy?.danger ? 'destructive' : 'default'}
                            disabled={isPending}
                            onClick={() => pendingAction && runAction(pendingAction)}
                        >
                            {isPending && (
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {copy?.cta}
                        </Button>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}

'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    LuShield,
    LuLock,
    LuKey,
    LuLaptop,
    LuSave,
    LuLoaderCircle,
} from 'react-icons/lu';

import {
    ClayBadge,
    ClayBreadcrumbs,
    ClayButton,
    ClayCard,
    ClayInput,
    ClaySectionHeader,
} from '@/components/clay';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { handleChangePassword } from '@/app/actions/user.actions';

const initialState = { message: undefined, error: undefined } as {
    message?: string;
    error?: string;
};

function SaveBtn() {
    const { pending } = useFormStatus();
    return (
        <ClayButton
            type="submit"
            variant="obsidian"
            size="md"
            disabled={pending}
            leading={pending ? <LuLoaderCircle className="h-4 w-4 animate-spin" /> : <LuSave className="h-4 w-4" />}
        >
            {pending ? 'Saving…' : 'Update password'}
        </ClayButton>
    );
}

export default function SecuritySettingsPage() {
    const [state, formAction] = useActionState(handleChangePassword, initialState);
    const [twoFactor, setTwoFactor] = useState(false);
    const [loginAlerts, setLoginAlerts] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        if (state.message) toast({ title: state.message });
        if (state.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    return (
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'Settings', href: '/dashboard/settings' },
                    { label: 'Security' },
                ]}
            />

            <ClaySectionHeader
                size="lg"
                title="Security"
                subtitle="Manage your password, two-factor authentication, and active sessions."
            />

            {/* Password */}
            <ClayCard padded>
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-primary">
                        <LuLock className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-[13.5px] font-semibold text-foreground">Password</p>
                        <p className="text-[12.5px] text-muted-foreground">
                            Use a unique password at least 12 characters long.
                        </p>
                    </div>
                </div>
                <form action={formAction} className="grid gap-4 sm:grid-cols-3">
                    <Field label="Current password">
                        <ClayInput type="password" name="currentPassword" required />
                    </Field>
                    <Field label="New password">
                        <ClayInput type="password" name="newPassword" required minLength={12} />
                    </Field>
                    <Field label="Confirm new password">
                        <ClayInput type="password" name="confirmPassword" required minLength={12} />
                    </Field>
                    <div className="sm:col-span-3 flex justify-end">
                        <SaveBtn />
                    </div>
                </form>
            </ClayCard>

            {/* 2FA */}
            <ClayCard padded>
                <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-primary">
                        <LuShield className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-[13.5px] font-semibold text-foreground">
                                Two-factor authentication
                            </p>
                            <ClayBadge tone={twoFactor ? 'green' : 'neutral'}>
                                {twoFactor ? 'Enabled' : 'Disabled'}
                            </ClayBadge>
                        </div>
                        <p className="text-[12.5px] text-muted-foreground">
                            Add a second verification step using an authenticator app.
                        </p>
                    </div>
                    <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
                </div>
                <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/50 p-3">
                    <div>
                        <Label className="text-[13px] font-medium text-foreground">Alert on new sign-ins</Label>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                            Email you whenever a new device signs in to your account.
                        </p>
                    </div>
                    <Switch checked={loginAlerts} onCheckedChange={setLoginAlerts} />
                </div>
            </ClayCard>

            {/* Active sessions placeholder */}
            <ClayCard padded>
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-primary">
                        <LuLaptop className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-[13.5px] font-semibold text-foreground">Active sessions</p>
                        <p className="text-[12.5px] text-muted-foreground">
                            Devices currently signed in to your account.
                        </p>
                    </div>
                </div>
                <div className="divide-y divide-border rounded-xl border border-border">
                    <SessionRow label="Current session" device="This browser" location="—" current />
                </div>
            </ClayCard>

            {/* Recovery */}
            <ClayCard padded variant="soft">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-white">
                        <LuKey className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <p className="text-[13.5px] font-semibold text-foreground">Recovery codes</p>
                        <p className="text-[12.5px] text-muted-foreground">
                            Generate a new set of backup codes if you lose access to your authenticator.
                        </p>
                    </div>
                    <ClayButton variant="pill" size="sm">
                        Generate codes
                    </ClayButton>
                </div>
            </ClayCard>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Label className="mb-1.5 block text-[12.5px] font-medium text-foreground">{label}</Label>
            {children}
        </div>
    );
}

function SessionRow({
    label,
    device,
    location,
    current,
}: {
    label: string;
    device: string;
    location: string;
    current?: boolean;
}) {
    return (
        <div className="flex items-center justify-between px-4 py-3 text-[13px]">
            <div>
                <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{label}</p>
                    {current && <ClayBadge tone="green">This device</ClayBadge>}
                </div>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {device} · {location}
                </p>
            </div>
            {!current && (
                <ClayButton variant="ghost" size="sm">
                    Sign out
                </ClayButton>
            )}
        </div>
    );
}

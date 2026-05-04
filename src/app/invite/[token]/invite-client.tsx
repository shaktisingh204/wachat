'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    LuArrowRight,
    LuCheck,
    LuClock,
    LuLoader,
    LuLogIn,
    LuShield,
    LuUserPlus,
    LuX,
} from 'react-icons/lu';

import { ClayBadge } from '@/components/clay/clay-badge';
import { ClayButton } from '@/components/clay/clay-button';
import { ClayCard } from '@/components/clay/clay-card';
import { useToast } from '@/hooks/use-toast';
import type { InvitationView } from '@/app/actions/team.actions';
import {
    acceptInvitation,
    declineInvitation,
    rememberPendingInviteToken,
} from '@/app/actions/team.actions';

type AuthState =
    | { kind: 'logged-out' }
    | { kind: 'matched'; email: string; name: string }
    | { kind: 'mismatch'; loggedInEmail: string; inviteeEmail: string };

export function InviteClient({
    invitation,
    auth,
}: {
    invitation: InvitationView;
    auth: AuthState;
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, setPending] = React.useState<false | 'accept' | 'decline' | 'carry'>(false);

    const expiresIn = React.useMemo(() => formatExpiresIn(invitation.expiresAt), [invitation.expiresAt]);
    const statusTone: Record<InvitationView['status'], React.ComponentProps<typeof ClayBadge>['tone']> = {
        pending: 'amber',
        accepted: 'green',
        expired: 'red',
        revoked: 'neutral',
    };

    const canInteract = invitation.status === 'pending' && !invitation.isExpired;

    const onAccept = () => {
        if (auth.kind !== 'matched') return;
        setPending('accept');
        (async () => {
            const res = await acceptInvitation(invitation.token);
            if (res.success) {
                toast({
                    title: 'Welcome to the team',
                    description: res.projectName
                        ? `You joined ${res.projectName}.`
                        : 'You joined the team.',
                });
                router.push('/wachat');
            } else {
                toast({
                    title: 'Could not accept',
                    description: res.error || 'Please try again.',
                    variant: 'destructive',
                });
                setPending(false);
            }
        })();
    };

    const onDecline = () => {
        setPending('decline');
        (async () => {
            const res = await declineInvitation(invitation.token);
            if (res.success) {
                toast({ title: 'Invitation declined.' });
                router.push('/');
            } else {
                toast({
                    title: 'Could not decline',
                    description: res.error || 'Please try again.',
                    variant: 'destructive',
                });
                setPending(false);
            }
        })();
    };

    const onCarryToken = (dest: '/login' | '/onboarding') => {
        setPending('carry');
        (async () => {
            await rememberPendingInviteToken(invitation.token);
            const q = new URLSearchParams({ invite: invitation.token, email: invitation.inviteeEmail });
            router.push(`${dest}?${q.toString()}`);
        })();
    };

    return (
        <ClayCard
            variant="floating"
            padded={false}
            className="w-full max-w-[480px] overflow-hidden"
        >
            {/* Rose accent header */}
            <div className="relative h-[6px] w-full bg-primary" />

            <div className="flex flex-col gap-6 p-7 sm:p-9">
                {/* Top meta row */}
                <div className="flex items-center justify-between gap-2">
                    <ClayBadge tone="rose-soft" dot>
                        Team invitation
                    </ClayBadge>
                    <ClayBadge tone={statusTone[invitation.status]} dot>
                        {invitation.status === 'pending' && invitation.isExpired
                            ? 'Expired'
                            : capitalize(invitation.status)}
                    </ClayBadge>
                </div>

                <div className="flex flex-col gap-2">
                    <h1 className="text-[26px] font-semibold tracking-[-0.015em] text-foreground">
                        You're invited to {invitation.projectName || 'the team'}
                    </h1>
                    <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground">
                            {invitation.inviterName || invitation.inviterEmail || 'A SabNode user'}
                        </span>{' '}
                        invited <span className="font-medium text-foreground">{invitation.inviteeEmail}</span> to join
                        as a{' '}
                        <ClayBadge tone="neutral" className="align-middle">
                            {prettyRole(invitation.role)}
                        </ClayBadge>
                        .
                    </p>
                </div>

                {/* Summary rows */}
                <div className="grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-3">
                    <MetaRow
                        icon={<LuShield className="h-3.5 w-3.5" strokeWidth={1.75} />}
                        label="Role"
                        value={prettyRole(invitation.role)}
                    />
                    <MetaRow
                        icon={<LuClock className="h-3.5 w-3.5" strokeWidth={1.75} />}
                        label="Expires"
                        value={expiresIn}
                    />
                    <MetaRow
                        icon={<LuUserPlus className="h-3.5 w-3.5" strokeWidth={1.75} />}
                        label="Workspace"
                        value={invitation.projectName || 'All inviter projects'}
                    />
                </div>

                {/* State-dependent action area */}
                {!canInteract ? (
                    <StatusBlock invitation={invitation} />
                ) : auth.kind === 'matched' ? (
                    <ActionBlock
                        primary={
                            <ClayButton
                                variant="obsidian"
                                size="lg"
                                onClick={onAccept}
                                disabled={!!pending}
                                leading={
                                    pending === 'accept' ? (
                                        <LuLoader className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <LuCheck className="h-4 w-4" strokeWidth={2.25} />
                                    )
                                }
                            >
                                Accept & join
                            </ClayButton>
                        }
                        secondary={
                            <ClayButton
                                variant="pill"
                                size="lg"
                                onClick={onDecline}
                                disabled={!!pending}
                                leading={
                                    pending === 'decline' ? (
                                        <LuLoader className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <LuX className="h-4 w-4" strokeWidth={2.25} />
                                    )
                                }
                            >
                                Decline
                            </ClayButton>
                        }
                        hint={`You'll join as ${auth.name || auth.email}.`}
                    />
                ) : auth.kind === 'mismatch' ? (
                    <div className="flex flex-col gap-4 rounded-lg border border-amber-50 bg-amber-50/40 p-4">
                        <p className="text-[13px] leading-relaxed text-foreground">
                            This invitation was sent to{' '}
                            <span className="font-medium">{invitation.inviteeEmail}</span>, but you're signed in as{' '}
                            <span className="font-medium">{auth.loggedInEmail}</span>.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Link href="/api/auth/logout">
                                <ClayButton
                                    variant="obsidian"
                                    size="md"
                                    trailing={<LuArrowRight className="h-3.5 w-3.5" />}
                                >
                                    Switch account
                                </ClayButton>
                            </Link>
                            <Link href="/">
                                <ClayButton variant="pill" size="md">
                                    Stay signed in
                                </ClayButton>
                            </Link>
                        </div>
                    </div>
                ) : (
                    <ActionBlock
                        primary={
                            <ClayButton
                                variant="obsidian"
                                size="lg"
                                onClick={() => onCarryToken('/onboarding')}
                                disabled={!!pending}
                                leading={
                                    pending === 'carry' ? (
                                        <LuLoader className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <LuUserPlus className="h-4 w-4" strokeWidth={2.25} />
                                    )
                                }
                            >
                                Create account
                            </ClayButton>
                        }
                        secondary={
                            <ClayButton
                                variant="pill"
                                size="lg"
                                onClick={() => onCarryToken('/login')}
                                disabled={!!pending}
                                leading={<LuLogIn className="h-4 w-4" strokeWidth={2.25} />}
                            >
                                I have an account
                            </ClayButton>
                        }
                        hint={`You'll be attached to the team automatically after you sign in.`}
                    />
                )}

                <div className="border-t border-border pt-4 text-[11.5px] leading-relaxed text-muted-foreground">
                    By accepting you agree to SabNode's terms. Only admins in{' '}
                    <span className="text-foreground">{invitation.projectName || 'this workspace'}</span> can see your
                    role and activity within the team.
                </div>
            </div>
        </ClayCard>
    );
}

function MetaRow({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground">
                {icon}
            </span>
            <div className="flex min-w-0 flex-col">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    {label}
                </span>
                <span className="truncate text-[12.5px] text-foreground">{value}</span>
            </div>
        </div>
    );
}

function ActionBlock({
    primary,
    secondary,
    hint,
}: {
    primary: React.ReactNode;
    secondary: React.ReactNode;
    hint?: string;
}) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
                {primary}
                {secondary}
            </div>
            {hint ? <p className="text-[11.5px] text-muted-foreground">{hint}</p> : null}
        </div>
    );
}

function StatusBlock({ invitation }: { invitation: InvitationView }) {
    const copy = invitation.isExpired
        ? {
              title: 'This invitation expired',
              body: 'Ask the sender to resend it — resending extends the expiry by another 7 days.',
              tone: 'red' as const,
          }
        : invitation.status === 'accepted'
          ? {
                title: 'Already accepted',
                body: 'You can head to the dashboard to continue.',
                tone: 'green' as const,
            }
          : {
                title: 'Invitation no longer active',
                body: 'This invitation was revoked by the sender.',
                tone: 'neutral' as const,
            };
    return (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary p-4">
            <div className="flex items-center gap-2">
                <ClayBadge tone={copy.tone} dot>
                    {capitalize(invitation.status)}
                </ClayBadge>
                <span className="text-[13px] font-medium text-foreground">{copy.title}</span>
            </div>
            <p className="text-[12.5px] text-muted-foreground">{copy.body}</p>
            <Link href="/">
                <ClayButton variant="pill" size="md" trailing={<LuArrowRight className="h-3.5 w-3.5" />}>
                    Back to SabNode
                </ClayButton>
            </Link>
        </div>
    );
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function prettyRole(role: string) {
    if (role === 'admin') return 'Admin';
    if (role === 'agent') return 'Agent';
    if (role === 'owner') return 'Owner';
    if (role === 'member') return 'Member';
    return capitalize(role);
}

function formatExpiresIn(iso: string) {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (days >= 1) return `In ${days} day${days === 1 ? '' : 's'}`;
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours >= 1) return `In ${hours} hour${hours === 1 ? '' : 's'}`;
    const mins = Math.max(1, Math.floor(diff / (60 * 1000)));
    return `In ${mins} min${mins === 1 ? '' : 's'}`;
}

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

import { Badge, Button, Card, type ZoruBadgeProps } from '@/components/sabcrm/20ui/compat';
import { useToast } from '@/hooks/use-toast';
import {
    acceptInvitation,
    declineInvitation,
    rememberPendingInviteToken,
} from '@/app/actions/team.actions';
import type { InvitationView } from '@/app/actions/team.actions.types';

export type AuthState =
    | { kind: 'logged-out' }
    | { kind: 'matched'; email: string; name: string }
    | { kind: 'mismatch'; loggedInEmail: string; inviteeEmail: string };

type PendingState = false | 'accept' | 'decline' | 'carry';

export function InviteClient({
    invitation,
    auth,
}: {
    invitation: InvitationView;
    auth: AuthState;
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, setPending] = React.useState<PendingState>(false);

    // Fix Hydration mismatch
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => {
        setMounted(true);
    }, []);

    const expiresIn = React.useMemo(() => formatExpiresIn(invitation.expiresAt), [invitation.expiresAt]);

    const statusTone: Record<InvitationView['status'], NonNullable<ZoruBadgeProps['tone']>> = {
        pending: 'amber',
        accepted: 'green',
        expired: 'red',
        revoked: 'neutral',
    };

    const canInteract = invitation.status === 'pending' && !invitation.isExpired;

    const onAccept = async () => {
        if (auth.kind !== 'matched') return;
        setPending('accept');
        try {
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
        } catch (error) {
            toast({
                title: 'Error',
                description: 'An unexpected error occurred. Please try again.',
                variant: 'destructive',
            });
            setPending(false);
        }
    };

    const onDecline = async () => {
        setPending('decline');
        try {
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
        } catch (error) {
            toast({
                title: 'Error',
                description: 'An unexpected error occurred. Please try again.',
                variant: 'destructive',
            });
            setPending(false);
        }
    };

    const onCarryToken = async (dest: '/login' | '/onboarding') => {
        setPending('carry');
        try {
            await rememberPendingInviteToken(invitation.token);
            const q = new URLSearchParams({ invite: invitation.token, email: invitation.inviteeEmail });
            router.push(`${dest}?${q.toString()}`);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to process invitation token.',
                variant: 'destructive',
            });
            setPending(false);
        }
    };

    return (
        // TODO(zoru): port ClayCard floating variant accent header to Zoru
        <Card className="w-full max-w-[480px] overflow-hidden p-0">
            {/* Rose accent header */}
            <div className="relative h-[6px] w-full bg-zoru-primary" />

            <div className="flex flex-col gap-6 p-7 sm:p-9">
                <HeaderSection invitation={invitation} statusTone={statusTone} />

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
                        value={mounted ? expiresIn : <span className="inline-block h-3 w-16 animate-pulse rounded bg-zoru-line" />}
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
                    <MatchedAuthBlock auth={auth} pending={pending} onAccept={onAccept} onDecline={onDecline} />
                ) : auth.kind === 'mismatch' ? (
                    <MismatchAuthBlock auth={auth} invitation={invitation} />
                ) : (
                    <LoggedOutAuthBlock pending={pending} onCarryToken={onCarryToken} />
                )}

                <div className="border-t border-zoru-line pt-4 text-[11.5px] leading-relaxed text-zoru-ink-muted">
                    By accepting you agree to SabNode's terms. Only admins in{' '}
                    <span className="text-zoru-ink">{invitation.projectName || 'this workspace'}</span> can see your
                    role and activity within the team.
                </div>
            </div>
        </Card>
    );
}

function HeaderSection({
    invitation,
    statusTone,
}: {
    invitation: InvitationView;
    statusTone: Record<InvitationView['status'], NonNullable<ZoruBadgeProps['tone']>>;
}) {
    return (
        <>
            <div className="flex items-center justify-between gap-2">
                <Badge tone="rose-soft">
                    Team invitation
                </Badge>
                <Badge tone={statusTone[invitation.status]}>
                    {invitation.status === 'pending' && invitation.isExpired
                        ? 'Expired'
                        : capitalize(invitation.status)}
                </Badge>
            </div>

            <div className="flex flex-col gap-2">
                <h1 className="text-[26px] font-semibold tracking-[-0.015em] text-zoru-ink">
                    You're invited to {invitation.projectName || 'the team'}
                </h1>
                <p className="text-[13.5px] leading-relaxed text-zoru-ink-muted">
                    <span className="font-medium text-zoru-ink">
                        {invitation.inviterName || invitation.inviterEmail || 'A SabNode user'}
                    </span>{' '}
                    invited <span className="font-medium text-zoru-ink">{invitation.inviteeEmail}</span> to join
                    as a{' '}
                    <Badge tone="neutral" className="align-middle">
                        {prettyRole(invitation.role)}
                    </Badge>
                    .
                </p>
            </div>
        </>
    );
}

function MatchedAuthBlock({
    auth,
    pending,
    onAccept,
    onDecline,
}: {
    auth: { kind: 'matched'; email: string; name: string };
    pending: PendingState;
    onAccept: () => void;
    onDecline: () => void;
}) {
    return (
        <ActionBlock
            primary={
                <Button
                    size="lg"
                    onClick={onAccept}
                    disabled={!!pending}
                >
                    {pending === 'accept' ? (
                        <LuLoader className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <LuCheck className="mr-2 h-4 w-4" strokeWidth={2.25} />
                    )}
                    Accept &amp; join
                </Button>
            }
            secondary={
                <Button
                    size="lg"
                    variant="outline"
                    onClick={onDecline}
                    disabled={!!pending}
                >
                    {pending === 'decline' ? (
                        <LuLoader className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <LuX className="mr-2 h-4 w-4" strokeWidth={2.25} />
                    )}
                    Decline
                </Button>
            }
            hint={`You'll join as ${auth.name || auth.email}.`}
        />
    );
}

function MismatchAuthBlock({
    auth,
    invitation,
}: {
    auth: { kind: 'mismatch'; loggedInEmail: string; inviteeEmail: string };
    invitation: InvitationView;
}) {
    return (
        <div className="flex flex-col gap-4 rounded-lg border border-zoru-warning/30 bg-zoru-warning/10 p-4">
            <p className="text-[13px] leading-relaxed text-zoru-ink">
                This invitation was sent to{' '}
                <span className="font-medium">{invitation.inviteeEmail}</span>, but you're signed in as{' '}
                <span className="font-medium">{auth.loggedInEmail}</span>.
            </p>
            <div className="flex flex-wrap gap-2">
                <Link href="/api/auth/logout">
                    <Button>
                        Switch account
                        <LuArrowRight className="ml-2 h-3.5 w-3.5" />
                    </Button>
                </Link>
                <Link href="/">
                    <Button variant="outline">
                        Stay signed in
                    </Button>
                </Link>
            </div>
        </div>
    );
}

function LoggedOutAuthBlock({
    pending,
    onCarryToken,
}: {
    pending: PendingState;
    onCarryToken: (dest: '/login' | '/onboarding') => void;
}) {
    return (
        <ActionBlock
            primary={
                <Button
                    size="lg"
                    onClick={() => onCarryToken('/onboarding')}
                    disabled={!!pending}
                >
                    {pending === 'carry' ? (
                        <LuLoader className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <LuUserPlus className="mr-2 h-4 w-4" strokeWidth={2.25} />
                    )}
                    Create account
                </Button>
            }
            secondary={
                <Button
                    size="lg"
                    variant="outline"
                    onClick={() => onCarryToken('/login')}
                    disabled={!!pending}
                >
                    <LuLogIn className="mr-2 h-4 w-4" strokeWidth={2.25} />
                    I have an account
                </Button>
            }
            hint={`You'll be attached to the team automatically after you sign in.`}
        />
    );
}

function MetaRow({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-2 rounded-lg border border-zoru-line bg-zoru-surface px-3 py-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zoru-bg text-zoru-ink-muted">
                {icon}
            </span>
            <div className="flex min-w-0 flex-col">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-zoru-ink-muted">
                    {label}
                </span>
                <span className="truncate text-[12.5px] text-zoru-ink">{value}</span>
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
            {hint ? <p className="text-[11.5px] text-zoru-ink-muted">{hint}</p> : null}
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
        <div className="flex flex-col gap-3 rounded-lg border border-zoru-line bg-zoru-surface p-4">
            <div className="flex items-center gap-2">
                <Badge tone={copy.tone}>
                    {capitalize(invitation.status)}
                </Badge>
                <span className="text-[13px] font-medium text-zoru-ink">{copy.title}</span>
            </div>
            <p className="text-[12.5px] text-zoru-ink-muted">{copy.body}</p>
            <Link href="/">
                <Button variant="outline">
                    Back to SabNode
                    <LuArrowRight className="ml-2 h-3.5 w-3.5" />
                </Button>
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

function formatExpiresIn(iso: string | Date) {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (days >= 1) return `In ${days} day${days === 1 ? '' : 's'}`;
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours >= 1) return `In ${hours} hour${hours === 1 ? '' : 's'}`;
    const mins = Math.max(1, Math.floor(diff / (60 * 1000)));
    return `In ${mins} min${mins === 1 ? '' : 's'}`;
}

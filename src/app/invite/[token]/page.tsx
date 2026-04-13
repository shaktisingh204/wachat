import Link from 'next/link';
import { LuArrowRight, LuMailX } from 'react-icons/lu';

import { ClayBadge } from '@/components/clay/clay-badge';
import { ClayButton } from '@/components/clay/clay-button';
import { ClayCard } from '@/components/clay/clay-card';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { getInvitationByToken, rememberPendingInviteToken } from '@/app/actions/team.actions';
import { getSession } from '@/app/actions/user.actions';

import { InviteClient } from './invite-client';

export const dynamic = 'force-dynamic';

export default async function InvitePage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    const invitation = await getInvitationByToken(token);
    const session = await getSession();

    // Stash the token so that downstream /onboarding or /login can auto-accept.
    if (invitation && invitation.status === 'pending' && !invitation.isExpired) {
        await rememberPendingInviteToken(token);
    }

    if (!invitation) {
        return (
            <InviteShell>
                <ClayCard variant="floating" className="w-full max-w-[420px]">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-clay-red-soft text-clay-red">
                            <LuMailX className="h-5 w-5" strokeWidth={2} />
                        </span>
                        <ClayBadge tone="red" dot>
                            Invitation not found
                        </ClayBadge>
                        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-clay-ink">
                            This invite link isn't valid
                        </h1>
                        <p className="text-[13px] text-clay-ink-muted">
                            The link may have been mistyped or the invitation was revoked.
                            Ask the sender to send a fresh invitation.
                        </p>
                        <Link href="/">
                            <ClayButton
                                variant="obsidian"
                                size="md"
                                trailing={<LuArrowRight className="h-3.5 w-3.5" />}
                            >
                                Back to SabNode
                            </ClayButton>
                        </Link>
                    </div>
                </ClayCard>
            </InviteShell>
        );
    }

    const loggedIn = session?.user;
    const loggedInEmail = loggedIn?.email?.toLowerCase();
    const inviteeEmail = invitation.inviteeEmail.toLowerCase();

    const auth = !loggedIn
        ? { kind: 'logged-out' as const }
        : loggedInEmail === inviteeEmail
          ? {
                kind: 'matched' as const,
                email: loggedIn.email,
                name: loggedIn.name || loggedIn.email,
            }
          : {
                kind: 'mismatch' as const,
                loggedInEmail: loggedIn.email,
                inviteeEmail: invitation.inviteeEmail,
            };

    return (
        <InviteShell>
            <InviteClient invitation={invitation} auth={auth} />
        </InviteShell>
    );
}

function InviteShell({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="clay-outer-shell relative flex min-h-screen flex-col items-center justify-center px-4 py-10"
            style={{ fontFamily: 'var(--font-sab-sans), system-ui, sans-serif' }}
        >
            <div className="clay-enter flex w-full flex-col items-center gap-8">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-clay-ink hover:opacity-80 transition-opacity"
                >
                    <SabNodeLogo className="h-8 w-8" />
                    <span className="text-[14px] font-semibold tracking-[-0.01em]">SabNode</span>
                </Link>
                {children}
                <p className="text-[11px] text-clay-ink-soft">
                    Didn't expect this email?{' '}
                    <Link href="/" className="text-clay-rose-ink underline-offset-2 hover:underline">
                        Report it
                    </Link>
                </p>
            </div>
        </div>
    );
}

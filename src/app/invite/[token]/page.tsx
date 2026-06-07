import Link from 'next/link';
import { ArrowRight, MailX } from 'lucide-react';

import { Button, Card, EmptyState } from '@/components/sabcrm/20ui';
import { getInvitationByToken } from '@/app/actions/team.actions';
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

    // NOTE: We must NOT stash the pending-invite cookie here. Writing cookies
    // during a Server Component render throws ("Cookies can only be modified in
    // a Server Action or Route Handler"), which crashed this page for every
    // valid pending invite. The token is stashed client-side instead -- see
    // InviteClient.onCarryToken (rememberPendingInviteToken) -- and is also
    // carried forward as a `?invite=` query param to /login and /onboarding.

    if (!invitation) {
        return (
            <InviteShell>
                <Card padding="lg" className="w-full max-w-[420px]">
                    <EmptyState
                        icon={MailX}
                        tone="danger"
                        title="This invite link isn't valid"
                        description="The link may have been mistyped or the invitation was revoked. Ask the sender to send a fresh invitation."
                        action={
                            <Link href="/">
                                <Button variant="primary" iconRight={ArrowRight}>
                                    Back to SabNode
                                </Button>
                            </Link>
                        }
                    />
                </Card>
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

function SabNodeWordmark({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 50"
            className={className}
            role="img"
            aria-label="SabNode"
        >
            <text
                x="50%"
                y="50%"
                dy=".35em"
                textAnchor="middle"
                fontSize="30"
                fontWeight="bold"
                fill="currentColor"
            >
                SabNode
            </text>
        </svg>
    );
}

function InviteShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="ui20 relative flex min-h-screen flex-col items-center justify-center bg-[var(--st-bg)] px-4 py-10 text-[var(--st-text)]">
            <div className="flex w-full flex-col items-center gap-8">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-[var(--st-text)] transition-opacity hover:opacity-80"
                >
                    <SabNodeWordmark className="h-8 w-auto" />
                </Link>
                {children}
                <p className="text-[11px] text-[var(--st-text-secondary)]">
                    Didn't expect this email?{' '}
                    <Link href="/" className="text-[var(--st-text)] underline-offset-2 hover:underline">
                        Report it
                    </Link>
                </p>
            </div>
        </div>
    );
}

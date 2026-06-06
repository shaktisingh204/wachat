import "@/styles/zoruui.css";

import Link from 'next/link';
import { LuArrowRight, LuMailX } from 'react-icons/lu';

import { Badge, Button, Card } from '@/components/sabcrm/20ui/compat';
import { SabNodeLogo } from '@/components/zoruui-domain/logo';
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
    // valid pending invite. The token is stashed client-side instead — see
    // InviteClient.onCarryToken (rememberPendingInviteToken) — and is also
    // carried forward as a `?invite=` query param to /login and /onboarding.

    if (!invitation) {
        return (
            <InviteShell>
                <Card className="w-full max-w-[420px] p-7">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-danger)]/10 text-[var(--st-danger)]">
                            <LuMailX className="h-5 w-5" strokeWidth={2} />
                        </span>
                        <Badge tone="red">
                            Invitation not found
                        </Badge>
                        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-[var(--st-text)]">
                            This invite link isn't valid
                        </h1>
                        <p className="text-[13px] text-[var(--st-text-secondary)]">
                            The link may have been mistyped or the invitation was revoked.
                            Ask the sender to send a fresh invitation.
                        </p>
                        <Link href="/">
                            {/* TODO(zoru): port ClayButton 'obsidian' variant; using default Button for now */}
                            <Button>
                                Back to SabNode
                                <LuArrowRight className="ml-2 h-3.5 w-3.5" />
                            </Button>
                        </Link>
                    </div>
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

function InviteShell({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="zoruui relative flex min-h-screen flex-col items-center justify-center bg-[var(--st-bg)] text-[var(--st-text)] px-4 py-10"
            style={{ fontFamily: 'var(--font-sab-sans), system-ui, sans-serif' }}
        >
            <div className="flex w-full flex-col items-center gap-8">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-[var(--st-text)] hover:opacity-80 transition-opacity"
                >
                    <SabNodeLogo className="h-8 w-8" />
                    <span className="text-[14px] font-semibold tracking-[-0.01em]">SabNode</span>
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

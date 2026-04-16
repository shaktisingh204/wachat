'use client';

/**
 * Client side of the invite-accept flow. Rendered by
 * /dashboard/sabflow/invites/[token]/page.tsx — it already verified the
 * invite's validity and resolved the workspace name, so this only needs
 * to submit the accept / decline action.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LuBuilding, LuCheck, LuUserPlus, LuX } from 'react-icons/lu';
import type { WorkspaceRole } from '@/lib/sabflow/workspaces/types';

interface Props {
  token: string;
  inviteEmail: string;
  inviteRole: WorkspaceRole;
  workspaceId: string;
  workspaceName: string;
  workspaceIconUrl?: string;
  invitedBy: string;
  emailMismatch: boolean;
  sessionEmail: string;
}

export function InviteAcceptClient({
  token,
  inviteEmail,
  inviteRole,
  workspaceId,
  workspaceName,
  workspaceIconUrl,
  emailMismatch,
  sessionEmail,
}: Props) {
  const router = useRouter();
  const [working, setWorking] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = useCallback(async () => {
    setWorking('accept');
    setError(null);
    try {
      const res = await fetch(
        `/api/sabflow/workspaces/invites/accept/${token}`,
        { method: 'POST' },
      );
      const data = (await res.json()) as {
        workspaceId?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? 'Failed to accept invite');
      router.push(
        `/dashboard/sabflow/workspaces/${data.workspaceId ?? workspaceId}/settings`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
      setWorking(null);
    }
  }, [router, token, workspaceId]);

  const handleDecline = useCallback(() => {
    setWorking('decline');
    router.push('/dashboard/sabflow');
  }, [router]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-200">
        {workspaceIconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={workspaceIconUrl}
            alt=""
            className="h-16 w-16 rounded-xl object-cover"
          />
        ) : (
          <LuBuilding className="h-7 w-7" aria-hidden="true" />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold text-gray-900 dark:text-white">
          You&apos;re invited to {workspaceName}
        </h1>
        <p className="text-[13px] text-gray-500">
          You&apos;ll join as{' '}
          <span className="font-medium capitalize text-gray-700 dark:text-zinc-200">
            {inviteRole}
          </span>
          . The invite was sent to{' '}
          <span className="font-medium">{inviteEmail}</span>.
        </p>
      </div>

      {emailMismatch && (
        <div className="w-full rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-left text-[12px] text-amber-800 dark:text-amber-200">
          You&apos;re signed in as <strong>{sessionEmail}</strong>, but this
          invite was sent to <strong>{inviteEmail}</strong>. Please sign in with
          the invited account before accepting.
        </div>
      )}

      {error && (
        <div className="w-full rounded-md border border-red-500/30 bg-red-500/10 p-3 text-[13px] text-red-600">
          {error}
        </div>
      )}

      <div className="flex w-full items-center gap-3">
        <button
          type="button"
          onClick={handleDecline}
          disabled={working !== null}
          className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <LuX className="h-4 w-4" aria-hidden="true" />
          Decline
        </button>
        <button
          type="button"
          onClick={handleAccept}
          disabled={working !== null || emailMismatch}
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[var(--color-primary,#f76808)] px-4 py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {working === 'accept' ? (
            <>
              <LuCheck className="h-4 w-4" aria-hidden="true" />
              Accepting…
            </>
          ) : (
            <>
              <LuUserPlus className="h-4 w-4" aria-hidden="true" />
              Accept invite
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default InviteAcceptClient;

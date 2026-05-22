"use client";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Button,
  Card,
  ZoruCardContent,
} from '@/components/zoruui';
import {
  useCallback,
  useState } from "react";
import { useRouter } from "next/navigation";
import { Building2,
  Check,
  Loader2,
  UserPlus,
  X } from "lucide-react";

/**
 * Client side of the invite-accept flow. Rendered by
 * /dashboard/sabflow/invites/[token]/page.tsx — it already verified the
 * invite's validity and resolved the workspace name, so this only needs
 * to submit the accept / decline action.
 *
 * ZoruUI rewrite — chrome only. Same fetch endpoints & router hop.
 */

import type { WorkspaceRole } from "@/lib/sabflow/workspaces/types";

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
  const [working, setWorking] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = useCallback(async () => {
    setWorking("accept");
    setError(null);
    try {
      const res = await fetch(
        `/api/sabflow/workspaces/invites/accept/${token}`,
        { method: "POST" },
      );
      const data = (await res.json()) as {
        workspaceId?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to accept invite");
      router.push(
        `/dashboard/sabflow/workspaces/${data.workspaceId ?? workspaceId}/settings`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invite");
      setWorking(null);
    }
  }, [router, token, workspaceId]);

  const handleDecline = useCallback(() => {
    setWorking("decline");
    router.push("/dashboard/sabflow/flow-builder");
  }, [router]);

  return (
    <Card>
      <ZoruCardContent className="flex flex-col items-center gap-5 p-8 text-center">
        <Avatar className="h-16 w-16 rounded-[var(--zoru-radius-lg)]">
          {workspaceIconUrl ? (
            <ZoruAvatarImage src={workspaceIconUrl} alt={workspaceName} />
          ) : null}
          <ZoruAvatarFallback className="rounded-[var(--zoru-radius-lg)]">
            <Building2 className="h-7 w-7" aria-hidden="true" />
          </ZoruAvatarFallback>
        </Avatar>

        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold text-zoru-ink-strong">
            You&apos;re invited to {workspaceName}
          </h1>
          <p className="text-[13px] text-zoru-ink-muted">
            You&apos;ll join as{" "}
            <span className="font-medium capitalize text-zoru-ink">
              {inviteRole}
            </span>
            . The invite was sent to{" "}
            <span className="font-medium text-zoru-ink">{inviteEmail}</span>.
          </p>
        </div>

        {emailMismatch && (
          <Alert variant="warning" className="w-full text-left">
            <ZoruAlertTitle>Wrong account</ZoruAlertTitle>
            <ZoruAlertDescription>
              You&apos;re signed in as <strong>{sessionEmail}</strong>, but this
              invite was sent to <strong>{inviteEmail}</strong>. Sign in with
              the invited account before accepting.
            </ZoruAlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="w-full text-left">
            <ZoruAlertDescription>{error}</ZoruAlertDescription>
          </Alert>
        )}

        <div className="flex w-full items-center gap-3">
          <Button
            type="button"
            variant="outline"
            block
            onClick={handleDecline}
            disabled={working !== null}
          >
            <X aria-hidden="true" />
            Decline
          </Button>
          <Button
            type="button"
            block
            onClick={handleAccept}
            disabled={working !== null || emailMismatch}
          >
            {working === "accept" ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Accepting…
              </>
            ) : (
              <>
                <UserPlus aria-hidden="true" />
                Accept invite
              </>
            )}
          </Button>
        </div>
      </ZoruCardContent>
    </Card>
  );
}

export default InviteAcceptClient;

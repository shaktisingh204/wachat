"use client";

import * as React from "react";
import { AtSign, Mail, Plus, Trash2, X } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  useToast,
} from "@/components/sabcrm/20ui";
import {
  deleteSabmailAccount,
  type SabmailAccountRow,
} from "@/app/actions/sabmail-projects.actions";

import { MailboxConnectForm } from "../_components/mailbox-connect-form";
import "@/components/sabmail/motion/sabmail-motion.css";

export function SabmailAccountsClient({
  projectId,
  initialAccounts,
}: {
  projectId: string;
  initialAccounts: SabmailAccountRow[];
}) {
  const { toast } = useToast();
  const [accounts, setAccounts] = React.useState<SabmailAccountRow[]>(initialAccounts);
  const [adding, setAdding] = React.useState(initialAccounts.length === 0);

  const removeAccount = React.useCallback(
    async (id: string) => {
      const res = await deleteSabmailAccount(id);
      if (!res.success) {
        toast({ title: "Could not remove mailbox", description: res.error, variant: "destructive" });
        return;
      }
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Mailbox removed" });
    },
    [toast],
  );

  // Surface the OAuth callback result (?connected=… / ?error=…), then clean the URL.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (!connected && !error) return;
    if (connected) {
      toast({ title: "Mailbox connected", description: connected });
    } else if (error === "oauth-not-configured") {
      toast({
        title: "OAuth isn't configured yet",
        description: "Add the provider's client id/secret in env to enable this.",
        variant: "destructive",
      });
    } else if (error === "oauth-no-refresh-token") {
      toast({
        title: "Couldn't get offline access",
        description: "Remove the app's access in your provider account, then reconnect.",
        variant: "destructive",
      });
    } else if (error) {
      toast({ title: "Couldn't connect mailbox", description: error, variant: "destructive" });
    }
    const clean = new URL(window.location.href);
    clean.search = "";
    window.history.replaceState({}, "", clean.toString());
  }, [toast]);

  const startOAuth = React.useCallback((provider: "gmail" | "outlook") => {
    window.location.href = `/api/sabmail/oauth/authorize?provider=${provider}&returnTo=/sabmail/accounts`;
  }, []);

  return (
    <div className="sabmail-canvas min-h-full p-4 sm:p-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[var(--st-text)]">Accounts</h1>
            <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
              Connected mailboxes for this workspace. Add Gmail, Outlook or any
              IMAP account — they sync into one unified inbox.
            </p>
          </div>
          {!adding ? (
            <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setAdding(true)}>
              Connect mailbox
            </Button>
          ) : null}
        </div>

        <div className="mt-6 grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Connected mailboxes</CardTitle>
            <CardDescription>{accounts.length} connected</CardDescription>
          </CardHeader>
          <CardBody>
            {accounts.length === 0 ? (
              <EmptyState
                icon={<AtSign aria-hidden />}
                title="No mailboxes connected"
                description="Connect your first mailbox below to start receiving and sending mail."
              />
            ) : (
              <ul className="sabmail-motion flex flex-col gap-2">
                {accounts.map((a, idx) => (
                  <li
                    key={a.id}
                    data-selected={false}
                    className="sabmail-stagger-item sabmail-listrow flex items-center justify-between gap-3 rounded-lg border border-[var(--st-border)] px-3 py-2.5 hover:bg-[var(--st-bg-muted)]"
                    style={{ ["--i" as string]: idx } as React.CSSProperties}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                        <AtSign className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[var(--st-text)]">
                          {a.displayName ? `${a.displayName} · ${a.email}` : a.email}
                        </div>
                        <div className="truncate text-xs text-[var(--st-text-secondary)]">
                          {a.provider.toUpperCase()}
                          {a.imapHost ? ` · ${a.imapHost}` : ""}
                          {a.lastError ? ` · ${a.lastError}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={a.status === "active" ? "default" : "outline"} className="capitalize">
                        {a.status}
                      </Badge>
                      <Button variant="ghost" size="sm" iconLeft={Trash2} onClick={() => void removeAccount(a.id)}>
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {adding ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Connect a mailbox</CardTitle>
                <CardDescription>We verify credentials live before saving.</CardDescription>
              </div>
              {accounts.length > 0 ? (
                <Button variant="ghost" size="sm" iconLeft={X} onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              ) : null}
            </CardHeader>
            <CardBody>
              {/* One-click OAuth — no passwords; refresh token stored encrypted. */}
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="secondary" iconLeft={Mail} onClick={() => startOAuth("gmail")}>
                  Connect Gmail
                </Button>
                <Button variant="secondary" iconLeft={Mail} onClick={() => startOAuth("outlook")}>
                  Connect Outlook
                </Button>
              </div>
              <div className="my-4 flex items-center gap-3 text-xs text-[var(--st-text-tertiary)]">
                <span className="h-px flex-1 bg-[var(--st-border)]" />
                or connect any mailbox via IMAP
                <span className="h-px flex-1 bg-[var(--st-border)]" />
              </div>
              <MailboxConnectForm
                projectId={projectId}
                onConnected={(acct) => {
                  setAccounts((prev) => [acct, ...prev.filter((p) => p.id !== acct.id)]);
                  setAdding(false);
                }}
              />
            </CardBody>
          </Card>
        ) : null}
        </div>
      </div>
    </div>
  );
}

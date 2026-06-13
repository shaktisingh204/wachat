import { redirect } from "next/navigation";
import Link from "next/link";
import { AtSign } from "lucide-react";

import {
  Button,
  Card,
  EmptyState,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from "@/components/sabcrm/20ui";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";
import { listSabmailAccounts } from "@/app/actions/sabmail-projects.actions";

import { SabmailInboxClient } from "./_components/inbox-client";

export const dynamic = "force-dynamic";

export default async function SabmailInboxPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const accounts = (await listSabmailAccounts()).filter((a) => a.provider === "imap");

  if (accounts.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Inbox</PageTitle>
            <PageDescription>
              A fast, keyboard-first inbox across all your mailboxes.
            </PageDescription>
          </PageHeaderHeading>
        </PageHeader>
        <Card className="mt-6 p-10">
          <EmptyState
            icon={<AtSign aria-hidden />}
            title="Connect a mailbox to begin"
            description="Once an IMAP mailbox is connected, your unified inbox appears here."
            action={
              <Button variant="primary" size="sm" asChild>
                <Link href="/sabmail/accounts">Connect mailbox</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return <SabmailInboxClient accounts={accounts} />;
}

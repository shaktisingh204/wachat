import Link from "next/link";
import { AtSign, Inbox, Keyboard, Sparkles } from "lucide-react";

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
} from "@/components/sabcrm/20ui";

import { listSabmailAccounts } from "@/app/actions/sabmail-projects.actions";

export const dynamic = "force-dynamic";

/**
 * Inbox — the hero surface. Phase 0 ships the connected-mailbox foundation;
 * the live three-pane sync engine (modifier-queue optimistic UI, JWZ
 * threading, DOMPurify+iframe render, push) lands in Phase 1. This page is an
 * honest placeholder — it shows real connected accounts, not fabricated mail.
 */
export default async function SabmailInboxPage() {
  const accounts = await listSabmailAccounts();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Inbox</PageTitle>
          <PageDescription>
            A fast, keyboard-first, three-pane inbox across all your mailboxes.
          </PageDescription>
        </PageHeaderHeading>
        <Button variant="outline" size="sm" iconLeft={AtSign} asChild>
          <Link href="/sabmail/accounts">Manage accounts</Link>
        </Button>
      </PageHeader>

      <div className="mt-6">
        {accounts.length === 0 ? (
          <Card className="p-10">
            <EmptyState
              icon={<AtSign aria-hidden />}
              title="Connect a mailbox to begin"
              description="Once a mailbox is connected, your unified inbox appears here."
              action={
                <Button variant="primary" size="sm" asChild>
                  <Link href="/sabmail/accounts">Connect mailbox</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Inbox sync is being set up</CardTitle>
              <CardDescription>
                {accounts.length} mailbox{accounts.length === 1 ? "" : "es"} connected. Live triage is rolling out.
              </CardDescription>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {accounts.map((a) => (
                  <Badge key={a.id} variant="outline" className="gap-1">
                    <AtSign className="h-3 w-3" aria-hidden /> {a.email}
                  </Badge>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Feature icon={<Inbox className="h-4 w-4" aria-hidden />} title="Three-pane triage" description="Folders · conversation list · reading pane with inline reply." />
                <Feature icon={<Keyboard className="h-4 w-4" aria-hidden />} title="Keyboard-first" description="j/k to move, e to archive, c to compose, ⌘K command palette." />
                <Feature icon={<Sparkles className="h-4 w-4" aria-hidden />} title="AI triage" description="Auto-labels, thread summaries, draft-in-your-voice replies." />
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-md border border-[var(--st-border)] p-3">
      <div className="flex items-center gap-2 text-[var(--st-text)]">
        <span className="text-[var(--st-text-secondary)]">{icon}</span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="mt-1 text-xs text-[var(--st-text-secondary)]">{description}</p>
    </div>
  );
}

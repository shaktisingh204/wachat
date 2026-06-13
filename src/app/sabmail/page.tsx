import Link from "next/link";
import { AtSign, Inbox, Plug, Sparkles } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from "@/components/sabcrm/20ui";

import { getActiveSabmailProject } from "@/lib/sabmail/workspace";
import { listSabmailAccounts } from "@/app/actions/sabmail-projects.actions";

export const dynamic = "force-dynamic";

export default async function SabmailOverviewPage() {
  const [project, accounts] = await Promise.all([
    getActiveSabmailProject(),
    listSabmailAccounts(),
  ]);

  const activeAccounts = accounts.filter((a) => a.status === "active").length;
  const intent = project?.sabmail?.intent ?? null;

  const kpis = [
    { id: "mailboxes", label: "Connected mailboxes", value: accounts.length, icon: AtSign },
    { id: "active", label: "Active connections", value: activeAccounts, icon: Plug },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Overview</PageTitle>
          <PageDescription>
            {project?.name
              ? `${project.name} — your email workspace.`
              : "Your email workspace."}
          </PageDescription>
        </PageHeaderHeading>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" iconLeft={AtSign} asChild>
            <Link href="/sabmail/accounts">Accounts</Link>
          </Button>
          <Button variant="primary" size="sm" iconLeft={Inbox} asChild>
            <Link href="/sabmail/inbox">Open inbox</Link>
          </Button>
        </div>
      </PageHeader>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.id} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--st-text-secondary)]">{k.label}</span>
                <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden />
              </div>
              <div className="mt-2 text-2xl font-semibold text-[var(--st-text)]">
                {k.value.toLocaleString()}
              </div>
            </Card>
          );
        })}
        <Card className="p-4">
          <span className="text-xs text-[var(--st-text-secondary)]">Usage</span>
          <div className="mt-2">
            <Badge variant="outline" className="capitalize">
              {intent ?? "—"}
            </Badge>
          </div>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-[var(--st-text-secondary)]">Status</span>
          <div className="mt-2">
            <Badge variant="default">Ready</Badge>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Get the most out of SabMail</CardTitle>
            <CardDescription>The inbox-first client, built in phases.</CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            <NextStep
              icon={<AtSign className="h-4 w-4" aria-hidden />}
              title="Connect more mailboxes"
              description="Add Gmail, Outlook, or any IMAP account. One unified inbox across all of them."
              href="/sabmail/accounts"
              cta="Manage accounts"
            />
            <NextStep
              icon={<Inbox className="h-4 w-4" aria-hidden />}
              title="Triage your inbox"
              description="Read, reply, snooze and archive — with a keyboard-first, three-pane inbox."
              href="/sabmail/inbox"
              cta="Open inbox"
            />
            <NextStep
              icon={<Sparkles className="h-4 w-4" aria-hidden />}
              title="AI triage & summaries"
              description="Auto-labeling, thread summaries, and draft-in-your-voice replies (rolling out)."
              href="/sabmail/inbox"
              cta="Learn more"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connected mailboxes</CardTitle>
            <CardDescription>{accounts.length} connected</CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-2">
            {accounts.length === 0 ? (
              <p className="text-sm text-[var(--st-text-secondary)]">
                No mailboxes yet.{" "}
                <Link href="/sabmail/accounts" className="underline underline-offset-2">
                  Connect one
                </Link>
                .
              </p>
            ) : (
              accounts.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-[var(--st-text)]">{a.email}</span>
                  <Badge variant={a.status === "active" ? "default" : "outline"} className="shrink-0 capitalize">
                    {a.status}
                  </Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function NextStep({
  icon,
  title,
  description,
  href,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-[var(--st-border)] p-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--st-text)]">{title}</div>
        <div className="text-xs text-[var(--st-text-secondary)]">{description}</div>
      </div>
      <Button variant="ghost" size="sm" asChild>
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}

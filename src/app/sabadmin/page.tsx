import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  PageDescription,
  PageHeader,
  PageTitle,
} from "@/components/sabcrm/20ui";

import { getSabAdminContext } from "@/lib/sabadmin/tenant";
import { getSabAdminOverviewCounts } from "@/lib/sabadmin/queries";
import { getSabAdminSettingsView } from "./actions/settings.actions";

export const dynamic = "force-dynamic";

export default async function SabAdminOverviewPage() {
  const ctx = await getSabAdminContext();
  if (!ctx.ok) redirect("/dashboard");

  const [counts, settings] = await Promise.all([
    getSabAdminOverviewCounts(ctx.ctx.ownerUserId),
    getSabAdminSettingsView(),
  ]);

  const notReady =
    !settings?.hostedMailConfigured ||
    !settings?.hostedAuthConfigured ||
    !settings?.mailWorkspaceId ||
    (settings?.verifiedDomains.length ?? 0) === 0;

  const stats = [
    { label: "People", value: counts.people, href: "/sabadmin/people" },
    { label: "Active", value: counts.active, href: "/sabadmin/people" },
    { label: "Suspended", value: counts.suspended, href: "/sabadmin/people" },
    { label: "Offboarded", value: counts.offboarded, href: "/sabadmin/people" },
    { label: "Access Packages", value: counts.packages, href: "/sabadmin/access" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeader>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <PageTitle>Admin Center</PageTitle>
            <PageDescription>
              Onboard an employee once — they get a company email + login, an
              Outlook-style mailbox, and access to exactly the tools you grant.
            </PageDescription>
          </div>
          <Button asChild>
            <Link href="/sabadmin/people">Add employee</Link>
          </Button>
        </div>
      </PageHeader>

      {notReady ? (
        <Callout variant="warning" className="mt-6">
          <div className="font-medium">Finish setup to start onboarding</div>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {!settings?.hostedAuthConfigured && <li>Login provisioning (Firebase Admin) isn’t configured on the server.</li>}
            {!settings?.hostedMailConfigured && <li>Hosted mail (Stalwart) isn’t configured on the server.</li>}
            {!settings?.mailWorkspaceId && <li>No SabMail mail workspace is linked — set one in Settings.</li>}
            {settings?.mailWorkspaceId && (settings?.verifiedDomains.length ?? 0) === 0 && (
              <li>No verified email domain yet — verify one in SabMail, then it appears here.</li>
            )}
          </ul>
          <div className="mt-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/sabadmin/settings">Open Settings</Link>
            </Button>
          </div>
        </Callout>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="block">
            <Card className="transition hover:shadow-md">
              <CardBody>
                <div className="text-3xl font-semibold tabular-nums">{s.value}</div>
                <div className="mt-1 text-sm text-[var(--zoru-text-secondary,#666)]">{s.label}</div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>How onboarding works</CardTitle>
            <CardDescription>One flow, four artifacts — Microsoft-365 style.</CardDescription>
          </CardHeader>
          <CardBody>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>A company <strong>mailbox</strong> (the Outlook-style inbox) on your verified domain.</li>
              <li>A <strong>login</strong> — the mailbox address is the sign-in (UPN), with a one-time password.</li>
              <li>An <strong>HR record</strong> linked to the account.</li>
              <li><strong>Tool access</strong> — bounded by what you yourself can access.</li>
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email domain</CardTitle>
            <CardDescription>Where new mailboxes are created.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[var(--zoru-text-secondary,#666)]">Default domain:</span>
              {settings?.defaultDomain ? (
                <Badge variant="secondary">{settings.defaultDomain}</Badge>
              ) : (
                <span className="text-[var(--zoru-text-secondary,#666)]">none yet</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--zoru-text-secondary,#666)]">Policy:</span>
              <Badge variant="outline">
                {settings?.domainMode === "shared" ? "Shared SabNode domain" : "Custom, else shared"}
              </Badge>
            </div>
            <div className="pt-1">
              <Button asChild variant="ghost" size="sm">
                <Link href="/sabadmin/settings">Manage domains & email →</Link>
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

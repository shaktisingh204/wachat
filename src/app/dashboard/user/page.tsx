import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
export const dynamic = 'force-dynamic';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  StatCard,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  Avatar,
  Badge,
  Dot,
  EmptyState,
  Separator,
} from '@/components/sabcrm/20ui';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  Building2,
  KeyRound,
  ChevronRight,
  Settings,
  Globe,
  CalendarDays,
  Wallet,
  UserRound,
  Languages,
  ReceiptText,
  Hash,
  MapPin,
} from 'lucide-react';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'My Account | SabNode',
};

export default async function UserDashboardPage() {
  const session = await getCachedSession();

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user;
  const projects = (await getCachedProjects()) || [];

  const initials = user.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)
    : user.email.substring(0, 2).toUpperCase();

  const joinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Unknown';

  const hasPassword = !!user.password;
  const apiKeysCount = user.apiKeys?.length || 0;
  const activeProject =
    projects.find((p) => p._id?.toString() === user.activeProjectId?.toString()) ||
    projects[0];

  const biz = user.businessProfile;
  const hasBiz = !!(biz && (biz.name || biz.gstin || biz.pan || biz.address));

  const credits = user.credits;
  const totalCredits = credits
    ? (credits.broadcast || 0) +
      (credits.sms || 0) +
      (credits.meta || 0) +
      (credits.email || 0) +
      (credits.seo || 0)
    : 0;

  const walletBalance = user.wallet
    ? (user.wallet.balance / 100).toLocaleString(undefined, {
        style: 'currency',
        currency: user.wallet.currency || 'INR',
        maximumFractionDigits: 0,
      })
    : null;

  const otherProjects = projects.filter(
    (p) => p._id?.toString() !== activeProject?._id?.toString(),
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Account</PageEyebrow>
          <PageTitle>My Account</PageTitle>
          <PageDescription>
            Your profile, security and workspaces at a glance.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button asChild>
            <Link href="/dashboard/user/profile">
              <Settings size={16} aria-hidden="true" />
              Manage profile
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Workspaces"
          value={projects.length}
          icon={Globe}
          accent="#3b7af5"
        />
        <StatCard
          label="Credits"
          value={totalCredits.toLocaleString()}
          icon={Wallet}
          accent="#1f9d55"
        />
        <StatCard
          label="API keys"
          value={apiKeysCount}
          icon={KeyRound}
          accent="#7c3aed"
        />
        <StatCard
          label="Member since"
          value={joinedDate}
          icon={CalendarDays}
          accent="#d97706"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound size={16} aria-hidden="true" />
              Profile
            </CardTitle>
            <CardDescription>Your identity on SabNode.</CardDescription>
          </CardHeader>
          <CardBody className="flex items-center gap-4">
            <Avatar
              name={user.name || user.email}
              src={user.image || undefined}
              size="lg"
              shape="round"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate font-semibold text-[var(--st-text)]">
                {user.name || 'Anonymous user'}
              </p>
              <p className="truncate text-sm text-[var(--st-text-secondary)]">
                {user.email}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {user.emailVerified ? (
                  <Badge tone="success" kind="soft" dot>
                    Verified
                  </Badge>
                ) : (
                  <Badge tone="warning" kind="soft" dot>
                    Unverified
                  </Badge>
                )}
                {user.language && (
                  <Badge tone="neutral" kind="outline">
                    <Languages size={12} aria-hidden="true" />
                    {user.language.toUpperCase()}
                  </Badge>
                )}
              </div>
            </div>
          </CardBody>
          <CardFooter>
            <Button asChild variant="ghost">
              <Link href="/dashboard/user/profile">
                Edit profile
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {hasPassword ? (
                <ShieldCheck size={16} aria-hidden="true" />
              ) : (
                <ShieldAlert size={16} aria-hidden="true" />
              )}
              Security
            </CardTitle>
            <CardDescription>Password and access keys.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <KeyRound
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--st-text-secondary)]"
                />
                <span className="text-sm text-[var(--st-text)]">Password</span>
              </div>
              <Badge tone={hasPassword ? 'success' : 'warning'} kind="soft">
                {hasPassword ? 'Set' : 'Not set'}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <ShieldCheck
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--st-text-secondary)]"
                />
                <span className="text-sm text-[var(--st-text)]">API keys</span>
              </div>
              <Badge tone={apiKeysCount > 0 ? 'accent' : 'neutral'} kind="soft">
                {apiKeysCount} active
              </Badge>
            </div>
            {walletBalance && (
              <div className="flex items-center justify-between gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Wallet
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-[var(--st-text-secondary)]"
                  />
                  <span className="text-sm text-[var(--st-text)]">Wallet</span>
                </div>
                <span className="text-sm font-semibold text-[var(--st-text)]">
                  {walletBalance}
                </span>
              </div>
            )}
          </CardBody>
          <CardFooter>
            <Button asChild variant="ghost">
              <Link href="/dashboard/user/profile">
                Manage security
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Workspaces */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe size={16} aria-hidden="true" />
            Workspaces
          </CardTitle>
          <CardDescription>Where your work lives.</CardDescription>
        </CardHeader>
        <CardBody className="space-y-3">
          {projects.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="No workspaces yet"
              description="Create a workspace to start building with SabNode."
              action={
                <Button asChild size="sm">
                  <Link href="/dashboard/platform">
                    <Globe size={16} aria-hidden="true" />
                    Create workspace
                  </Link>
                </Button>
              }
            />
          ) : (
            <>
              {activeProject && (
                <div className="flex items-center justify-between gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-accent-soft)] px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Dot tone="success" pulse />
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                        Active workspace
                      </p>
                      <p
                        className="truncate text-sm font-semibold text-[var(--st-text)]"
                        title={activeProject.name}
                      >
                        {activeProject.name}
                      </p>
                    </div>
                  </div>
                  <Badge tone="accent" kind="soft">
                    Current
                  </Badge>
                </div>
              )}
              {otherProjects.length > 0 && (
                <>
                  <Separator />
                  <ul className="space-y-1.5">
                    {otherProjects.slice(0, 4).map((p) => (
                      <li
                        key={p._id?.toString()}
                        className="flex items-center gap-2.5 px-1 py-1.5"
                      >
                        <Globe
                          size={15}
                          aria-hidden="true"
                          className="shrink-0 text-[var(--st-text-secondary)]"
                        />
                        <span
                          className="truncate text-sm text-[var(--st-text)]"
                          title={p.name}
                        >
                          {p.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {otherProjects.length > 4 && (
                    <p className="px-1 text-xs text-[var(--st-text-secondary)]">
                      +{otherProjects.length - 4} more
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </CardBody>
        <CardFooter>
          <Button asChild variant="ghost">
            <Link href="/dashboard/platform">
              Manage workspaces
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </Button>
        </CardFooter>
      </Card>

      {/* Business profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 size={16} aria-hidden="true" />
            Business profile
          </CardTitle>
          <CardDescription>
            Used on invoices, vouchers and accounting documents.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {hasBiz ? (
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <BizField icon={Building2} label="Business name" value={biz?.name} />
              <BizField icon={ReceiptText} label="GSTIN" value={biz?.gstin} />
              <BizField icon={Hash} label="PAN" value={biz?.pan} />
              <BizField icon={MapPin} label="Address" value={biz?.address} />
            </dl>
          ) : (
            <EmptyState
              icon={Building2}
              title="No business profile yet"
              description="Add your company details so they appear on invoices and vouchers."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/user/profile">
                    <Building2 size={16} aria-hidden="true" />
                    Set up business profile
                  </Link>
                </Button>
              }
            />
          )}
        </CardBody>
        {hasBiz && (
          <CardFooter>
            <Button asChild variant="ghost">
              <Link href="/dashboard/user/profile">
                Edit business profile
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

function BizField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2.5">
      <Icon
        size={16}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-[var(--st-text-secondary)]"
      />
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
          {label}
        </dt>
        <dd className="mt-0.5 truncate text-sm font-medium text-[var(--st-text)]">
          {value || '—'}
        </dd>
      </div>
    </div>
  );
}

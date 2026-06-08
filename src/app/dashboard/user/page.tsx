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
  AvatarImage,
  AvatarFallback,
  Badge,
  EmptyState,
} from '@/components/sabcrm/20ui';
import Link from 'next/link';
import {
  Shield,
  Building2,
  Key,
  Clock,
  ChevronRight,
  Settings,
  Globe,
  CalendarDays,
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
              <Settings size={16} />
              Manage profile
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Workspaces" value={projects.length} icon={<Globe />} />
        <StatCard
          label="Password"
          value={hasPassword ? 'Set' : 'Not set'}
          icon={<Key />}
        />
        <StatCard label="API keys" value={apiKeysCount} icon={<Shield />} />
        <StatCard label="Joined" value={joinedDate} icon={<CalendarDays />} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your identity on SabNode.</CardDescription>
          </CardHeader>
          <CardBody className="flex items-center gap-4">
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarImage src={user.image || ''} alt={user.name || 'User avatar'} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate font-semibold text-[var(--st-text)]">
                {user.name || 'Anonymous user'}
              </p>
              <p className="truncate text-sm text-[var(--st-text-secondary)]">
                {user.email}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary">
                  <Clock size={12} />
                  Joined {joinedDate}
                </Badge>
                {user.language && (
                  <Badge variant="outline">{user.language.toUpperCase()}</Badge>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspaces</CardTitle>
            <CardDescription>Where your work lives.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="space-y-0.5">
              <p className="text-sm text-[var(--st-text-secondary)]">Total workspaces</p>
              <p className="text-2xl font-semibold text-[var(--st-text)]">
                {projects.length}
              </p>
            </div>
            {activeProject && (
              <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
                <p className="text-xs text-[var(--st-text-secondary)]">Active workspace</p>
                <p
                  className="truncate font-medium text-[var(--st-text)]"
                  title={activeProject.name}
                >
                  {activeProject.name}
                </p>
              </div>
            )}
          </CardBody>
          <CardFooter>
            <Button asChild variant="ghost">
              <Link href="/dashboard/platform">
                Manage workspaces
                <ChevronRight size={16} />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
          <CardDescription>
            Used on invoices, vouchers and accounting documents.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {biz ? (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--st-text-secondary)]">Business name</dt>
                <dd className="mt-0.5 text-sm font-medium text-[var(--st-text)]">
                  {biz.name || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--st-text-secondary)]">GSTIN</dt>
                <dd className="mt-0.5 text-sm text-[var(--st-text)]">{biz.gstin || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--st-text-secondary)]">PAN</dt>
                <dd className="mt-0.5 text-sm text-[var(--st-text)]">{biz.pan || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--st-text-secondary)]">Address</dt>
                <dd className="mt-0.5 text-sm text-[var(--st-text)]">{biz.address || '—'}</dd>
              </div>
            </dl>
          ) : (
            <EmptyState
              icon={<Building2 />}
              title="No business profile yet"
              description="Add your company details so they appear on invoices and vouchers."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/user/profile">Set up business profile</Link>
                </Button>
              }
            />
          )}
        </CardBody>
        <CardFooter>
          <Button asChild variant="ghost">
            <Link href="/dashboard/user/profile">
              Edit business profile
              <ChevronRight size={16} />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

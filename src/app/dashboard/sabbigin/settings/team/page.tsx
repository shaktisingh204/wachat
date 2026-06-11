import Link from 'next/link';
import { ArrowLeft, Layers, Plus, Users } from 'lucide-react';

import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';

import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';

export const dynamic = 'force-dynamic';

export default async function SabbiginTeamSettingsPage() {
  const pipelines = await getCrmPipelines();

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <Link
              href="/dashboard/sabbigin/settings"
              className="inline-flex items-center gap-1 hover:text-[var(--st-text)]"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden="true" />
              Settings
            </Link>
          </PageEyebrow>
          <PageTitle>Team &amp; pipelines</PageTitle>
          <PageDescription>
            Pipelines define the stages your deals move through. Everyone on your
            account works the same shared pipelines.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Link
            href="/dashboard/sabbigin/pipelines/new"
            className="u-btn u-btn--primary u-btn--sm"
          >
            <Plus size={13} aria-hidden="true" />
            <span className="u-btn__label">New pipeline</span>
          </Link>
        </PageActions>
      </PageHeader>

      {/* Visibility explainer */}
      <Card padding="none">
        <CardBody className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent)]/12 text-[var(--st-accent)]"
            aria-hidden="true"
          >
            <Users className="h-4.5 w-4.5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--st-text)]">
              Shared by your team
            </p>
            <p className="text-xs text-[var(--st-text-secondary)]">
              Pipelines and their stages are visible to every member of your
              account. Record-level visibility (who can see which deals and
              contacts) follows your role&apos;s permissions — manage those from
              your account&apos;s roles &amp; permissions settings.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Pipelines list */}
      {pipelines.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No pipelines yet"
          description="Create your first pipeline to start tracking deals through stages."
          action={
            <Link
              href="/dashboard/sabbigin/pipelines/new"
              className="u-btn u-btn--primary u-btn--sm"
            >
              <span className="u-btn__label">New pipeline</span>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pipelines.map((p) => (
            <Card key={String(p.id)} padding="none">
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Layers
                      className="h-4 w-4 text-[var(--st-accent)]"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold text-[var(--st-text)]">
                      {p.name}
                    </span>
                  </div>
                  <Badge tone="neutral" kind="soft">
                    {p.stages?.length ?? 0} stage
                    {(p.stages?.length ?? 0) === 1 ? '' : 's'}
                  </Badge>
                </div>
                {p.stages && p.stages.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.stages.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-full border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-0.5 text-xs text-[var(--st-text-secondary)]"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3">
                  <Link
                    href={`/dashboard/sabbigin/deals?pipeline=${encodeURIComponent(String(p.id))}`}
                    className="text-xs font-medium text-[var(--st-text-secondary)] transition-colors hover:text-[var(--st-text)]"
                  >
                    Open deals →
                  </Link>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

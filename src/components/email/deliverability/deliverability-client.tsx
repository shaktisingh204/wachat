'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  Activity,
  Flame,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageActions,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  zoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  actionGetDeliverabilityScore,
  actionGetLatestPlacementTest,
  actionListEmailDomains,
  actionListWarmupRuns,
  actionRunPlacementTest,
  type DeliverabilityScore,
  type EmailDomainDoc,
  type PlacementTestDoc,
  type WarmupRunDoc,
} from '@/app/actions/email/deliverability.actions';
import { ScoreGauge } from './score-gauge';
import { DomainList } from './domain-list';
import { WarmupSchedule } from './warmup-schedule';
import { ContentAnalyzer } from './content-analyzer';

export function DeliverabilityClient() {
  const [score, setScore] = useState<DeliverabilityScore | null>(null);
  const [domains, setDomains] = useState<EmailDomainDoc[]>([]);
  const [warmups, setWarmups] = useState<WarmupRunDoc[]>([]);
  const [placement, setPlacement] = useState<PlacementTestDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [scoreRes, domainsRes, warmupsRes, placementRes] = await Promise.all([
      actionGetDeliverabilityScore(),
      actionListEmailDomains(),
      actionListWarmupRuns(),
      actionGetLatestPlacementTest(),
    ]);

    if (scoreRes.ok) setScore(scoreRes.data);
    else zoruToast({ title: 'Score unavailable', description: scoreRes.error, variant: 'destructive' });

    if (domainsRes.ok) setDomains(domainsRes.data);
    else zoruToast({ title: 'Failed to load domains', description: domainsRes.error, variant: 'destructive' });

    if (warmupsRes.ok) setWarmups(warmupsRes.data);
    else zoruToast({ title: 'Failed to load warmups', description: warmupsRes.error, variant: 'destructive' });

    if (placementRes.ok) setPlacement(placementRes.data);
    // placement is optional — silent on failure

    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const handleRunPlacement = () => {
    startTransition(async () => {
      const result = await actionRunPlacementTest();
      if (!result.ok) {
        zoruToast({ title: 'Placement test failed', description: result.error, variant: 'destructive' });
        return;
      }
      setPlacement(result.data);
      zoruToast({ title: 'Placement test completed' });
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <ShieldCheck className="h-6 w-6" /> Deliverability
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Authentication, sender reputation, warmup and inbox placement — at a glance.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button variant="outline" onClick={() => void fetchAll()} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <ZoruCardHeader>
            <ZoruCardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" /> Sender score
            </ZoruCardTitle>
            <ZoruCardDescription>
              Composite signal across authentication, complaints and bounces.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="flex flex-col items-center gap-3">
            {loading ? (
              <Skeleton className="h-[168px] w-[168px] rounded-full" />
            ) : score ? (
              <>
                <ScoreGauge score={score.score} grade={score.grade} />
                {score.factors && score.factors.length > 0 ? (
                  <ul className="w-full space-y-1.5 text-xs">
                    {score.factors.slice(0, 4).map((f) => (
                      <li
                        key={f.key}
                        className="flex items-center justify-between gap-2 border-b border-[var(--st-border)] pb-1 last:border-b-0"
                      >
                        <span className="text-[var(--st-text-secondary)]">{f.note ?? f.key}</span>
                        <span className="font-medium text-[var(--st-text)]">
                          {Math.round(f.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-[var(--st-text-secondary)]">No score available.</p>
            )}
          </ZoruCardContent>
        </Card>

        <Card className="lg:col-span-2">
          <ZoruCardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <ZoruCardTitle>Inbox placement</ZoruCardTitle>
                <ZoruCardDescription>
                  {placement
                    ? `Last run ${new Date(placement.runAt).toLocaleString()}`
                    : 'Run a placement test to see where your mail lands.'}
                </ZoruCardDescription>
              </div>
              <Button
                size="sm"
                onClick={handleRunPlacement}
                disabled={pending}
              >
                <PlayCircle className="h-4 w-4" /> Run test
              </Button>
            </div>
          </ZoruCardHeader>
          <ZoruCardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : placement ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-[var(--zoru-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                    <p className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">Inbox</p>
                    <p className="text-2xl font-semibold text-[var(--st-text)]">
                      {Math.round((placement.inboxRate ?? 0) * 100)}%
                    </p>
                  </div>
                  <div className="rounded-[var(--zoru-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                    <p className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">Spam</p>
                    <p className="text-2xl font-semibold text-[var(--st-text)]">
                      {Math.round((placement.spamRate ?? 0) * 100)}%
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(placement.results ?? []).map((r) => (
                    <Badge
                      key={r.provider}
                      variant={
                        r.folder === 'inbox'
                          ? 'success'
                          : r.folder === 'spam'
                            ? 'destructive'
                            : 'warning'
                      }
                    >
                      {r.provider}: {r.folder}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--st-text-secondary)]">
                No placement data yet.
              </p>
            )}
          </ZoruCardContent>
        </Card>
      </div>

      <ContentAnalyzer />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Sender domains
          </h2>
        </div>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <DomainList domains={domains} onUpdated={fetchAll} />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-[var(--st-text-secondary)]" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Warmup runs
          </h2>
        </div>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <WarmupSchedule runs={warmups} onUpdated={fetchAll} />
        )}
      </section>
    </div>
  );
}

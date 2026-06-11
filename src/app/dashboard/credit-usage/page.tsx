'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Spinner,
  StatCard,
  TBody,
  Table,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';
import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Coins,
  CreditCard,
  LineChart as LineChartIcon,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useProject } from '@/context/project-context';
import { getCreditUsage } from '@/app/actions/wachat-features.actions';

/**
 * Wachat Credit Usage - billing and credit usage dashboard.
 */

interface DailyUsageRow {
  _id: string;
  count: number;
}

export default function CreditUsagePage() {
  const router = useRouter();
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [credits, setCredits] = useState(0);
  const [dailyUsage, setDailyUsage] = useState<DailyUsageRow[]>([]);
  const [isLoading, startLoading] = useTransition();

  const fetchUsage = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getCreditUsage(pid);
        if (res.error) {
          toast.error(res.error);
        } else {
          setCredits(res.credits || 0);
          setDailyUsage(res.dailyUsage || []);
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchUsage(projectId);
  }, [projectId, fetchUsage]);

  const totalUsed = dailyUsage.reduce((sum, d) => sum + (d.count || 0), 0);
  const dailyAvg = dailyUsage.length > 0 ? Math.round(totalUsed / dailyUsage.length) : 0;
  const maxUsed = Math.max(...dailyUsage.map((d) => d.count || 0), 1);
  const isLow = credits < 5000;
  const daysLeft = dailyAvg > 0 ? Math.floor(credits / dailyAvg) : 0;

  const stats = [
    { label: 'Credits remaining', value: credits.toLocaleString(), icon: Coins },
    { label: 'Used (30 days)', value: totalUsed.toLocaleString(), icon: TrendingUp },
    { label: 'Daily average', value: dailyAvg.toLocaleString(), icon: Calendar },
  ];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1200px] flex-col gap-[var(--st-space-7)]">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Credit usage</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>Credit usage</PageTitle>
          <PageDescription>
            Monitor your messaging credit balance and daily usage.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={CreditCard}
            onClick={() => router.push('/dashboard/billing')}
          >
            Top up credits
          </Button>
        </PageActions>
      </PageHeader>

      {isLow && credits > 0 && (
        <Alert variant="warning" icon={TriangleAlert}>
          <AlertTitle>Low credit balance</AlertTitle>
          <AlertDescription>
            Approximately {daysLeft} day{daysLeft !== 1 ? 's' : ''} of credits remaining at current
            usage.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner size="md" label="Loading credit usage" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} />
            ))}
          </div>

          {dailyUsage.length > 0 ? (
            <Card padding="lg">
              <CardHeader>
                <CardTitle>Daily trend</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="mb-5 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={dailyUsage.map((d) => ({ date: d._id, count: d.count }))}
                      margin={{ top: 5, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" />
                      <XAxis
                        dataKey="date"
                        stroke="var(--st-text-secondary)"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis stroke="var(--st-text-secondary)" tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="var(--st-warn)"
                        strokeWidth={2}
                        dot={false}
                        name="Credits used"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <Table density="compact">
                  <THead>
                    <Tr>
                      <Th>Date</Th>
                      <Th align="right">Messages</Th>
                      <Th>Share of peak day</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {dailyUsage.map((d) => (
                      <Tr key={d._id}>
                        <Td>{d._id}</Td>
                        <Td align="right" className="tabular-nums">
                          {d.count.toLocaleString()}
                        </Td>
                        <Td>
                          <div className="h-2 w-full overflow-hidden rounded-[var(--st-radius-pill)] bg-[var(--st-bg-muted)]">
                            <div
                              className="h-full rounded-[var(--st-radius-pill)] bg-[var(--st-warn)] transition-all"
                              style={{ width: `${(d.count / maxUsed) * 100}%` }}
                            />
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </CardBody>
            </Card>
          ) : (
            <Card padding="lg">
              <CardBody>
                <EmptyState
                  icon={LineChartIcon}
                  title="No usage yet"
                  description="Once you start sending messages, your daily credit usage will appear here."
                />
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

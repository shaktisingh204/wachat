'use client';

import {
  Button,
  IconButton,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Alert,
  AlertTitle,
  AlertDescription,
  Switch,
  Badge,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Input,
  Field,
  EmptyState,
} from '@/components/sabcrm/20ui';
import {
  useState,
  useEffect,
  useTransition,
  use,
} from 'react';
import {
  getAdSets,
  getInsights,
  updateAdSet,
  updateEntityStatus,
} from '@/app/actions/ad-manager.actions';

import { AlertCircle, ArrowLeft, Layers, ChevronRight, RefreshCw, Check, X, Edit2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { AmBreadcrumb, AmHeader } from '../../_components/am-page-shell';

const insightsCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-8 w-64" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
        </CardHeader>
        <CardBody>
          <Skeleton className="h-48 w-full" />
        </CardBody>
      </Card>
    </div>
  );
}

export default function AdSetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = use(params);
  const router = useRouter();
  const [adSets, setAdSets] = useState<any[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters
  const [minRoas, setMinRoas] = useState<string>('');
  const [maxCpa, setMaxCpa] = useState<string>('');

  // Inline Editing
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editBudgetAmount, setEditBudgetAmount] = useState<string>('');
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  useEffect(() => {
    startLoadingTransition(async () => {
      setError(null);
      const [adSetsResult, insightsResult] = await Promise.all([
        getAdSets(campaignId),
        (async () => {
          const cacheKey = `insights_${campaignId}`;
          const cached = insightsCache.get(cacheKey);
          if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return { data: cached.data };
          }
          const res = await getInsights(campaignId, { level: 'adset', date_preset: 'maximum' });
          if (!res.error && res.data) {
            insightsCache.set(cacheKey, { data: res.data, timestamp: Date.now() });
          }
          return res;
        })(),
      ]);

      if (adSetsResult.error) {
        setError(adSetsResult.error);
        return;
      }

      const rawAdSets = adSetsResult.adSets || [];
      const insightsData = insightsResult.data || [];

      const merged = rawAdSets.map((adSet) => {
        const insight = insightsData.find((i) => i.adset_id === adSet.id);
        return { ...adSet, insights: insight || adSet.insights || {} };
      });

      setAdSets(merged);
    });
  }, [campaignId, refreshKey]);

  const handleStatusToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setAdSets((prev) => prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item)));

    const result = await updateEntityStatus(id, 'adset', newStatus);

    if (result.success) {
      toast({ title: 'Status Updated', description: `Ad Set is now ${newStatus.toLowerCase()}.` });
    } else {
      setAdSets((prev) => prev.map((item) => (item.id === id ? { ...item, status: currentStatus as any } : item)));
      toast({ title: 'Update Failed', description: result.error, variant: 'destructive' });
    }
  };

  const handleSaveBudget = async (id: string) => {
    const amount = Number(editBudgetAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter a valid budget amount.', variant: 'destructive' });
      return;
    }

    setIsSavingBudget(true);
    const previousAdSets = [...adSets];
    const newDailyBudget = (amount * 100).toString();

    setAdSets((prev) => prev.map((item) => (item.id === id ? { ...item, daily_budget: newDailyBudget } : item)));
    setEditingBudgetId(null);

    const result = await updateAdSet(id, { daily_budget: newDailyBudget });

    if (result.error) {
      setAdSets(previousAdSets);
      toast({ title: 'Update Failed', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Budget Updated', description: `Ad Set budget has been updated to ₹${amount}.` });
    }
    setIsSavingBudget(false);
  };

  const getCpa = (insights: any) => {
    const spend = Number(insights?.spend || 0);
    const clicks = Number(insights?.clicks || 0);
    return clicks > 0 ? spend / clicks : 0;
  };

  const getRoas = (insights: any) => {
    const roasArr = insights?.purchase_roas || [];
    return roasArr.length > 0 ? Number(roasArr[0].value) : 0;
  };

  const filteredAdSets = adSets.filter((adSet) => {
    let pass = true;
    const roasVal = getRoas(adSet.insights);
    const cpaVal = getCpa(adSet.insights);

    if (minRoas && !isNaN(Number(minRoas))) {
      if (roasVal < Number(minRoas)) pass = false;
    }
    if (maxCpa && !isNaN(Number(maxCpa))) {
      if (cpaVal > Number(maxCpa)) pass = false;
    }
    return pass;
  });

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <AmBreadcrumb
        page={`Campaign ${campaignId}`}
        parent={{ label: 'Campaigns', href: '/dashboard/ad-manager/campaigns' }}
      />

      <AmHeader
        title="Ad Sets"
        description={`Campaign ID: ${campaignId}`}
        actions={
          <div className="flex items-center gap-2">
            <IconButton
              label="Back to campaigns"
              icon={ArrowLeft}
              variant="ghost"
              onClick={() => router.push('/dashboard/ad-manager/campaigns')}
            />
            <IconButton
              label="Refresh ad sets"
              icon={RefreshCw}
              variant="outline"
              className={isLoading ? 'animate-spin' : undefined}
              onClick={() => {
                insightsCache.delete(`insights_${campaignId}`);
                setRefreshKey((k) => k + 1);
              }}
            />
          </div>
        }
      />

      {error && (
        <Alert tone="danger" icon={AlertCircle}>
          <AlertTitle>Error fetching Ad Sets</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" /> Ad Sets
              </CardTitle>
              <CardDescription>Manage the ad sets within this campaign.</CardDescription>
            </div>
            <div className="flex items-end gap-2">
              <Field label="Min ROAS" className="w-32">
                <Input
                  placeholder="Min ROAS"
                  value={minRoas}
                  onChange={(e) => setMinRoas(e.target.value)}
                  type="number"
                  min="0"
                  step="0.1"
                />
              </Field>
              <Field label="Max CPA (₹)" className="w-32">
                <Input
                  placeholder="Max CPA"
                  value={maxCpa}
                  onChange={(e) => setMaxCpa(e.target.value)}
                  type="number"
                  min="0"
                  step="0.1"
                />
              </Field>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-hidden">
            <Table>
              <THead>
                <Tr>
                  <Th>Status</Th>
                  <Th>Ad Set Name</Th>
                  <Th>Budget</Th>
                  <Th>ROAS</Th>
                  <Th>Optimization</Th>
                  <Th>Results</Th>
                  <Th>Cost/Result</Th>
                  <Th></Th>
                </Tr>
              </THead>
              <TBody>
                {filteredAdSets.length > 0 ? (
                  filteredAdSets.map((adSet) => (
                    <Tr key={adSet.id}>
                      <Td>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={adSet.status === 'ACTIVE'}
                            onCheckedChange={() => handleStatusToggle(adSet.id, adSet.status)}
                            aria-label={`Toggle ${adSet.name} status`}
                          />
                          <span className="text-xs text-[var(--st-text-secondary)]">{adSet.status}</span>
                        </div>
                      </Td>
                      <Td className="font-medium">
                        <Link
                          href={`/dashboard/ad-manager/ad-sets/${adSet.id}`}
                          className="text-[var(--st-text)] hover:underline"
                        >
                          {adSet.name}
                        </Link>
                      </Td>
                      <Td>
                        {editingBudgetId === adSet.id ? (
                          <div className="flex items-center gap-1">
                            <Field label="Daily budget" className="w-28">
                              <Input
                                inputSize="sm"
                                prefix="₹"
                                value={editBudgetAmount}
                                onChange={(e) => setEditBudgetAmount(e.target.value)}
                                autoFocus
                                type="number"
                                min="1"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveBudget(adSet.id);
                                  if (e.key === 'Escape') setEditingBudgetId(null);
                                }}
                                disabled={isSavingBudget}
                              />
                            </Field>
                            <IconButton
                              label="Save budget"
                              icon={Check}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSaveBudget(adSet.id)}
                              disabled={isSavingBudget}
                            />
                            <IconButton
                              label="Cancel budget edit"
                              icon={X}
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingBudgetId(null)}
                              disabled={isSavingBudget}
                            />
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            iconRight={Edit2}
                            className="group -mx-2"
                            aria-label={`Edit budget for ${adSet.name}`}
                            onClick={() => {
                              setEditingBudgetId(adSet.id);
                              setEditBudgetAmount((Number(adSet.daily_budget || 0) / 100).toString());
                            }}
                          >
                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
                              Number(adSet.daily_budget) / 100,
                            )}{' '}
                            Daily
                          </Button>
                        )}
                      </Td>
                      <Td>{getRoas(adSet.insights) > 0 ? `${getRoas(adSet.insights).toFixed(2)}x` : '-'}</Td>
                      <Td>
                        <Badge tone="neutral" kind="outline">
                          {adSet.optimization_goal}
                        </Badge>
                      </Td>
                      <Td>{adSet.insights?.clicks || 0} Clicks</Td>
                      <Td>{adSet.insights?.clicks > 0 ? `₹${getCpa(adSet.insights).toFixed(2)}` : '-'}</Td>
                      <Td>
                        <Link href={`/dashboard/ad-manager/ad-sets/${adSet.id}`}>
                          <Button variant="ghost" size="sm" iconRight={ChevronRight}>
                            Ads
                          </Button>
                        </Link>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan={8}>
                      <EmptyState
                        icon={Layers}
                        title="No ad sets found"
                        description="No ad sets match the current filter criteria."
                      />
                    </Td>
                  </Tr>
                )}
              </TBody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

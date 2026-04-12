'use client';

import * as React from 'react';
import Link from 'next/link';
import {
    TrendingUp, TrendingDown, MousePointerClick, Eye, DollarSign, Users,
    Plus, ChevronRight, Megaphone,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdManager } from '@/context/ad-manager-context';
import { useAdManagerShell } from '@/components/wabasimplify/ad-manager/ad-manager-shell';
import { getInsights, listCampaigns } from '@/app/actions/ad-manager.actions';
import { formatMoney, formatNumber, formatPercent } from '@/components/wabasimplify/ad-manager/constants';

type Kpi = {
    id: string;
    label: string;
    value: string;
    delta?: string;
    deltaDir?: 'up' | 'down';
    icon: React.ComponentType<{ className?: string }>;
};

export default function AdManagerOverviewPage() {
    const { activeAccount } = useAdManager();
    const { preset } = useAdManagerShell();

    const [loading, setLoading] = React.useState(true);
    const [kpis, setKpis] = React.useState<Kpi[]>([]);
    const [topCampaigns, setTopCampaigns] = React.useState<any[]>([]);

    React.useEffect(() => {
        if (!activeAccount) {
            setLoading(false);
            return;
        }
        setLoading(true);
        (async () => {
            const actId = `act_${activeAccount.account_id.replace(/^act_/, '')}`;
            const [insightsRes, campaignsRes] = await Promise.all([
                getInsights(actId, {
                    level: 'account',
                    date_preset: preset && preset !== 'custom' ? preset : 'last_7d',
                }),
                listCampaigns(activeAccount.account_id),
            ]);

            const agg = insightsRes.data?.[0] || {};
            setKpis([
                {
                    id: 'spend',
                    label: 'Amount spent',
                    value: formatMoney(agg.spend || 0),
                    icon: DollarSign,
                },
                {
                    id: 'impressions',
                    label: 'Impressions',
                    value: formatNumber(agg.impressions || 0),
                    icon: Eye,
                },
                {
                    id: 'reach',
                    label: 'Reach',
                    value: formatNumber(agg.reach || 0),
                    icon: Users,
                },
                {
                    id: 'clicks',
                    label: 'Link clicks',
                    value: formatNumber(agg.inline_link_clicks || agg.clicks || 0),
                    icon: MousePointerClick,
                },
                {
                    id: 'ctr',
                    label: 'CTR',
                    value: formatPercent(agg.ctr || 0),
                    icon: TrendingUp,
                },
                {
                    id: 'cpc',
                    label: 'CPC',
                    value: formatMoney(agg.cpc || 0),
                    icon: TrendingDown,
                },
            ]);

            setTopCampaigns((campaignsRes.data || []).slice(0, 5));
            setLoading(false);
        })();
    }, [activeAccount, preset]);

    if (!activeAccount) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4">
                <Megaphone className="h-16 w-16 text-muted-foreground" />
                <div>
                    <h2 className="text-xl font-semibold">Welcome to Ads Manager</h2>
                    <p className="text-muted-foreground mt-1 max-w-md">
                        Connect your Meta ad account to start creating, managing and measuring ads.
                    </p>
                </div>
                <Button asChild className="bg-[#1877F2] hover:bg-[#1877F2]/90">
                    <Link href="/dashboard/ad-manager/ad-accounts">Connect ad account</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Performance overview</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Account {activeAccount.name} • last {preset?.replace(/_/g, ' ')}
                    </p>
                </div>
                <Button asChild className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
                    <Link href="/dashboard/ad-manager/create">
                        <Plus className="h-4 w-4 mr-1" /> Create campaign
                    </Link>
                </Button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {loading
                    ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
                    : kpis.map((kpi) => {
                          const Icon = kpi.icon;
                          return (
                              <Card key={kpi.id} className="p-0 overflow-hidden">
                                  <CardContent className="p-4">
                                      <div className="flex items-center justify-between">
                                          <Icon className="h-4 w-4 text-muted-foreground" />
                                          {kpi.delta && (
                                              <span
                                                  className={`text-xs font-medium ${
                                                      kpi.deltaDir === 'up' ? 'text-green-600' : 'text-red-600'
                                                  }`}
                                              >
                                                  {kpi.delta}
                                              </span>
                                          )}
                                      </div>
                                      <div className="mt-2">
                                          <div className="text-xs text-muted-foreground">{kpi.label}</div>
                                          <div className="text-2xl font-bold tabular-nums mt-0.5">{kpi.value}</div>
                                      </div>
                                  </CardContent>
                              </Card>
                          );
                      })}
            </div>

            {/* Top campaigns */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base">Top campaigns</CardTitle>
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/dashboard/ad-manager/campaigns">
                            View all <ChevronRight className="h-4 w-4 ml-1" />
                        </Link>
                    </Button>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : topCampaigns.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-8 text-center">
                            No campaigns yet. Click "Create campaign" to get started.
                        </div>
                    ) : (
                        <div className="divide-y">
                            {topCampaigns.map((c) => (
                                <div key={c.id} className="flex items-center justify-between py-2.5">
                                    <div className="min-w-0">
                                        <Link
                                            href={`/dashboard/ad-manager/campaigns/${c.id}`}
                                            className="font-medium text-sm text-[#1877F2] hover:underline truncate block"
                                        >
                                            {c.name}
                                        </Link>
                                        <div className="text-xs text-muted-foreground">
                                            {c.objective} • {c.effective_status}
                                        </div>
                                    </div>
                                    <div className="text-right text-sm">
                                        <div className="tabular-nums">{formatMoney((c.daily_budget || 0) / 100)}</div>
                                        <div className="text-xs text-muted-foreground">Daily budget</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

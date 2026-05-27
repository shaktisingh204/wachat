'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruEmptyState,
  Skeleton,
  cn,
} from '@/components/zoruui';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  MessagesSquare,
  Plus,
  RefreshCw,
  Send,
  Users,
  MessageCircle,
  Eye,
  CheckCheck,
  CircleX,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

import { useProject } from '@/context/project-context';
import { getDashboardStats } from '@/app/actions/dashboard.actions';

function compact(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
}

function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10;
}

export default function GlobalWachatDashboardPage() {
  const router = useRouter();
  const { projects, setActiveProjectId } = useProject();
  
  const wachatProjects = useMemo(() => projects.filter(p => !!p.wabaId), [projects]);

  const [statsMap, setStatsMap] = useState<Record<string, any>>({});
  const [loading, startTransition] = useTransition();

  const loadAllStats = () => {
    startTransition(async () => {
      const results: Record<string, any> = {};
      await Promise.all(
        wachatProjects.map(async (p) => {
          try {
            const s = await getDashboardStats(p._id.toString());
            results[p._id.toString()] = s;
          } catch {
            results[p._id.toString()] = null;
          }
        })
      );
      setStatsMap(results);
    });
  };

  useEffect(() => {
    if (wachatProjects.length > 0) {
      loadAllStats();
    }
  }, [wachatProjects]);

  const globalStats = useMemo(() => {
    let totalMessages = 0;
    let totalSent = 0;
    let totalFailed = 0;
    let totalDelivered = 0;
    let totalRead = 0;
    let totalCampaigns = 0;
    
    Object.values(statsMap).forEach((s) => {
      if (s) {
        totalMessages += s.totalMessages || 0;
        totalSent += s.totalSent || 0;
        totalFailed += s.totalFailed || 0;
        totalDelivered += s.totalDelivered || 0;
        totalRead += s.totalRead || 0;
        totalCampaigns += s.totalCampaigns || 0;
      }
    });

    return {
      totalMessages,
      totalSent,
      totalFailed,
      totalDelivered,
      totalRead,
      totalCampaigns,
      deliveryRate: pct(totalDelivered, totalSent),
      readRate: pct(totalRead, totalDelivered),
      failRate: pct(totalFailed, totalMessages),
    };
  }, [statsMap]);

  if (wachatProjects.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10 flex flex-col gap-6">
        <Breadcrumb>
          <ZoruBreadcrumbList>
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbPage>WhatsApp Overview</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </Breadcrumb>

        <ZoruEmptyState
          icon={<MessageCircle className="h-10 w-10 text-zoru-ink" />}
          title="Welcome to WhatsApp Chat"
          description="You haven't connected any WhatsApp Business Accounts yet. Connect your first account to unlock messaging, automation, and live chat."
          action={
            <Link href="/wachat/setup">
              <Button size="md" className="bg-zoru-ink hover:bg-zoru-ink text-white">
                <Plus className="mr-2" />
                Connect WhatsApp Account
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10 flex flex-col gap-6">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>WhatsApp Overview</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] tracking-tight leading-none text-zoru-ink">
            Global WhatsApp Overview
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            Aggregated statistics across your {wachatProjects.length} connected WhatsApp accounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAllStats}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh Data
          </Button>
          <Link href="/wachat">
            <Button size="sm">
              <MessagesSquare className="h-3.5 w-3.5" />
              Open Wachat App
            </Button>
          </Link>
        </div>
      </div>

      {loading && Object.keys(statsMap).length === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[118px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Kpi
            icon={<Send className="h-4 w-4" />}
            label="Total Messages Sent"
            value={compact(globalStats.totalSent)}
            hint={`${compact(globalStats.totalMessages)} overall total`}
          />
          <Kpi
            icon={<CheckCheck className="h-4 w-4" />}
            label="Avg Delivery Rate"
            value={`${globalStats.deliveryRate}%`}
            hint={`${compact(globalStats.totalDelivered)} delivered globally`}
          />
          <Kpi
            icon={<Eye className="h-4 w-4" />}
            label="Avg Read Rate"
            value={`${globalStats.readRate}%`}
            hint={`${compact(globalStats.totalRead)} read globally`}
          />
          <Kpi
            icon={<CircleX className="h-4 w-4" />}
            label="Total Failed"
            value={compact(globalStats.totalFailed)}
            hint={`${globalStats.failRate}% global fail rate`}
          />
        </div>
      )}

      <div className="mt-4">
        <h2 className="text-lg font-medium text-zoru-ink mb-4">Your WhatsApp Projects</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wachatProjects.map((p) => {
            const s = statsMap[p._id.toString()];
            const sent = s?.totalSent || 0;
            const deliv = s?.totalDelivered || 0;
            return (
              <Card key={p._id.toString()} className="p-5 flex flex-col gap-4 transition hover:border-zoru-line">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-zoru-ink">{p.name || 'Untitled project'}</h3>
                    <p className="text-xs text-zoru-ink-muted mt-0.5">
                      {p.phoneNumbers?.[0]?.display_phone_number || p.wabaId}
                    </p>
                  </div>
                  <Button 
                    size="icon-sm" 
                    variant="outline"
                    onClick={() => {
                      setActiveProjectId(p._id.toString());
                      router.push('/wachat/overview');
                    }}
                  >
                    <TrendingUp className="h-3.5 w-3.5 text-zoru-ink" />
                  </Button>
                </div>
                
                {s ? (
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-zoru-line">
                    <div>
                      <span className="text-zoru-ink-muted block">Sent</span>
                      <span className="font-medium text-zoru-ink">{compact(sent)}</span>
                    </div>
                    <div>
                      <span className="text-zoru-ink-muted block">Delivered</span>
                      <span className="font-medium text-zoru-ink">{compact(deliv)} ({pct(deliv, sent)}%)</span>
                    </div>
                  </div>
                ) : loading ? (
                  <div className="space-y-2 pt-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ) : (
                  <div className="text-xs text-zoru-ink-muted pt-2 border-t border-zoru-line">
                    No stats available
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4 transition-shadow hover:shadow-[var(--zoru-shadow-sm)]">
      <div className="flex items-start justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink">
          {icon}
        </span>
      </div>
      <div className="mt-3.5 text-[11.5px] leading-none text-zoru-ink-muted">{label}</div>
      <div className="mt-1.5 text-[22px] tracking-[-0.01em] leading-none text-zoru-ink">{value}</div>
      {hint && (
        <div className="mt-1 truncate text-[11px] leading-tight text-zoru-ink-muted">{hint}</div>
      )}
    </Card>
  );
}

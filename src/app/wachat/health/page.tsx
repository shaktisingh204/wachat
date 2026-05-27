'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  Activity,
  AppWindow,
  Ban,
  Building2,
  Circle,
  CircleCheck,
  Lock,
  Phone,
  RefreshCw,
  Shield,
  Smartphone,
  TriangleAlert,
  ExternalLink,
  Info,
  TrendingDown,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import {
  getWabaHealthStatus,
  getPhoneNumberHealthStatus,
  handleSetTwoStepVerificationPin,
  getCommerceSettings,
} from '@/app/actions/whatsapp.actions';
import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
  StatusPill,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import {
  useZoruToast,
  Input,
  ZoruChart,
  ZoruChartContainer,
  Tooltip,
  ZoruTooltipContent,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
} from '@/components/zoruui';

/**
 * Wachat Account Health - WABA + phone number health monitoring,
 * rebuilt on wachat-ui chrome.
 */

type PhoneHealth = {
  phoneNumberId: string;
  displayName: string;
  displayNumber: string;
  healthStatus?: any;
  messagingLimitTier?: string;
  nameStatus?: string;
  qualityRating?: string;
  commerceSettings?: any;
};

type StatusColor = 'green' | 'amber' | 'red' | 'muted';

function statusColor(status?: string): StatusColor {
  if (!status) return 'muted';
  const s = status.toLowerCase();
  if (s === 'available' || s === 'connected' || s === 'green' || s === 'high') return 'green';
  if (s === 'yellow' || s === 'medium' || s === 'limited' || s === 'flagged') return 'amber';
  return 'red';
}

function colorToTone(color: StatusColor): StatusTone {
  if (color === 'green') return 'sent';
  if (color === 'amber') return 'queued';
  if (color === 'red') return 'failed';
  return 'draft';
}

function entityIcon(type?: string): LucideIcon {
  switch (type?.toUpperCase()) {
    case 'WABA':
      return Smartphone;
    case 'BUSINESS':
      return Building2;
    case 'APP':
      return AppWindow;
    case 'PHONE_NUMBER':
      return Phone;
    default:
      return Circle;
  }
}

function categorizeError(err: any) {
  const desc = (err.error_description || err.message || '').toLowerCase();
  if (desc.includes('policy') || desc.includes('violation'))
    return { type: 'Policy violation', tone: 'red' as StatusColor };
  if (desc.includes('limit') || desc.includes('rate'))
    return { type: 'Rate limit', tone: 'amber' as StatusColor };
  if (desc.includes('payment') || desc.includes('billing'))
    return { type: 'Billing issue', tone: 'red' as StatusColor };
  if (desc.includes('quality') || desc.includes('spam'))
    return { type: 'Quality drop', tone: 'amber' as StatusColor };
  return { type: 'System error', tone: 'muted' as StatusColor };
}

const MOCK_QUALITY_HISTORY = [
  { date: 'Oct 01', value: 3, rating: 'High', event: null as string | null },
  { date: 'Oct 05', value: 3, rating: 'High', event: null },
  { date: 'Oct 10', value: 2, rating: 'Medium', event: 'Diwali promo (spam reports up)' },
  { date: 'Oct 15', value: 1, rating: 'Low', event: 'Mass broadcast (high block rate)' },
  { date: 'Oct 20', value: 2, rating: 'Medium', event: null },
  { date: 'Oct 25', value: 3, rating: 'High', event: null },
];

const yAxisFormatter = (val: number) => {
  if (val === 3) return 'High';
  if (val === 2) return 'Medium';
  if (val === 1) return 'Low';
  return '';
};

export default function HealthPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const reduceMotion = useReducedMotion();
  const [isPending, startTransition] = useTransition();
  const [wabaHealth, setWabaHealth] = useState<any>(null);
  const [phoneHealths, setPhoneHealths] = useState<PhoneHealth[]>([]);
  const [pinInput, setPinInput] = useState('');
  const [pinPhoneId, setPinPhoneId] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  useEffect(() => {
    document.title = 'Account health · Wachat';
  }, []);

  const fetchHealth = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const wabaResult = await getWabaHealthStatus(activeProject._id.toString());
      if (!wabaResult.error) {
        setWabaHealth(wabaResult.healthStatus);
      }

      const phones = activeProject.phoneNumbers || [];
      if (phones.length > 0) {
        const healthResults = await Promise.all(
          phones.map(async (phone: any) => {
            const [healthResult, commerceResult] = await Promise.all([
              getPhoneNumberHealthStatus(activeProject._id.toString(), phone.id),
              getCommerceSettings(activeProject._id.toString(), phone.id),
            ]);
            return {
              phoneNumberId: phone.id,
              displayName: phone.verified_name || 'Unknown',
              displayNumber: phone.display_phone_number || phone.id,
              healthStatus: healthResult.healthStatus,
              messagingLimitTier: healthResult.messagingLimitTier,
              nameStatus: healthResult.nameStatus,
              qualityRating: phone.quality_rating,
              commerceSettings: commerceResult.settings,
            };
          }),
        );
        setPhoneHealths(healthResults);
      }

      setLastSyncAt(new Date());
    });
  }, [activeProject?._id, activeProject?.phoneNumbers]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleSetPin = (phoneNumberId: string) => {
    if (!activeProject?._id || !pinInput || pinInput.length !== 6) {
      toast({ title: 'Error', description: 'PIN must be exactly 6 digits.', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const result = await handleSetTwoStepVerificationPin(
        activeProject._id.toString(),
        phoneNumberId,
        pinInput,
      );
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: result.message });
        setPinPhoneId(null);
        setPinInput('');
      }
    });
  };

  const overallStatus = wabaHealth?.can_send_message;
  const entities: any[] = wabaHealth?.entities || [];
  const overallColor = statusColor(overallStatus);

  // Aggregate health summary across entities and phones
  const summary = useMemo(() => {
    const allErrors = entities.flatMap((e: any) => (e.errors || []) as any[]);
    const totalErrors = allErrors.length;
    const greenPhones = phoneHealths.filter(
      (p) => statusColor(p.qualityRating) === 'green',
    ).length;
    const amberPhones = phoneHealths.filter(
      (p) => statusColor(p.qualityRating) === 'amber',
    ).length;
    const redPhones = phoneHealths.filter((p) => statusColor(p.qualityRating) === 'red').length;
    return {
      totalErrors,
      greenPhones,
      amberPhones,
      redPhones,
      totalPhones: phoneHealths.length,
      allErrors,
    };
  }, [entities, phoneHealths]);

  // Error type breakdown
  const errorTypeBreakdown = useMemo(() => {
    const map = new Map<string, { type: string; tone: StatusColor; count: number }>();
    summary.allErrors.forEach((err: any) => {
      const cat = categorizeError(err);
      const cur = map.get(cat.type) || { ...cat, count: 0 };
      cur.count += 1;
      map.set(cat.type, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [summary.allErrors]);

  const errorMax = Math.max(1, ...errorTypeBreakdown.map((e) => e.count));

  // Recovery suggestions
  const recoverySuggestions = useMemo(() => {
    const out: { label: string; suggestion: string }[] = [];
    if (errorTypeBreakdown.some((e) => e.type === 'Policy violation')) {
      out.push({
        label: 'Policy violation flagged',
        suggestion: 'Pause broadcasts and review WhatsApp Business policy for the affected number.',
      });
    }
    if (errorTypeBreakdown.some((e) => e.type === 'Quality drop')) {
      out.push({
        label: 'Quality dropping',
        suggestion: 'Slow down opt-in/promotional sends and warm up traffic gradually.',
      });
    }
    if (errorTypeBreakdown.some((e) => e.type === 'Billing issue')) {
      out.push({
        label: 'Billing blocked',
        suggestion: 'Update payment method in Meta Business Manager to resume messaging.',
      });
    }
    if (errorTypeBreakdown.some((e) => e.type === 'Rate limit')) {
      out.push({
        label: 'Rate-limited',
        suggestion: 'Reduce concurrent broadcast volume or request a higher messaging tier.',
      });
    }
    if (summary.redPhones > 0) {
      out.push({
        label: `${summary.redPhones} phone number(s) flagged`,
        suggestion: 'Re-verify display name and reduce spam reports to recover quality.',
      });
    }
    return out;
  }, [errorTypeBreakdown, summary.redPhones]);

  return (
    <WaPage>
      <PageHeader
        title="Account health"
        kicker="Health"
        description="Monitor WABA status, resolve messaging blockers, and manage phone quality."
        eyebrowIcon={Activity}
        actions={
          <>
            {lastSyncAt && (
              <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Synced {Math.max(0, Math.round((Date.now() - lastSyncAt.getTime()) / 1000))}s ago
              </span>
            )}
            <WaButton size="sm" variant="outline" onClick={fetchHealth} disabled={isPending} leftIcon={RefreshCw}>
              Refresh
            </WaButton>
          </>
        }
      />

      {/* Alert banner */}
      {overallColor !== 'muted' && overallColor !== 'green' && (
        <div
          className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${
            overallColor === 'red'
              ? 'border-rose-200 bg-rose-50'
              : 'border-amber-200 bg-amber-50'
          }`}
        >
          {overallColor === 'red' ? (
            <Ban className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" strokeWidth={2} />
          ) : (
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} />
          )}
          <div>
            <p className={`text-[13px] font-semibold ${overallColor === 'red' ? 'text-rose-900' : 'text-amber-900'}`}>
              {overallColor === 'red' ? 'Messaging disabled' : 'Account warning'}
            </p>
            <p className={`mt-0.5 text-[12px] leading-relaxed ${overallColor === 'red' ? 'text-rose-700' : 'text-amber-700'}`}>
              {overallColor === 'red'
                ? 'Your WhatsApp Business Account cannot send messages right now. Resolve the critical errors below.'
                : 'Your account is facing warnings that could lead to messaging restrictions.'}
            </p>
          </div>
        </div>
      )}

      {/* 6-tile health KPI strip */}
      {wabaHealth && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <MetricTile
            label="Messaging"
            value={overallStatus || '--'}
            delta={
              overallColor === 'green'
                ? { value: 'Healthy', positive: true }
                : overallColor === 'red'
                ? { value: 'Blocked', positive: false }
                : overallColor === 'amber'
                ? { value: 'Warning', positive: false }
                : undefined
            }
            icon={Activity}
            delay={reduceMotion ? 0 : 0.02}
          />
          <MetricTile
            label="Entities"
            value={entities.length.toLocaleString()}
            icon={Building2}
            delay={reduceMotion ? 0 : 0.04}
          />
          <MetricTile
            label="Phone numbers"
            value={summary.totalPhones.toLocaleString()}
            icon={Phone}
            delay={reduceMotion ? 0 : 0.06}
          />
          <MetricTile
            label="Healthy phones"
            value={`${summary.greenPhones}/${summary.totalPhones || 0}`}
            delta={
              summary.totalPhones > 0
                ? {
                    value: `${Math.round((summary.greenPhones / Math.max(1, summary.totalPhones)) * 100)}%`,
                    positive: summary.greenPhones === summary.totalPhones,
                  }
                : undefined
            }
            icon={CircleCheck}
            delay={reduceMotion ? 0 : 0.08}
          />
          <MetricTile
            label="Warnings"
            value={summary.amberPhones.toLocaleString()}
            delta={
              summary.amberPhones > 0
                ? { value: 'Watch', positive: false }
                : undefined
            }
            icon={TriangleAlert}
            delay={reduceMotion ? 0 : 0.1}
          />
          <MetricTile
            label="Active errors"
            value={summary.totalErrors.toLocaleString()}
            delta={
              summary.totalErrors > 0
                ? { value: 'Resolve', positive: false }
                : { value: 'Clean', positive: true }
            }
            icon={Shield}
            delay={reduceMotion ? 0 : 0.12}
          />
        </div>
      )}

      {/* Recovery suggestions */}
      {recoverySuggestions.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {recoverySuggestions.map((s, i) => (
            <m.div
              key={s.label}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.04, ease: EASE_OUT }}
              className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3"
            >
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={2.25} aria-hidden />
              <div>
                <p className="text-[12.5px] font-semibold text-amber-900">{s.label}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-amber-800">{s.suggestion}</p>
              </div>
            </m.div>
          ))}
        </div>
      )}

      {/* Error taxonomy breakdown */}
      {errorTypeBreakdown.length > 0 && (
        <div className="mb-4">
          <Section title="Error taxonomy" description="Active issues grouped by category">
            <ul className="space-y-2">
              {errorTypeBreakdown.map((e) => {
                const width = (e.count / errorMax) * 100;
                const color =
                  e.tone === 'red' ? '#f43f5e' : e.tone === 'amber' ? '#f59e0b' : '#a1a1aa';
                return (
                  <li key={e.type} className="flex items-center gap-2.5">
                    <span className="w-32 text-[12px] font-medium text-zinc-900">{e.type}</span>
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <m.div
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.4, ease: EASE_OUT }}
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ background: color }}
                      />
                    </div>
                    <span className="w-8 text-right text-[12px] font-semibold tabular-nums text-zinc-900">
                      {e.count}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>
      )}

      {/* Overall messaging status card */}
      {wabaHealth && (
        <div className="mb-4 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center gap-4 border-b border-zinc-100 bg-zinc-50/60 px-5 py-4">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                overallColor === 'green'
                  ? 'bg-emerald-100 text-emerald-600'
                  : overallColor === 'amber'
                  ? 'bg-amber-100 text-amber-600'
                  : overallColor === 'red'
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-zinc-100 text-zinc-500'
              }`}
            >
              {overallColor === 'green' ? (
                <CircleCheck className="h-5 w-5" />
              ) : overallColor === 'amber' ? (
                <TriangleAlert className="h-5 w-5" />
              ) : overallColor === 'red' ? (
                <Ban className="h-5 w-5" />
              ) : (
                <Activity className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[14px] font-semibold text-zinc-900">Messaging status</h2>
                <StatusPill tone={colorToTone(overallColor)}>{overallStatus || 'unknown'}</StatusPill>
              </div>
              <p className="mt-0.5 text-[12px] text-zinc-500">
                {overallColor === 'green'
                  ? 'Your account is healthy. Business-initiated and user-initiated messages can send.'
                  : overallColor === 'amber'
                  ? 'Some features may be limited. Maintain message quality to avoid drops.'
                  : overallStatus
                  ? 'Issues are blocking messaging. Review the details below.'
                  : 'Unable to determine messaging status.'}
              </p>
            </div>
          </div>

          {entities.length > 0 && (
            <div className="divide-y divide-zinc-100">
              {entities.map((entity: any, i: number) => {
                const errors: any[] = entity.errors || [];
                const eColor = statusColor(entity.can_send_message);
                const EIcon = entityIcon(entity.entity_type);
                return (
                  <div key={i} className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-lg ${
                          eColor === 'green'
                            ? 'bg-emerald-100 text-emerald-600'
                            : eColor === 'amber'
                            ? 'bg-amber-100 text-amber-600'
                            : eColor === 'red'
                            ? 'bg-rose-100 text-rose-600'
                            : 'bg-zinc-100 text-zinc-500'
                        }`}
                      >
                        <EIcon className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-zinc-900">{entity.entity_type}</span>
                          <StatusPill tone={colorToTone(eColor)}>{entity.can_send_message || 'unknown'}</StatusPill>
                          {errors.length > 0 && (
                            <StatusPill tone="failed">{errors.length} errors</StatusPill>
                          )}
                        </div>
                        <p className="font-mono text-[11px] text-zinc-500">{entity.id}</p>
                      </div>
                    </div>

                    {errors.length > 0 && (
                      <div className="ml-11 mt-2.5 space-y-2">
                        {errors.map((err: any, j: number) => {
                          const errMeta = categorizeError(err);
                          return (
                            <div
                              key={j}
                              className={`flex flex-col gap-2 rounded-lg border px-3 py-2 ${
                                errMeta.tone === 'red'
                                  ? 'border-rose-200 bg-rose-50/60'
                                  : errMeta.tone === 'amber'
                                  ? 'border-amber-200 bg-amber-50/60'
                                  : 'border-zinc-200 bg-zinc-50'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {errMeta.tone === 'red' ? (
                                  <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" strokeWidth={2} />
                                ) : (
                                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" strokeWidth={2} />
                                )}
                                <div className="min-w-0 flex-1">
                                  <span
                                    className={`mb-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                      errMeta.tone === 'red'
                                        ? 'bg-rose-100 text-rose-700'
                                        : errMeta.tone === 'amber'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-zinc-100 text-zinc-700'
                                    }`}
                                  >
                                    {errMeta.type}
                                  </span>
                                  <p
                                    className={`text-[12.5px] font-medium ${
                                      errMeta.tone === 'red' ? 'text-rose-800' : 'text-amber-800'
                                    }`}
                                  >
                                    {err.error_description || err.message || 'Unknown error'}
                                  </p>
                                  {err.possible_solution && (
                                    <p className="mt-1 text-[11.5px] text-zinc-600">{err.possible_solution}</p>
                                  )}
                                </div>
                              </div>
                              <div className="ml-5">
                                <WaButton
                                  size="sm"
                                  variant="outline"
                                  href="https://business.facebook.com/wa/manage/phone-numbers"
                                  leftIcon={ExternalLink}
                                >
                                  File dispute
                                </WaButton>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Phone numbers */}
      {phoneHealths.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Phone numbers
            </h2>
            <div className="inline-flex items-center gap-2 text-[11px] text-zinc-500">
              <StatusPill tone="sent">{summary.greenPhones} healthy</StatusPill>
              {summary.amberPhones > 0 && (
                <StatusPill tone="queued">{summary.amberPhones} warning</StatusPill>
              )}
              {summary.redPhones > 0 && (
                <StatusPill tone="failed">{summary.redPhones} flagged</StatusPill>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {phoneHealths.map((phone) => (
              <Section key={phone.phoneNumberId}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-100 text-zinc-700">
                    <Phone className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-zinc-900">{phone.displayName}</p>
                    <p className="font-mono text-[11px] text-zinc-500">{phone.displayNumber}</p>
                  </div>
                  <StatusPill tone={colorToTone(statusColor(phone.qualityRating))}>
                    {phone.qualityRating?.toLowerCase() === 'green' ? 'Healthy' : phone.qualityRating || 'Unknown'}
                  </StatusPill>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-zinc-50 px-3 py-2">
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Messaging tier
                    </p>
                    <p className="text-[12.5px] font-medium text-zinc-900">{phone.messagingLimitTier || 'Unknown'}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-3 py-2">
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Name status
                    </p>
                    <p className="text-[12.5px] font-medium capitalize text-zinc-900">
                      {(phone.nameStatus || 'Unknown').replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>

                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[12px] font-semibold text-zinc-900">Quality history</h3>
                    <ZoruTooltipProvider>
                      <Tooltip>
                        <ZoruTooltipTrigger asChild>
                          <button
                            type="button"
                            className="grid h-6 w-6 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                            aria-label="More info"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </ZoruTooltipTrigger>
                        <ZoruTooltipContent>
                          <p className="max-w-[220px] text-[11.5px]">
                            Track quality rating over time to see if campaigns caused drops.
                          </p>
                        </ZoruTooltipContent>
                      </Tooltip>
                    </ZoruTooltipProvider>
                  </div>

                  <ZoruChartContainer height={120}>
                    <ZoruChart.LineChart
                      data={MOCK_QUALITY_HISTORY}
                      margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                    >
                      <ZoruChart.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                      <ZoruChart.XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#71717a', fontSize: 10 }}
                        dy={5}
                      />
                      <ZoruChart.YAxis
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={yAxisFormatter}
                        tick={{ fill: '#71717a', fontSize: 10 }}
                        domain={[1, 3]}
                        ticks={[1, 2, 3]}
                      />
                      <ZoruChart.Tooltip
                        content={({ active, payload, label }: any) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-[11.5px] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.12)]">
                              <p className="mb-1 font-semibold text-zinc-900">{label}</p>
                              <div className="flex items-center gap-2 text-zinc-600">
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    data.value === 3
                                      ? 'bg-emerald-500'
                                      : data.value === 2
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                  }`}
                                />
                                <span>Rating:</span>
                                <span className="font-medium text-zinc-900">{data.rating}</span>
                              </div>
                              {data.event && (
                                <div className="mt-1 flex items-start gap-1.5 border-t border-zinc-100 pt-1 text-[10px] text-amber-700">
                                  <TrendingDown className="mt-0.5 h-3 w-3 shrink-0" />
                                  <span className="max-w-[160px] leading-tight">{data.event}</span>
                                </div>
                              )}
                            </div>
                          );
                        }}
                      />
                      <ZoruChart.Line
                        type="monotone"
                        dataKey="value"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 5 }}
                      />
                    </ZoruChart.LineChart>
                  </ZoruChartContainer>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
                  <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                    {phone.commerceSettings && (
                      <>
                        <StatusPill
                          tone={phone.commerceSettings.is_cart_enabled ? 'sent' : 'paused'}
                        >
                          Cart {phone.commerceSettings.is_cart_enabled ? 'on' : 'off'}
                        </StatusPill>
                        <StatusPill
                          tone={phone.commerceSettings.is_catalog_visible ? 'sent' : 'paused'}
                        >
                          Catalog {phone.commerceSettings.is_catalog_visible ? 'on' : 'off'}
                        </StatusPill>
                      </>
                    )}
                  </div>

                  {pinPhoneId === phone.phoneNumberId ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="text"
                        value={pinInput}
                        onChange={(e) =>
                          setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="PIN"
                        maxLength={6}
                        className="h-7 w-16 px-1.5 text-center font-mono text-[11px]"
                      />
                      <WaButton
                        size="sm"
                        onClick={() => handleSetPin(phone.phoneNumberId)}
                        disabled={isPending || pinInput.length !== 6}
                      >
                        Set
                      </WaButton>
                      <WaButton
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPinPhoneId(null);
                          setPinInput('');
                        }}
                      >
                        Cancel
                      </WaButton>
                    </div>
                  ) : (
                    <WaButton
                      size="sm"
                      variant="ghost"
                      onClick={() => setPinPhoneId(phone.phoneNumberId)}
                      leftIcon={Lock}
                    >
                      2FA PIN
                    </WaButton>
                  )}
                </div>
              </Section>
            ))}
          </div>
        </div>
      )}

      {isPending && !wabaHealth && (
        <EmptyState icon={RefreshCw} title="Loading account health" description="One moment." />
      )}

      {!isPending && !wabaHealth && !activeProject?._id && (
        <EmptyState
          icon={Activity}
          title="No project selected"
          description="Pick a project to view its account health."
        />
      )}
    </WaPage>
  );
}

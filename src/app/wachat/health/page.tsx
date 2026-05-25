'use client';

import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  Input,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  cn,
  useZoruToast,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  Tooltip,
  ZoruTooltipContent,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import {
  Activity,
  AppWindow,
  Ban,
  Building2,
  CircleAlert,
  CircleCheck,
  Circle,
  Lock,
  Phone,
  RefreshCw,
  Smartphone,
  TriangleAlert,
  ExternalLink,
  Info,
  TrendingDown,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getWabaHealthStatus,
  getPhoneNumberHealthStatus,
  handleSetTwoStepVerificationPin,
  getCommerceSettings,
  } from '@/app/actions/whatsapp.actions';

/**
 * Wachat Account Health — WABA and phone number health monitoring.
 */

import * as React from 'react';

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

function statusColor(status?: string): 'green' | 'amber' | 'red' | 'muted' {
  if (!status) return 'muted';
  const s = status.toLowerCase();
  if (s === 'available' || s === 'connected' || s === 'green' || s === 'high') return 'green';
  if (s === 'yellow' || s === 'medium' || s === 'limited' || s === 'flagged') return 'amber';
  return 'red';
}

function StatusPill({ status, label }: { status?: string; label?: string }) {
  const color = statusColor(status);
  const text = label || status || 'Unknown';
  const variant: 'success' | 'warning' | 'danger' | 'ghost' =
    color === 'green'
      ? 'success'
      : color === 'amber'
        ? 'warning'
        : color === 'red'
          ? 'danger'
          : 'ghost';
  return (
    <Badge variant={variant} className="text-[10px] uppercase tracking-wider">
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          color === 'green' && 'bg-zoru-success',
          color === 'amber' && 'bg-zoru-warning',
          color === 'red' && 'bg-zoru-danger',
          color === 'muted' && 'bg-zoru-ink-muted',
        )}
      />
      {text}
    </Badge>
  );
}

function entityIcon(type?: string) {
  const cls = 'h-4 w-4';
  switch (type?.toUpperCase()) {
    case 'WABA':
      return <Smartphone className={cls} />;
    case 'BUSINESS':
      return <Building2 className={cls} />;
    case 'APP':
      return <AppWindow className={cls} />;
    case 'PHONE_NUMBER':
      return <Phone className={cls} />;
    default:
      return <Circle className={cls} />;
  }
}

function categorizeError(err: any) {
  const desc = (err.error_description || err.message || '').toLowerCase();
  if (desc.includes('policy') || desc.includes('violation')) return { type: 'Policy Violation', variant: 'danger' as const };
  if (desc.includes('limit') || desc.includes('rate')) return { type: 'Rate Limit', variant: 'warning' as const };
  if (desc.includes('payment') || desc.includes('billing')) return { type: 'Billing Issue', variant: 'danger' as const };
  if (desc.includes('quality') || desc.includes('spam')) return { type: 'Quality Drop', variant: 'warning' as const };
  return { type: 'System Error', variant: 'ghost' as const };
}

const MOCK_QUALITY_HISTORY = [
  { date: 'Oct 01', value: 3, rating: 'High', event: null },
  { date: 'Oct 05', value: 3, rating: 'High', event: null },
  { date: 'Oct 10', value: 2, rating: 'Medium', event: 'Diwali Promo (Spam reports increased)' },
  { date: 'Oct 15', value: 1, rating: 'Low', event: 'Mass Broadcast (High block rate)' },
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
  const [isPending, startTransition] = useTransition();
  const [wabaHealth, setWabaHealth] = useState<any>(null);
  const [phoneHealths, setPhoneHealths] = useState<PhoneHealth[]>([]);
  const [pinInput, setPinInput] = useState('');
  const [pinPhoneId, setPinPhoneId] = useState<string | null>(null);

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

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Account health</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Account health</ZoruPageTitle>
            <ZoruPageDescription>
              Monitor your WABA status, resolve issues blocking messaging, and manage phone number
              quality.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
        <Button size="sm" variant="outline" onClick={fetchHealth} disabled={isPending}>
          <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Alerts/notifications when health drops */}
      {overallColor !== 'muted' && overallColor !== 'green' && (
        <Alert variant={overallColor === 'red' ? 'destructive' : 'warning'}>
          {overallColor === 'red' ? <Ban className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
          <ZoruAlertTitle>
            {overallColor === 'red' ? 'Messaging Disabled' : 'Account Warning'}
          </ZoruAlertTitle>
          <ZoruAlertDescription className="mt-1">
            {overallColor === 'red'
              ? 'Your WhatsApp Business Account is currently unable to send messages. Please resolve the critical errors below.'
              : 'Your account is facing warnings that could lead to messaging restrictions. Maintain high message quality to avoid further drops.'}
          </ZoruAlertDescription>
        </Alert>
      )}

      {/* Overall messaging status */}
      {wabaHealth && (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-4 border-b border-zoru-line bg-zoru-surface px-6 py-5">
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--zoru-radius-lg)]',
                overallColor === 'green' && 'bg-zoru-success/10 text-zoru-success-ink',
                overallColor === 'amber' && 'bg-zoru-warning/15 text-zoru-warning-ink',
                overallColor === 'red' && 'bg-zoru-danger/10 text-zoru-danger-ink',
                overallColor === 'muted' && 'bg-zoru-surface-2 text-zoru-ink-muted',
              )}
            >
              {overallColor === 'green' ? (
                <CircleCheck className="h-6 w-6" />
              ) : overallColor === 'amber' ? (
                <TriangleAlert className="h-6 w-6" />
              ) : overallColor === 'red' ? (
                <Ban className="h-6 w-6" />
              ) : (
                <Activity className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[16px] text-zoru-ink">Messaging status</h2>
                <StatusPill status={overallStatus} />
              </div>
              <p className="mt-0.5 text-xs text-zoru-ink-muted">
                {overallColor === 'green'
                  ? 'Your account is healthy. You can send business-initiated and user-initiated messages.'
                  : overallColor === 'amber'
                    ? 'Your account has warnings. Some features may be limited.'
                    : overallStatus
                      ? 'Your account has issues that are blocking messaging. Review the details below.'
                      : 'Unable to determine messaging status.'}
              </p>
            </div>
          </div>

          {entities.length > 0 && (
            <div className="divide-y divide-zoru-line">
              {entities.map((entity: any, i: number) => {
                const errors: any[] = entity.errors || [];
                const eColor = statusColor(entity.can_send_message);
                return (
                  <div key={i} className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)]',
                          eColor === 'green' && 'bg-zoru-success/10 text-zoru-success-ink',
                          eColor === 'amber' && 'bg-zoru-warning/15 text-zoru-warning-ink',
                          eColor === 'red' && 'bg-zoru-danger/10 text-zoru-danger-ink',
                          eColor === 'muted' && 'bg-zoru-surface-2 text-zoru-ink-muted',
                        )}
                      >
                        {entityIcon(entity.entity_type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-zoru-ink">{entity.entity_type}</span>
                          <StatusPill status={entity.can_send_message} />
                        </div>
                        <p className="font-mono text-[11px] text-zoru-ink-muted">{entity.id}</p>
                      </div>
                    </div>

                    {errors.length > 0 && (
                      <div className="ml-11 mt-3 space-y-2">
                        {errors.map((err: any, j: number) => {
                          const errMeta = categorizeError(err);
                          return (
                            <div
                              key={j}
                              className={cn(
                                "flex flex-col gap-2 rounded-[var(--zoru-radius-sm)] border px-3 py-2.5",
                                errMeta.variant === 'danger' ? "border-zoru-danger/30 bg-zoru-danger/5" :
                                errMeta.variant === 'warning' ? "border-zoru-warning/30 bg-zoru-warning/5" :
                                "border-zoru-line bg-zoru-surface-2"
                              )}
                            >
                              <div className="flex items-start gap-2">
                                {errMeta.variant === 'danger' ? (
                                  <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zoru-danger" />
                                ) : (
                                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zoru-warning" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="mb-1 flex items-center gap-2">
                                    <Badge variant={errMeta.variant} className="text-[9px] uppercase">
                                      {errMeta.type}
                                    </Badge>
                                  </div>
                                  <p className={cn(
                                    "text-xs font-medium",
                                    errMeta.variant === 'danger' ? "text-zoru-danger-ink" : "text-zoru-warning-ink"
                                  )}>
                                    {err.error_description || err.message || 'Unknown error'}
                                  </p>
                                  {err.possible_solution && (
                                    <p className="mt-1 text-[11px] text-zoru-ink-muted">
                                      {err.possible_solution}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="ml-5 flex items-center gap-2">
                                <Button size="sm" variant="outline" className="h-7 text-[11px]" asChild>
                                  <a href="https://business.facebook.com/wa/manage/phone-numbers" target="_blank" rel="noreferrer">
                                    <ExternalLink className="mr-1.5 h-3 w-3" />
                                    File Dispute
                                  </a>
                                </Button>
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
        </Card>
      )}

      {/* Phone numbers */}
      {phoneHealths.length > 0 && (
        <>
          <h2 className="text-sm text-zoru-ink">Phone numbers</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {phoneHealths.map((phone) => (
              <Card key={phone.phoneNumberId} className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zoru-ink">{phone.displayName}</p>
                    <p className="font-mono text-[11px] text-zoru-ink-muted">{phone.displayNumber}</p>
                  </div>
                  <StatusPill
                    status={phone.qualityRating}
                    label={
                      phone.qualityRating?.toLowerCase() === 'green' ? 'Healthy' : phone.qualityRating
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[var(--zoru-radius-sm)] bg-zoru-surface px-3 py-2.5">
                    <p className="mb-0.5 text-[10px] uppercase tracking-wider text-zoru-ink-muted">
                      Messaging tier
                    </p>
                    <p className="text-sm text-zoru-ink">{phone.messagingLimitTier || 'Unknown'}</p>
                  </div>
                  <div className="rounded-[var(--zoru-radius-sm)] bg-zoru-surface px-3 py-2.5">
                    <p className="mb-0.5 text-[10px] uppercase tracking-wider text-zoru-ink-muted">
                      Name status
                    </p>
                    <p className="text-sm capitalize text-zoru-ink">
                      {(phone.nameStatus || 'Unknown').replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-zoru-line pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[12px] font-medium text-zoru-ink">Quality History</h3>
                    <ZoruTooltipProvider>
                      <Tooltip>
                        <ZoruTooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Info className="h-3.5 w-3.5 text-zoru-ink-muted" />
                          </Button>
                        </ZoruTooltipTrigger>
                        <ZoruTooltipContent>
                          <p className="max-w-[200px] text-xs">
                            Track your quality rating over time to see if specific campaigns caused a drop in quality.
                          </p>
                        </ZoruTooltipContent>
                      </Tooltip>
                    </ZoruTooltipProvider>
                  </div>
                  
                  <ZoruChartContainer height={140}>
                    <ZoruChart.LineChart data={MOCK_QUALITY_HISTORY} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <ZoruChart.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--zoru-line))" />
                      <ZoruChart.XAxis 
                        dataKey="date" 
                        tickLine={false} 
                        axisLine={false} 
                        tick={{ fill: 'hsl(var(--zoru-ink-muted))', fontSize: 10 }} 
                        dy={5}
                      />
                      <ZoruChart.YAxis 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={yAxisFormatter}
                        tick={{ fill: 'hsl(var(--zoru-ink-muted))', fontSize: 10 }}
                        domain={[1, 3]}
                        ticks={[1, 2, 3]}
                      />
                      <ZoruChart.Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-bg px-2.5 py-1.5 text-xs shadow-[var(--zoru-shadow-sm)]">
                              <p className="mb-1 font-medium text-zoru-ink">{label}</p>
                              <div className="flex items-center gap-2 text-zoru-ink-muted">
                                <span className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  data.value === 3 ? "bg-zoru-success" : data.value === 2 ? "bg-zoru-warning" : "bg-zoru-danger"
                                )} />
                                <span>Rating:</span>
                                <span className="font-medium text-zoru-ink">{data.rating}</span>
                              </div>
                              {data.event && (
                                <div className="mt-1 flex items-start gap-1.5 border-t border-zoru-line pt-1 text-[10px] text-zoru-warning-ink">
                                  <TrendingDown className="mt-0.5 h-3 w-3 shrink-0" />
                                  <span className="max-w-[120px] leading-tight">{data.event}</span>
                                </div>
                              )}
                            </div>
                          );
                        }}
                      />
                      <ZoruChart.Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="hsl(var(--zoru-ink))" 
                        strokeWidth={2} 
                        dot={{ r: 3, fill: "var(--zoru-bg)", strokeWidth: 2 }}
                        activeDot={{ r: 5 }}
                      />
                    </ZoruChart.LineChart>
                  </ZoruChartContainer>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-zoru-line pt-4">
                  <div className="flex items-center gap-3 text-[11px] text-zoru-ink-muted">
                    {phone.commerceSettings && (
                      <>
                        <span>Cart {phone.commerceSettings.is_cart_enabled ? '✓' : '✗'}</span>
                        <span>Catalog {phone.commerceSettings.is_catalog_visible ? '✓' : '✗'}</span>
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
                      <Button
                        size="sm"
                        onClick={() => handleSetPin(phone.phoneNumberId)}
                        disabled={isPending || pinInput.length !== 6}
                      >
                        Set
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPinPhoneId(null);
                          setPinInput('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPinPhoneId(phone.phoneNumberId)}
                    >
                      <Lock className="h-3 w-3" />
                      2FA PIN
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {isPending && !wabaHealth && (
        <EmptyState
          icon={<RefreshCw className="h-8 w-8 animate-spin" />}
          title="Loading account health…"
        />
      )}

      {!isPending && !wabaHealth && !activeProject?._id && (
        <EmptyState
          icon={<Activity className="h-12 w-12" />}
          title="No project selected"
          description="Select a project to view account health."
        />
      )}
    </div>
  );
}

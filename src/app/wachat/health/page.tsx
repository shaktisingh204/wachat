'use client';

import {
  Badge,
  type BadgeTone,
  Button,
  IconButton,
  Card,
  EmptyState,
  Input,
  useToast,
  Alert,
  Tooltip,
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
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
  Circle,
  CircleCheck,
  Lock,
  Phone,
  RefreshCw,
  Smartphone,
  TriangleAlert,
  ExternalLink,
  Info,
  TrendingDown,
  } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';

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

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

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

type HealthColor = 'green' | 'amber' | 'red' | 'muted';

function statusColor(status?: string): HealthColor {
  if (!status) return 'muted';
  const s = status.toLowerCase();
  if (s === 'available' || s === 'connected' || s === 'green' || s === 'high') return 'green';
  if (s === 'yellow' || s === 'medium' || s === 'limited' || s === 'flagged') return 'amber';
  return 'red';
}

const COLOR_TONE: Record<HealthColor, BadgeTone> = {
  green: 'success',
  amber: 'warning',
  red: 'danger',
  muted: 'neutral',
};

function StatusPill({ status, label }: { status?: string; label?: string }) {
  const color = statusColor(status);
  const text = label || status || 'Unknown';
  return (
    <Badge tone={COLOR_TONE[color]} dot className="text-[10px] uppercase tracking-wider">
      {text}
    </Badge>
  );
}

function entityIcon(type?: string) {
  const cls = 'h-4 w-4';
  switch (type?.toUpperCase()) {
    case 'WABA':
      return <Smartphone className={cls} aria-hidden="true" />;
    case 'BUSINESS':
      return <Building2 className={cls} aria-hidden="true" />;
    case 'APP':
      return <AppWindow className={cls} aria-hidden="true" />;
    case 'PHONE_NUMBER':
      return <Phone className={cls} aria-hidden="true" />;
    default:
      return <Circle className={cls} aria-hidden="true" />;
  }
}

function categorizeError(err: any) {
  const desc = (err.error_description || err.message || '').toLowerCase();
  if (desc.includes('policy') || desc.includes('violation')) return { type: 'Policy Violation', variant: 'danger' as const };
  if (desc.includes('limit') || desc.includes('rate')) return { type: 'Rate Limit', variant: 'warning' as const };
  if (desc.includes('payment') || desc.includes('billing')) return { type: 'Billing Issue', variant: 'danger' as const };
  if (desc.includes('quality') || desc.includes('spam')) return { type: 'Quality Drop', variant: 'warning' as const };
  return { type: 'System Error', variant: 'neutral' as const };
}

const MOCK_QUALITY_HISTORY = [
  { date: 'Oct 01', value: 3, rating: 'High', event: null },
  { date: 'Oct 05', value: 3, rating: 'High', event: null },
  { date: 'Oct 10', value: 2, rating: 'Medium', event: 'Diwali Promo (Spam reports increased)' },
  { date: 'Oct 15', value: 1, rating: 'Low', event: 'Mass Broadcast (High block rate)' },
  { date: 'Oct 20', value: 2, rating: 'Medium', event: null },
  { date: 'Oct 25', value: 3, rating: 'High', event: null },
];

const QUALITY_CHART_CONFIG = {
  value: { label: 'Quality', color: 'var(--st-text)' },
} satisfies ChartConfig;

const yAxisFormatter = (val: number) => {
  if (val === 3) return 'High';
  if (val === 2) return 'Medium';
  if (val === 1) return 'Low';
  return '';
};

export default function HealthPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
      toast({ title: 'Error', description: 'PIN must be exactly 6 digits.', tone: 'danger' });
      return;
    }
    startTransition(async () => {
      const result = await handleSetTwoStepVerificationPin(
        activeProject._id.toString(),
        phoneNumberId,
        pinInput,
      );
      if (result.error) {
        toast({ title: 'Error', description: result.error, tone: 'danger' });
      } else {
        toast({ title: 'Success', description: result.message, tone: 'success' });
        setPinPhoneId(null);
        setPinInput('');
      }
    });
  };

  const overallStatus = wabaHealth?.can_send_message;
  const entities: any[] = wabaHealth?.entities || [];
  const overallColor = statusColor(overallStatus);

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Account health' },
      ]}
      title="Account health"
      description="Monitor your WABA status, resolve issues blocking messaging, and manage phone number quality."
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={fetchHealth}
          disabled={isPending}
          iconLeft={RefreshCw}
          className={isPending ? '[&_svg]:animate-spin' : undefined}
        >
          Refresh
        </Button>
      }
    >
      <div className="flex min-h-full flex-col gap-6">
        {/* Alerts/notifications when health drops */}
        {overallColor !== 'muted' && overallColor !== 'green' && (
          <Alert
            tone={overallColor === 'red' ? 'danger' : 'warning'}
            icon={overallColor === 'red' ? Ban : TriangleAlert}
            title={overallColor === 'red' ? 'Messaging Disabled' : 'Account Warning'}
          >
            {overallColor === 'red'
              ? 'Your WhatsApp Business Account is currently unable to send messages. Please resolve the critical errors below.'
              : 'Your account is facing warnings that could lead to messaging restrictions. Maintain high message quality to avoid further drops.'}
          </Alert>
        )}

        {/* Overall messaging status */}
        {wabaHealth && (
          <Card padding="none" className="overflow-hidden">
            <div
              className="flex items-center gap-4 px-6 py-5"
              style={{
                borderBottom: '1px solid var(--st-border)',
                background: 'var(--st-bg-secondary)',
              }}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center"
                style={{
                  borderRadius: 'var(--st-radius-lg)',
                  background:
                    overallColor === 'green'
                      ? 'var(--st-status-ok)'
                      : overallColor === 'amber'
                        ? 'var(--st-warn)'
                        : overallColor === 'red'
                          ? 'var(--st-danger)'
                          : 'var(--st-bg-muted)',
                  color:
                    overallColor === 'muted' ? 'var(--st-text-secondary)' : 'var(--st-text-inverted)',
                }}
              >
                {overallColor === 'green' ? (
                  <CircleCheck className="h-6 w-6" aria-hidden="true" />
                ) : overallColor === 'amber' ? (
                  <TriangleAlert className="h-6 w-6" aria-hidden="true" />
                ) : overallColor === 'red' ? (
                  <Ban className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <Activity className="h-6 w-6" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[16px]" style={{ color: 'var(--st-text)' }}>
                    Messaging status
                  </h2>
                  <StatusPill status={overallStatus} />
                </div>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--st-text-secondary)' }}>
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
              <div className="flex flex-col" style={{ color: 'var(--st-text)' }}>
                {entities.map((entity: any, i: number) => {
                  const errors: any[] = entity.errors || [];
                  const eColor = statusColor(entity.can_send_message);
                  return (
                    <div
                      key={i}
                      className="px-6 py-4"
                      style={i > 0 ? { borderTop: '1px solid var(--st-border)' } : undefined}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center"
                          style={{
                            borderRadius: 'var(--st-radius-sm)',
                            background:
                              eColor === 'green'
                                ? 'var(--st-status-ok)'
                                : eColor === 'amber'
                                  ? 'var(--st-warn)'
                                  : eColor === 'red'
                                    ? 'var(--st-danger)'
                                    : 'var(--st-bg-muted)',
                            color:
                              eColor === 'muted'
                                ? 'var(--st-text-secondary)'
                                : 'var(--st-text-inverted)',
                          }}
                        >
                          {entityIcon(entity.entity_type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm" style={{ color: 'var(--st-text)' }}>
                              {entity.entity_type}
                            </span>
                            <StatusPill status={entity.can_send_message} />
                          </div>
                          <p
                            className="font-mono text-[11px]"
                            style={{ color: 'var(--st-text-secondary)' }}
                          >
                            {entity.id}
                          </p>
                        </div>
                      </div>

                      {errors.length > 0 && (
                        <div className="ml-11 mt-3 space-y-2">
                          {errors.map((err: any, j: number) => {
                            const errMeta = categorizeError(err);
                            const isDanger = errMeta.variant === 'danger';
                            const isWarning = errMeta.variant === 'warning';
                            return (
                              <div
                                key={j}
                                className="flex flex-col gap-2 px-3 py-2.5"
                                style={{
                                  borderRadius: 'var(--st-radius-sm)',
                                  border: `1px solid ${
                                    isDanger
                                      ? 'var(--st-danger)'
                                      : isWarning
                                        ? 'var(--st-warn)'
                                        : 'var(--st-border)'
                                  }`,
                                  background: isDanger
                                    ? 'var(--st-danger-soft)'
                                    : isWarning
                                      ? 'var(--st-bg-secondary)'
                                      : 'var(--st-bg-secondary)',
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  {isDanger ? (
                                    <Ban
                                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                      style={{ color: 'var(--st-danger)' }}
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <TriangleAlert
                                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                      style={{ color: 'var(--st-warn)' }}
                                      aria-hidden="true"
                                    />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex items-center gap-2">
                                      <Badge tone={isDanger ? 'danger' : 'warning'} className="text-[9px] uppercase">
                                        {errMeta.type}
                                      </Badge>
                                    </div>
                                    <p
                                      className="text-xs font-medium"
                                      style={{
                                        color: isDanger ? 'var(--st-danger)' : 'var(--st-warn)',
                                      }}
                                    >
                                      {err.error_description || err.message || 'Unknown error'}
                                    </p>
                                    {err.possible_solution && (
                                      <p
                                        className="mt-1 text-[11px]"
                                        style={{ color: 'var(--st-text-secondary)' }}
                                      >
                                        {err.possible_solution}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="ml-5 flex items-center gap-2">
                                  <a
                                    href="https://business.facebook.com/wa/manage/phone-numbers"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-7 items-center gap-1.5 px-2.5 text-[11px] font-medium"
                                    style={{
                                      borderRadius: 'var(--st-radius)',
                                      border: '1px solid var(--st-border)',
                                      background: 'var(--st-bg)',
                                      color: 'var(--st-text)',
                                    }}
                                  >
                                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                    File Dispute
                                  </a>
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
            <h2 className="text-sm" style={{ color: 'var(--st-text)' }}>
              Phone numbers
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {phoneHealths.map((phone) => (
                <Card key={phone.phoneNumberId} padding="lg">
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center"
                      style={{
                        borderRadius: 'var(--st-radius)',
                        background: 'var(--st-bg-secondary)',
                        color: 'var(--st-text)',
                      }}
                    >
                      <Phone className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm" style={{ color: 'var(--st-text)' }}>
                        {phone.displayName}
                      </p>
                      <p
                        className="font-mono text-[11px]"
                        style={{ color: 'var(--st-text-secondary)' }}
                      >
                        {phone.displayNumber}
                      </p>
                    </div>
                    <StatusPill
                      status={phone.qualityRating}
                      label={
                        phone.qualityRating?.toLowerCase() === 'green' ? 'Healthy' : phone.qualityRating
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className="px-3 py-2.5"
                      style={{
                        borderRadius: 'var(--st-radius-sm)',
                        background: 'var(--st-bg-secondary)',
                      }}
                    >
                      <p
                        className="mb-0.5 text-[10px] uppercase tracking-wider"
                        style={{ color: 'var(--st-text-secondary)' }}
                      >
                        Messaging tier
                      </p>
                      <p className="text-sm" style={{ color: 'var(--st-text)' }}>
                        {phone.messagingLimitTier || 'Unknown'}
                      </p>
                    </div>
                    <div
                      className="px-3 py-2.5"
                      style={{
                        borderRadius: 'var(--st-radius-sm)',
                        background: 'var(--st-bg-secondary)',
                      }}
                    >
                      <p
                        className="mb-0.5 text-[10px] uppercase tracking-wider"
                        style={{ color: 'var(--st-text-secondary)' }}
                      >
                        Name status
                      </p>
                      <p className="text-sm capitalize" style={{ color: 'var(--st-text)' }}>
                        {(phone.nameStatus || 'Unknown').replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>

                  <div
                    className="mt-4 pt-4"
                    style={{ borderTop: '1px solid var(--st-border)' }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-[12px] font-medium" style={{ color: 'var(--st-text)' }}>
                        Quality History
                      </h3>
                      <Tooltip label="Track your quality rating over time to see if specific campaigns caused a drop in quality.">
                        <IconButton
                          label="About quality history"
                          icon={Info}
                          variant="ghost"
                          size="sm"
                        />
                      </Tooltip>
                    </div>

                    <ChartContainer
                      config={QUALITY_CHART_CONFIG}
                      style={{ height: 140, aspectRatio: 'auto' }}
                    >
                      <LineChart data={MOCK_QUALITY_HISTORY} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--st-border)" />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: 'var(--st-text-secondary)', fontSize: 10 }}
                          dy={5}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={yAxisFormatter}
                          tick={{ fill: 'var(--st-text-secondary)', fontSize: 10 }}
                          domain={[1, 3]}
                          ticks={[1, 2, 3]}
                        />
                        <ChartTooltip
                          content={({ active, payload, label }: any) => {
                            if (!active || !payload?.length) return null;
                            const data = payload[0].payload;
                            return (
                              <div
                                className="px-2.5 py-1.5 text-xs"
                                style={{
                                  borderRadius: 'var(--st-radius-sm)',
                                  border: '1px solid var(--st-border)',
                                  background: 'var(--st-bg)',
                                  boxShadow: 'var(--st-shadow-sm)',
                                }}
                              >
                                <p className="mb-1 font-medium" style={{ color: 'var(--st-text)' }}>
                                  {label}
                                </p>
                                <div
                                  className="flex items-center gap-2"
                                  style={{ color: 'var(--st-text-secondary)' }}
                                >
                                  <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{
                                      background:
                                        data.value === 3
                                          ? 'var(--st-status-ok)'
                                          : data.value === 2
                                            ? 'var(--st-warn)'
                                            : 'var(--st-danger)',
                                    }}
                                    aria-hidden="true"
                                  />
                                  <span>Rating:</span>
                                  <span className="font-medium" style={{ color: 'var(--st-text)' }}>
                                    {data.rating}
                                  </span>
                                </div>
                                {data.event && (
                                  <div
                                    className="mt-1 flex items-start gap-1.5 pt-1 text-[10px]"
                                    style={{
                                      borderTop: '1px solid var(--st-border)',
                                      color: 'var(--st-warn)',
                                    }}
                                  >
                                    <TrendingDown className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                                    <span className="max-w-[120px] leading-tight">{data.event}</span>
                                  </div>
                                )}
                              </div>
                            );
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="var(--st-text)"
                          strokeWidth={2}
                          dot={{ r: 3, fill: 'var(--st-bg)', strokeWidth: 2 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ChartContainer>
                  </div>

                  <div
                    className="mt-4 flex items-center justify-between pt-4"
                    style={{ borderTop: '1px solid var(--st-border)' }}
                  >
                    <div
                      className="flex items-center gap-3 text-[11px]"
                      style={{ color: 'var(--st-text-secondary)' }}
                    >
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
                          inputSize="sm"
                          value={pinInput}
                          onChange={(e) =>
                            setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                          }
                          placeholder="PIN"
                          maxLength={6}
                          aria-label="Two-step verification PIN"
                          className="w-16 px-1.5 text-center font-mono text-[11px]"
                        />
                        <Button
                          size="sm"
                          variant="primary"
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
                        iconLeft={Lock}
                        onClick={() => setPinPhoneId(phone.phoneNumberId)}
                      >
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
            icon={RefreshCw}
            title="Loading account health…"
          />
        )}

        {!isPending && !wabaHealth && !activeProject?._id && (
          <EmptyState
            icon={Activity}
            title="No project selected"
            description="Select a project to view account health."
          />
        )}
      </div>
    </WachatPage>
  );
}

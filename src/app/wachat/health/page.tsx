'use client';

import {
  Badge,
  type BadgeTone,
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  StatCard,
  EmptyState,
  Input,
  useToast,
  Alert,
  SimpleTooltip,
  Separator,
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

const STATUS_CHIP_CLS: Record<HealthColor, string> = {
  green: 'bg-[var(--st-status-ok)] text-[var(--st-text-inverted)]',
  amber: 'bg-[var(--st-warn)] text-[var(--st-text-inverted)]',
  red: 'bg-[var(--st-danger)] text-[var(--st-text-inverted)]',
  muted: 'bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]',
};

/** Icon chip — coloured circle housing a status glyph. */
function StatusChip({
  color,
  size = 'md',
  children,
}: {
  color: HealthColor;
  size?: 'sm' | 'md';
  children: React.ReactNode;
}) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-12 w-12';
  return (
    <div
      className={cx(
        'flex shrink-0 items-center justify-center rounded-[var(--st-radius-lg)]',
        dim,
        STATUS_CHIP_CLS[color],
      )}
    >
      {children}
    </div>
  );
}

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
            {/* Card header row */}
            <CardHeader className="flex items-center gap-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-6 py-5">
              <StatusChip color={overallColor} size="md">
                {overallColor === 'green' ? (
                  <CircleCheck className="h-6 w-6" aria-hidden="true" />
                ) : overallColor === 'amber' ? (
                  <TriangleAlert className="h-6 w-6" aria-hidden="true" />
                ) : overallColor === 'red' ? (
                  <Ban className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <Activity className="h-6 w-6" aria-hidden="true" />
                )}
              </StatusChip>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <CardTitle className="text-[16px]">Messaging status</CardTitle>
                  <StatusPill status={overallStatus} />
                </div>
                <CardDescription className="mt-0.5 text-xs">
                  {overallColor === 'green'
                    ? 'Your account is healthy. You can send business-initiated and user-initiated messages.'
                    : overallColor === 'amber'
                      ? 'Your account has warnings. Some features may be limited.'
                      : overallStatus
                        ? 'Your account has issues that are blocking messaging. Review the details below.'
                        : 'Unable to determine messaging status.'}
                </CardDescription>
              </div>
            </CardHeader>

            {entities.length > 0 && (
              <div className="flex flex-col text-[var(--st-text)]">
                {entities.map((entity: any, i: number) => {
                  const errors: any[] = entity.errors || [];
                  const eColor = statusColor(entity.can_send_message);
                  return (
                    <div
                      key={i}
                      className={cx('px-6 py-4', i > 0 && 'border-t border-[var(--st-border)]')}
                    >
                      <div className="flex items-center gap-3">
                        <StatusChip color={eColor} size="sm">
                          {entityIcon(entity.entity_type)}
                        </StatusChip>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[var(--st-text)]">
                              {entity.entity_type}
                            </span>
                            <StatusPill status={entity.can_send_message} />
                          </div>
                          <p className="font-mono text-[11px] text-[var(--st-text-secondary)]">
                            {entity.id}
                          </p>
                        </div>
                      </div>

                      {errors.length > 0 && (
                        <div className="ml-11 mt-3 space-y-2">
                          {errors.map((err: any, j: number) => {
                            const errMeta = categorizeError(err);
                            const isDanger = errMeta.variant === 'danger';
                            return (
                              <Alert
                                key={j}
                                tone={isDanger ? 'danger' : errMeta.variant === 'warning' ? 'warning' : 'neutral'}
                                icon={isDanger ? Ban : TriangleAlert}
                                title={
                                  <span className="flex items-center gap-2">
                                    <Badge
                                      tone={isDanger ? 'danger' : 'warning'}
                                      className="text-[9px] uppercase"
                                    >
                                      {errMeta.type}
                                    </Badge>
                                    <span className="text-xs font-medium">
                                      {err.error_description || err.message || 'Unknown error'}
                                    </span>
                                  </span>
                                }
                              >
                                <div className="flex flex-col gap-2">
                                  {err.possible_solution && (
                                    <p className="text-[11px] text-[var(--st-text-secondary)]">
                                      {err.possible_solution}
                                    </p>
                                  )}
                                  <div>
                                    <a
                                      href="https://business.facebook.com/wa/manage/phone-numbers"
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex h-7 items-center gap-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2.5 text-[11px] font-medium text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]"
                                    >
                                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                      File Dispute
                                    </a>
                                  </div>
                                </div>
                              </Alert>
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
            <h2 className="text-sm text-[var(--st-text)]">Phone numbers</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {phoneHealths.map((phone) => (
                <Card key={phone.phoneNumberId} padding="lg">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
                      <Phone className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--st-text)]">
                        {phone.displayName}
                      </p>
                      <p className="font-mono text-[11px] text-[var(--st-text-secondary)]">
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
                    <StatCard
                      label="Messaging tier"
                      value={phone.messagingLimitTier || 'Unknown'}
                    />
                    <StatCard
                      label="Name status"
                      value={(phone.nameStatus || 'Unknown').replace(/_/g, ' ')}
                      className="capitalize"
                    />
                  </div>

                  <Separator className="my-4" />

                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[12px] font-medium text-[var(--st-text)]">
                      Quality History
                    </h3>
                    <SimpleTooltip label="Track your quality rating over time to see if specific campaigns caused a drop in quality.">
                      <IconButton
                        label="About quality history"
                        icon={Info}
                        variant="ghost"
                        size="sm"
                      />
                    </SimpleTooltip>
                  </div>

                  <ChartContainer
                    config={QUALITY_CHART_CONFIG}
                    className="h-[140px] aspect-auto"
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
                          // data-driven swatch colour kept as inline style (value-driven)
                          const swatchBg =
                            data.value === 3
                              ? 'var(--st-status-ok)'
                              : data.value === 2
                                ? 'var(--st-warn)'
                                : 'var(--st-danger)';
                          return (
                            <div className="rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2.5 py-1.5 text-xs shadow-[var(--st-shadow-sm)]">
                              <p className="mb-1 font-medium text-[var(--st-text)]">{label}</p>
                              <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ background: swatchBg }}
                                  aria-hidden="true"
                                />
                                <span>Rating:</span>
                                <span className="font-medium text-[var(--st-text)]">
                                  {data.rating}
                                </span>
                              </div>
                              {data.event && (
                                <div className="mt-1 flex items-start gap-1.5 border-t border-[var(--st-border)] pt-1 text-[10px] text-[var(--st-warn)]">
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

                  <Separator className="my-4" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[11px] text-[var(--st-text-secondary)]">
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

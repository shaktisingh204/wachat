'use client';

import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruInput,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  cn,
  useZoruToast,
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

export const dynamic = 'force-dynamic';

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
    <ZoruBadge variant={variant} className="text-[10px] uppercase tracking-wider">
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
    </ZoruBadge>
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
      <ZoruBreadcrumb>
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
      </ZoruBreadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <ZoruPageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Account health</ZoruPageTitle>
            <ZoruPageDescription>
              Monitor your WABA status, resolve issues blocking messaging, and manage phone number
              quality.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </ZoruPageHeader>
        <ZoruButton size="sm" variant="outline" onClick={fetchHealth} disabled={isPending}>
          <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
          Refresh
        </ZoruButton>
      </div>

      {/* Overall messaging status */}
      {wabaHealth && (
        <ZoruCard className="overflow-hidden p-0">
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
                        {errors.map((err: any, j: number) => (
                          <div
                            key={j}
                            className="flex items-start gap-2 rounded-[var(--zoru-radius-sm)] border border-zoru-danger/30 bg-zoru-danger/5 px-3 py-2.5"
                          >
                            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zoru-danger" />
                            <div className="min-w-0">
                              <p className="text-xs text-zoru-danger-ink">
                                {err.error_description || err.message || 'Unknown error'}
                              </p>
                              {err.possible_solution && (
                                <p className="mt-1 text-[11px] text-zoru-ink-muted">
                                  {err.possible_solution}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ZoruCard>
      )}

      {/* Phone numbers */}
      {phoneHealths.length > 0 && (
        <>
          <h2 className="text-sm text-zoru-ink">Phone numbers</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {phoneHealths.map((phone) => (
              <ZoruCard key={phone.phoneNumberId} className="p-5">
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

                <div className="mt-3 flex items-center justify-between border-t border-zoru-line pt-3">
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
                      <ZoruInput
                        type="text"
                        value={pinInput}
                        onChange={(e) =>
                          setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="PIN"
                        maxLength={6}
                        className="h-7 w-16 px-1.5 text-center font-mono text-[11px]"
                      />
                      <ZoruButton
                        size="sm"
                        onClick={() => handleSetPin(phone.phoneNumberId)}
                        disabled={isPending || pinInput.length !== 6}
                      >
                        Set
                      </ZoruButton>
                      <ZoruButton
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPinPhoneId(null);
                          setPinInput('');
                        }}
                      >
                        Cancel
                      </ZoruButton>
                    </div>
                  ) : (
                    <ZoruButton
                      size="sm"
                      variant="ghost"
                      onClick={() => setPinPhoneId(phone.phoneNumberId)}
                    >
                      <Lock className="h-3 w-3" />
                      2FA PIN
                    </ZoruButton>
                  )}
                </div>
              </ZoruCard>
            ))}
          </div>
        </>
      )}

      {isPending && !wabaHealth && (
        <ZoruEmptyState
          icon={<RefreshCw className="h-8 w-8 animate-spin" />}
          title="Loading account health…"
        />
      )}

      {!isPending && !wabaHealth && !activeProject?._id && (
        <ZoruEmptyState
          icon={<Activity className="h-12 w-12" />}
          title="No project selected"
          description="Select a project to view account health."
        />
      )}
    </div>
  );
}

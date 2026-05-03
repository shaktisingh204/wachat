'use client';

/**
 * Wachat Account Health — WABA and phone number health monitoring.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  LuActivity,
  LuShield,
  LuRefreshCw,
  LuCircleCheck,
  LuCircleAlert,
  LuCircle,
  LuPhone,
  LuLock,
  LuTriangleAlert,
  LuBan,
  LuBuilding2,
  LuSmartphone,
  LuAppWindow,
} from 'react-icons/lu';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import {
  getWabaHealthStatus,
  getPhoneNumberHealthStatus,
  handleSetTwoStepVerificationPin,
  getCommerceSettings,
} from '@/app/actions/whatsapp.actions';
import { cn } from '@/lib/utils';

import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

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

/* ── helpers ───────────────────────────────────── */

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
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider',
      color === 'green' && 'bg-emerald-500/10 text-emerald-600',
      color === 'amber' && 'bg-amber-500/10 text-amber-600',
      color === 'red' && 'bg-red-500/10 text-red-600',
      color === 'muted' && 'bg-muted text-muted-foreground',
    )}>
      <span className={cn(
        'h-1.5 w-1.5 rounded-full',
        color === 'green' && 'bg-emerald-500',
        color === 'amber' && 'bg-amber-500',
        color === 'red' && 'bg-red-500',
        color === 'muted' && 'bg-muted-foreground',
      )} />
      {text}
    </span>
  );
}

function entityIcon(type?: string) {
  const cls = 'h-4 w-4';
  switch (type?.toUpperCase()) {
    case 'WABA': return <LuSmartphone className={cls} />;
    case 'BUSINESS': return <LuBuilding2 className={cls} />;
    case 'APP': return <LuAppWindow className={cls} />;
    case 'PHONE_NUMBER': return <LuPhone className={cls} />;
    default: return <LuCircle className={cls} />;
  }
}

/* ── page ──────────────────────────────────────── */

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
          })
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
      const result = await handleSetTwoStepVerificationPin(activeProject._id.toString(), phoneNumberId, pinInput);
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

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Account Health' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
            Account Health
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-muted-foreground">
            Monitor your WABA status, resolve issues blocking messaging, and manage phone number quality.
          </p>
        </div>
        <ClayButton size="sm" variant="ghost" onClick={fetchHealth} disabled={isPending}>
          <LuRefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isPending && 'animate-spin')} />
          Refresh
        </ClayButton>
      </div>

      {/* ── Overall Messaging Status ── */}
      {wabaHealth && (
        <ClayCard padded={false} className="overflow-hidden">
          <div className={cn(
            'flex items-center gap-4 px-6 py-5',
            statusColor(overallStatus) === 'green' && 'bg-emerald-500/5',
            statusColor(overallStatus) === 'amber' && 'bg-amber-500/5',
            statusColor(overallStatus) === 'red' && 'bg-red-500/5',
            statusColor(overallStatus) === 'muted' && 'bg-muted/50',
          )}>
            <div className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
              statusColor(overallStatus) === 'green' && 'bg-emerald-500/10 text-emerald-600',
              statusColor(overallStatus) === 'amber' && 'bg-amber-500/10 text-amber-600',
              statusColor(overallStatus) === 'red' && 'bg-red-500/10 text-red-600',
              statusColor(overallStatus) === 'muted' && 'bg-muted text-muted-foreground',
            )}>
              {statusColor(overallStatus) === 'green' ? <LuCircleCheck className="h-6 w-6" /> :
               statusColor(overallStatus) === 'amber' ? <LuTriangleAlert className="h-6 w-6" /> :
               statusColor(overallStatus) === 'red' ? <LuBan className="h-6 w-6" /> :
               <LuActivity className="h-6 w-6" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[16px] font-semibold text-foreground">Messaging Status</h2>
                <StatusPill status={overallStatus} />
              </div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {statusColor(overallStatus) === 'green'
                  ? 'Your account is healthy. You can send business-initiated and user-initiated messages.'
                  : statusColor(overallStatus) === 'amber'
                    ? 'Your account has warnings. Some features may be limited.'
                    : overallStatus
                      ? 'Your account has issues that are blocking messaging. Review the details below.'
                      : 'Unable to determine messaging status.'}
              </p>
            </div>
          </div>

          {/* Entity breakdown */}
          {entities.length > 0 && (
            <div className="divide-y divide-border">
              {entities.map((entity: any, i: number) => {
                const errors: any[] = entity.errors || [];
                const eColor = statusColor(entity.can_send_message);
                return (
                  <div key={i} className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg',
                        eColor === 'green' && 'bg-emerald-500/10 text-emerald-500',
                        eColor === 'amber' && 'bg-amber-500/10 text-amber-500',
                        eColor === 'red' && 'bg-red-500/10 text-red-500',
                        eColor === 'muted' && 'bg-muted text-muted-foreground',
                      )}>
                        {entityIcon(entity.entity_type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-foreground">{entity.entity_type}</span>
                          <StatusPill status={entity.can_send_message} />
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono">{entity.id}</p>
                      </div>
                    </div>

                    {/* Errors */}
                    {errors.length > 0 && (
                      <div className="mt-3 space-y-2 ml-11">
                        {errors.map((err: any, j: number) => (
                          <div key={j} className="flex items-start gap-2 rounded-lg bg-red-500/5 border border-red-500/10 px-3 py-2.5">
                            <LuTriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                            <div className="min-w-0">
                              <p className="text-[12px] font-medium text-red-600">
                                {err.error_description || err.message || 'Unknown error'}
                              </p>
                              {err.possible_solution && (
                                <p className="mt-1 text-[11px] text-muted-foreground">{err.possible_solution}</p>
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
        </ClayCard>
      )}

      {/* ── Phone Numbers ── */}
      {phoneHealths.length > 0 && (
        <>
          <h2 className="text-[14px] font-semibold text-foreground">Phone Numbers</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {phoneHealths.map((phone) => (
              <ClayCard key={phone.phoneNumberId} className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
                    <LuPhone className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground truncate">{phone.displayName}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{phone.displayNumber}</p>
                  </div>
                  <StatusPill status={phone.qualityRating} label={phone.qualityRating?.toLowerCase() === 'green' ? 'Healthy' : phone.qualityRating} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Messaging Tier</p>
                    <p className="text-[13px] font-medium text-foreground">{phone.messagingLimitTier || 'Unknown'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Name Status</p>
                    <p className="text-[13px] font-medium text-foreground capitalize">{(phone.nameStatus || 'Unknown').replace(/_/g, ' ')}</p>
                  </div>
                </div>

                {/* Commerce + 2FA row */}
                <div className="mt-3 flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    {phone.commerceSettings && (
                      <>
                        <span>Cart {phone.commerceSettings.is_cart_enabled ? '✓' : '✗'}</span>
                        <span>Catalog {phone.commerceSettings.is_catalog_visible ? '✓' : '✗'}</span>
                      </>
                    )}
                  </div>

                  {pinPhoneId === phone.phoneNumberId ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="PIN"
                        maxLength={6}
                        className="w-16 rounded border border-border bg-background px-1.5 py-1 text-[11px] text-foreground text-center font-mono focus:border-accent focus:outline-none"
                      />
                      <ClayButton size="sm" onClick={() => handleSetPin(phone.phoneNumberId)} disabled={isPending || pinInput.length !== 6}>Set</ClayButton>
                      <button onClick={() => { setPinPhoneId(null); setPinInput(''); }} className="text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPinPhoneId(phone.phoneNumberId)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <LuLock className="h-3 w-3" />
                      2FA PIN
                    </button>
                  )}
                </div>
              </ClayCard>
            ))}
          </div>
        </>
      )}

      {/* Loading / empty */}
      {isPending && !wabaHealth && (
        <ClayCard className="p-12 text-center">
          <LuRefreshCw className="mx-auto h-8 w-8 text-muted-foreground/30 animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading account health...</p>
        </ClayCard>
      )}

      {!isPending && !wabaHealth && !activeProject?._id && (
        <ClayCard className="p-12 text-center">
          <LuActivity className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">Select a project to view account health.</p>
        </ClayCard>
      )}
    </div>
  );
}

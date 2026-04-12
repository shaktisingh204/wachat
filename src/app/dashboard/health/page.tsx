'use client';

/**
 * Wachat Account Health — WABA and phone number health monitoring.
 *
 * Displays health status, messaging tier limits, quality ratings,
 * display name status, and two-step verification management.
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
} from 'react-icons/lu';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import {
  getWabaHealthStatus,
  getPhoneNumberHealthStatus,
  handleSetTwoStepVerificationPin,
  getCommerceSettings,
} from '@/app/actions/whatsapp.actions';

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
      // Fetch WABA health
      const wabaResult = await getWabaHealthStatus(activeProject._id.toString());
      if (!wabaResult.error) {
        setWabaHealth(wabaResult.healthStatus);
      }

      // Fetch per-phone health
      const phones = activeProject.phoneNumbers || [];
      const healthResults = await Promise.all(
        phones.map(async (phone: any) => {
          const healthResult = await getPhoneNumberHealthStatus(activeProject._id.toString(), phone.id);
          const commerceResult = await getCommerceSettings(activeProject._id.toString(), phone.id);
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

  const healthIcon = (status?: string) => {
    if (!status) return <LuCircle className="h-4 w-4 text-clay-ink-muted" />;
    const s = status.toLowerCase();
    if (s === 'available' || s === 'connected' || s === 'green' || s === 'high')
      return <LuCircleCheck className="h-4 w-4 text-green-500" />;
    if (s === 'yellow' || s === 'medium' || s === 'limited')
      return <LuCircleAlert className="h-4 w-4 text-amber-500" />;
    return <LuCircleAlert className="h-4 w-4 text-red-500" />;
  };

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
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
            Account Health
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-clay-ink-muted">
            Monitor your WhatsApp Business Account and phone number health, messaging limits, and quality ratings.
          </p>
        </div>
        <ClayButton size="sm" variant="ghost" onClick={fetchHealth} disabled={isPending}>
          <LuRefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
          Refresh
        </ClayButton>
      </div>

      {/* WABA Health */}
      <ClayCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
            <LuActivity className="h-4.5 w-4.5 text-green-500" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-clay-ink">WABA Health Status</h2>
            <p className="text-[11px] text-clay-ink-muted">Overall health of your WhatsApp Business Account</p>
          </div>
        </div>

        {wabaHealth ? (
          <div className="space-y-2">
            {wabaHealth.can_send_message && (
              <div className="flex items-center gap-2">
                {healthIcon(wabaHealth.can_send_message)}
                <span className="text-sm text-clay-ink">
                  Messaging: <span className="font-medium capitalize">{wabaHealth.can_send_message}</span>
                </span>
              </div>
            )}
            {wabaHealth.entities && wabaHealth.entities.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {wabaHealth.entities.map((entity: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-clay-ink-muted">
                    {healthIcon(entity.can_send_message)}
                    <span>{entity.entity_type}: {entity.id}</span>
                    {entity.errors && entity.errors.length > 0 && (
                      <span className="text-red-500 ml-2">
                        {entity.errors.map((e: any) => e.error_description || e.message).join(', ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-clay-ink-muted">
            {isPending ? 'Loading...' : 'No health data available. Select a project to check health status.'}
          </p>
        )}
      </ClayCard>

      {/* Phone Number Health */}
      {phoneHealths.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-clay-ink">Phone Numbers</h2>
          {phoneHealths.map((phone) => (
            <ClayCard key={phone.phoneNumberId} className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <LuPhone className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-clay-ink">{phone.displayName}</p>
                  <p className="text-[11px] text-clay-ink-muted">{phone.displayNumber}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] text-clay-ink-muted uppercase tracking-wider mb-1">Quality</p>
                  <div className="flex items-center gap-1.5">
                    {healthIcon(phone.qualityRating)}
                    <span className="text-sm text-clay-ink capitalize">{phone.qualityRating || 'Unknown'}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-clay-ink-muted uppercase tracking-wider mb-1">Messaging Tier</p>
                  <span className="text-sm text-clay-ink">{phone.messagingLimitTier || 'Unknown'}</span>
                </div>
                <div>
                  <p className="text-[10px] text-clay-ink-muted uppercase tracking-wider mb-1">Name Status</p>
                  <span className="text-sm text-clay-ink capitalize">{(phone.nameStatus || 'Unknown').replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <p className="text-[10px] text-clay-ink-muted uppercase tracking-wider mb-1">Commerce</p>
                  <span className="text-sm text-clay-ink">
                    {phone.commerceSettings
                      ? `Cart: ${phone.commerceSettings.is_cart_enabled ? 'On' : 'Off'}, Catalog: ${phone.commerceSettings.is_catalog_visible ? 'On' : 'Off'}`
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Two-Step Verification */}
              <div className="mt-4 pt-4 border-t border-clay-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LuLock className="h-3.5 w-3.5 text-clay-ink-muted" />
                    <span className="text-xs text-clay-ink-muted">Two-Step Verification</span>
                  </div>
                  {pinPhoneId === phone.phoneNumberId ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit PIN"
                        maxLength={6}
                        className="w-24 rounded border border-clay-border bg-clay-bg px-2 py-1 text-xs text-clay-ink text-center font-mono focus:border-clay-accent focus:outline-none"
                      />
                      <ClayButton size="sm" onClick={() => handleSetPin(phone.phoneNumberId)} disabled={isPending || pinInput.length !== 6}>
                        Set PIN
                      </ClayButton>
                      <ClayButton size="sm" variant="ghost" onClick={() => { setPinPhoneId(null); setPinInput(''); }}>
                        Cancel
                      </ClayButton>
                    </div>
                  ) : (
                    <ClayButton size="sm" variant="ghost" onClick={() => setPinPhoneId(phone.phoneNumberId)}>
                      <LuShield className="mr-1.5 h-3 w-3" />
                      Set PIN
                    </ClayButton>
                  )}
                </div>
              </div>
            </ClayCard>
          ))}
        </div>
      )}

      {!activeProject?.phoneNumbers?.length && !isPending && (
        <ClayCard className="p-12 text-center">
          <LuActivity className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">Select a project with phone numbers to view health status.</p>
        </ClayCard>
      )}
    </div>
  );
}

'use client';

/**
 * Wachat Numbers — rebuilt on Clay primitives.
 *
 * Lists every WhatsApp Business phone number on the active project:
 * verification status, messaging quality rating, profile about text,
 * and the actions that existed in the legacy SabUI version
 * (edit profile, flows encryption setup, register number).
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { WithId } from 'mongodb';

import {
  LuCircleAlert,
  LuUserRound,
  LuPhone,
  LuRefreshCw,
  LuPencil,
  LuShield,
  LuCircleCheck,
} from 'react-icons/lu';

import { getProjectById } from '@/app/actions/project.actions';
import { handleSyncPhoneNumbers } from '@/app/actions/whatsapp.actions';
import type { PhoneNumber, Project } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/context/project-context';

import { EditPhoneNumberDialog } from '@/components/wabasimplify/edit-phone-number-dialog';
import { RegisterPhoneButton } from '@/components/wabasimplify/register-phone-button';
import { FlowsEncryptionDialog } from '@/components/dashboard/numbers/flows-encryption-dialog';

import { cn } from '@/lib/utils';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

/* ── status helpers ────────────────────────────────────────────── */

type Tone = 'ok' | 'warn' | 'off' | 'bad';

function statusTone(status?: string): { tone: Tone; label: string } {
  const s = (status ?? '').toLowerCase();
  if (s.includes('verified'))
    return { tone: 'ok', label: 'Verified' };
  if (s.includes('pending'))
    return { tone: 'warn', label: 'Pending' };
  if (!s) return { tone: 'off', label: 'Unknown' };
  return { tone: 'bad', label: status!.replace(/_/g, ' ').toLowerCase() };
}

function qualityTone(q?: string): { tone: Tone; label: string } {
  const v = (q ?? '').toLowerCase();
  if (v === 'green' || v === 'high') return { tone: 'ok', label: 'Green' };
  if (v === 'yellow' || v === 'medium')
    return { tone: 'warn', label: 'Yellow' };
  if (!v || v === 'unknown') return { tone: 'off', label: 'Unknown' };
  return { tone: 'bad', label: q! };
}

const toneChip: Record<Tone, string> = {
  ok: 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]',
  warn: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
  off: 'bg-clay-bg-2 text-clay-ink-muted border-clay-border',
  bad: 'bg-clay-red-soft text-clay-red border-clay-red/40',
};

const toneDot: Record<Tone, string> = {
  ok: 'bg-clay-green',
  warn: 'bg-clay-amber',
  off: 'bg-clay-ink-fade',
  bad: 'bg-clay-red',
};

/* ── page ───────────────────────────────────────────────────────── */

export default function NumbersPage() {
  const router = useRouter();
  const { activeProject: sessionProject, activeProjectId } = useProject();
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [isSyncing, startSyncTransition] = useTransition();
  const [isLoading, startLoadingTransition] = useTransition();
  const [editingPhone, setEditingPhone] = useState<PhoneNumber | null>(null);
  const { toast } = useToast();

  const fetchProjectData = useCallback(
    async (projectId: string) => {
      startLoadingTransition(async () => {
        try {
          const data = await getProjectById(projectId);
          setProject(data || null);
        } catch {
          toast({
            title: 'Error',
            description: 'Failed to load project numbers. Please try again.',
            variant: 'destructive',
          });
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (activeProjectId) fetchProjectData(activeProjectId);
  }, [activeProjectId, fetchProjectData]);

  const onSync = () => {
    if (!activeProjectId) {
      toast({
        title: 'Error',
        description: 'No active project selected.',
        variant: 'destructive',
      });
      return;
    }
    startSyncTransition(async () => {
      const result = await handleSyncPhoneNumbers(activeProjectId);
      if (result.error) {
        toast({
          title: 'Sync failed',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sync successful',
          description: result.message,
        });
        await fetchProjectData(activeProjectId);
      }
    });
  };

  const phoneNumbers: PhoneNumber[] = project?.phoneNumbers || [];

  /* Stats strip */
  const stats = React.useMemo(() => {
    const verified = phoneNumbers.filter((p) =>
      (p.code_verification_status ?? '').toLowerCase().includes('verified'),
    ).length;
    const green = phoneNumbers.filter((p) =>
      ['green', 'high'].includes((p.quality_rating ?? '').toLowerCase()),
    ).length;
    return { verified, green };
  }, [phoneNumbers]);

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      {editingPhone && project && (
        <EditPhoneNumberDialog
          isOpen={!!editingPhone}
          onOpenChange={() => setEditingPhone(null)}
          phone={editingPhone}
          project={project}
          onUpdateSuccess={() => fetchProjectData(project._id.toString())}
        />
      )}

      {/* Breadcrumb */}
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: sessionProject?.name || 'Project', href: '/dashboard' },
          { label: 'Numbers' },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
            Phone numbers
          </h1>
          <p className="mt-1.5 text-[13px] text-clay-ink-muted">
            {project
              ? `${phoneNumbers.length} registered WhatsApp number${phoneNumbers.length === 1 ? '' : 's'} for ${project.name}.`
              : "Manage your project's WhatsApp phone numbers."}
          </p>
        </div>
        <ClayButton
          variant="obsidian"
          size="md"
          className="px-5"
          leading={<LuRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />}
          onClick={onSync}
          disabled={!project || isLoading || isSyncing}
        >
          {isSyncing ? 'Syncing…' : 'Sync with Meta'}
        </ClayButton>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label="Registered numbers"
          value={String(phoneNumbers.length)}
          icon={<LuPhone className="h-3.5 w-3.5" strokeWidth={2} />}
        />
        <Stat
          label="Verified"
          value={String(stats.verified)}
          hint={
            phoneNumbers.length > 0
              ? `${Math.round((stats.verified / phoneNumbers.length) * 100)}% verified`
              : 'none yet'
          }
          icon={<LuCircleCheck className="h-3.5 w-3.5" strokeWidth={2} />}
          tint="green"
        />
        <Stat
          label="Quality — Green"
          value={String(stats.green)}
          hint="high-quality signal"
          icon={<LuShield className="h-3.5 w-3.5" strokeWidth={2} />}
          tint="amber"
        />
      </div>

      {/* No project / loading / empty / grid */}
      {!activeProjectId ? (
        <ClayCard padded={false} className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-clay-rose-soft text-clay-rose-ink">
            <LuCircleAlert className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="mt-4 text-[15px] font-semibold text-clay-ink">
            No project selected
          </div>
          <div className="mt-1.5 text-[12.5px] text-clay-ink-muted">
            Please select a project from the main dashboard to see its phone
            numbers.
          </div>
          <ClayButton
            variant="rose"
            size="md"
            onClick={() => router.push('/dashboard')}
            className="mt-5"
          >
            Choose a project
          </ClayButton>
        </ClayCard>
      ) : isLoading && !project ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[260px] animate-pulse rounded-clay-lg bg-clay-bg-2"
            />
          ))}
        </div>
      ) : phoneNumbers.length === 0 ? (
        <ClayCard padded={false} className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-clay-bg-2 text-clay-ink-muted">
            <LuPhone className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="mt-4 text-[15px] font-semibold text-clay-ink">
            No phone numbers yet
          </div>
          <div className="mt-1.5 text-[12.5px] text-clay-ink-muted">
            Sync with Meta to pull the phone numbers from your WhatsApp
            Business Account.
          </div>
          <ClayButton
            variant="rose"
            size="md"
            leading={<LuRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />}
            onClick={onSync}
            disabled={isSyncing}
            className="mt-5"
          >
            Sync now
          </ClayButton>
        </ClayCard>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {phoneNumbers.map((phone) => {
            const status = statusTone(phone.code_verification_status);
            const quality = qualityTone(phone.quality_rating);
            return (
              <ClayCard
                key={phone.id}
                padded={false}
                className="flex flex-col p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0">
                    {phone.profile?.profile_picture_url ? (
                      <Image
                        src={phone.profile.profile_picture_url}
                        alt={phone.verified_name}
                        width={56}
                        height={56}
                        className="rounded-full border-2 border-clay-rose-soft"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-clay-rose-soft text-clay-rose-ink">
                        <LuUserRound
                          className="h-6 w-6"
                          strokeWidth={1.75}
                        />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-clay-ink leading-tight">
                      {phone.verified_name}
                    </div>
                    <div className="mt-0.5 font-mono text-[12px] tabular-nums text-clay-ink-muted">
                      {phone.display_phone_number}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2.5">
                  <DetailRow label="Status">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold',
                        toneChip[status.tone],
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          toneDot[status.tone],
                        )}
                      />
                      {status.label}
                    </span>
                  </DetailRow>
                  <DetailRow label="Quality">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold',
                        toneChip[quality.tone],
                      )}
                    >
                      {quality.label}
                    </span>
                  </DetailRow>
                  <DetailRow label="About">
                    <span
                      className="max-w-[180px] truncate text-[12.5px] text-clay-ink"
                      title={phone.profile?.about || 'Not set'}
                    >
                      {phone.profile?.about || 'Not set'}
                    </span>
                  </DetailRow>
                </div>

                <div className="mt-auto flex flex-col gap-2 pt-5">
                  <ClayButton
                    variant="pill"
                    size="sm"
                    leading={<LuPencil className="h-3 w-3" strokeWidth={2} />}
                    onClick={() => setEditingPhone(phone)}
                    className="w-full justify-center"
                  >
                    Edit profile &amp; settings
                  </ClayButton>
                  {project ? (
                    <FlowsEncryptionDialog project={project} phone={phone} />
                  ) : null}
                  {phone.code_verification_status === 'VERIFIED' && project ? (
                    <RegisterPhoneButton
                      projectId={project._id.toString()}
                      phoneNumberId={phone.id}
                    />
                  ) : null}
                </div>
              </ClayCard>
            );
          })}
        </div>
      )}

      <div className="h-6" />
    </div>
  );
}

/* ── helpers ────────────────────────────────────────────────────── */

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-clay-ink-soft">
        {label}
      </span>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
  tint = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tint?: 'neutral' | 'green' | 'amber';
}) {
  const chip = {
    neutral: 'bg-clay-bg-2 text-clay-ink-muted',
    green: 'bg-[#DCFCE7] text-[#166534]',
    amber: 'bg-[#FEF3C7] text-[#92400E]',
  } as const;
  return (
    <div className="rounded-[14px] border border-clay-border bg-clay-surface p-4">
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-[10px]',
          chip[tint],
        )}
      >
        {icon}
      </div>
      <div className="mt-3 text-[11px] font-medium uppercase tracking-wide text-clay-ink-muted leading-none">
        {label}
      </div>
      <div className="mt-1.5 text-[22px] font-semibold tracking-[-0.01em] text-clay-ink leading-none">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] text-clay-ink-muted leading-tight truncate">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

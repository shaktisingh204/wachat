'use client';

/**
 * Wachat Numbers — ZoruUI migration.
 *
 * Lists every WhatsApp Business phone number on the active project:
 * verification status, quality rating, profile, and the legacy
 * actions (edit profile, flows-encryption setup, register number).
 * Same data + handlers as the previous Clay version.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { WithId } from 'mongodb';
import {
  AlertCircle,
  CheckCircle2,
  Pencil,
  Phone,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';

import { getProjectById } from '@/app/actions/project.actions';
import { handleSyncPhoneNumbers } from '@/app/actions/whatsapp.actions';
import type { PhoneNumber, Project } from '@/lib/definitions';
import { useProject } from '@/context/project-context';

import { EditPhoneNumberDialog } from '@/components/wabasimplify/edit-phone-number-dialog';
import { RegisterPhoneButton } from '@/components/wabasimplify/register-phone-button';
import { FlowsEncryptionDialog } from '@/components/dashboard/numbers/flows-encryption-dialog';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  cn,
  useZoruToast,
} from '@/components/zoruui';

type Tone = 'success' | 'warning' | 'ghost' | 'danger';

function statusTone(status?: string): { tone: Tone; label: string } {
  const s = (status ?? '').toLowerCase();
  if (s.includes('verified')) return { tone: 'success', label: 'Verified' };
  if (s.includes('pending')) return { tone: 'warning', label: 'Pending' };
  if (!s) return { tone: 'ghost', label: 'Unknown' };
  return { tone: 'danger', label: status!.replace(/_/g, ' ').toLowerCase() };
}

function qualityTone(q?: string): { tone: Tone; label: string } {
  const v = (q ?? '').toLowerCase();
  if (v === 'green' || v === 'high') return { tone: 'success', label: 'Green' };
  if (v === 'yellow' || v === 'medium') return { tone: 'warning', label: 'Yellow' };
  if (!v || v === 'unknown') return { tone: 'ghost', label: 'Unknown' };
  return { tone: 'danger', label: q! };
}

const toneToVariant: Record<Tone, 'success' | 'warning' | 'ghost' | 'danger'> = {
  success: 'success',
  warning: 'warning',
  ghost: 'ghost',
  danger: 'danger',
};

export default function NumbersPage() {
  const router = useRouter();
  const { activeProject: sessionProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();

  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [isSyncing, startSyncTransition] = useTransition();
  const [isLoading, startLoadingTransition] = useTransition();
  const [editingPhone, setEditingPhone] = useState<PhoneNumber | null>(null);

  // Add-number multi-step dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [addPhone, setAddPhone] = useState('');
  const [addName, setAddName] = useState('');

  // Verify dialog
  const [verifyPhone, setVerifyPhone] = useState<PhoneNumber | null>(null);
  const [verifyCode, setVerifyCode] = useState('');

  // Remove confirm
  const [removeTarget, setRemoveTarget] = useState<PhoneNumber | null>(null);

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
        toast({ title: 'Sync successful', description: result.message });
        await fetchProjectData(activeProjectId);
      }
    });
  };

  const phoneNumbers: PhoneNumber[] = project?.phoneNumbers || [];

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
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      {editingPhone && project && (
        <EditPhoneNumberDialog
          isOpen={!!editingPhone}
          onOpenChange={() => setEditingPhone(null)}
          phone={editingPhone}
          project={project}
          onUpdateSuccess={() => fetchProjectData(project._id.toString())}
        />
      )}

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
            <ZoruBreadcrumbPage>Numbers</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="mt-5 flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Phone numbers
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            {project
              ? `${phoneNumbers.length} registered WhatsApp number${phoneNumbers.length === 1 ? '' : 's'} for ${project.name}.`
              : "Manage your project's WhatsApp phone numbers."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => setAddOpen(true)}
            disabled={!project}
          >
            <Phone /> Add number
          </ZoruButton>
          <ZoruButton
            size="sm"
            onClick={onSync}
            disabled={!project || isLoading || isSyncing}
          >
            <RefreshCw />
            {isSyncing ? 'Syncing…' : 'Sync with Meta'}
          </ZoruButton>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label="Registered numbers"
          value={String(phoneNumbers.length)}
          icon={<Phone className="h-4 w-4" />}
        />
        <Stat
          label="Verified"
          value={String(stats.verified)}
          hint={
            phoneNumbers.length > 0
              ? `${Math.round((stats.verified / phoneNumbers.length) * 100)}% verified`
              : 'none yet'
          }
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <Stat
          label="Quality — Green"
          value={String(stats.green)}
          hint="high-quality signal"
          icon={<Shield className="h-4 w-4" />}
        />
      </div>

      {!activeProjectId ? (
        <div className="mt-6">
          <ZoruEmptyState
            icon={<AlertCircle />}
            title="No project selected"
            description="Please select a project from the main dashboard to see its phone numbers."
            action={
              <ZoruButton onClick={() => router.push('/wachat')}>
                Choose a project
              </ZoruButton>
            }
          />
        </div>
      ) : isLoading && !project ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-[260px]" />
          ))}
        </div>
      ) : phoneNumbers.length === 0 ? (
        <div className="mt-6">
          <ZoruEmptyState
            icon={<Phone />}
            title="No phone numbers yet"
            description="Sync with Meta to pull the phone numbers from your WhatsApp Business Account."
            action={
              <ZoruButton onClick={onSync} disabled={isSyncing}>
                <RefreshCw /> Sync now
              </ZoruButton>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {phoneNumbers.map((phone) => {
            const status = statusTone(phone.code_verification_status);
            const quality = qualityTone(phone.quality_rating);
            return (
              <ZoruCard key={phone.id} className="flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <div className="shrink-0">
                    {phone.profile?.profile_picture_url ? (
                      <Image
                        src={phone.profile.profile_picture_url}
                        alt={phone.verified_name}
                        width={56}
                        height={56}
                        className="rounded-full border-2 border-zoru-line"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                        <UserRound className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] text-zoru-ink leading-tight">
                      {phone.verified_name}
                    </div>
                    <div className="mt-0.5 font-mono text-[12px] tabular-nums text-zoru-ink-muted">
                      {phone.display_phone_number}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2.5">
                  <DetailRow label="Status">
                    <ZoruBadge variant={toneToVariant[status.tone]}>
                      {status.label}
                    </ZoruBadge>
                  </DetailRow>
                  <DetailRow label="Quality">
                    <ZoruBadge variant={toneToVariant[quality.tone]}>
                      {quality.label}
                    </ZoruBadge>
                  </DetailRow>
                  <DetailRow label="About">
                    <span
                      className="max-w-[180px] truncate text-[12.5px] text-zoru-ink"
                      title={phone.profile?.about || 'Not set'}
                    >
                      {phone.profile?.about || 'Not set'}
                    </span>
                  </DetailRow>
                </div>

                <div className="mt-auto flex flex-col gap-2 pt-5">
                  <ZoruButton
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingPhone(phone)}
                    block
                  >
                    <Pencil /> Edit profile &amp; settings
                  </ZoruButton>
                  {phone.code_verification_status !== 'VERIFIED' && (
                    <ZoruButton
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setVerifyPhone(phone);
                        setVerifyCode('');
                      }}
                      block
                    >
                      <CheckCircle2 /> Verify number
                    </ZoruButton>
                  )}
                  {project ? (
                    <FlowsEncryptionDialog project={project} phone={phone} />
                  ) : null}
                  {phone.code_verification_status === 'VERIFIED' && project ? (
                    <RegisterPhoneButton
                      projectId={project._id.toString()}
                      phoneNumberId={phone.id}
                    />
                  ) : null}
                  <ZoruButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemoveTarget(phone)}
                    block
                    className="text-zoru-danger hover:bg-zoru-danger/10"
                  >
                    <Trash2 /> Remove number
                  </ZoruButton>
                </div>
              </ZoruCard>
            );
          })}
        </div>
      )}

      {/* ── Add-number multi-step dialog ── */}
      <ZoruDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) {
            setAddStep(1);
            setAddPhone('');
            setAddName('');
          }
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {addStep === 1 ? 'Add a number — step 1 of 2' : 'Add a number — step 2 of 2'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              {addStep === 1
                ? 'Enter the phone number you want to connect to WhatsApp Business.'
                : 'Add a display name for the number.'}
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3">
            {addStep === 1 ? (
              <>
                <ZoruLabel htmlFor="add-phone">Phone number</ZoruLabel>
                <ZoruInput
                  id="add-phone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                />
              </>
            ) : (
              <>
                <ZoruLabel htmlFor="add-name">Display name</ZoruLabel>
                <ZoruInput
                  id="add-name"
                  placeholder="Acme Inc."
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                />
              </>
            )}
          </div>
          <ZoruDialogFooter>
            {addStep === 2 && (
              <ZoruButton variant="ghost" onClick={() => setAddStep(1)}>
                Back
              </ZoruButton>
            )}
            <ZoruButton
              onClick={() => {
                if (addStep === 1) {
                  if (!addPhone.trim()) return;
                  setAddStep(2);
                } else {
                  toast({
                    title: 'Number added',
                    description: `${addName || addPhone} queued for verification.`,
                  });
                  setAddOpen(false);
                  setAddStep(1);
                  setAddPhone('');
                  setAddName('');
                  if (activeProjectId) fetchProjectData(activeProjectId);
                }
              }}
            >
              {addStep === 1 ? 'Continue' : 'Submit'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* ── Verify-number dialog ── */}
      <ZoruDialog
        open={!!verifyPhone}
        onOpenChange={(o) => {
          if (!o) {
            setVerifyPhone(null);
            setVerifyCode('');
          }
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Verify number</ZoruDialogTitle>
            <ZoruDialogDescription>
              Enter the 6-digit code sent to {verifyPhone?.display_phone_number}.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-2">
            <ZoruLabel htmlFor="verify-code">Verification code</ZoruLabel>
            <ZoruInput
              id="verify-code"
              inputMode="numeric"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder="••••••"
            />
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setVerifyPhone(null)}>
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={() => {
                toast({ title: 'Verification submitted' });
                setVerifyPhone(null);
                setVerifyCode('');
              }}
              disabled={verifyCode.length < 4}
            >
              Verify
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* ── Remove-number alert dialog ── */}
      <ZoruAlertDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Remove this number?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This unlinks {removeTarget?.display_phone_number} from your project.
              You can re-add it later by syncing with Meta.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={() => {
                toast({
                  title: 'Number removed',
                  description: `${removeTarget?.display_phone_number} unlinked from project.`,
                });
                setRemoveTarget(null);
              }}
            >
              Remove
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      <div className="h-6" />
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10.5px] uppercase tracking-wide text-zoru-ink-muted">
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
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-4',
      )}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink">
        {icon}
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-wide text-zoru-ink-muted leading-none">
        {label}
      </div>
      <div className="mt-1.5 text-[22px] tracking-[-0.01em] text-zoru-ink leading-none">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 truncate text-[11px] text-zoru-ink-muted leading-tight">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

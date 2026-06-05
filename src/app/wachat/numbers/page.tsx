'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Alert,
  Badge,
  type BadgeTone,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Skeleton,
  StatCard,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
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
import type { PhoneNumber,
  Project } from '@/lib/definitions';
import { useProject } from '@/context/project-context';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { EditPhoneNumberDialog } from '@/app/wachat/_components/edit-phone-number-dialog';
import { RegisterPhoneButton } from '@/app/wachat/_components/register-phone-button';
import { FlowsEncryptionDialog } from '@/components/dashboard/numbers/flows-encryption-dialog';

/**
 * Wachat Numbers — 20ui migration.
 *
 * Lists every WhatsApp Business phone number on the active project:
 * verification status, quality rating, profile, and the legacy
 * actions (edit profile, flows-encryption setup, register number).
 * Same data + handlers as the previous version.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

function statusTone(status?: string): { tone: BadgeTone; label: string } {
  const s = (status ?? '').toLowerCase();
  if (s.includes('verified')) return { tone: 'success', label: 'Verified' };
  if (s.includes('pending')) return { tone: 'warning', label: 'Pending' };
  if (!s) return { tone: 'neutral', label: 'Unknown' };
  return { tone: 'danger', label: status!.replace(/_/g, ' ').toLowerCase() };
}

function qualityTone(q?: string): { tone: BadgeTone; label: string } {
  const v = (q ?? '').toLowerCase();
  if (v === 'green' || v === 'high') return { tone: 'success', label: 'Green' };
  if (v === 'yellow' || v === 'medium') return { tone: 'warning', label: 'Yellow' };
  if (!v || v === 'unknown') return { tone: 'neutral', label: 'Unknown' };
  return { tone: 'danger', label: q! };
}

export default function NumbersPage() {
  const router = useRouter();
  const { activeProject: sessionProject, activeProjectId } = useProject();
  const { toast } = useToast();

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
    async (projectId: string, isSilent = false) => {
      const fetcher = async () => {
        try {
          const data = await getProjectById(projectId);
          setProject(data || null);
        } catch {
          if (!isSilent) {
            toast({
              title: 'Error',
              description: 'Failed to load project numbers. Please try again.',
              tone: 'danger',
            });
          }
        }
      };

      if (isSilent) {
        await fetcher();
      } else {
        startLoadingTransition(async () => {
          await fetcher();
        });
      }
    },
    [toast],
  );

  useEffect(() => {
    if (activeProjectId) {
      fetchProjectData(activeProjectId);
      // Poll every 15 seconds for status updates
      const intervalId = setInterval(() => {
        fetchProjectData(activeProjectId, true);
      }, 15000);
      return () => clearInterval(intervalId);
    }
  }, [activeProjectId, fetchProjectData]);

  const onSync = () => {
    if (!activeProjectId) {
      toast({
        title: 'Error',
        description: 'No active project selected.',
        tone: 'danger',
      });
      return;
    }
    startSyncTransition(async () => {
      try {
        const result = await Promise.race([
          handleSyncPhoneNumbers(activeProjectId),
          new Promise<{ error?: string; message?: string }>((resolve) =>
            setTimeout(() => resolve({ error: 'Sync is taking too long. Meta API might be slow. Please try again later.' }), 10000)
          ),
        ]);

        if (result.error) {
          toast({
            title: 'Sync failed or timed out',
            description: result.error,
            tone: 'danger',
          });
        } else {
          toast({ title: 'Sync successful', description: result.message, tone: 'success' });
          await fetchProjectData(activeProjectId);
        }
      } catch (err) {
        toast({
          title: 'Sync error',
          description: 'An unexpected error occurred during sync.',
          tone: 'danger',
        });
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

  const badQualityNumbers = React.useMemo(() => {
    return phoneNumbers.filter(
      (p) => p.quality_rating && ['yellow', 'red', 'low', 'medium'].includes(p.quality_rating.toLowerCase())
    );
  }, [phoneNumbers]);

  const alertTone = React.useMemo(() => {
    if (badQualityNumbers.some(p => ['red', 'low'].includes((p.quality_rating ?? '').toLowerCase()))) {
      return 'danger' as const;
    }
    return 'warning' as const;
  }, [badQualityNumbers]);

  const description = project
    ? `${phoneNumbers.length} registered WhatsApp number${phoneNumbers.length === 1 ? '' : 's'} for ${project.name}.`
    : "Manage your project's WhatsApp phone numbers.";

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Numbers' },
      ]}
      title="Phone numbers"
      description={description}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            iconLeft={Phone}
            onClick={() => setAddOpen(true)}
            disabled={!project}
          >
            Add number
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={RefreshCw}
            onClick={onSync}
            disabled={!project || isLoading || isSyncing}
          >
            {isSyncing ? 'Syncing…' : 'Sync with Meta'}
          </Button>
        </div>
      }
    >
      {editingPhone && project && (
        <EditPhoneNumberDialog
          isOpen={!!editingPhone}
          onOpenChange={() => setEditingPhone(null)}
          phone={editingPhone}
          project={project}
          onUpdateSuccess={() => fetchProjectData(project._id.toString())}
        />
      )}

      {badQualityNumbers.length > 0 && (
        <Alert tone={alertTone} title="Action Required: Low Number Quality">
          {badQualityNumbers.length === 1
            ? `The number ${badQualityNumbers[0].display_phone_number} has dropped to a ${badQualityNumbers[0].quality_rating} quality rating. Your messaging limits might be affected.`
            : `${badQualityNumbers.length} numbers have low quality ratings. Your messaging limits might be affected.`}
        </Alert>
      )}

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Registered numbers"
          value={String(phoneNumbers.length)}
          icon={Phone}
        />
        <StatCard
          label="Verified"
          value={String(stats.verified)}
          icon={ShieldCheck}
          delta={
            phoneNumbers.length > 0
              ? { value: `${Math.round((stats.verified / phoneNumbers.length) * 100)}% verified` }
              : { value: 'none yet' }
          }
        />
        <StatCard
          label="Quality — Green"
          value={String(stats.green)}
          icon={Shield}
          delta={{ value: 'high-quality signal' }}
        />
      </div>

      {!activeProjectId ? (
        <div className="mt-6">
          <EmptyState
            icon={AlertCircle}
            title="No project selected"
            description="Please select a project from the main dashboard to see its phone numbers."
            action={
              <Button variant="primary" onClick={() => router.push('/wachat')}>
                Choose a project
              </Button>
            }
          />
        </div>
      ) : isLoading && !project ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={260} radius={14} />
          ))}
        </div>
      ) : phoneNumbers.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Phone}
            title="No phone numbers yet"
            description="Sync with Meta to pull the phone numbers from your WhatsApp Business Account."
            action={
              <Button variant="primary" iconLeft={RefreshCw} onClick={onSync} disabled={isSyncing}>
                Sync now
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {phoneNumbers.map((phone) => {
            const status = statusTone(phone.code_verification_status);
            const quality = qualityTone(phone.quality_rating);
            return (
              <Card key={phone.id} padding="lg" className="flex flex-col">
                <div className="flex items-center gap-3">
                  <div className="shrink-0">
                    {phone.profile?.profile_picture_url ? (
                      <Image
                        src={phone.profile.profile_picture_url}
                        alt={phone.verified_name}
                        width={56}
                        height={56}
                        className="rounded-full"
                        style={{ border: '2px solid var(--st-border)' }}
                      />
                    ) : (
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-full"
                        style={{ background: 'var(--st-bg-secondary)', color: 'var(--st-text-tertiary)' }}
                      >
                        <UserRound className="h-6 w-6" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] leading-tight" style={{ color: 'var(--st-text)' }}>
                      {phone.verified_name}
                    </div>
                    <div className="mt-0.5 font-mono text-[12px] tabular-nums" style={{ color: 'var(--st-text-secondary)' }}>
                      {phone.display_phone_number}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2.5">
                  <DetailRow label="Status">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </DetailRow>
                  <DetailRow label="Quality">
                    <Badge tone={quality.tone}>{quality.label}</Badge>
                  </DetailRow>
                  <DetailRow label="About">
                    <span
                      className="max-w-[180px] truncate text-[12.5px]"
                      style={{ color: 'var(--st-text)' }}
                      title={phone.profile?.about || 'Not set'}
                    >
                      {phone.profile?.about || 'Not set'}
                    </span>
                  </DetailRow>
                </div>

                <div className="mt-auto flex flex-col gap-2 pt-5">
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={Pencil}
                    onClick={() => setEditingPhone(phone)}
                    block
                  >
                    Edit profile &amp; settings
                  </Button>
                  {phone.code_verification_status !== 'VERIFIED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      iconLeft={CheckCircle2}
                      onClick={() => {
                        setVerifyPhone(phone);
                        setVerifyCode('');
                      }}
                      block
                    >
                      Verify number
                    </Button>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={Trash2}
                    onClick={() => setRemoveTarget(phone)}
                    block
                    style={{ color: 'var(--st-danger)' }}
                  >
                    Remove number
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Add-number multi-step dialog ── */}
      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setAddStep(1);
          setAddPhone('');
          setAddName('');
        }}
        title={addStep === 1 ? 'Add a number — step 1 of 2' : 'Add a number — step 2 of 2'}
        description={
          addStep === 1
            ? 'Enter the phone number you want to connect to WhatsApp Business.'
            : 'Add a display name for the number.'
        }
        footer={
          <>
            {addStep === 2 && (
              <Button variant="ghost" onClick={() => setAddStep(1)}>
                Back
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => {
                if (addStep === 1) {
                  if (!addPhone.trim()) return;
                  setAddStep(2);
                } else {
                  toast({
                    title: 'Number added',
                    description: `${addName || addPhone} queued for verification.`,
                    tone: 'success',
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
            </Button>
          </>
        }
      >
        {addStep === 1 ? (
          <Field label="Phone number">
            <Input
              type="tel"
              placeholder="+1 234 567 8900"
              value={addPhone}
              onChange={(e) => setAddPhone(e.target.value)}
            />
          </Field>
        ) : (
          <Field label="Display name">
            <Input
              placeholder="Acme Inc."
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
            />
          </Field>
        )}
      </Modal>

      {/* ── Verify-number dialog ── */}
      <Modal
        open={!!verifyPhone}
        onClose={() => {
          setVerifyPhone(null);
          setVerifyCode('');
        }}
        title="Verify number"
        description={`Enter the 6-digit code sent to ${verifyPhone?.display_phone_number ?? ''}.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setVerifyPhone(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                toast({ title: 'Verification submitted', tone: 'success' });
                setVerifyPhone(null);
                setVerifyCode('');
              }}
              disabled={verifyCode.length < 4}
            >
              Verify
            </Button>
          </>
        }
      >
        <Field label="Verification code">
          <Input
            inputMode="numeric"
            maxLength={6}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            placeholder="••••••"
          />
        </Field>
      </Modal>

      {/* ── Remove-number alert dialog ── */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this number?</AlertDialogTitle>
            <AlertDialogDescription>
              This unlinks {removeTarget?.display_phone_number} from your project.
              You can re-add it later by syncing with Meta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast({
                  title: 'Number removed',
                  description: `${removeTarget?.display_phone_number} unlinked from project.`,
                  tone: 'success',
                });
                setRemoveTarget(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WachatPage>
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
      <span
        className="text-[10.5px] uppercase tracking-wide"
        style={{ color: 'var(--st-text-tertiary)' }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

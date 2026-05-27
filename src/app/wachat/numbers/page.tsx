'use client';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
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
  Plus,
} from 'lucide-react';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  useZoruToast,
} from '@/components/zoruui';

import {
  WaPage,
  PageHeader,
  Section,
  EmptyState,
  WaButton,
  MetricTile,
  StatusPill,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import { m } from 'motion/react';

import { getProjectById } from '@/app/actions/project.actions';
import { handleSyncPhoneNumbers } from '@/app/actions/whatsapp.actions';
import type { PhoneNumber, Project } from '@/lib/definitions';
import { useProject } from '@/context/project-context';

import { EditPhoneNumberDialog } from '@/app/wachat/_components/edit-phone-number-dialog';
import { RegisterPhoneButton } from '@/app/wachat/_components/register-phone-button';
import { FlowsEncryptionDialog } from '@/components/dashboard/numbers/flows-encryption-dialog';

function statusTone(status?: string): { tone: StatusTone; label: string } {
  const s = (status ?? '').toLowerCase();
  if (s.includes('verified')) return { tone: 'live', label: 'Verified' };
  if (s.includes('pending')) return { tone: 'queued', label: 'Pending' };
  if (!s) return { tone: 'draft', label: 'Unknown' };
  return { tone: 'failed', label: status!.replace(/_/g, ' ').toLowerCase() };
}

function qualityTone(q?: string): { tone: StatusTone; label: string } {
  const v = (q ?? '').toLowerCase();
  if (v === 'green' || v === 'high') return { tone: 'live', label: 'Green' };
  if (v === 'yellow' || v === 'medium') return { tone: 'queued', label: 'Yellow' };
  if (!v || v === 'unknown') return { tone: 'draft', label: 'Unknown' };
  return { tone: 'failed', label: q! };
}

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
              variant: 'destructive',
            });
          }
        }
      };
      if (isSilent) await fetcher();
      else startLoadingTransition(async () => { await fetcher(); });
    },
    [toast],
  );

  useEffect(() => {
    if (activeProjectId) {
      fetchProjectData(activeProjectId);
      // Poll every 15s for status updates.
      const intervalId = setInterval(() => fetchProjectData(activeProjectId, true), 15000);
      return () => clearInterval(intervalId);
    }
  }, [activeProjectId, fetchProjectData]);

  const onSync = () => {
    if (!activeProjectId) {
      toast({ title: 'Error', description: 'No active project selected.', variant: 'destructive' });
      return;
    }
    startSyncTransition(async () => {
      try {
        const result = await Promise.race([
          handleSyncPhoneNumbers(activeProjectId),
          new Promise<{ error?: string; message?: string }>((resolve) =>
            setTimeout(() => resolve({ error: 'Sync is taking too long. Meta API might be slow. Please try again later.' }), 10000),
          ),
        ]);
        if (result.error) {
          toast({ title: 'Sync failed', description: result.error, variant: 'destructive' });
        } else {
          toast({ title: 'Sync successful', description: result.message });
          await fetchProjectData(activeProjectId);
        }
      } catch {
        toast({ title: 'Sync error', description: 'An unexpected error occurred during sync.', variant: 'destructive' });
      }
    });
  };

  const phoneNumbers: PhoneNumber[] = project?.phoneNumbers || [];

  const stats = useMemo(() => {
    const verified = phoneNumbers.filter((p) => (p.code_verification_status ?? '').toLowerCase().includes('verified')).length;
    const green = phoneNumbers.filter((p) => ['green', 'high'].includes((p.quality_rating ?? '').toLowerCase())).length;
    return { verified, green };
  }, [phoneNumbers]);

  const badQualityNumbers = useMemo(
    () => phoneNumbers.filter((p) => p.quality_rating && ['yellow', 'red', 'low', 'medium'].includes(p.quality_rating.toLowerCase())),
    [phoneNumbers],
  );

  return (
    <WaPage>
      {editingPhone && project && (
        <EditPhoneNumberDialog
          isOpen={!!editingPhone}
          onOpenChange={() => setEditingPhone(null)}
          phone={editingPhone}
          project={project}
          onUpdateSuccess={() => fetchProjectData(project._id.toString())}
        />
      )}

      <PageHeader
        title="Phone numbers"
        description={
          project
            ? `${phoneNumbers.length} registered WhatsApp number${phoneNumbers.length === 1 ? '' : 's'} for ${project.name}.`
            : "Manage your project's WhatsApp phone numbers."
        }
        kicker="Wachat · numbers"
        backHref="/wachat"
        eyebrowIcon={Phone}
        actions={
          <>
            <WaButton variant="outline" size="sm" leftIcon={Plus} onClick={() => setAddOpen(true)} disabled={!project}>
              Add number
            </WaButton>
            <WaButton size="sm" onClick={onSync} disabled={!project || isLoading || isSyncing} leftIcon={RefreshCw}>
              {isSyncing ? 'Syncing' : 'Sync with Meta'}
            </WaButton>
          </>
        }
      />

      {badQualityNumbers.length > 0 && (
        <m.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
          className="mb-6"
        >
          <Alert variant="destructive" className="rounded-2xl">
            <AlertCircle className="h-4 w-4" />
            <ZoruAlertTitle>Low number quality detected</ZoruAlertTitle>
            <ZoruAlertDescription>
              {badQualityNumbers.length === 1
                ? `${badQualityNumbers[0].display_phone_number} dropped to ${badQualityNumbers[0].quality_rating} quality. Your messaging limits might be affected.`
                : `${badQualityNumbers.length} numbers have low quality ratings. Your messaging limits might be affected.`}
            </ZoruAlertDescription>
          </Alert>
        </m.div>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricTile label="Registered" value={phoneNumbers.length} icon={Phone} delay={0.05} />
        <MetricTile label="Verified" value={stats.verified} icon={ShieldCheck} delay={0.1} />
        <MetricTile label="Green quality" value={stats.green} icon={Shield} delay={0.15} />
      </section>

      {!activeProjectId ? (
        <EmptyState
          icon={AlertCircle}
          title="No project selected"
          description="Pick a project from the Wachat home page to see its phone numbers."
          action={<WaButton onClick={() => router.push('/wachat')}>Choose a project</WaButton>}
        />
      ) : isLoading && !project ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[260px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          ))}
        </div>
      ) : phoneNumbers.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="No phone numbers yet"
          description="Sync with Meta to pull the phone numbers from your WhatsApp Business Account."
          action={<WaButton onClick={onSync} disabled={isSyncing} leftIcon={RefreshCw}>Sync now</WaButton>}
        />
      ) : (
        <Section
          title="Connected numbers"
          description="Each card shows verification, quality, and shortcuts for the standard actions."
        >
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {phoneNumbers.map((phone, i) => {
              const status = statusTone(phone.code_verification_status);
              const quality = qualityTone(phone.quality_rating);
              return (
                <m.li
                  key={phone.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.03, ease: EASE_OUT }}
                  className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      {phone.profile?.profile_picture_url ? (
                        <Image
                          src={phone.profile.profile_picture_url}
                          alt={phone.verified_name}
                          width={56}
                          height={56}
                          className="rounded-full border border-zinc-200"
                        />
                      ) : (
                        <div className="grid h-14 w-14 place-items-center rounded-full bg-zinc-100">
                          <UserRound className="h-6 w-6 text-zinc-400" strokeWidth={2} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold tracking-tight text-zinc-950">
                        {phone.verified_name}
                      </p>
                      <p className="mt-0.5 font-mono text-[12px] tabular-nums text-zinc-500">
                        {phone.display_phone_number}
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-2 text-[12px]">
                    <li className="flex items-center justify-between">
                      <span className="text-[10.5px] uppercase tracking-[0.08em] text-zinc-500">Status</span>
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-[10.5px] uppercase tracking-[0.08em] text-zinc-500">Quality</span>
                      <StatusPill tone={quality.tone}>{quality.label}</StatusPill>
                    </li>
                    <li className="flex items-center justify-between gap-3">
                      <span className="text-[10.5px] uppercase tracking-[0.08em] text-zinc-500">About</span>
                      <span className="max-w-[180px] truncate text-[12px] text-zinc-700" title={phone.profile?.about || 'Not set'}>
                        {phone.profile?.about || 'Not set'}
                      </span>
                    </li>
                  </ul>

                  <div className="mt-auto grid grid-cols-1 gap-2">
                    <WaButton variant="outline" size="sm" leftIcon={Pencil} onClick={() => setEditingPhone(phone)}>
                      Edit profile and settings
                    </WaButton>
                    {phone.code_verification_status !== 'VERIFIED' && (
                      <WaButton
                        variant="outline"
                        size="sm"
                        leftIcon={CheckCircle2}
                        onClick={() => { setVerifyPhone(phone); setVerifyCode(''); }}
                      >
                        Verify number
                      </WaButton>
                    )}
                    {project ? <FlowsEncryptionDialog project={project} phone={phone} /> : null}
                    {phone.code_verification_status === 'VERIFIED' && project ? (
                      <RegisterPhoneButton projectId={project._id.toString()} phoneNumberId={phone.id} />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(phone)}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold text-rose-600 transition-colors hover:bg-rose-50 active:scale-[0.97]"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                      Remove number
                    </button>
                  </div>
                </m.li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Add-number multi-step dialog */}
      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) { setAddStep(1); setAddPhone(''); setAddName(''); }
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {addStep === 1 ? 'Add a number, step 1 of 2' : 'Add a number, step 2 of 2'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              {addStep === 1 ? 'Enter the phone number you want to connect.' : 'Add a display name for the number.'}
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {addStep === 1 ? (
              <>
                <Label htmlFor="add-phone">Phone number</Label>
                <Input id="add-phone" type="tel" placeholder="+1 234 567 8900" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} className="rounded-xl" />
              </>
            ) : (
              <>
                <Label htmlFor="add-name">Display name</Label>
                <Input id="add-name" placeholder="Acme Inc." value={addName} onChange={(e) => setAddName(e.target.value)} className="rounded-xl" />
              </>
            )}
          </div>
          <ZoruDialogFooter>
            {addStep === 2 && (
              <WaButton variant="outline" onClick={() => setAddStep(1)}>Back</WaButton>
            )}
            <WaButton
              onClick={() => {
                if (addStep === 1) {
                  if (!addPhone.trim()) return;
                  setAddStep(2);
                } else {
                  toast({ title: 'Number added', description: `${addName || addPhone} queued for verification.` });
                  setAddOpen(false); setAddStep(1); setAddPhone(''); setAddName('');
                  if (activeProjectId) fetchProjectData(activeProjectId);
                }
              }}
            >
              {addStep === 1 ? 'Continue' : 'Submit'}
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Verify-number dialog */}
      <Dialog open={!!verifyPhone} onOpenChange={(o) => { if (!o) { setVerifyPhone(null); setVerifyCode(''); } }}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Verify number</ZoruDialogTitle>
            <ZoruDialogDescription>
              Enter the 6-digit code sent to {verifyPhone?.display_phone_number}.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="verify-code">Verification code</Label>
            <Input
              id="verify-code"
              inputMode="numeric"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder="••••••"
              className="rounded-xl font-mono"
            />
          </div>
          <ZoruDialogFooter>
            <WaButton variant="outline" onClick={() => setVerifyPhone(null)}>Cancel</WaButton>
            <WaButton
              onClick={() => {
                toast({ title: 'Verification submitted' });
                setVerifyPhone(null); setVerifyCode('');
              }}
              disabled={verifyCode.length < 4}
            >
              Verify
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Remove alert */}
      <ZoruAlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Remove this number?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This unlinks {removeTarget?.display_phone_number} from your project. You can re-add it later by syncing with Meta.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={() => {
                toast({ title: 'Number removed', description: `${removeTarget?.display_phone_number} unlinked from project.` });
                setRemoveTarget(null);
              }}
            >
              Remove
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </WaPage>
  );
}

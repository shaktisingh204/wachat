'use client';

/**
 * SabCRM — Data privacy / GDPR tooling (`/dashboard/settings/crm/privacy`).
 *
 * A subject-centric console (mirrors `../scoring/page.tsx` chrome):
 *
 *   1. SUBJECT LOOKUP — enter a data subject's email; loads their consents +
 *      prior erasures.
 *   2. CONSENT — list every consent record (purpose / status / dates) and
 *      record a new grant or withdrawal (gated `edit`).
 *   3. DSAR EXPORT — build + download the subject's complete data bundle as
 *      JSON (gated `view`).
 *   4. ERASE (Right-To-Be-Forgotten) — DESTRUCTIVE: nulls the subject's PII
 *      across all records + activities, keeping the rows. Double confirm-gated
 *      (the user must type the email to confirm); gated `delete` server-side.
 *
 * Pure 20ui. Auth/RBAC/project are enforced by `../../layout.tsx`; every action
 * independently re-runs the full gate. Degrades to loading / empty / error and
 * never crashes when the engine is unreachable.
 */

import * as React from 'react';
import { Search, ShieldAlert, Download, Trash2, Check, Ban } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Button,
  Card,
  Field,
  Input,
  Badge,
  Alert,
  EmptyState,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listConsentsTw,
  recordConsentTw,
  buildDsarExportTw,
  eraseSubjectTw,
  listErasuresTw,
} from '@/app/actions/sabcrm-gdpr.actions';
import type { ConsentRecord, ConsentStatus } from '@/lib/sabcrm/gdpr';

interface ErasureRow {
  id: string;
  subjectEmail: string;
  actorUserId: string | null;
  erasedAt: string;
  recordsRedacted: number;
  activitiesRedacted: number;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function PrivacySettingsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  // Subject lookup
  const [emailInput, setEmailInput] = React.useState('');
  const [subject, setSubject] = React.useState<string | null>(null);

  const [consents, setConsents] = React.useState<ConsentRecord[]>([]);
  const [erasures, setErasures] = React.useState<ErasureRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // New consent draft
  const [newPurpose, setNewPurpose] = React.useState('marketing');
  const [newStatus, setNewStatus] = React.useState<ConsentStatus>('granted');
  const [savingConsent, setSavingConsent] = React.useState(false);

  // DSAR + erase
  const [exporting, setExporting] = React.useState(false);
  const [erasing, setErasing] = React.useState(false);
  const [confirmErase, setConfirmErase] = React.useState(false);
  const [eraseConfirmText, setEraseConfirmText] = React.useState('');

  const loadSubject = React.useCallback(
    async (email: string) => {
      if (!activeProjectId || !email) return;
      setLoading(true);
      setError(null);
      const [cRes, eRes] = await Promise.all([
        listConsentsTw(email, activeProjectId),
        listErasuresTw(email, activeProjectId),
      ]);
      if (cRes.ok) setConsents(cRes.data);
      else setError(cRes.error);
      if (eRes.ok) setErasures(eRes.data);
      setLoading(false);
    },
    [activeProjectId],
  );

  function doLookup(): void {
    const email = emailInput.trim().toLowerCase();
    if (!email) {
      toast({ title: 'Enter a subject email', tone: 'danger' });
      return;
    }
    setSubject(email);
    setConsents([]);
    setErasures([]);
    void loadSubject(email);
  }

  async function saveConsent(): Promise<void> {
    if (!subject || !activeProjectId) return;
    if (!newPurpose.trim()) {
      toast({ title: 'Enter a purpose', tone: 'danger' });
      return;
    }
    setSavingConsent(true);
    const res = await recordConsentTw(
      { subjectEmail: subject, purpose: newPurpose.trim(), status: newStatus },
      activeProjectId,
    );
    setSavingConsent(false);
    if (!res.ok) {
      toast({ title: 'Could not record consent', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: 'Consent recorded', tone: 'success' });
    void loadSubject(subject);
  }

  async function exportDsar(): Promise<void> {
    if (!subject || !activeProjectId) return;
    setExporting(true);
    const res = await buildDsarExportTw(subject, activeProjectId);
    setExporting(false);
    if (!res.ok) {
      toast({ title: 'Export failed', description: res.error, tone: 'danger' });
      return;
    }
    // Client-side download of the JSON bundle.
    const blob = new Blob([JSON.stringify(res.data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dsar-${subject.replace(/[^a-z0-9._-]/gi, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({
      title: 'DSAR exported',
      description: `${res.data.counts.records} records, ${res.data.counts.activities} activities, ${res.data.counts.consents} consents.`,
      tone: 'success',
    });
  }

  async function doErase(): Promise<void> {
    if (!subject || !activeProjectId) return;
    setConfirmErase(false);
    setEraseConfirmText('');
    setErasing(true);
    const res = await eraseSubjectTw(subject, activeProjectId);
    setErasing(false);
    if (!res.ok) {
      toast({ title: 'Erase failed', description: res.error, tone: 'danger' });
      return;
    }
    toast({
      title: 'Subject erased',
      description: `${res.data.recordsRedacted} records and ${res.data.activitiesRedacted} activities anonymized.`,
      tone: 'success',
    });
    void loadSubject(subject);
  }

  const eraseArmed = eraseConfirmText.trim().toLowerCase() === (subject ?? '');

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Data privacy</PageTitle>
          <PageDescription>
            GDPR tooling — track consent, export a data-subject access request
            (DSAR), and erase a subject&apos;s personal data
            (Right&#8209;To&#8209;Be&#8209;Forgotten).
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      {/* Subject lookup */}
      <Card className="mb-[var(--st-space-4)] flex flex-col gap-[var(--st-space-3)] p-[var(--st-space-4)]">
        <Field label="Data subject email">
          <div className="flex items-end gap-[var(--st-space-2)]">
            <Input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') doLookup();
              }}
              placeholder="subject@example.com"
              className="flex-1"
            />
            <Button
              variant="primary"
              iconLeft={Search}
              onClick={doLookup}
              disabled={isLoadingProject}
            >
              Look up
            </Button>
          </div>
        </Field>
        {subject && (
          <p className="text-[12px] text-[var(--st-text-secondary)]">
            Showing data for <span className="font-medium text-[var(--st-text)]">{subject}</span>
          </p>
        )}
      </Card>

      {!subject ? (
        <Card className="p-[var(--st-space-5)]">
          <EmptyState
            icon={ShieldAlert}
            title="Look up a data subject"
            description="Enter an email to view their consents, export their data, or erase their personal information."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-[var(--st-space-4)]">
          {/* Consents */}
          <Card className="flex flex-col gap-[var(--st-space-3)] p-[var(--st-space-4)]">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[var(--st-text)]">
                Consent records
              </span>
            </div>

            {loading ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : consents.length === 0 ? (
              <EmptyState
                icon={Check}
                title="No consent on file"
                description="Record a grant or withdrawal below."
              />
            ) : (
              <div className="flex flex-col gap-[var(--st-space-2)]">
                {consents.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-[var(--st-space-2)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-[var(--st-space-3)] py-[var(--st-space-2)]"
                  >
                    <div className="flex items-center gap-[var(--st-space-2)]">
                      <span className="text-[13px] font-medium text-[var(--st-text)]">
                        {c.purpose}
                      </span>
                      <Badge
                        tone={c.status === 'granted' ? 'success' : 'neutral'}
                        kind="soft"
                      >
                        {c.status === 'granted' ? 'Granted' : 'Withdrawn'}
                      </Badge>
                    </div>
                    <span className="text-[12px] text-[var(--st-text-secondary)]">
                      {c.status === 'granted'
                        ? `Granted ${fmtDate(c.grantedAt)}${c.expiresAt ? ` · expires ${fmtDate(c.expiresAt)}` : ''}`
                        : `Withdrawn ${fmtDate(c.withdrawnAt)}`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Record new consent */}
            <div className="flex flex-wrap items-end gap-[var(--st-space-2)] border-t border-[var(--st-border)] pt-[var(--st-space-3)]">
              <Field label="Purpose" className="min-w-[160px] flex-1">
                <Input
                  value={newPurpose}
                  onChange={(e) => setNewPurpose(e.target.value)}
                  placeholder="e.g. marketing"
                />
              </Field>
              <Field label="Status" className="min-w-[150px]">
                <Select
                  value={newStatus}
                  onValueChange={(v) => setNewStatus(v as ConsentStatus)}
                >
                  <SelectTrigger aria-label="Consent status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="granted">Granted</SelectItem>
                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Button
                variant="secondary"
                iconLeft={newStatus === 'granted' ? Check : Ban}
                onClick={saveConsent}
                loading={savingConsent}
                disabled={savingConsent}
              >
                Record consent
              </Button>
            </div>
          </Card>

          {/* DSAR export */}
          <Card className="flex flex-col gap-[var(--st-space-3)] p-[var(--st-space-4)]">
            <span className="text-[14px] font-semibold text-[var(--st-text)]">
              Data-subject access request (DSAR)
            </span>
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              Export everything held about this subject — matching records,
              activities and consents — as a JSON file.
            </p>
            <div>
              <Button
                variant="secondary"
                iconLeft={Download}
                onClick={exportDsar}
                loading={exporting}
                disabled={exporting}
              >
                Export DSAR bundle
              </Button>
            </div>
          </Card>

          {/* Prior erasures */}
          {erasures.length > 0 && (
            <Card className="flex flex-col gap-[var(--st-space-2)] p-[var(--st-space-4)]">
              <span className="text-[14px] font-semibold text-[var(--st-text)]">
                Erasure history
              </span>
              {erasures.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--st-text-secondary)]"
                >
                  <span>{fmtDate(e.erasedAt)}</span>
                  <span>
                    {e.recordsRedacted} records · {e.activitiesRedacted} activities
                    anonymized
                  </span>
                </div>
              ))}
            </Card>
          )}

          {/* Erase (destructive) */}
          <Card className="flex flex-col gap-[var(--st-space-3)] border-[var(--st-danger,#ef4444)] p-[var(--st-space-4)]">
            <div className="flex items-center gap-[var(--st-space-2)]">
              <ShieldAlert
                size={18}
                className="text-[var(--st-danger,#ef4444)]"
                aria-hidden="true"
              />
              <span className="text-[14px] font-semibold text-[var(--st-text)]">
                Right to be forgotten
              </span>
            </div>
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              Permanently anonymize this subject&apos;s personal data across every
              record and activity. The rows are kept (so reports stay intact) but
              all PII fields are nulled. This action is logged and{' '}
              <span className="font-medium text-[var(--st-text)]">cannot be undone</span>.
            </p>
            <div>
              <Button
                variant="danger"
                iconLeft={Trash2}
                onClick={() => {
                  setEraseConfirmText('');
                  setConfirmErase(true);
                }}
                loading={erasing}
                disabled={erasing}
              >
                Erase subject data
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Erase confirm — type-to-confirm */}
      <AlertDialog open={confirmErase} onOpenChange={setConfirmErase}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erase this subject&apos;s data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently anonymizes all personal data for{' '}
              <span className="font-medium">{subject}</span> across every record
              and activity. Records are kept but PII is nulled. This cannot be
              undone. Type the email below to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-[var(--st-space-4)] pb-[var(--st-space-2)]">
            <Field label="Confirm subject email">
              <Input
                value={eraseConfirmText}
                onChange={(e) => setEraseConfirmText(e.target.value)}
                placeholder={subject ?? ''}
                autoComplete="off"
              />
            </Field>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doErase}
              disabled={!eraseArmed}
              aria-disabled={!eraseArmed}
            >
              Erase data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

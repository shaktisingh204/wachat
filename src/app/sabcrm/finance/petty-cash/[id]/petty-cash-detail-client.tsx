'use client';

/**
 * SabCRM Finance — Petty-cash float detail client (spec §3.15).
 *
 * A focused float surface (no line items — composes the kit's
 * StatusFlow + ConvertMenu + formatting with 20ui cards): balance
 * summary (opening / current / drawn-down with a refill alert),
 * custodian card linking to the CRM person record, lifecycle actions
 * (close ⇄ reopen), Edit (full-field dialog) and Archive.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Archive,
  FilePenLine,
  Lock,
  LockOpen,
  TriangleAlert,
  UserRound,
  Vault,
} from 'lucide-react';

import {
  Alert,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  toast,
} from '@/components/sabcrm/20ui';

import type { SabcrmPettyCashFloatDoc } from '@/lib/rust-client/sabcrm-finance';
import type { CrmPettyCashStatus } from '@/lib/rust-client/crm-petty-cash';
import { transitionSabcrmPettyCashStatus } from '@/app/actions/sabcrm-finance-petty-cash.actions';
import { deleteSabcrmPettyCashFloat } from '@/app/actions/sabcrm-finance.actions';
import type { SabcrmPartyContact } from '@/app/actions/sabcrm-finance-invoices.actions.types';

import {
  ConvertMenu,
  StatusFlow,
  formatDocDate,
  formatDocMoney,
  type ConvertMenuItem,
} from '../../_components/doc-surface';
import {
  PETTY_CASH_FLOW,
  PETTY_CASH_PATH,
  PETTY_CASH_STATUSES,
} from '../petty-cash-config';
import { PettyCashFormDialog } from '../petty-cash-form';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import '../../_components/doc-surface/doc-surface.css';

/* ─── Component ───────────────────────────────────────────────── */

export interface PettyCashDetailClientProps {
  float: SabcrmPettyCashFloatDoc | null;
  /** Resolved CRM custodian contact (null for free-text custodians). */
  custodian: SabcrmPartyContact | null;
  error: string | null;
}

export function PettyCashDetailClient({
  float,
  custodian,
  error,
}: PettyCashDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmArchive, setConfirmArchive] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [archiving, startArchive] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  if (!float) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-6 pb-12 pt-6">
        <Link
          href={PETTY_CASH_PATH}
          className="inline-flex items-center gap-1 text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Petty cash
        </Link>
        <div className="mt-6">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load this petty cash float: {error ?? 'Not found.'}
          </Alert>
        </div>
      </div>
    );
  }

  const status = (float.status ?? 'active') as CrmPettyCashStatus;
  const currency = float.currency || 'INR';
  const opening = float.openingBalance ?? 0;
  const current = float.currentBalance ?? opening;
  const drawn = Math.max(0, opening - current);
  const low = status === 'active' && opening > 0 && current < opening * 0.1;
  const title =
    float.branchName || float.custodianName || 'Petty cash float';
  const custodianLabel = custodian?.label || float.custodianName || null;
  const custodianHref =
    custodian && float.custodianId
      ? `/sabcrm/people/${encodeURIComponent(float.custodianId)}`
      : null;

  const transition = (next: CrmPettyCashStatus, success: string): void => {
    startTransition(async () => {
      const res = await transitionSabcrmPettyCashStatus(float._id, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(success);
      refresh();
    });
  };

  const handleArchive = (): void => {
    startArchive(async () => {
      const res = await deleteSabcrmPettyCashFloat(float._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Float archived.');
      router.push(PETTY_CASH_PATH);
      router.refresh();
    });
  };

  const menuItems: ConvertMenuItem[] = [
    {
      key: 'archive',
      label: 'Archive float',
      icon: Archive,
      danger: true,
      onSelect: () => setConfirmArchive(true),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 pb-12 pt-6">
      <Link
        href={PETTY_CASH_PATH}
        className="inline-flex items-center gap-1 text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Petty cash
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-semibold tracking-tight text-[var(--st-text)]">
            {title}
          </h1>
          <div className="mt-2">
            <StatusFlow
              flow={PETTY_CASH_FLOW}
              statuses={PETTY_CASH_STATUSES}
              current={status}
            />
          </div>
        </div>
        <div
          className="flex flex-wrap items-center gap-2"
          role="toolbar"
          aria-label="Float actions"
        >
          {status === 'active' ? (
            <Button
              variant="secondary"
              iconLeft={Lock}
              loading={transitioning}
              onClick={() => transition('closed', 'Float closed.')}
            >
              Close float
            </Button>
          ) : null}
          {status === 'closed' ? (
            <Button
              variant="primary"
              iconLeft={LockOpen}
              loading={transitioning}
              onClick={() => transition('active', 'Float reopened.')}
            >
              Reopen float
            </Button>
          ) : null}
          <Button
            variant="secondary"
            iconLeft={FilePenLine}
            onClick={() => setEditOpen(true)}
          >
            Edit
          </Button>
          <ConvertMenu label="More" items={menuItems} disabled={transitioning} />
        </div>
      </div>

      {low ? (
        <div className="mt-4">
          <Alert tone="warning" role="alert">
            <span className="inline-flex items-center gap-1.5">
              <TriangleAlert size={14} aria-hidden="true" />
              Balance is below 10% of the opening float — time to replenish.
            </span>
          </Alert>
        </div>
      ) : null}

      <div className="fdoc-detail">
        {/* ─── Balance card (main column) ───────────────────────── */}
        <section className="fdoc-paper" aria-label={`Float ${title}`}>
          <div className="fdoc-paper__head">
            <div>
              <h2 className="fdoc-paper__title">{title}</h2>
              <span className="fdoc-cell-sub">Petty cash float</span>
            </div>
            <div>
              <span className="fdoc-detail__meta-label">Custodian</span>
              <span className="fdoc-detail__meta-value">
                {custodianLabel ? (
                  custodianHref ? (
                    <Link href={custodianHref} data-noprint-link="">
                      {custodianLabel}
                    </Link>
                  ) : (
                    custodianLabel
                  )
                ) : (
                  <span className="fdoc-unknown-party">No custodian</span>
                )}
              </span>
            </div>
          </div>

          <div className="fdoc-detail__meta">
            {float.branchName ? (
              <div>
                <span className="fdoc-detail__meta-label">Branch</span>
                <span className="fdoc-detail__meta-value">
                  {float.branchName}
                </span>
              </div>
            ) : null}
            <div>
              <span className="fdoc-detail__meta-label">Currency</span>
              <span className="fdoc-detail__meta-value">{currency}</span>
            </div>
            <div>
              <span className="fdoc-detail__meta-label">Created</span>
              <span className="fdoc-detail__meta-value">
                {formatDocDate(float.createdAt)}
              </span>
            </div>
            {float.updatedAt ? (
              <div>
                <span className="fdoc-detail__meta-label">Updated</span>
                <span className="fdoc-detail__meta-value">
                  {formatDocDate(float.updatedAt)}
                </span>
              </div>
            ) : null}
          </div>

          <div className="fdoc-lines__footer" data-section="totals">
            <div />
            <dl className="fdoc-totals">
              <dt className="fdoc-totals__label">Opening balance</dt>
              <dd className="fdoc-totals__value">
                {formatDocMoney(opening, currency)}
              </dd>
              {drawn > 0 ? (
                <>
                  <dt className="fdoc-totals__label">Drawn down</dt>
                  <dd className="fdoc-totals__value">
                    −{formatDocMoney(drawn, currency)}
                  </dd>
                </>
              ) : null}
              <div className="fdoc-totals__grand">
                <dt className="fdoc-totals__label">Current balance</dt>
                <dd className="fdoc-totals__value">
                  {formatDocMoney(current, currency)}
                </dd>
              </div>
            </dl>
          </div>

          {float.notes ? (
            <div className="fdoc-paper__notes">
              <h4>Notes</h4>
              {float.notes}
            </div>
          ) : null}
        </section>

        {/* ─── Rail ─────────────────────────────────────────────── */}
        <aside className="fdoc-rail" aria-label="Float context">
          <Card variant="outlined">
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-1.5">
                  <UserRound size={14} aria-hidden="true" /> Custodian
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              {custodianLabel ? (
                <>
                  {custodianHref ? (
                    <Link
                      href={custodianHref}
                      className="text-sm font-medium text-[var(--st-accent)] hover:underline"
                    >
                      {custodianLabel}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium">
                      {custodianLabel}
                    </span>
                  )}
                  <span className="fdoc-cell-sub">
                    {custodian
                      ? (custodian.email ?? 'CRM person record')
                      : 'Non-CRM custodian (free text)'}
                  </span>
                </>
              ) : (
                <span className="fdoc-unknown-party text-sm">
                  No custodian on record
                </span>
              )}
            </CardBody>
          </Card>

          <Card variant="outlined">
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-1.5">
                  <Vault size={14} aria-hidden="true" /> Float level
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <span className="text-sm font-medium">
                {opening > 0
                  ? `${Math.round((current / opening) * 100)}% of opening`
                  : 'No opening balance set'}
              </span>
              <div className="mt-2">
                <Badge tone={low ? 'danger' : status === 'active' ? 'success' : 'neutral'} dot>
                  {low
                    ? 'Refill needed'
                    : status === 'active'
                      ? 'Healthy'
                      : 'Closed'}
                </Badge>
              </div>
              <span className="fdoc-cell-sub">
                The current balance is drained and topped up by petty-cash
                vouchers.
              </span>
            </CardBody>
          </Card>
        </aside>
      </div>

      <PettyCashFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={float}
        onDone={refresh}
      />

      <AlertDialog
        open={confirmArchive}
        onOpenChange={(next) => {
          if (!next && !archiving) setConfirmArchive(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this float?</AlertDialogTitle>
            <AlertDialogDescription>
              The float disappears from the list (crm-common soft delete).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={archiving}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={archiving} onClick={handleArchive}>
              Archive float
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

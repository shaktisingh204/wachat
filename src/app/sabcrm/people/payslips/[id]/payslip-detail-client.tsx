'use client';

/**
 * SabCRM People — Payslip detail client (WI-33).
 *
 * Branches the WI-9 unified shape (risk R7 — `runId` presence):
 *
 *   - RICH run-generated payslips render the full frozen snapshot on
 *     the DocDetailPage paper: employee snapshot party, statutory meta
 *     (PAN/UAN/ESIC), earnings (+) and deductions (−) line groups,
 *     reimbursements, gross→subTotal / netPay→total, plus rail cards
 *     for attendance summary, YTD, leave balances, masked bank info and
 *     the download log. The parent payroll run links out as lineage.
 *   - FLAT legacy payslips map their fixed component fields
 *     (basic/hra/allowances vs pf/esi/tax/other deductions) onto the
 *     same paper with the flat status vocabulary.
 *
 * Actions: Mark sent (the only legal rich mutation), Print
 * (`window.print()` — the kit paper is the print region) and Delete
 * (flat only, danger).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  CalendarCheck,
  Download,
  Printer,
  Send,
  Trash2,
  TrendingUp,
  Trees,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  toast,
} from '@/components/sabcrm/20ui';

import {
  DocDetailPage,
  formatDocDate,
  formatDocMoney,
  type DocDetailLine,
  type DocRelatedRef,
  type DocStatusDef,
} from '../../../finance/_components/doc-surface';
import {
  PAYSLIP_FLAT_DETAIL_STATUSES,
  PAYSLIP_FLAT_FLOW,
  PAYSLIP_RICH_DETAIL_STATUSES,
  PAYSLIP_RICH_FLOW,
  PAYSLIP_RICH_STATUS,
  PEOPLE_PAYSLIPS_PATH,
  isRichSabcrmPayslip,
  payrollRunDetailHref,
  peopleEmployeeHref,
} from '../payslips-config';

import {
  deleteSabcrmPayslip,
  markSabcrmPayslipSent,
} from '@/app/actions/sabcrm-people-payslips.actions';
import type {
  CrmPayslipDoc,
  SabcrmPayslipDetail,
  SabcrmRichPayslipDoc,
} from '@/app/actions/sabcrm-people-payslips.actions.types';

/* ─── Helpers ─────────────────────────────────────────────────── */

const CURRENCY = 'INR';

function fmtMonth(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

interface PaperData {
  docNumber: string;
  statuses: DocStatusDef[];
  flow: string[];
  status: string;
  party: { label: string; href: string | null; meta?: string | null };
  meta: { label: string; value: React.ReactNode }[];
  lines: DocDetailLine[];
  totals: { subTotal: number; total: number };
  related: DocRelatedRef[];
  sent: boolean;
  isFlat: boolean;
}

function line(
  description: string,
  amount: number,
  kindLabel: 'Earning' | 'Deduction' | 'Reimbursement',
): DocDetailLine {
  const signed = kindLabel === 'Deduction' ? -Math.abs(amount) : amount;
  return {
    description,
    itemLabel: kindLabel,
    qty: 1,
    rate: signed,
    total: signed,
  };
}

function richPaper(
  p: SabcrmRichPayslipDoc,
): PaperData {
  const gross = (p.earnings ?? []).reduce((s, l) => s + (l.amount ?? 0), 0);
  const snapshot = p.employeeSnapshot;
  const lines: DocDetailLine[] = [
    ...(p.earnings ?? []).map((l) => line(l.label || l.code, l.amount, 'Earning')),
    ...(p.deductions ?? []).map((l) =>
      line(l.label || l.code, l.amount, 'Deduction'),
    ),
    ...(p.reimbursements ?? []).map((l) =>
      line(l.category, l.amount, 'Reimbursement'),
    ),
  ];
  return {
    docNumber: `Payslip — ${p.header?.periodLabel || fmtMonth(p.periodFrom)}`,
    statuses: PAYSLIP_RICH_DETAIL_STATUSES,
    flow: [...PAYSLIP_RICH_FLOW],
    status: p.sent ? 'sent' : PAYSLIP_RICH_STATUS,
    party: {
      label: snapshot?.name ?? 'Employee',
      href: p.employeeId ? peopleEmployeeHref(p.employeeId) : null,
      meta:
        [snapshot?.designation, snapshot?.department, snapshot?.employmentId]
          .filter(Boolean)
          .join(' · ') || null,
    },
    meta: [
      {
        label: 'Period',
        value: `${formatDocDate(p.periodFrom)} – ${formatDocDate(p.periodTo)}`,
      },
      ...(p.header?.companyName
        ? [{ label: 'Company', value: p.header.companyName }]
        : []),
      ...(snapshot?.joiningDate
        ? [{ label: 'Joining date', value: formatDocDate(snapshot.joiningDate) }]
        : []),
      ...(snapshot?.pan ? [{ label: 'PAN', value: snapshot.pan }] : []),
      ...(snapshot?.uan ? [{ label: 'UAN', value: snapshot.uan }] : []),
      ...(snapshot?.esic ? [{ label: 'ESIC', value: snapshot.esic }] : []),
      ...(p.sentAt
        ? [{ label: 'Sent', value: formatDocDate(p.sentAt) }]
        : []),
      ...(p.netPayInWords
        ? [
            {
              label: 'Net pay in words',
              value: <em>{p.netPayInWords}</em>,
            },
          ]
        : []),
    ],
    lines,
    totals: { subTotal: gross, total: p.netPay ?? 0 },
    related: p.runId
      ? [
          {
            kind: 'payrollRun',
            id: p.runId,
            label: p.header?.periodLabel || 'Payroll run',
            href: payrollRunDetailHref(p.runId),
            direction: 'parent',
          },
        ]
      : [],
    sent: Boolean(p.sent),
    isFlat: false,
  };
}

function flatPaper(
  p: CrmPayslipDoc,
  employeeLabel: string | null,
): PaperData {
  const lines: DocDetailLine[] = [
    line('Basic', p.basic ?? 0, 'Earning'),
    line('HRA', p.hra ?? 0, 'Earning'),
    ...(p.allowances ? [line('Allowances', p.allowances, 'Earning')] : []),
    ...(p.pf ? [line('Provident fund', p.pf, 'Deduction')] : []),
    ...(p.esi ? [line('ESI', p.esi, 'Deduction')] : []),
    ...(p.tax ? [line('Tax', p.tax, 'Deduction')] : []),
    ...(p.deductions ? [line('Other deductions', p.deductions, 'Deduction')] : []),
  ];
  return {
    docNumber: `Payslip — ${fmtMonth(p.payPeriod)}`,
    statuses: PAYSLIP_FLAT_DETAIL_STATUSES,
    flow: [...PAYSLIP_FLAT_FLOW],
    status: p.status ?? 'draft',
    party: {
      label: p.employeeName?.trim() || employeeLabel || 'Employee',
      href: p.employeeId ? peopleEmployeeHref(p.employeeId) : null,
      meta: 'Legacy manual payslip',
    },
    meta: [
      { label: 'Pay period', value: fmtMonth(p.payPeriod) },
      ...(p.issuedAt
        ? [{ label: 'Issued', value: formatDocDate(p.issuedAt) }]
        : []),
      ...(p.createdAt
        ? [{ label: 'Created', value: formatDocDate(p.createdAt) }]
        : []),
    ],
    lines,
    totals: { subTotal: p.gross ?? 0, total: p.net ?? 0 },
    related: [],
    sent: p.status === 'issued' || p.status === 'paid',
    isFlat: true,
  };
}

/* ─── Rich rail cards ─────────────────────────────────────────── */

function StatList({
  rows,
}: {
  rows: { label: string; value: React.ReactNode }[];
}): React.JSX.Element {
  return (
    <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
      {rows.map((row) => (
        <React.Fragment key={row.label}>
          <dt className="m-0 text-[var(--st-text-secondary)]">{row.label}</dt>
          <dd className="m-0 text-right tabular-nums">{row.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function RichRail({ p }: { p: SabcrmRichPayslipDoc }): React.JSX.Element {
  const att = p.attendanceSummary;
  const ytd = p.ytd;
  const bank = p.bankInfoSnapshot;
  const leaves = Object.entries(p.leaveBalanceSnapshot ?? {});
  const downloads = p.downloadedLog ?? [];
  return (
    <>
      {att ? (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck size={14} aria-hidden="true" /> Attendance
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <StatList
              rows={[
                { label: 'Working days', value: att.workingDays },
                { label: 'Present', value: att.present },
                { label: 'Leaves', value: att.leaves },
                { label: 'Holidays', value: att.holidays },
                { label: 'Loss of pay', value: att.lop },
              ]}
            />
          </CardBody>
        </Card>
      ) : null}

      {ytd ? (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-1.5">
                <TrendingUp size={14} aria-hidden="true" /> Year to date
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <StatList
              rows={[
                { label: 'Gross', value: formatDocMoney(ytd.gross, CURRENCY) },
                { label: 'Net', value: formatDocMoney(ytd.net, CURRENCY) },
                {
                  label: 'Tax paid',
                  value: formatDocMoney(ytd.taxPaid, CURRENCY),
                },
              ]}
            />
          </CardBody>
        </Card>
      ) : null}

      {leaves.length > 0 ? (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-1.5">
                <Trees size={14} aria-hidden="true" /> Leave balances
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <StatList
              rows={leaves.map(([code, balance]) => ({
                label: code,
                value: balance,
              }))}
            />
          </CardBody>
        </Card>
      ) : null}

      {bank ? (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-1.5">
                <Banknote size={14} aria-hidden="true" /> Bank transfer
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <StatList
              rows={[
                { label: 'Bank', value: bank.bankName },
                {
                  label: 'Account',
                  value: (
                    <span className="font-mono">{bank.accountNoMasked}</span>
                  ),
                },
                { label: 'IFSC', value: bank.ifsc },
                { label: 'Name', value: bank.nameOnAccount },
              ]}
            />
          </CardBody>
        </Card>
      ) : null}

      {downloads.length > 0 ? (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-1.5">
                <Download size={14} aria-hidden="true" /> Download log
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="fdoc-rail-list">
              {downloads.map((entry, i) => (
                <li key={i} className="fdoc-rail-item">
                  <span>
                    {entry.by}
                    <span className="fdoc-rail-item__kind">
                      {formatDocDate(entry.at)}
                      {entry.ip ? ` · ${entry.ip}` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface PayslipDetailClientProps {
  detail: SabcrmPayslipDetail | null;
  error: string | null;
}

export function PayslipDetailClient({
  detail,
  error,
}: PayslipDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [working, startWork] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();

  if (!detail) {
    return (
      <DocDetailPage
        backHref={PEOPLE_PAYSLIPS_PATH}
        backLabel="Payslips"
        docNumber="Payslip"
        entitySingular="Payslip"
        statuses={PAYSLIP_RICH_DETAIL_STATUSES}
        flow={[...PAYSLIP_RICH_FLOW]}
        status={PAYSLIP_RICH_STATUS}
        party={null}
        meta={[]}
        currency={CURRENCY}
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Payslip not found.'}
      />
    );
  }

  const { payslip, employeeLabel } = detail;
  const rich = isRichSabcrmPayslip(payslip);
  const paper = rich
    ? richPaper(payslip)
    : flatPaper(payslip as CrmPayslipDoc, employeeLabel);
  const id = payslip._id;

  const markSent = (): void => {
    startWork(async () => {
      const res = await markSabcrmPayslipSent(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Payslip marked as sent.');
      router.refresh();
    });
  };

  const handleDelete = (): void => {
    startDelete(async () => {
      const res = await deleteSabcrmPayslip(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Payslip deleted.');
      router.push(PEOPLE_PAYSLIPS_PATH);
      router.refresh();
    });
  };

  const actions = (
    <>
      {!paper.sent ? (
        <Button
          variant="primary"
          iconLeft={Send}
          loading={working}
          onClick={markSent}
        >
          Mark sent
        </Button>
      ) : null}
      <Button
        variant="secondary"
        iconLeft={Printer}
        onClick={() => window.print()}
      >
        Print
      </Button>
      {paper.isFlat ? (
        <Button
          variant="danger"
          iconLeft={Trash2}
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </Button>
      ) : null}
    </>
  );

  return (
    <>
      <DocDetailPage
        backHref={PEOPLE_PAYSLIPS_PATH}
        backLabel="Payslips"
        docNumber={paper.docNumber}
        entitySingular="Payslip"
        statuses={paper.statuses}
        flow={paper.flow}
        status={paper.status}
        actions={actions}
        party={paper.party}
        meta={paper.meta}
        currency={CURRENCY}
        lines={paper.lines}
        totals={paper.totals}
        related={paper.related}
        railExtra={rich ? <RichRail p={payslip} /> : undefined}
      />

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(next) => !next && !deleting && setConfirmDelete(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payslip?</AlertDialogTitle>
            <AlertDialogDescription>
              The legacy payslip is removed permanently. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete payslip
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

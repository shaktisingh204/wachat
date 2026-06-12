'use client';

/**
 * SabCRM Finance — Payment accounts list client
 * (`/sabcrm/finance/payment-accounts`), 20ui.
 *
 * Same shape as the shared finance-doc client but with account-flavoured
 * columns (name, type, opening balance, default flag, status) and a
 * "New account" dialog (name, type, opening balance, currency) →
 * `createSabcrmPaymentAccount`. Delete is a crm-common-style archive.
 *
 * ONLY `@/components/sabcrm/20ui` barrel imports (repo rule); every
 * action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Landmark, Plus, Trash2 } from 'lucide-react';

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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SelectField,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  type BadgeTone,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import {
  createSabcrmPaymentAccount,
  deleteSabcrmPaymentAccount,
} from '@/app/actions/sabcrm-finance.actions';

import '@/components/sabcrm/20ui/surface-crm-base.css';

// ---------------------------------------------------------------------------
// Types + display helpers
// ---------------------------------------------------------------------------

/** Flat row shape the server page narrows account documents into. */
export interface PaymentAccountRow {
  id: string;
  name: string;
  type: string;
  openingBalance: number;
  currency: string;
  isDefault: boolean;
  status: string;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  active: 'success',
  inactive: 'neutral',
  archived: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  archived: 'Archived',
};

const TYPE_LABEL: Record<string, string> = {
  bank: 'Bank',
  cash: 'Cash',
  upi: 'UPI',
  wallet: 'Wallet',
  employee: 'Employee',
};

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'bank', label: 'Bank' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'employee', label: 'Employee' },
];

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ---------------------------------------------------------------------------
// New-account dialog
// ---------------------------------------------------------------------------

interface NewAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function NewAccountDialog({
  open,
  onOpenChange,
  onCreated,
}: NewAccountDialogProps): React.JSX.Element {
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<string | null>('bank');
  const [openingBalance, setOpeningBalance] = React.useState('');
  const [currency, setCurrency] = React.useState<string | null>('INR');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const reset = React.useCallback(() => {
    setName('');
    setType('bank');
    setOpeningBalance('');
    setCurrency('INR');
    setError(null);
  }, []);

  const handleOpenChange = (next: boolean): void => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = (): void => {
    if (!name.trim()) {
      setError('An account name is required.');
      return;
    }
    if (!type) {
      setError('Pick an account type.');
      return;
    }
    const parsedBalance =
      openingBalance.trim() === '' ? 0 : Number(openingBalance);
    if (!Number.isFinite(parsedBalance)) {
      setError('Opening balance must be a number.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await createSabcrmPaymentAccount({
        accountName: name.trim(),
        accountType: type,
        openingBalance: parsedBalance,
        currency: currency ?? undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      reset();
      onOpenChange(false);
      onCreated();
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby="new-payment-account-desc">
        <DialogHeader>
          <DialogTitle>New payment account</DialogTitle>
          <DialogDescription id="new-payment-account-desc">
            Add a bank, cash, UPI, or wallet account to track money in
            this workspace.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label="Account name" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="HDFC Current"
                autoFocus
                disabled={pending}
              />
            </Field>

            <Field label="Account type" required>
              <SelectField
                value={type}
                onChange={setType}
                options={TYPE_OPTIONS}
                disabled={pending}
              />
            </Field>

            <Field label="Opening balance">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
                disabled={pending}
              />
            </Field>

            <Field label="Currency">
              <SelectField
                value={currency}
                onChange={setCurrency}
                options={CURRENCY_OPTIONS}
                disabled={pending}
              />
            </Field>

            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={pending}>
              Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page client
// ---------------------------------------------------------------------------

export interface PaymentAccountsClientProps {
  initialRows: PaymentAccountRow[];
  /** Non-null when the list fetch failed (e.g. the Rust engine is down). */
  initialError: string | null;
}

export function PaymentAccountsClient({
  initialRows,
  initialError,
}: PaymentAccountsClientProps): React.JSX.Element {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] =
    React.useState<PaymentAccountRow | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  const handleDelete = (): void => {
    const target = confirmDelete;
    if (!target) return;
    setDeleteError(null);
    startDelete(async () => {
      const res = await deleteSabcrmPaymentAccount(target.id);
      if (!res.ok) {
        setDeleteError(res.error);
        return;
      }
      setConfirmDelete(null);
      refresh();
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1040px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Payment accounts</PageTitle>
          <PageDescription>
            Bank, cash, UPI, and wallet accounts for this workspace — part
            of the SabCRM Finance suite.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => setDialogOpen(true)}
          >
            New account
          </Button>
        </PageActions>
      </PageHeader>

      {initialError ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load payment accounts: {initialError}
          </Alert>
        </div>
      ) : null}

      {!initialError && initialRows.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={Landmark}
            title="No payment accounts yet"
            description="Add your first account to start tracking money movement in this workspace."
            action={
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={() => setDialogOpen(true)}
              >
                New account
              </Button>
            }
          />
        </div>
      ) : null}

      {initialRows.length > 0 ? (
        <div className="mt-4">
          <Table hover>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th align="right">Opening balance</Th>
                <Th>Status</Th>
                <Th align="right" width={64}>
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {initialRows.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    {row.name}
                    {row.isDefault ? (
                      <span className="ml-2 align-middle">
                        <Badge tone="info">Default</Badge>
                      </span>
                    ) : null}
                  </Td>
                  <Td>{TYPE_LABEL[row.type] ?? row.type}</Td>
                  <Td align="right">
                    {formatAmount(row.openingBalance, row.currency)}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[row.status] ?? 'neutral'} dot>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={Trash2}
                      aria-label={`Archive account ${row.name}`}
                      onClick={() => {
                        setDeleteError(null);
                        setConfirmDelete(row);
                      }}
                    >
                      Archive
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      ) : null}

      <NewAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={refresh}
      />

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(next) => {
          if (!next && !deleting) {
            setConfirmDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Archive {confirmDelete?.name ?? 'this account'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The account is hidden from pickers and lists. Its history is
              preserved and an admin can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <Alert tone="danger" role="alert">
              {deleteError}
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Archive account
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

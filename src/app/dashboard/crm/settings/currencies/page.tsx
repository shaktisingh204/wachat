'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSwitch,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import Papa from 'papaparse';
import { AlertTriangle,
  Check,
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * Currencies — settings-style list (§1D.4 specialized: settings list).
 *
 * Mirrors `accounting/groups/page.tsx`: a single client component with
 * inline-create dialog, edit dialog, and delete confirmation. No
 * `/new` or `/[id]` subroutes — settings master-data uses dialogs.
 *
 * Backed by `crmCurrenciesApi` (Rust `/v1/crm/currencies`) through the
 * `crm-currencies.actions.ts` server actions. ISO 4217 fields plus a
 * per-tenant `isBase` flag with a warning that flipping it demotes any
 * other currency currently marked as base.
 */

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { RowDrawer } from '@/components/crm/row-drawer';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    deleteCurrency,
    getCurrencies,
    saveCurrency,
} from '@/app/actions/crm-currencies.actions';
import type {
    CrmCurrencyDoc,
    CrmCurrencyDisplayFormat,
    CrmCurrencyStatus,
} from '@/lib/rust-client/crm-currencies';

type Row = CrmCurrencyDoc;
type StatusFilter = 'all' | 'active' | 'archived';

const saveInitialState: { message?: string; error?: string } = {};

const STATUS_TONE: Record<CrmCurrencyStatus, StatusTone> = {
    active: 'green',
    archived: 'neutral',
};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? 'Save changes' : 'Create currency'}
        </ZoruButton>
    );
}

function CurrencyDialog({
    isOpen,
    onOpenChange,
    onSave,
    initialData,
    hasExistingBase,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
    initialData: Row | null;
    /** Another currency in the table is already isBase — used to drive the warning. */
    hasExistingBase: boolean;
}) {
    const isEditing = !!initialData;
    const [state, formAction] = useActionState(saveCurrency, saveInitialState);
    const { toast } = useZoruToast();

    const [isBase, setIsBase] = React.useState<boolean>(!!initialData?.isBase);
    const [isActive, setIsActive] = React.useState<boolean>(initialData?.isActive ?? true);
    const [displayFormat, setDisplayFormat] = React.useState<CrmCurrencyDisplayFormat>(
        initialData?.displayFormat ?? 'prefix',
    );

    React.useEffect(() => {
        if (!isOpen) return;
        setIsBase(!!initialData?.isBase);
        setIsActive(initialData?.isActive ?? true);
        setDisplayFormat(initialData?.displayFormat ?? 'prefix');
    }, [isOpen, initialData]);

    React.useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
            onSave();
            onOpenChange(false);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onSave, onOpenChange]);

    // Warning shows when the user is about to set isBase=true while another
    // currency is currently the base. (Suppressed when editing the existing
    // base currency since toggling its own flag is the intent.)
    const wouldDemoteOthers =
        isBase && hasExistingBase && !(initialData?.isBase ?? false);

    return (
        <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-[560px]">
                <form action={formAction}>
                    {isEditing ? (
                        <input type="hidden" name="_id" value={initialData!._id} />
                    ) : null}
                    {/* Hidden mirrors of the controlled toggles so they post via FormData. */}
                    <input type="hidden" name="isBase" value={isBase ? 'true' : 'false'} />
                    <input type="hidden" name="isActive" value={isActive ? 'true' : 'false'} />
                    <input type="hidden" name="displayFormat" value={displayFormat} />

                    <ZoruDialogHeader>
                        <ZoruDialogTitle>
                            {isEditing ? 'Edit currency' : 'Create new currency'}
                        </ZoruDialogTitle>
                    </ZoruDialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="code">Code (ISO 4217) *</ZoruLabel>
                                <ZoruInput
                                    id="code"
                                    name="code"
                                    placeholder="USD"
                                    required
                                    maxLength={3}
                                    minLength={3}
                                    autoCapitalize="characters"
                                    defaultValue={initialData?.code}
                                    style={{ textTransform: 'uppercase' }}
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="symbol">Symbol</ZoruLabel>
                                <ZoruInput
                                    id="symbol"
                                    name="symbol"
                                    placeholder="$"
                                    defaultValue={initialData?.symbol ?? ''}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel htmlFor="name">Name *</ZoruLabel>
                            <ZoruInput
                                id="name"
                                name="name"
                                placeholder="US Dollar"
                                required
                                defaultValue={initialData?.name}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="exchangeRate">Exchange rate</ZoruLabel>
                                <ZoruInput
                                    id="exchangeRate"
                                    name="exchangeRate"
                                    type="number"
                                    step="0.000001"
                                    min="0"
                                    placeholder="1"
                                    defaultValue={initialData?.exchangeRate ?? 1}
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="decimalPlaces">Decimal places</ZoruLabel>
                                <ZoruInput
                                    id="decimalPlaces"
                                    name="decimalPlaces"
                                    type="number"
                                    step="1"
                                    min="0"
                                    max="8"
                                    placeholder="2"
                                    defaultValue={initialData?.decimalPlaces ?? 2}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="displayFormat">Display format</ZoruLabel>
                                <ZoruSelect
                                    value={displayFormat}
                                    onValueChange={(v) => setDisplayFormat(v as CrmCurrencyDisplayFormat)}
                                >
                                    <ZoruSelectTrigger id="displayFormat">
                                        <ZoruSelectValue placeholder="Pick…" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="prefix">Prefix ($100)</ZoruSelectItem>
                                        <ZoruSelectItem value="suffix">Suffix (100$)</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="thousandSeparator">Thousands</ZoruLabel>
                                    <ZoruInput
                                        id="thousandSeparator"
                                        name="thousandSeparator"
                                        placeholder=","
                                        maxLength={3}
                                        defaultValue={initialData?.thousandSeparator ?? ','}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="decimalSeparator">Decimal</ZoruLabel>
                                    <ZoruInput
                                        id="decimalSeparator"
                                        name="decimalSeparator"
                                        placeholder="."
                                        maxLength={3}
                                        defaultValue={initialData?.decimalSeparator ?? '.'}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                            <div className="flex flex-col">
                                <ZoruLabel htmlFor="isBase-switch" className="text-sm font-medium">
                                    Base currency
                                </ZoruLabel>
                                <span className="text-xs text-muted-foreground">
                                    Only one currency per tenant can be the base.
                                </span>
                            </div>
                            <ZoruSwitch
                                id="isBase-switch"
                                checked={isBase}
                                onCheckedChange={setIsBase}
                            />
                        </div>

                        {wouldDemoteOthers ? (
                            <div
                                role="alert"
                                className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
                            >
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>
                                    This will demote other currencies marked as base.
                                </span>
                            </div>
                        ) : null}

                        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                            <div className="flex flex-col">
                                <ZoruLabel htmlFor="isActive-switch" className="text-sm font-medium">
                                    Active
                                </ZoruLabel>
                                <span className="text-xs text-muted-foreground">
                                    Inactive currencies stay in reports but hide from pickers.
                                </span>
                            </div>
                            <ZoruSwitch
                                id="isActive-switch"
                                checked={isActive}
                                onCheckedChange={setIsActive}
                            />
                        </div>
                    </div>

                    <ZoruDialogFooter>
                        <ZoruButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </ZoruButton>
                        <SubmitButton isEditing={isEditing} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

export default function CurrenciesPage() {
    const [rows, setRows] = React.useState<Row[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [editing, setEditing] = React.useState<Row | null>(null);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('active');
    const [pendingDelete, setPendingDelete] = React.useState<Row | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useZoruToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        const data = await getCurrencies();
        setRows(data);
        setIsLoading(false);
    }, []);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (statusFilter !== 'all' && r.status !== statusFilter) return false;
            if (!q) return true;
            return `${r.code} ${r.name} ${r.symbol ?? ''}`.toLowerCase().includes(q);
        });
    }, [rows, search, statusFilter]);

    const hasExistingBase = React.useMemo(
        () => rows.some((r) => r.isBase),
        [rows],
    );

    const handleOpenDialog = (row: Row | null) => {
        setEditing(row);
        setIsDialogOpen(true);
    };

    const handleDelete = () => {
        if (!pendingDelete) return;
        startDeleteTransition(async () => {
            const result = await deleteCurrency(pendingDelete._id);
            if (result.success) {
                toast({ title: 'Currency deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const handleExport = () => {
        const csv = Papa.unparse(
            filtered.map((r) => ({
                Code: r.code,
                Name: r.name,
                Symbol: r.symbol ?? '',
                'Exchange rate': r.exchangeRate,
                'Decimal places': r.decimalPlaces,
                Base: r.isBase ? 'Yes' : 'No',
                Status: r.status,
            })),
        );
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'currencies.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <>
            <CurrencyDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={refresh}
                initialData={editing}
                hasExistingBase={hasExistingBase}
            />

            <EntityListShell
                    title="Currencies"
                    subtitle="Manage ISO 4217 currencies, symbols, exchange rates, and display formatting."
                    primaryAction={
                        <>
                            <ZoruButton variant="outline" onClick={handleExport}>
                                Export CSV
                            </ZoruButton>
                            <ZoruButton onClick={() => handleOpenDialog(null)}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New Currency
                            </ZoruButton>
                        </>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search by code, name, or symbol…',
                    }}
                    filters={
                        <ZoruSelect
                            value={statusFilter}
                            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                        >
                            <ZoruSelectTrigger className="h-9 w-[180px]">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="active">Active</ZoruSelectItem>
                                <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    }
                    loading={isLoading && rows.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-border hover:bg-transparent">
                                    <ZoruTableHead className="text-muted-foreground">Code</ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">Name</ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">Symbol</ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground text-right">
                                        Exchange rate
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground text-right">
                                        Decimals
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground text-center">
                                        Base
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground text-right">
                                        Actions
                                    </ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-border">
                                        <ZoruTableCell colSpan={8} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : filtered.length === 0 ? (
                                    <ZoruTableRow className="border-border">
                                        <ZoruTableCell
                                            colSpan={8}
                                            className="h-24 text-center text-muted-foreground"
                                        >
                                            No currencies match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    filtered.map((r) => (
                                        <ZoruTableRow key={r._id} className="border-border">
                                            <ZoruTableCell className="font-mono font-medium text-foreground">
                                                {r.code}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-foreground">
                                                <RowDrawer
                                                    label={r.name}
                                                    subtitle={`${r.code}${r.symbol ? ` · ${r.symbol}` : ''}`}
                                                    title={`Currency · ${r.name}`}
                                                    description="Review currency settings, then open the editor to change them."
                                                >
                                                    <div className="space-y-3 text-sm">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <div className="text-muted-foreground text-xs">Code</div>
                                                                <div className="font-mono">{r.code}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-muted-foreground text-xs">Symbol</div>
                                                                <div className="font-mono">{r.symbol ?? '—'}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-muted-foreground text-xs">Exchange rate</div>
                                                                <div className="font-mono">
                                                                    {Number(r.exchangeRate).toLocaleString(undefined, {
                                                                        maximumFractionDigits: 6,
                                                                    })}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-muted-foreground text-xs">Decimals</div>
                                                                <div className="font-mono">{r.decimalPlaces}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-muted-foreground text-xs">Display</div>
                                                                <div>{r.displayFormat}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-muted-foreground text-xs">Base</div>
                                                                <div>{r.isBase ? 'Yes' : 'No'}</div>
                                                            </div>
                                                        </div>
                                                        <div className="pt-2">
                                                            <ZoruButton
                                                                size="sm"
                                                                onClick={() => handleOpenDialog(r)}
                                                            >
                                                                <Edit className="mr-1.5 h-3.5 w-3.5" />
                                                                Open editor
                                                            </ZoruButton>
                                                        </div>
                                                    </div>
                                                </RowDrawer>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-foreground">
                                                {r.symbol ?? '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-foreground">
                                                {Number(r.exchangeRate).toLocaleString(undefined, {
                                                    maximumFractionDigits: 6,
                                                })}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-foreground">
                                                {r.decimalPlaces}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-center">
                                                {r.isBase ? (
                                                    <Check
                                                        className="mx-auto h-4 w-4 text-emerald-500"
                                                        aria-label="Base currency"
                                                    />
                                                ) : (
                                                    <span aria-hidden className="text-muted-foreground">
                                                        —
                                                    </span>
                                                )}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <StatusPill
                                                    label={r.status}
                                                    tone={STATUS_TONE[r.status] ?? 'neutral'}
                                                />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                <ZoruButton
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleOpenDialog(r)}
                                                    aria-label={`Edit ${r.code}`}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </ZoruButton>
                                                <ZoruButton
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setPendingDelete(r)}
                                                    aria-label={`Delete ${r.code}`}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </ZoruButton>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </EntityListShell>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete currency?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.code} – {pendingDelete?.name}&rdquo; will
                            remove it from pickers. Existing documents that reference it will keep
                            the saved values.
                            {pendingDelete?.isBase ? (
                                <span className="mt-2 block font-medium text-destructive">
                                    Warning: this is your base currency.
                                </span>
                            ) : null}
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            Delete
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}

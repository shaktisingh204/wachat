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
  Button,
  Checkbox,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Switch,
  Table,
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
 * Additions over the original:
 *  - Checkbox multi-select column
 *  - Bulk bar: delete (non-default only) + set active + set inactive
 */

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { RowDrawer } from '@/components/crm/row-drawer';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    bulkDeleteCurrencies,
    bulkSetCurrencyStatus,
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
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? 'Save changes' : 'Create currency'}
        </Button>
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

    const wouldDemoteOthers =
        isBase && hasExistingBase && !(initialData?.isBase ?? false);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-[560px]">
                <form action={formAction}>
                    {isEditing ? (
                        <input type="hidden" name="_id" value={initialData!._id} />
                    ) : null}
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
                                <Label htmlFor="code">Code (ISO 4217) *</Label>
                                <Input
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
                                <Label htmlFor="symbol">Symbol</Label>
                                <Input
                                    id="symbol"
                                    name="symbol"
                                    placeholder="$"
                                    defaultValue={initialData?.symbol ?? ''}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="US Dollar"
                                required
                                defaultValue={initialData?.name}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="exchangeRate">Exchange rate</Label>
                                <Input
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
                                <Label htmlFor="decimalPlaces">Decimal places</Label>
                                <Input
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
                                <Label htmlFor="displayFormat">Display format</Label>
                                <Select
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
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="thousandSeparator">Thousands</Label>
                                    <Input
                                        id="thousandSeparator"
                                        name="thousandSeparator"
                                        placeholder=","
                                        maxLength={3}
                                        defaultValue={initialData?.thousandSeparator ?? ','}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="decimalSeparator">Decimal</Label>
                                    <Input
                                        id="decimalSeparator"
                                        name="decimalSeparator"
                                        placeholder="."
                                        maxLength={3}
                                        defaultValue={initialData?.decimalSeparator ?? '.'}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-zoru-line px-3 py-2.5">
                            <div className="flex flex-col">
                                <Label htmlFor="isBase-switch" className="text-sm font-medium">
                                    Base currency
                                </Label>
                                <span className="text-xs text-zoru-ink-muted">
                                    Only one currency per tenant can be the base.
                                </span>
                            </div>
                            <Switch
                                id="isBase-switch"
                                checked={isBase}
                                onCheckedChange={setIsBase}
                            />
                        </div>

                        {wouldDemoteOthers ? (
                            <div
                                role="alert"
                                className="flex items-start gap-2 rounded-lg border border-zoru-line/30 bg-zoru-ink/10 px-3 py-2 text-xs text-zoru-ink dark:text-zoru-ink-muted"
                            >
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>
                                    This will demote other currencies marked as base.
                                </span>
                            </div>
                        ) : null}

                        <div className="flex items-center justify-between rounded-lg border border-zoru-line px-3 py-2.5">
                            <div className="flex flex-col">
                                <Label htmlFor="isActive-switch" className="text-sm font-medium">
                                    Active
                                </Label>
                                <span className="text-xs text-zoru-ink-muted">
                                    Inactive currencies stay in reports but hide from pickers.
                                </span>
                            </div>
                            <Switch
                                id="isActive-switch"
                                checked={isActive}
                                onCheckedChange={setIsActive}
                            />
                        </div>
                    </div>

                    <ZoruDialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <SubmitButton isEditing={isEditing} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </Dialog>
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
    const [bulkPending, startBulkTransition] = React.useTransition();
    const { toast } = useZoruToast();

    // Selection
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    // Bulk dialog state
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

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

    // Selection helpers
    const filteredIds = React.useMemo(
        () => filtered.map((r) => r._id),
        [filtered],
    );
    const allChecked =
        filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
    const someChecked = filteredIds.some((id) => selected.has(id));

    const toggleAll = () => {
        if (allChecked) {
            setSelected((prev) => {
                const next = new Set(prev);
                filteredIds.forEach((id) => next.delete(id));
                return next;
            });
        } else {
            setSelected((prev) => {
                const next = new Set(prev);
                filteredIds.forEach((id) => next.add(id));
                return next;
            });
        }
    };

    const toggleOne = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectedIds = React.useMemo(
        () => [...selected].filter((id) => filteredIds.includes(id)),
        [selected, filteredIds],
    );
    // For bulk delete: only non-base currencies can be deleted in bulk
    const selectedNonBaseIds = React.useMemo(
        () => selectedIds.filter((id) => {
            const r = rows.find((row) => row._id === id);
            return r && !r.isBase;
        }),
        [selectedIds, rows],
    );
    const hasSelection = selectedIds.length > 0;

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

    // Bulk delete — only non-base currencies
    const handleBulkDelete = () => {
        startBulkTransition(async () => {
            const res = await bulkDeleteCurrencies(selectedNonBaseIds);
            if (res.ok) {
                toast({ title: `${res.count} currency/currencies deleted` });
                setSelected(new Set());
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
            setBulkDeleteOpen(false);
            await refresh();
        });
    };

    // Bulk set active/inactive
    const handleBulkSetStatus = (status: 'active' | 'archived') => {
        startBulkTransition(async () => {
            const res = await bulkSetCurrencyStatus(selectedIds, status);
            if (res.ok) {
                toast({ title: `${res.count} currency/currencies updated` });
                setSelected(new Set());
                await refresh();
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
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
                        <Button variant="outline" onClick={handleExport}>
                            Export CSV
                        </Button>
                        <Button onClick={() => handleOpenDialog(null)}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Currency
                        </Button>
                    </>
                }
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Search by code, name, or symbol…',
                }}
                filters={
                    <Select
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
                    </Select>
                }
                loading={isLoading && rows.length === 0}
            >
                {/* KPI strip */}
                {(() => {
                    const totalCurrencies = rows.length;
                    const activeCurrencies = rows.filter((r) => r.status === 'active').length;
                    const baseCurrency = rows.find((r) => r.isBase);
                    const multiCurrencyOn = rows.filter((r) => r.status === 'active').length > 1;
                    return (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-3">
                            <StatCard label="Total currencies" value={totalCurrencies.toLocaleString()} />
                            <StatCard label="Active" value={activeCurrencies.toLocaleString()} />
                            <StatCard label="Base currency" value={baseCurrency ? `${baseCurrency.code} ${baseCurrency.symbol ?? ''}`.trim() : '—'} />
                            <StatCard label="Multi-currency" value={multiCurrencyOn ? 'On' : 'Off'} />
                        </div>
                    );
                })()}

                {/* Bulk bar */}
                {hasSelection && (
                    <div className="flex items-center gap-3 rounded-lg border border-zoru-line bg-zoru-surface-2/40 px-4 py-2.5 text-sm mb-3">
                        <span className="font-medium text-zoru-ink">
                            {selectedIds.length} selected
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={bulkPending}
                            onClick={() => handleBulkSetStatus('active')}
                        >
                            {bulkPending ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                            Set active
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={bulkPending}
                            onClick={() => handleBulkSetStatus('archived')}
                        >
                            Set inactive
                        </Button>

                        {selectedNonBaseIds.length > 0 && (
                            <ZoruAlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={bulkPending}
                                    onClick={() => setBulkDeleteOpen(true)}
                                >
                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                    Delete {selectedNonBaseIds.length} non-base
                                </Button>
                                <ZoruAlertDialogContent>
                                    <ZoruAlertDialogHeader>
                                        <ZoruAlertDialogTitle>
                                            Delete {selectedNonBaseIds.length} currency/currencies?
                                        </ZoruAlertDialogTitle>
                                        <ZoruAlertDialogDescription>
                                            Base currencies are skipped. Existing documents that
                                            reference deleted currencies keep their saved values.
                                        </ZoruAlertDialogDescription>
                                    </ZoruAlertDialogHeader>
                                    <ZoruAlertDialogFooter>
                                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                        <ZoruAlertDialogAction onClick={handleBulkDelete} disabled={bulkPending}>
                                            {bulkPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Delete
                                        </ZoruAlertDialogAction>
                                    </ZoruAlertDialogFooter>
                                </ZoruAlertDialogContent>
                            </ZoruAlertDialog>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelected(new Set())}
                        >
                            Clear selection
                        </Button>
                    </div>
                )}

                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="w-10">
                                    <Checkbox
                                        checked={allChecked}
                                        aria-checked={someChecked && !allChecked ? 'mixed' : allChecked}
                                        onCheckedChange={toggleAll}
                                        aria-label="Select all"
                                        disabled={filtered.length === 0}
                                    />
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Code</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Symbol</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">
                                    Exchange rate
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">
                                    Decimals
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-center">
                                    Base
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">
                                    Actions
                                </ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={9} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : filtered.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={9}
                                        className="h-24 text-center text-zoru-ink-muted"
                                    >
                                        No currencies match this filter.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                filtered.map((r) => (
                                    <ZoruTableRow key={r._id} className="border-zoru-line">
                                        <ZoruTableCell>
                                            <Checkbox
                                                checked={selected.has(r._id)}
                                                onCheckedChange={() => toggleOne(r._id)}
                                                aria-label={`Select ${r.code}`}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-mono font-medium text-zoru-ink">
                                            {r.code}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">
                                            <RowDrawer
                                                label={r.name}
                                                subtitle={`${r.code}${r.symbol ? ` · ${r.symbol}` : ''}`}
                                                title={`Currency · ${r.name}`}
                                                description="Review currency settings, then open the editor to change them."
                                            >
                                                <div className="space-y-3 text-sm">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <div className="text-zoru-ink-muted text-xs">Code</div>
                                                            <div className="font-mono">{r.code}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-zoru-ink-muted text-xs">Symbol</div>
                                                            <div className="font-mono">{r.symbol ?? '—'}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-zoru-ink-muted text-xs">Exchange rate</div>
                                                            <div className="font-mono">
                                                                {Number(r.exchangeRate).toLocaleString(undefined, {
                                                                    maximumFractionDigits: 6,
                                                                })}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-zoru-ink-muted text-xs">Decimals</div>
                                                            <div className="font-mono">{r.decimalPlaces}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-zoru-ink-muted text-xs">Display</div>
                                                            <div>{r.displayFormat}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-zoru-ink-muted text-xs">Base</div>
                                                            <div>{r.isBase ? 'Yes' : 'No'}</div>
                                                        </div>
                                                    </div>
                                                    <div className="pt-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleOpenDialog(r)}
                                                        >
                                                            <Edit className="mr-1.5 h-3.5 w-3.5" />
                                                            Open editor
                                                        </Button>
                                                    </div>
                                                </div>
                                            </RowDrawer>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">
                                            {r.symbol ?? '—'}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                            {Number(r.exchangeRate).toLocaleString(undefined, {
                                                maximumFractionDigits: 6,
                                            })}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                            {r.decimalPlaces}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-center">
                                            {r.isBase ? (
                                                <Check
                                                    className="mx-auto h-4 w-4 text-zoru-ink"
                                                    aria-label="Base currency"
                                                />
                                            ) : (
                                                <span aria-hidden className="text-zoru-ink-muted">
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
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleOpenDialog(r)}
                                                aria-label={`Edit ${r.code}`}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setPendingDelete(r)}
                                                aria-label={`Delete ${r.code}`}
                                            >
                                                <Trash2 className="h-4 w-4 text-zoru-ink" />
                                            </Button>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </Table>
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
                                <span className="mt-2 block font-medium text-zoru-ink">
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

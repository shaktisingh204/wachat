'use client';

import * as React from 'react';
import { SmartCombobox } from '@/components/wabasimplify/smart-combobox';
import { getCrmChartOfAccounts, getCrmAccountGroups } from '@/app/actions/crm-accounting.actions';
import { CrmChartOfAccountDialog } from '@/components/wabasimplify/crm-chart-of-account-dialog';

interface Option {
    value: string;
    label: string;
}

interface SmartLedgerSelectProps {
    value?: string;
    onSelect: (value: string, label: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    initialOptions?: Option[];
    accountGroups?: any[]; // Pass this if we can to avoid refetching in dialog, but dialog fetches? No dialog takes props.
}

export function SmartLedgerSelect({
    value,
    onSelect,
    placeholder = "Select Ledger",
    disabled = false,
    className,
    initialOptions = [],
}: SmartLedgerSelectProps) {
    const [options, setOptions] = React.useState<Option[]>(initialOptions);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [accountGroups, setAccountGroups] = React.useState<any[]>([]);

    const fetchData = React.useCallback(async () => {
        // Fetch ledgers only if initialOptions are not provided
        if (initialOptions.length === 0) {
            const ledgerData = await getCrmChartOfAccounts();
            setOptions(ledgerData.map(d => ({ value: d._id.toString(), label: d.name })));
        }

        // Fetch groups for the dialog
        const groups = await getCrmAccountGroups();
        setAccountGroups(groups);
    }, [initialOptions.length]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleLedgerAdded = async () => {
        await fetchData();
        setIsDialogOpen(false);
    };

    return (
        <>
            <SmartCombobox
                options={options}
                value={value}
                onSelect={(val) => {
                    const option = options.find(o => o.value === val);
                    onSelect(val, option?.label || val);
                }}
                placeholder={placeholder}
                searchPlaceholder="Search ledger..."
                onCreate={(query) => {
                    setSearchQuery(query);
                    setIsDialogOpen(true);
                }}
                disabled={disabled}
                className={className}
            />

            <CrmChartOfAccountDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={handleLedgerAdded}
                accountGroups={accountGroups}
                initialData={searchQuery ? { name: searchQuery } as any : null}
            />
        </>
    );
}

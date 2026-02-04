'use client';

import * as React from 'react';
import { SmartCombobox } from '@/components/wabasimplify/smart-combobox';
import { CrmAddClientDialog } from '@/components/wabasimplify/crm-add-client-dialog';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';

interface Option {
    value: string;
    label: string;
}

interface SmartClientSelectProps {
    value?: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    // Optional pre-fetched options to avoid fetch waterfalls if parent already has data
    initialOptions?: Option[];
    onClientAdded?: (client: any) => void;
}

export function SmartClientSelect({
    value,
    onSelect,
    placeholder = "Select Client...",
    disabled = false,
    className,
    initialOptions = [],
    onClientAdded
}: SmartClientSelectProps) {
    const [options, setOptions] = React.useState<Option[]>(initialOptions);
    const [loading, setLoading] = React.useState(false);

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [newItemName, setNewItemName] = React.useState("");

    // Fetch clients (Accounts) on mount if not provided
    React.useEffect(() => {
        if (initialOptions.length > 0) return;

        const fetchClients = async () => {
            setLoading(true); // Though combobox doesn't have a loading state for options currently
            try {
                const { accounts } = await getCrmAccounts(1, 100); // Fetch top 100 Accounts
                const formatted = accounts.map(c => ({
                    value: c._id.toString(),
                    label: c.name || "Unknown"
                }));
                setOptions(formatted);
            } catch (error) {
                console.error("Failed to fetch clients", error);
            } finally {
                setLoading(false);
            }
        };

        fetchClients();
    }, [initialOptions.length]);

    const handleCreate = (inputValue: string) => {
        setNewItemName(inputValue);
        setIsDialogOpen(true);
    };

    const handleClientAdded = (newClient?: any) => {
        setIsDialogOpen(false);
        if (newClient && newClient.accountId) {
            const newOption = {
                value: newClient.accountId.toString(), // Use Account ID
                label: newClient.company || newClient.name || newItemName
            };
            setOptions(prev => [...prev, newOption]);
            onSelect(newClient.accountId?.toString() || newClient._id.toString());
            if (onClientAdded) {
                onClientAdded(newClient);
            }
        }
    };

    return (
        <>
            <SmartCombobox
                options={options}
                value={value}
                onSelect={onSelect}
                onCreate={handleCreate}
                placeholder={placeholder}
                searchPlaceholder="Search clients..."
                createLabel="Create Client"
                disabled={disabled}
                className={className}
            />
            {isDialogOpen && (
                <CrmAddClientDialog
                    onClientAdded={handleClientAdded}
                    defaultOpen={true}
                    defaultName={newItemName}
                />
            )}
        </>
    );
}

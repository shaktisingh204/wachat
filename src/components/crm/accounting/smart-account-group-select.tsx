'use client';

import * as React from 'react';
import { SmartCombobox } from '@/components/wabasimplify/smart-combobox';
import { getCrmAccountGroups } from '@/app/actions/crm-accounting.actions';
import { AddAccountGroupDialog } from './add-account-group-dialog';

interface Option {
    value: string;
    label: string;
}

interface SmartAccountGroupSelectProps {
    value?: string;
    onSelect: (value: string, label: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    initialOptions?: Option[];
}

export function SmartAccountGroupSelect({
    value,
    onSelect,
    placeholder = "Select Account Group",
    disabled = false,
    className,
    initialOptions = [],
}: SmartAccountGroupSelectProps) {
    const [options, setOptions] = React.useState<Option[]>(initialOptions);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');

    const fetchGroups = React.useCallback(async () => {
        const data = await getCrmAccountGroups();
        setOptions(data.map(d => ({ value: d._id.toString(), label: d.name })));
    }, []);

    // Fetch on mount if no initial options
    React.useEffect(() => {
        if (initialOptions.length === 0) {
            fetchGroups();
        }
    }, []);

    const handleGroupAdded = async () => {
        // Refresh options after adding
        await fetchGroups();
        setIsDialogOpen(false);
        // We can try to select the newly added group if we knew its name, 
        // but for now we just refresh list and let user search it (it will be in list).
        // If we want to auto-select, we'd need the action to return the created object.
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
                searchPlaceholder="Search group..."
                onCreate={(query) => {
                    setSearchQuery(query);
                    setIsDialogOpen(true);
                }}
                disabled={disabled}
                className={className}
            />

            <AddAccountGroupDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onGroupAdded={handleGroupAdded}
                defaultName={searchQuery}
            />
        </>
    );
}

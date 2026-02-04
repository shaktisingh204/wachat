'use client';

import * as React from 'react';
import { SmartCombobox } from '@/components/wabasimplify/smart-combobox';
import { AddIndustryDialog } from './add-industry-dialog'; // We will create this
import { getCrmIndustries } from '@/app/actions/crm-inventory-settings.actions'; // We will add this

interface Option {
    value: string;
    label: string;
}

interface SmartIndustrySelectProps {
    value?: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    initialOptions?: Option[];
}

export function SmartIndustrySelect({
    value,
    onSelect,
    placeholder = "Select Industry...",
    disabled = false,
    className,
    initialOptions = [],
}: SmartIndustrySelectProps) {
    const [options, setOptions] = React.useState<Option[]>(initialOptions);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [newItemName, setNewItemName] = React.useState("");

    const fetchIndustries = React.useCallback(async () => {
        if (options.length === 0) {
            const data = await getCrmIndustries();
            setOptions(data.map(d => ({ value: d._id.toString(), label: d.name })));
        }
    }, [options.length]);

    React.useEffect(() => {
        fetchIndustries();
    }, [fetchIndustries]);

    const handleCreate = (inputValue: string) => {
        setNewItemName(inputValue);
        setIsDialogOpen(true);
    };

    const handleIndustryAdded = (newIndustry: any) => {
        const newOption = { value: newIndustry._id.toString(), label: newIndustry.name };
        setOptions(prev => [...prev, newOption]);
        onSelect(newIndustry._id.toString());
        setIsDialogOpen(false);
    };

    return (
        <>
            <SmartCombobox
                options={options}
                value={value}
                onSelect={onSelect}
                onCreate={handleCreate}
                placeholder={placeholder}
                searchPlaceholder="Search industries..."
                createLabel="Add Industry"
                disabled={disabled}
                className={className}
            />
            <AddIndustryDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                defaultName={newItemName}
                onIndustryAdded={handleIndustryAdded}
            />
        </>
    );
}

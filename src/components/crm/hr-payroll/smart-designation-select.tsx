'use client';

import * as React from 'react';
import { SmartCombobox } from '@/components/wabasimplify/smart-combobox';
import { AddDesignationDialog } from '@/components/crm/hr-payroll/add-designation-dialog';
import { getCrmDesignations } from '@/app/actions/crm-employees.actions';

interface Option {
    value: string;
    label: string;
}

interface SmartDesignationSelectProps {
    value?: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    initialOptions?: Option[];
}

export function SmartDesignationSelect({
    value,
    onSelect,
    placeholder = "Select Designation...",
    disabled = false,
    className,
    initialOptions = [],
}: SmartDesignationSelectProps) {
    const [options, setOptions] = React.useState<Option[]>(initialOptions);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [newItemName, setNewItemName] = React.useState("");

    const fetchDesignations = React.useCallback(async () => {
        if (options.length === 0) {
            const data = await getCrmDesignations();
            setOptions(data.map(d => ({ value: d._id.toString(), label: d.name })));
        }
    }, [options.length]);

    React.useEffect(() => {
        fetchDesignations();
    }, [fetchDesignations]);

    const handleCreate = (inputValue: string) => {
        setNewItemName(inputValue);
        setIsDialogOpen(true);
    };

    return (
        <>
            <SmartCombobox
                options={options}
                value={value}
                onSelect={onSelect}
                onCreate={handleCreate}
                placeholder={placeholder}
                searchPlaceholder="Search designations..."
                createLabel="Add Designation"
                disabled={disabled}
                className={className}
            />
            <AddDesignationDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                defaultName={newItemName}
                onDesignationAdded={(designation) => {
                    if (designation && designation._id) {
                        const newOption = { value: designation._id.toString(), label: designation.name };
                        setOptions(prev => [...prev, newOption]);
                        onSelect(designation._id.toString());
                    }
                    setIsDialogOpen(false);
                }}
            />
        </>
    );
}

'use client';

import * as React from 'react';
import { SmartCombobox } from '@/components/wabasimplify/smart-combobox';
import { AddDepartmentDialog } from '@/components/crm/hr-payroll/add-department-dialog';
import { getCrmDepartments } from '@/app/actions/crm-employees.actions';

interface Option {
    value: string;
    label: string;
}

interface SmartDepartmentSelectProps {
    value?: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    initialOptions?: Option[];
}

export function SmartDepartmentSelect({
    value,
    onSelect,
    placeholder = "Select Department...",
    disabled = false,
    className,
    initialOptions = [],
}: SmartDepartmentSelectProps) {
    const [options, setOptions] = React.useState<Option[]>(initialOptions);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [newItemName, setNewItemName] = React.useState("");

    const fetchDepartments = React.useCallback(async () => {
        if (options.length === 0) {
            const data = await getCrmDepartments();
            setOptions(data.map(d => ({ value: d._id.toString(), label: d.name })));
        }
    }, [options.length]);

    React.useEffect(() => {
        fetchDepartments();
    }, [fetchDepartments]);

    const handleCreate = (inputValue: string) => {
        setNewItemName(inputValue);
        setIsDialogOpen(true);
    };

    const handleDepartmentAdded = (newDepartment: any) => {
        // newDepartment might be { message: ... } or the object depending on action return
        // We need to ensure action returns the object. 
        // The current saveCrmDepartment returns { message: ... }. 
        // I will need to update the action to return the new object.
        // For now, I will assume I will trigger a refetch or manually add if I have the ID.
        // Since I don't have the ID from the current action, I might need to update the action first.
        // But let's proceed and then update the action.
        fetchDepartments(); // Refetching is safer if action doesn't return ID
        // Ideally we select the new one. 
        // I'll update the action next.
    };

    return (
        <>
            <SmartCombobox
                options={options}
                value={value}
                onSelect={onSelect}
                onCreate={handleCreate}
                placeholder={placeholder}
                searchPlaceholder="Search departments..."
                createLabel="Add Department"
                disabled={disabled}
                className={className}
            />
            <AddDepartmentDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                defaultName={newItemName}
                onDepartmentAdded={(dept) => {
                    // Since action currently doesn't return full object, we might list refresh
                    // But for smooth UX we want to select it.
                    // I will update the action to return the object.
                    if (dept && dept._id) {
                        const newOption = { value: dept._id.toString(), label: dept.name };
                        setOptions(prev => [...prev, newOption]);
                        onSelect(dept._id.toString());
                    }
                    setIsDialogOpen(false);
                }}
            />
        </>
    );
}

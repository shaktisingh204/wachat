'use client';

import * as React from "react";
import { SmartCombobox } from "@/components/wabasimplify/smart-combobox";
import { getCrmVendorTypes } from "@/app/actions/crm-vendors.actions";
import { AddVendorTypeDialog } from "@/components/crm/purchases/add-vendor-type-dialog";

interface SmartVendorTypeSelectProps {
    value?: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    initialOptions?: { value: string; label: string }[];
}

export function SmartVendorTypeSelect({
    value,
    onSelect,
    placeholder = "Select Vendor Type...",
    disabled = false,
    className,
    initialOptions = [],
}: SmartVendorTypeSelectProps) {
    const [options, setOptions] = React.useState<{ value: string; label: string }[]>(initialOptions);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [newItemName, setNewItemName] = React.useState('');

    const fetchTypes = React.useCallback(async () => {
        if (options.length === 0) {
            const data = await getCrmVendorTypes();
            setOptions(data.map(d => ({ value: d.name, label: d.name }))); // Using name as value since vendorType is string
        }
    }, [options.length]);

    React.useEffect(() => {
        if (initialOptions.length === 0) {
            fetchTypes();
        }
    }, [initialOptions, fetchTypes]);

    const handleCreate = (inputValue: string) => {
        setNewItemName(inputValue);
        setIsDialogOpen(true);
    };

    const handleTypeAdded = (newType: any) => {
        setIsDialogOpen(false);
        if (newType && newType.name) {
            const newOption = {
                value: newType.name,
                label: newType.name
            };
            setOptions(prev => [...prev, newOption]);
            onSelect(newType.name);
        }
    };

    return (
        <>
            <SmartCombobox
                options={options}
                value={value}
                onSelect={onSelect}
                placeholder={placeholder}
                searchPlaceholder="Search types..."
                disabled={disabled}
                className={className}
                onCreate={handleCreate}
                createLabel="Add Vendor Type"
            />
            <AddVendorTypeDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                defaultName={newItemName}
                onTypeAdded={handleTypeAdded}
            />
        </>
    );
}

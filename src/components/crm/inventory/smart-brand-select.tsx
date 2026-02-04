'use client';

import * as React from "react";
import { SmartCombobox } from "@/components/wabasimplify/smart-combobox";
import { getCrmBrands } from "@/app/actions/crm-inventory-settings.actions";
import { AddBrandDialog } from "./add-brand-dialog";

interface SmartBrandSelectProps {
    value?: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    initialOptions?: { value: string; label: string }[];
}

export function SmartBrandSelect({
    value,
    onSelect,
    placeholder = "Select Brand...",
    disabled = false,
    className,
    initialOptions = [],
}: SmartBrandSelectProps) {
    const [options, setOptions] = React.useState<{ value: string; label: string }[]>(initialOptions);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [newItemName, setNewItemName] = React.useState('');

    const fetchBrands = React.useCallback(async () => {
        if (options.length === 0) {
            const data = await getCrmBrands();
            setOptions(data.map(d => ({ value: d._id.toString(), label: d.name })));
        }
    }, [options.length]);

    React.useEffect(() => {
        if (initialOptions.length === 0) {
            fetchBrands();
        }
    }, [initialOptions, fetchBrands]);

    const handleCreate = (inputValue: string) => {
        setNewItemName(inputValue);
        setIsDialogOpen(true);
    };

    const handleBrandAdded = (newBrand: any) => {
        setIsDialogOpen(false);
        if (newBrand && newBrand._id) {
            const newOption = {
                value: newBrand._id.toString(),
                label: newBrand.name
            };
            setOptions(prev => [...prev, newOption]);
            onSelect(newBrand._id.toString());
        }
    };

    return (
        <>
            <SmartCombobox
                options={options}
                value={value}
                onSelect={onSelect}
                placeholder={placeholder}
                searchPlaceholder="Search brands..."
                disabled={disabled}
                className={className}
                onCreate={handleCreate}
            />
            <AddBrandDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                defaultName={newItemName}
                onBrandAdded={handleBrandAdded}
            />
        </>
    );
}

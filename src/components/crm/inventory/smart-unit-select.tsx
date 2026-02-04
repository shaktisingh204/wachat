'use client';

import * as React from "react";
import { SmartCombobox } from "@/components/wabasimplify/smart-combobox";
import { getCrmUnits } from "@/app/actions/crm-inventory-settings.actions";
import { AddUnitDialog } from "./add-unit-dialog";

interface SmartUnitSelectProps {
    value?: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    initialOptions?: { value: string; label: string }[];
}

export function SmartUnitSelect({
    value,
    onSelect,
    placeholder = "Select Unit...",
    disabled = false,
    className,
    initialOptions = [],
}: SmartUnitSelectProps) {
    const [options, setOptions] = React.useState<{ value: string; label: string }[]>(initialOptions);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [newItemName, setNewItemName] = React.useState('');

    const fetchUnits = React.useCallback(async () => {
        if (options.length === 0) {
            const data = await getCrmUnits();
            setOptions(data.map(d => ({ value: d._id.toString(), label: `${d.name} (${d.symbol})` })));
        }
    }, [options.length]);

    React.useEffect(() => {
        if (initialOptions.length === 0) {
            fetchUnits();
        }
    }, [initialOptions, fetchUnits]);

    const handleCreate = (inputValue: string) => {
        setNewItemName(inputValue);
        setIsDialogOpen(true);
    };

    const handleUnitAdded = (newUnit: any) => {
        setIsDialogOpen(false);
        if (newUnit && newUnit._id) {
            const newOption = {
                value: newUnit._id.toString(),
                label: `${newUnit.name} (${newUnit.symbol})`
            };
            setOptions(prev => [...prev, newOption]);
            onSelect(newUnit._id.toString());
        }
    };

    return (
        <>
            <SmartCombobox
                options={options}
                value={value}
                onSelect={onSelect}
                placeholder={placeholder}
                searchPlaceholder="Search units..."
                disabled={disabled}
                className={className}
                onCreate={handleCreate}
            />
            <AddUnitDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                defaultName={newItemName}
                onUnitAdded={handleUnitAdded}
            />
        </>
    );
}

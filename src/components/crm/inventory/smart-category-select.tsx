'use client';

import * as React from "react";
import { SmartCombobox } from "@/components/wabasimplify/smart-combobox";
import { getCrmCategories } from "@/app/actions/crm-inventory-settings.actions";
import { AddCategoryDialog } from "./add-category-dialog";

interface SmartCategorySelectProps {
    value?: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    initialOptions?: { value: string; label: string }[];
}

export function SmartCategorySelect({
    value,
    onSelect,
    placeholder = "Select Category...",
    disabled = false,
    className,
    initialOptions = [],
}: SmartCategorySelectProps) {
    const [options, setOptions] = React.useState<{ value: string; label: string }[]>(initialOptions);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [newItemName, setNewItemName] = React.useState('');

    const fetchCategories = React.useCallback(async () => {
        if (options.length === 0) {
            const data = await getCrmCategories();
            setOptions(data.map(d => ({ value: d._id.toString(), label: d.name })));
        }
    }, [options.length]);

    React.useEffect(() => {
        if (initialOptions.length === 0) {
            fetchCategories();
        }
    }, [initialOptions, fetchCategories]);

    const handleCreate = (inputValue: string) => {
        setNewItemName(inputValue);
        setIsDialogOpen(true);
    };

    const handleCategoryAdded = (newCategory: any) => {
        setIsDialogOpen(false);
        if (newCategory && newCategory._id) {
            const newOption = {
                value: newCategory._id.toString(),
                label: newCategory.name
            };
            setOptions(prev => [...prev, newOption]);
            onSelect(newCategory._id.toString());
        }
    };

    return (
        <>
            <SmartCombobox
                options={options}
                value={value}
                onSelect={onSelect}
                placeholder={placeholder}
                searchPlaceholder="Search categories..."
                disabled={disabled}
                className={className}
                onCreate={handleCreate}
            />
            <AddCategoryDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                defaultName={newItemName}
                onCategoryAdded={handleCategoryAdded}
            />
        </>
    );
}

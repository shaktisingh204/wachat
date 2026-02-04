'use client';

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useDebouncedCallback } from 'use-debounce';
import { SmartCombobox } from "@/components/wabasimplify/smart-combobox";
import { getCrmVendors } from "@/app/actions/crm-vendors.actions";
import { CrmAddVendorDialog } from "@/components/wabasimplify/crm-add-vendor-dialog";

interface SmartVendorSelectProps {
    value?: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    initialOptions?: { value: string; label: string }[];
    onVendorAdded?: (vendor: any) => void;
}

export function SmartVendorSelect({
    value,
    onSelect,
    placeholder = "Select Vendor...",
    disabled = false,
    className,
    initialOptions = [],
    onVendorAdded
}: SmartVendorSelectProps) {
    const [options, setOptions] = React.useState<{ value: string; label: string }[]>(initialOptions);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [newItemName, setNewItemName] = React.useState('');

    const fetchVendors = useDebouncedCallback(async (query: string) => {
        // Since getCrmVendors doesn't support query yet, we fetch all and filter client-side if needed
        // Or better: update getCrmVendors to support filtering. 
        // For now, assuming relatively small list, we might just rely on initial render or refetch.
        // Actually SmartCombobox does client filtering on the options provided.
        // So we just need to load data. 

        // If we want async loading:
        if (options.length === 0) {
            const data = await getCrmVendors(); // Fetch usage
            setOptions(data.map(d => ({ value: d._id.toString(), label: d.name })));
        }
    }, 300);

    // Initial fetch if no options provided
    React.useEffect(() => {
        if (initialOptions.length === 0) {
            fetchVendors('');
        }
    }, [initialOptions, fetchVendors]);

    const handleCreate = (inputValue: string) => {
        setNewItemName(inputValue);
        setIsDialogOpen(true);
    };

    const handleVendorAdded = (newVendor?: any) => {
        setIsDialogOpen(false);
        if (newVendor && newVendor._id) {
            const newOption = {
                value: newVendor._id.toString(),
                label: newVendor.name || newItemName
            };
            setOptions(prev => [...prev, newOption]);
            onSelect(newVendor._id.toString());
            if (onVendorAdded) {
                onVendorAdded(newVendor);
            }
        }
    };

    return (
        <>
            <SmartCombobox
                options={options}
                value={value}
                onSelect={onSelect}
                placeholder={placeholder}
                searchPlaceholder="Search vendors..."
                disabled={disabled}
                className={className}
                onCreate={handleCreate}
            />
            <CrmAddVendorDialog
                defaultOpen={isDialogOpen}
                defaultName={newItemName}
                onVendorAdded={handleVendorAdded}
            />
        </>
    );
}

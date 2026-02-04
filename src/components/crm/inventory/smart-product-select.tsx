'use client';

import * as React from "react";
import { SmartCombobox } from "@/components/wabasimplify/smart-combobox";
import { getCrmProducts } from "@/app/actions/crm-products.actions";

interface SmartProductSelectProps {
    value?: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export function SmartProductSelect({
    value,
    onSelect,
    placeholder = "Select Product...",
    disabled = false,
    className,
}: SmartProductSelectProps) {
    const [options, setOptions] = React.useState<{ value: string; label: string }[]>([]);

    const fetchProducts = React.useCallback(async () => {
        if (options.length === 0) {
            // Fetch all products for selection. Might need pagination support in SmartCombobox for large sets later.
            const { products } = await getCrmProducts(1, 100);
            setOptions(products.map(d => ({ value: d._id.toString(), label: `${d.name} (${d.sku})` })));
        }
    }, [options.length]);

    React.useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    return (
        <SmartCombobox
            options={options}
            value={value}
            onSelect={onSelect}
            placeholder={placeholder}
            searchPlaceholder="Search products..."
            disabled={disabled}
            className={className}
        // No onCreate for products from here typically
        />
    );
}

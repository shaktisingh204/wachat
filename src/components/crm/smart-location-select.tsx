'use client';

import * as React from 'react';
import { Country, State, City } from 'country-state-city';
import { SmartCombobox } from '@/components/wabasimplify/smart-combobox';

interface SmartLocationSelectProps {
    type: 'country' | 'state' | 'city';
    selectedCountryCode?: string;
    selectedStateCode?: string;
    value?: string;
    onSelect: (value: string, displayValue: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export function SmartLocationSelect({
    type,
    selectedCountryCode,
    selectedStateCode,
    value,
    onSelect,
    placeholder,
    disabled = false,
    className
}: SmartLocationSelectProps) {
    const options = React.useMemo(() => {
        switch (type) {
            case 'country':
                return Country.getAllCountries().map(c => ({
                    value: c.isoCode,
                    label: c.name
                }));
            case 'state':
                if (!selectedCountryCode) return [];
                return State.getStatesOfCountry(selectedCountryCode).map(s => ({
                    value: s.isoCode,
                    label: s.name
                }));
            case 'city':
                if (!selectedCountryCode || !selectedStateCode) return [];
                return City.getCitiesOfState(selectedCountryCode, selectedStateCode).map(c => ({
                    value: c.name, // Cities don't have ISO codes usually, distinct by name
                    label: c.name
                }));
            default:
                return [];
        }
    }, [type, selectedCountryCode, selectedStateCode]);

    const handleSelect = (val: string) => {
        const option = options.find(o => o.value === val);
        onSelect(val, option?.label || val);
    };

    return (
        <SmartCombobox
            options={options}
            value={value}
            onSelect={handleSelect}
            placeholder={placeholder || `Select ${type}...`}
            searchPlaceholder={`Search ${type}...`}
            disabled={disabled || (type !== 'country' && !selectedCountryCode) || (type === 'city' && !selectedStateCode)}
            className={className}
        // We don't support "Create New" currently for standard locations
        // But we could add it if needed later
        />
    );
}

'use client';

import * as React from 'react';
import { SmartCombobox } from '@/components/wabasimplify/smart-combobox';
import { CrmAddPipelineDialog } from '@/components/wabasimplify/crm-add-pipeline-dialog';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';

interface Option {
    value: string;
    label: string;
}

interface SmartPipelineSelectProps {
    value?: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    initialOptions?: Option[];
    onPipelineAdded?: (pipeline: any) => void;
}

export function SmartPipelineSelect({
    value,
    onSelect,
    placeholder = "Select Pipeline...",
    disabled = false,
    className,
    initialOptions = [],
    onPipelineAdded
}: SmartPipelineSelectProps) {
    const [options, setOptions] = React.useState<Option[]>(initialOptions);
    const [loading, setLoading] = React.useState(false);

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [newItemName, setNewItemName] = React.useState("");

    // Update options when initialOptions change
    React.useEffect(() => {
        if (initialOptions.length > 0) {
            setOptions(initialOptions);
        }
    }, [initialOptions]);

    // Fetch if no initial options provided (fallback)
    React.useEffect(() => {
        if (initialOptions.length > 0) return;

        const fetchPipelines = async () => {
            setLoading(true);
            try {
                const pipelines = await getCrmPipelines();
                const formatted = pipelines.map(p => ({
                    value: p.id,
                    label: p.name
                }));
                // Only set if we don't have initial options to avoid overwriting
                if (initialOptions.length === 0) {
                    setOptions(formatted);
                }
            } catch (error) {
                console.error("Failed to fetch pipelines", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPipelines();
    }, [initialOptions.length]);

    const handleCreate = (inputValue: string) => {
        setNewItemName(inputValue);
        setIsDialogOpen(true);
    };

    const handlePipelineAdded = (newPipeline?: any) => {
        setIsDialogOpen(false);
        if (newPipeline && newPipeline.id) {
            const newOption = {
                value: newPipeline.id,
                label: newPipeline.name
            };
            setOptions(prev => [...prev, newOption]);
            onSelect(newPipeline.id);
            if (onPipelineAdded) {
                onPipelineAdded(newPipeline);
            }
        }
    };

    return (
        <>
            <SmartCombobox
                options={options}
                value={value}
                onSelect={onSelect}
                onCreate={handleCreate}
                placeholder={placeholder}
                searchPlaceholder="Search pipelines..."
                createLabel="Create Pipeline"
                disabled={disabled}
                className={className}
            />
            {isDialogOpen && (
                <CrmAddPipelineDialog
                    onPipelineAdded={handlePipelineAdded}
                    defaultOpen={true}
                    defaultName={newItemName}
                />
            )}
        </>
    );
}

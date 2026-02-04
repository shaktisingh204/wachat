'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, LoaderCircle, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

interface Option {
    value: string;
    label: string;
}

interface SmartComboboxProps {
    options: Option[];
    value?: string;
    onSelect: (value: string) => void;
    onCreate?: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    createLabel?: string;
    isLoading?: boolean;
    disabled?: boolean;
    className?: string;
}

export function SmartCombobox({
    options,
    value,
    onSelect,
    onCreate,
    placeholder = "Select option...",
    searchPlaceholder = "Search...",
    createLabel = "Create",
    isLoading = false,
    disabled = false,
    className
}: SmartComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState("");

    const selectedLabel = React.useMemo(() => {
        return options.find((option) => option.value === value)?.label;
    }, [options, value]);

    return (
        <Popover open={open} onOpenChange={setOpen} modal={true}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between", !value && "text-muted-foreground", className)}
                    disabled={disabled}
                >
                    {selectedLabel || placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput
                        placeholder={searchPlaceholder}
                        value={inputValue}
                        onValueChange={setInputValue}
                    />
                    <CommandList className="max-h-[300px] overflow-y-auto overflow-x-hidden">
                        <CommandEmpty>
                            No results found.
                        </CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={(_) => {
                                        // Ignore cmdk internal value, use the stable loop variable
                                        onSelect(option.value);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        {onCreate && (
                            <>
                                <CommandSeparator />
                                <CommandGroup>
                                    <CommandItem
                                        value={`:::create:::${inputValue}`}
                                        onSelect={() => {
                                            onCreate(inputValue);
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer text-muted-foreground"
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        {createLabel} {inputValue ? `"${inputValue}"` : ""}
                                    </CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover >
    );
}

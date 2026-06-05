'use client';

import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
} from '@/components/sabcrm/20ui';
import {
  Check,
  ChevronsUpDown,
  X } from 'lucide-react';

/**
 * MultiSelectCombobox (wachat-local, 20ui).
 *
 * Drop-in replacement for the wabasimplify multi-select-combobox used
 * by AddContactDialog. Built only on 20ui primitives — neutral palette,
 * no clay tokens.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

export type MultiSelectOption = {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
};

interface MultiSelectComboboxProps {
  options: MultiSelectOption[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelectCombobox({
  options,
  selected,
  onSelectionChange,
  placeholder = 'Select…',
  className,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (currentValue: string) => {
    const newSelected = selected.includes(currentValue)
      ? selected.filter((item) => item !== currentValue)
      : [...selected, currentValue];
    onSelectionChange(newSelected);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cx(
            'h-auto min-h-9 w-full justify-between font-normal',
            className,
          )}
        >
          <div className="flex flex-wrap gap-1">
            {selected.length > 0 ? (
              options
                .filter((option) => selected.includes(option.value))
                .map((option) => (
                  <Badge key={option.value} tone="neutral" kind="soft">
                    {option.label}
                    <button
                      type="button"
                      aria-label={`Remove ${option.label}`}
                      className="ml-1 inline-flex items-center justify-center rounded-full text-[var(--st-text-secondary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSelect(option.value);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(option.value);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
            ) : (
              <span className="text-[var(--st-text-secondary)]">
                {placeholder}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0"
      >
        <Command>
          <CommandInput placeholder="Search tags…" />
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              <ScrollArea className="max-h-60">
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cx(
                        'mr-2 h-4 w-4',
                        selected.includes(option.value)
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </ScrollArea>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

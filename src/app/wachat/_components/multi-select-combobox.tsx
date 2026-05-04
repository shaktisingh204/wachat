'use client';

/**
 * MultiSelectCombobox (wachat-local, ZoruUI).
 *
 * Drop-in replacement for the wabasimplify multi-select-combobox used
 * by AddContactDialog. Built only on Zoru primitives — neutral palette,
 * no clay tokens.
 */

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  ZoruPopover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ZoruScrollArea,
  cn,
} from '@/components/zoruui';

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
    <ZoruPopover open={open} onOpenChange={setOpen} modal>
      <ZoruPopoverTrigger asChild>
        <ZoruButton
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-auto min-h-9 w-full justify-between font-normal',
            className,
          )}
        >
          <div className="flex flex-wrap gap-1">
            {selected.length > 0 ? (
              options
                .filter((option) => selected.includes(option.value))
                .map((option) => (
                  <ZoruBadge
                    key={option.value}
                    variant="secondary"
                    className="px-2 py-0.5"
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 rounded-full focus:outline-none focus:ring-2 focus:ring-zoru-ink"
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
                      <X className="h-3 w-3 text-zoru-ink-muted hover:text-zoru-ink" />
                    </button>
                  </ZoruBadge>
                ))
            ) : (
              <span className="text-zoru-ink-muted">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </ZoruButton>
      </ZoruPopoverTrigger>
      <ZoruPopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0"
      >
        <ZoruCommand>
          <ZoruCommandInput placeholder="Search tags…" />
          <ZoruCommandList>
            <ZoruCommandEmpty>No options found.</ZoruCommandEmpty>
            <ZoruCommandGroup>
              <ZoruScrollArea className="max-h-60">
                {options.map((option) => (
                  <ZoruCommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selected.includes(option.value)
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                    {option.label}
                  </ZoruCommandItem>
                ))}
              </ZoruScrollArea>
            </ZoruCommandGroup>
          </ZoruCommandList>
        </ZoruCommand>
      </ZoruPopoverContent>
    </ZoruPopover>
  );
}

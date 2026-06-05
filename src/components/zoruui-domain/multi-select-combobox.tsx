'use client';

import {
  Button,
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  Popover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  Badge,
  ScrollArea,
  Select,
} from '@/components/zoruui';
import {
  cn } from '@/lib/utils';
import { Check,
  ChevronsUpDown,
  X } from 'lucide-react';

import React from 'react';

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
  placeholder = "Select...",
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
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <ZoruPopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-auto min-h-10", className)}
        >
          <div className="flex gap-1 flex-wrap">
            {selected.length > 0 ? (
              options
                .filter((option) => selected.includes(option.value))
                .map((option) => (
                  <Badge
                    key={option.value}
                    variant="secondary"
                    className="rounded-sm px-2 py-1 font-normal flex items-center gap-1"
                    style={option.color ? { backgroundColor: option.color, color: 'var(--st-text-inverted)' } : {}}
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 rounded-full outline-none ring-offset-zoru-surface focus:ring-2 focus:ring-zoru-line focus:ring-offset-2"
                      onKeyDown={(e) => { if (e.key === "Enter") handleSelect(option.value); }}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => { e.stopPropagation(); handleSelect(option.value); }}
                    >
                      <X className="h-3 w-3 text-zoru-ink-muted hover:text-zoru-ink" />
                    </button>
                  </Badge>
                ))
            ) : (
              <span className="text-zoru-ink-muted font-normal">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </ZoruPopoverTrigger>
      <ZoruPopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <ZoruCommand>
          <ZoruCommandInput placeholder="Search tags..." />
          <ZoruCommandList>
            <ZoruCommandEmpty>No options found.</ZoruCommandEmpty>
            <ZoruCommandGroup>
              <ScrollArea className="max-h-60">
                {options.map((option) => (
                  <ZoruCommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected.includes(option.value) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.color && (
                      <span className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: option.color }} />
                    )}
                    {option.label}
                  </ZoruCommandItem>
                ))}
              </ScrollArea>
            </ZoruCommandGroup>
          </ZoruCommandList>
        </ZoruCommand>
      </ZoruPopoverContent>
    </Popover>
  );
}

'use client';

import * as React from 'react';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, Button, Label, Input, DateRangePicker } from '@/components/sabcrm/20ui/compat';
import { Filter, X, SlidersHorizontal, Save } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

export interface FilterSchemaField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date-range' | 'tags';
  placeholder?: string;
  options?: { label: string; value: string }[];
}

interface CrmFilterPanelProps {
  fields: FilterSchemaField[];
  filters: Record<string, any>;
  onUpdateFilter: (key: string, value: any) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;

  // Saved view/segment support
  savedSegments?: { id: string; name: string }[];
  onApplySegment?: (segmentId: string) => void;
  onSaveSegment?: (name: string) => void;
}

export function CrmFilterPanel({
  fields,
  filters,
  onUpdateFilter,
  onClearFilters,
  hasActiveFilters,
  savedSegments = [],
  onApplySegment,
  onSaveSegment,
}: CrmFilterPanelProps) {
  const [segmentName, setSegmentName] = React.useState('');
  const [showSaveSegment, setShowSaveSegment] = React.useState(false);

  const handleSaveSegment = () => {
    if (onSaveSegment && segmentName.trim()) {
      onSaveSegment(segmentName.trim());
      setSegmentName('');
      setShowSaveSegment(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[12.5px]">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filter Options
          {hasActiveFilters && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--st-text)] text-[10px] text-white">
              {Object.keys(filters).length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[380px] sm:w-[420px] bg-[var(--st-bg-secondary)] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold text-[var(--st-text)] flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filter Panel
          </SheetTitle>
          <SheetDescription className="text-sm text-[var(--st-text-secondary)]">
            Configure multi-dimensional filters or save custom dashboard views.
          </SheetDescription>
        </SheetHeader>

        {/* Saved Segments Section */}
        {savedSegments.length > 0 && (
          <div className="mt-6 border-b border-[var(--st-border)] pb-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)] mb-2.5">
              Saved Views / Segments
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {savedSegments.map((seg) => (
                <Button
                  key={seg.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[12px] bg-[var(--st-bg)]"
                  onClick={() => onApplySegment && onApplySegment(seg.id)}
                >
                  {seg.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Filter Input Fields */}
        <div className="mt-6 space-y-4">
          {fields.map((field) => {
            const val = filters[field.key];

            return (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">
                  {field.label}
                </Label>

                {field.type === 'text' && (
                  <Input
                    placeholder={field.placeholder ?? `Filter by ${field.label.toLowerCase()}`}
                    value={val ?? ''}
                    onChange={(e) => onUpdateFilter(field.key, e.target.value)}
                    className="h-9 text-[13px]"
                  />
                )}

                {field.type === 'select' && (
                  <select
                    className="flex h-9 w-full rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-1.5 text-[13px] text-[var(--st-text)] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--st-border)]"
                    value={val ?? 'all'}
                    onChange={(e) => onUpdateFilter(field.key, e.target.value)}
                  >
                    <option value="all">Any {field.label.toLowerCase()}</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === 'date-range' && (
                  <div className="w-full">
                    <DateRangePicker
                      value={val as DateRange | undefined}
                      onChange={(range) => onUpdateFilter(field.key, range)}
                      placeholder="Select duration presets"
                    />
                  </div>
                )}

                {field.type === 'tags' && (
                  <Input
                    placeholder="Enter tags, separated by commas"
                    value={val ?? ''}
                    onChange={(e) => onUpdateFilter(field.key, e.target.value)}
                    className="h-9 text-[13px]"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Save Segment Block */}
        {onSaveSegment && (
          <div className="mt-8 pt-4 border-t border-[var(--st-border)]">
            {showSaveSegment ? (
              <div className="space-y-2.5">
                <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">
                  Segment Name
                </Label>
                <div className="flex gap-2">
                  <Input
                    size="sm"
                    placeholder="e.g. Q4 High-Value Invoices"
                    value={segmentName}
                    onChange={(e) => setSegmentName(e.target.value)}
                    className="h-9 text-[13px]"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveSegment}
                    className="h-9 gap-1"
                    disabled={!segmentName.trim()}
                  >
                    <Save className="h-3.5 w-3.5" /> Save
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-[12.5px] gap-1.5"
                onClick={() => setShowSaveSegment(true)}
                disabled={!hasActiveFilters}
              >
                <Save className="h-3.5 w-3.5" /> Save current filters as segment
              </Button>
            )}
          </div>
        )}

        <SheetFooter className="mt-8 pt-4 border-t border-[var(--st-border)] flex flex-row items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 text-[12.5px] gap-1 text-[var(--st-danger)] hover:bg-[var(--st-danger)]/10"
              onClick={onClearFilters}
            >
              <X className="h-3.5 w-3.5" /> Reset Filters
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

'use client';

/**
 * Ticket Report filter selects (Priority / Channel / Status).
 *
 * Rendered inside the server `ReportToolbar`'s `<form method="get">` so the
 * page stays URL-driven. Each 20ui `Select` keeps its picked value in local
 * state and mirrors it into a `<input type="hidden" name="...">`, so the
 * existing "Apply" GET submit carries the filter into the query string just
 * like a native form field did, with no JS-required navigation.
 */

import * as React from 'react';
import {
  Field,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';

interface FilterSelectProps {
  name: string;
  label: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}

/** A single label + 20ui Select that submits via a mirrored hidden input. */
function FilterSelect({ name, label, defaultValue, options }: FilterSelectProps) {
  const [value, setValue] = React.useState(defaultValue ?? '');

  return (
    <Field label={label} className="w-36">
      <input type="hidden" name={name} value={value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value || 'all'} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

const PRIORITY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const CHANNEL_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'email', label: 'Email' },
  { value: 'web', label: 'Web' },
  { value: 'phone', label: 'Phone' },
  { value: 'chat', label: 'Chat' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export interface TicketFiltersProps {
  priority?: string;
  channel?: string;
  status?: string;
}

/** The Priority / Channel / Status trio for the ticket report toolbar. */
export function TicketFilters({ priority, channel, status }: TicketFiltersProps) {
  return (
    <>
      <FilterSelect
        name="priority"
        label="Priority"
        defaultValue={priority}
        options={PRIORITY_OPTIONS}
      />
      <FilterSelect
        name="channel"
        label="Channel"
        defaultValue={channel}
        options={CHANNEL_OPTIONS}
      />
      <FilterSelect
        name="status"
        label="Status"
        defaultValue={status}
        options={STATUS_OPTIONS}
      />
    </>
  );
}

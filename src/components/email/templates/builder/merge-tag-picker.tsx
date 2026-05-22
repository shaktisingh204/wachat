'use client';

/**
 * Popover listing common merge tags. Clicking one calls back with the
 * `{{tag}}` string so the parent can splice it into the active input.
 */
import { Braces } from 'lucide-react';

import {
  Button,
  Popover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
} from '@/components/zoruui';

interface MergeTag {
  key: string;
  label: string;
  description?: string;
}

const TAGS: MergeTag[] = [
  { key: 'firstName',      label: 'First name',     description: 'Subscriber first name' },
  { key: 'lastName',       label: 'Last name',      description: 'Subscriber last name' },
  { key: 'email',          label: 'Email',          description: 'Subscriber email address' },
  { key: 'companyName',    label: 'Company name',   description: 'Sender company name' },
  { key: 'unsubscribeUrl', label: 'Unsubscribe URL',description: 'One-click opt-out link' },
];

export interface MergeTagPickerProps {
  onPick: (snippet: string) => void;
}

export function MergeTagPicker({ onPick }: MergeTagPickerProps) {
  return (
    <ZoruPopover>
      <ZoruPopoverTrigger asChild>
        <ZoruButton type="button" variant="outline" size="sm">
          <Braces /> Merge tag
        </ZoruButton>
      </ZoruPopoverTrigger>
      <ZoruPopoverContent align="start" className="w-64 p-1">
        <ul role="listbox" aria-label="Merge tags" className="flex flex-col">
          {TAGS.map((tag) => (
            <li key={tag.key}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                className="flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-zoru-surface-2 focus:bg-zoru-surface-2 focus:outline-none"
                onClick={() => onPick(`{{${tag.key}}}`)}
              >
                <span className="font-medium">{tag.label}</span>
                <span className="text-xs text-muted-foreground">
                  <code className="font-mono">{`{{${tag.key}}}`}</code>
                  {tag.description ? ` — ${tag.description}` : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </ZoruPopoverContent>
    </ZoruPopover>
  );
}

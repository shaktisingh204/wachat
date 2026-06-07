'use client';

/**
 * Dropdown listing common merge tags. Selecting one calls back with the
 * `{{tag}}` string so the parent can splice it into the active input.
 */
import { Braces } from 'lucide-react';

import { Button, Menu, MenuItem, MenuLabel } from '@/components/sabcrm/20ui';

interface MergeTag {
  key: string;
  label: string;
  description?: string;
}

const TAGS: MergeTag[] = [
  { key: 'firstName', label: 'First name', description: 'Subscriber first name' },
  { key: 'lastName', label: 'Last name', description: 'Subscriber last name' },
  { key: 'email', label: 'Email', description: 'Subscriber email address' },
  { key: 'companyName', label: 'Company name', description: 'Sender company name' },
  { key: 'unsubscribeUrl', label: 'Unsubscribe URL', description: 'One-click opt-out link' },
];

export interface MergeTagPickerProps {
  onPick: (snippet: string) => void;
}

export function MergeTagPicker({ onPick }: MergeTagPickerProps) {
  return (
    <Menu
      label="Merge tags"
      align="start"
      trigger={
        <Button type="button" variant="outline" size="sm" iconLeft={Braces}>
          Merge tag
        </Button>
      }
    >
      <MenuLabel>Merge tags</MenuLabel>
      {TAGS.map((tag) => (
        <MenuItem
          key={tag.key}
          icon={Braces}
          hint={<code className="font-mono">{`{{${tag.key}}}`}</code>}
          title={tag.description}
          onSelect={() => onPick(`{{${tag.key}}}`)}
        >
          {tag.label}
        </MenuItem>
      ))}
    </Menu>
  );
}

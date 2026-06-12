'use client';

/**
 * doc-surface — ConvertMenu.
 *
 * The detail page's "Convert / actions" dropdown: a 20ui DropdownMenu
 * listing the lineage-aware operations the entity supports from its
 * current status (record payment, create credit note, duplicate, …).
 */

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/sabcrm/20ui';

export interface ConvertMenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  /** Secondary hint under the label. */
  description?: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
  /** Insert a separator BEFORE this item. */
  group?: boolean;
}

export interface ConvertMenuProps {
  label?: string;
  heading?: string;
  items: ConvertMenuItem[];
  disabled?: boolean;
}

export function ConvertMenu({
  label = 'Convert',
  heading,
  items,
  disabled = false,
}: ConvertMenuProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" iconRight={ChevronDown} disabled={disabled}>
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {heading ? <DropdownMenuLabel>{heading}</DropdownMenuLabel> : null}
        {items.map((item) => (
          <React.Fragment key={item.key}>
            {item.group ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              disabled={item.disabled}
              variant={item.danger ? 'danger' : 'default'}
              iconLeft={item.icon}
              onSelect={() => item.onSelect()}
            >
              <span>
                {item.label}
                {item.description ? (
                  <span className="fdoc-cell-sub">{item.description}</span>
                ) : null}
              </span>
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

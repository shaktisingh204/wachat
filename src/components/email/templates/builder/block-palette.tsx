'use client';

/**
 * Left rail of the email template builder. Each entry appends a default
 * block of its type to the document when clicked.
 */
import {
  Code2,
  Columns,
  Image as ImageIcon,
  Minus,
  MousePointerClick,
  Share2,
  Space,
  Type,
  Video,
  Mail,
} from 'lucide-react';

import { Button, ScrollArea, Separator } from '@/components/sabcrm/20ui/compat';
import type { EmailBuilderBlock, EmailBuilderBlockType } from '@/lib/email/types';
import { makeDefaultBlock } from './block-defaults';

interface PaletteEntry {
  type: EmailBuilderBlockType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const ENTRIES: PaletteEntry[] = [
  { type: 'text',    label: 'Text',     icon: Type,             description: 'Paragraph or heading' },
  { type: 'image',   label: 'Image',    icon: ImageIcon,        description: 'From SabFiles' },
  { type: 'button',  label: 'Button',   icon: MousePointerClick, description: 'Call to action' },
  { type: 'columns', label: 'Columns',  icon: Columns,          description: 'Side-by-side content' },
  { type: 'divider', label: 'Divider',  icon: Minus,            description: 'Horizontal rule' },
  { type: 'spacer',  label: 'Spacer',   icon: Space,            description: 'Vertical gap' },
  { type: 'social',  label: 'Social',   icon: Share2,           description: 'Social network icons' },
  { type: 'video',   label: 'Video',    icon: Video,            description: 'Linked poster image' },
  { type: 'footer',  label: 'Footer',   icon: Mail,             description: 'Address + unsubscribe' },
  { type: 'html',    label: 'HTML',     icon: Code2,            description: 'Raw HTML snippet' },
];

export interface BlockPaletteProps {
  onAdd: (block: EmailBuilderBlock) => void;
}

export function BlockPalette({ onAdd }: BlockPaletteProps) {
  return (
    <aside
      className="flex h-full w-60 shrink-0 flex-col border-r border-zoru-line bg-zoru-surface"
      aria-label="Block palette"
    >
      <header className="px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zoru-ink-muted">
          Blocks
        </p>
        <p className="text-xs text-zoru-ink-muted/80">Click to add</p>
      </header>
      <Separator />
      <ScrollArea className="flex-1">
        <ul className="grid grid-cols-2 gap-2 p-3">
          {ENTRIES.map((entry) => {
            const Icon = entry.icon;
            return (
              <li key={entry.type}>
                <Button
                  type="button"
                  variant="outline"
                  className="flex h-auto w-full flex-col items-center gap-1.5 px-2 py-3 text-center"
                  onClick={() => onAdd(makeDefaultBlock(entry.type))}
                  title={entry.description}
                  aria-label={`Add ${entry.label} block`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{entry.label}</span>
                </Button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </aside>
  );
}

'use client';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/sabcrm/20ui';
import { ExternalLink, Send, Power, Copy, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import type { MiniAppRow } from '@/lib/rust-client/telegram-mini-apps';

export function RowActionsMenu({
  app,
  onOpen,
  onSend,
  onSetMenuButton,
  onEdit,
  onDelete,
  onCopyLink,
}: {
  app: MiniAppRow;
  onOpen: () => void;
  onSend: () => void;
  onSetMenuButton: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${app.name}`}
          className="rounded p-1 text-[var(--st-text-secondary)] hover:bg-zoru-bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onOpen}>
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open detail
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSend}>
          <Send className="mr-1.5 h-3.5 w-3.5" /> Send to chat
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSetMenuButton}>
          <Power className="mr-1.5 h-3.5 w-3.5" /> Set as menu button
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCopyLink}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy direct link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-[var(--st-text)]">
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

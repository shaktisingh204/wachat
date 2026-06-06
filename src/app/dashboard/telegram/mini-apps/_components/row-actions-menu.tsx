'use client';

import {
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
} from '@/components/sabcrm/20ui/compat';
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
      <ZoruDropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${app.name}`}
          className="rounded p-1 text-[var(--st-text-secondary)] hover:bg-zoru-bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </ZoruDropdownMenuTrigger>
      <ZoruDropdownMenuContent align="end">
        <ZoruDropdownMenuItem onClick={onOpen}>
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open detail
        </ZoruDropdownMenuItem>
        <ZoruDropdownMenuItem onClick={onSend}>
          <Send className="mr-1.5 h-3.5 w-3.5" /> Send to chat
        </ZoruDropdownMenuItem>
        <ZoruDropdownMenuItem onClick={onSetMenuButton}>
          <Power className="mr-1.5 h-3.5 w-3.5" /> Set as menu button
        </ZoruDropdownMenuItem>
        <ZoruDropdownMenuItem onClick={onCopyLink}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy direct link
        </ZoruDropdownMenuItem>
        <ZoruDropdownMenuSeparator />
        <ZoruDropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
        </ZoruDropdownMenuItem>
        <ZoruDropdownMenuItem onClick={onDelete} className="text-[var(--st-text)]">
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
        </ZoruDropdownMenuItem>
      </ZoruDropdownMenuContent>
    </DropdownMenu>
  );
}

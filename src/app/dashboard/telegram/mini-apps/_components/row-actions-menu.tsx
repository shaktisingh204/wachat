'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
} from '@/components/sabcrm/20ui';
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
        <IconButton
          icon={MoreHorizontal}
          label={`Actions for ${app.name}`}
          variant="ghost"
          size="sm"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem iconLeft={ExternalLink} onClick={onOpen}>
          Open detail
        </DropdownMenuItem>
        <DropdownMenuItem iconLeft={Send} onClick={onSend}>
          Send to chat
        </DropdownMenuItem>
        <DropdownMenuItem iconLeft={Power} onClick={onSetMenuButton}>
          Set as menu button
        </DropdownMenuItem>
        <DropdownMenuItem iconLeft={Copy} onClick={onCopyLink}>
          Copy direct link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem iconLeft={Pencil} onClick={onEdit}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="danger" iconLeft={Trash2} onClick={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

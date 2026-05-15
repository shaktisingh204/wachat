/**
 * ConversationHeader — top bar of the middle pane in the SabWa inbox.
 *
 * Shows the active chat's avatar + name + presence ("online" / "typing"
 * / "last seen ..."). On the right, surfaces a search-within-chat button,
 * a more-actions menu, and a toggle for the right-side contact panel.
 *
 * On mobile, exposes an optional back button to return to the chat list.
 */

'use client';

import * as React from 'react';
import {
  ArrowLeft,
  MoreVertical,
  PanelRightClose,
  PanelRightOpen,
  Phone,
  Search,
  Users,
  Video,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { SabwaChat } from '@/lib/sabwa/types';

export interface ConversationHeaderProps {
  chat: SabwaChat;
  /** When set, show a mobile-only back button. */
  onBack?: () => void;
  /** Toggle the right-hand contact panel. */
  onTogglePanel?: () => void;
  panelOpen?: boolean;
  /** Presence string from SSE — "online", "typing...", etc. */
  presence?: string | null;
  onSearch?: () => void;
  onArchive?: () => void;
  onMuteToggle?: () => void;
  onClearMessages?: () => void;
  className?: string;
}

export function ConversationHeader({
  chat,
  onBack,
  onTogglePanel,
  panelOpen,
  presence,
  onSearch,
  onArchive,
  onMuteToggle,
  onClearMessages,
  className,
}: ConversationHeaderProps) {
  const name = chat.name || chat.jid.split('@')[0];
  const initials = name.slice(0, 2).toUpperCase();
  const isGroup = chat.type === 'group';
  const subtitle = presence
    ? presence
    : isGroup
      ? `${chat.participants ?? 0} participants`
      : 'tap to view contact';

  return (
    <div
      className={cn(
        'flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur md:px-3',
        className,
      )}
    >
      {onBack ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Back to chats"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      ) : null}

      <button
        type="button"
        onClick={onTogglePanel}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-1 text-left hover:bg-accent/50"
      >
        <Avatar className="h-9 w-9 shrink-0">
          {chat.profilePicUrl ? (
            <AvatarImage src={chat.profilePicUrl} alt={name} />
          ) : null}
          <AvatarFallback className="text-xs">
            {isGroup ? <Users className="h-4 w-4" /> : initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Voice call"
          className="hidden md:inline-flex"
        >
          <Phone className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Video call"
          className="hidden md:inline-flex"
        >
          <Video className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Search in chat"
          onClick={onSearch}
        >
          <Search className="h-4 w-4" />
        </Button>
        {onTogglePanel ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={panelOpen ? 'Close contact panel' : 'Open contact panel'}
            onClick={onTogglePanel}
            className="hidden md:inline-flex"
          >
            {panelOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="More">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onMuteToggle?.()}>
              {chat.muted ? 'Unmute' : 'Mute notifications'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onArchive?.()}>
              {chat.archived ? 'Unarchive' : 'Archive chat'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onClearMessages?.()}
              className="text-destructive"
            >
              Clear messages
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default ConversationHeader;

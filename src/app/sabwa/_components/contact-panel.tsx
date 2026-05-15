/**
 * ContactPanel — right-side pane of the SabWa inbox.
 *
 * Renders the active chat's profile (avatar / name / number / about),
 * a small action row (mute / archive / block), and a tabbed media view
 * (Photos / Videos / Docs) sourced from the messages window.
 *
 * Phase-1 data: derives media from the in-memory message list passed in
 * by the parent. Once the engine exposes a dedicated `/chats/:jid/media`
 * endpoint we can swap that source without changing the public API.
 */

'use client';

import * as React from 'react';
import {
  Archive,
  Ban,
  BellOff,
  FileText,
  ImageIcon,
  Users,
  Video,
  X,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { SabwaChat, SabwaMessage } from '@/lib/sabwa/types';

export interface ContactPanelProps {
  chat: SabwaChat;
  /** Messages currently loaded for this chat — used to extract media tabs. */
  messages: SabwaMessage[];
  onClose?: () => void;
  onMute?: () => void;
  onArchive?: () => void;
  onBlock?: () => void;
  className?: string;
}

type MediaTab = 'photos' | 'videos' | 'docs';

export function ContactPanel({
  chat,
  messages,
  onClose,
  onMute,
  onArchive,
  onBlock,
  className,
}: ContactPanelProps) {
  const [tab, setTab] = React.useState<MediaTab>('photos');
  const name = chat.name || chat.jid.split('@')[0];
  const initials = name.slice(0, 2).toUpperCase();
  const isGroup = chat.type === 'group';

  const buckets = React.useMemo(() => {
    const photos: SabwaMessage[] = [];
    const videos: SabwaMessage[] = [];
    const docs: SabwaMessage[] = [];
    for (const m of messages) {
      if (m.type === 'image' && m.mediaUrl) photos.push(m);
      else if (m.type === 'video' && m.mediaUrl) videos.push(m);
      else if (m.type === 'document' && m.mediaUrl) docs.push(m);
    }
    return { photos, videos, docs };
  }, [messages]);

  const active =
    tab === 'photos'
      ? buckets.photos
      : tab === 'videos'
        ? buckets.videos
        : buckets.docs;

  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col border-l bg-background',
        className,
      )}
      aria-label="Contact panel"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-3">
        <p className="text-sm font-semibold">Contact info</p>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close panel"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col items-center gap-2 border-b px-4 py-6">
          <Avatar className="h-24 w-24">
            {chat.profilePicUrl ? (
              <AvatarImage src={chat.profilePicUrl} alt={name} />
            ) : null}
            <AvatarFallback className="text-xl">
              {isGroup ? <Users className="h-8 w-8" /> : initials}
            </AvatarFallback>
          </Avatar>
          <p className="text-base font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">{chat.jid}</p>
          {isGroup ? (
            <p className="text-xs text-muted-foreground">
              {chat.participants ?? 0} participants
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-1 border-b p-2 text-xs">
          <Button
            type="button"
            variant="ghost"
            className="flex-col gap-1 py-3 text-[11px]"
            onClick={onMute}
          >
            <BellOff className="h-4 w-4" />
            {chat.muted ? 'Unmute' : 'Mute'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="flex-col gap-1 py-3 text-[11px]"
            onClick={onArchive}
          >
            <Archive className="h-4 w-4" />
            {chat.archived ? 'Unarchive' : 'Archive'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="flex-col gap-1 py-3 text-[11px] text-destructive hover:text-destructive"
            onClick={onBlock}
          >
            <Ban className="h-4 w-4" />
            Block
          </Button>
        </div>

        <div className="p-3">
          <div className="mb-3 grid grid-cols-3 rounded-md bg-muted p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTab('photos')}
              className={cn(
                'rounded px-2 py-1.5 transition-colors',
                tab === 'photos' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              Photos
              {buckets.photos.length ? (
                <span className="ml-1 text-[10px] tabular-nums">
                  {buckets.photos.length}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setTab('videos')}
              className={cn(
                'rounded px-2 py-1.5 transition-colors',
                tab === 'videos' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              Videos
              {buckets.videos.length ? (
                <span className="ml-1 text-[10px] tabular-nums">
                  {buckets.videos.length}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setTab('docs')}
              className={cn(
                'rounded px-2 py-1.5 transition-colors',
                tab === 'docs' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              Docs
              {buckets.docs.length ? (
                <span className="ml-1 text-[10px] tabular-nums">
                  {buckets.docs.length}
                </span>
              ) : null}
            </button>
          </div>

          {active.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-muted-foreground">
              {tab === 'photos' ? (
                <ImageIcon className="h-6 w-6" aria-hidden />
              ) : tab === 'videos' ? (
                <Video className="h-6 w-6" aria-hidden />
              ) : (
                <FileText className="h-6 w-6" aria-hidden />
              )}
              No {tab} yet
            </div>
          ) : tab === 'docs' ? (
            <ul className="space-y-1">
              {active.map((m) => (
                <li
                  key={m.messageId}
                  className="flex items-center gap-2 rounded-md p-2 hover:bg-accent"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs">
                    {m.body ?? m.caption ?? 'Document'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {active.map((m) => (
                // Plain <img>/<video> is acceptable inside a media gallery
                // where we deliberately don't want next/image's loader to
                // proxy untrusted CDN URLs. This is gallery-only — page LCP
                // candidates use next/image elsewhere.
                // eslint-disable-next-line @next/next/no-img-element
                <div
                  key={m.messageId}
                  className="aspect-square overflow-hidden rounded-md bg-muted"
                >
                  {tab === 'photos' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.mediaUrl}
                      alt={m.caption ?? 'photo'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <video
                      src={m.mediaUrl}
                      className="h-full w-full object-cover"
                      muted
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

export default ContactPanel;

'use client';

import { ZoruAvatar, ZoruAvatarFallback, ZoruAvatarImage, ZoruButton, ZoruScrollArea } from '@/components/zoruui';
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

import * as React from 'react';

import { cn } from '@/lib/utils';
import { formatJid, useResolveJid } from '@/lib/sabwa/format-jid';
import { useSabwaSession } from '@/lib/sabwa/session-context';
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
  const { current } = useSabwaSession();
  const resolve = useResolveJid(current?.id);
  const name = chat.name?.trim() || resolve(chat.jid);
  // Secondary line under the big name — show the formatted phone/JID even
  // when we have a friendly `name`, so the panel still surfaces an identifier.
  const subtitle = formatJid(chat.jid);
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
        'flex h-full w-full flex-col border-l border-zoru-line bg-zoru-bg',
        className,
      )}
      aria-label="Contact panel"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-zoru-line px-3">
        <p className="text-sm font-semibold text-zoru-ink">Contact info</p>
        {onClose ? (
          <ZoruButton
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close panel"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </ZoruButton>
        ) : null}
      </div>

      <ZoruScrollArea className="flex-1">
        <div className="flex flex-col items-center gap-2 border-b border-zoru-line px-4 py-6">
          <ZoruAvatar className="h-24 w-24">
            {chat.profilePicUrl ? (
              <ZoruAvatarImage src={chat.profilePicUrl} alt={name} />
            ) : null}
            <ZoruAvatarFallback className="text-xl">
              {isGroup ? <Users className="h-8 w-8" /> : initials}
            </ZoruAvatarFallback>
          </ZoruAvatar>
          <p className="text-base font-semibold text-zoru-ink">{name}</p>
          <p className="text-xs text-zoru-ink-muted">{subtitle}</p>
          {isGroup ? (
            <p className="text-xs text-zoru-ink-muted">
              {chat.participants ?? 0} participants
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-1 border-b border-zoru-line p-2 text-xs">
          <ZoruButton
            type="button"
            variant="ghost"
            className="flex-col gap-1 py-3 text-[11px]"
            onClick={onMute}
          >
            <BellOff className="h-4 w-4" />
            {chat.muted ? 'Unmute' : 'Mute'}
          </ZoruButton>
          <ZoruButton
            type="button"
            variant="ghost"
            className="flex-col gap-1 py-3 text-[11px]"
            onClick={onArchive}
          >
            <Archive className="h-4 w-4" />
            {chat.archived ? 'Unarchive' : 'Archive'}
          </ZoruButton>
          <ZoruButton
            type="button"
            variant="ghost"
            className="flex-col gap-1 py-3 text-[11px] text-zoru-danger hover:text-zoru-danger"
            onClick={onBlock}
          >
            <Ban className="h-4 w-4" />
            Block
          </ZoruButton>
        </div>

        <div className="p-3">
          <div
            role="group"
            aria-label="Media filter"
            className="mb-3 grid grid-cols-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-0.5 text-xs"
          >
            <ZoruButton
              type="button"
              variant={tab === 'photos' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTab('photos')}
              className="rounded-[calc(var(--zoru-radius)-2px)]"
            >
              Photos
              {buckets.photos.length ? (
                <span className="ml-1 text-[10px] tabular-nums">
                  {buckets.photos.length}
                </span>
              ) : null}
            </ZoruButton>
            <ZoruButton
              type="button"
              variant={tab === 'videos' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTab('videos')}
              className="rounded-[calc(var(--zoru-radius)-2px)]"
            >
              Videos
              {buckets.videos.length ? (
                <span className="ml-1 text-[10px] tabular-nums">
                  {buckets.videos.length}
                </span>
              ) : null}
            </ZoruButton>
            <ZoruButton
              type="button"
              variant={tab === 'docs' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTab('docs')}
              className="rounded-[calc(var(--zoru-radius)-2px)]"
            >
              Docs
              {buckets.docs.length ? (
                <span className="ml-1 text-[10px] tabular-nums">
                  {buckets.docs.length}
                </span>
              ) : null}
            </ZoruButton>
          </div>

          {active.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-zoru-ink-muted">
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
                  className="flex items-center gap-2 rounded-[var(--zoru-radius)] p-2 hover:bg-zoru-surface-2"
                >
                  <FileText className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
                  <span className="truncate text-xs text-zoru-ink">
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
                  className="aspect-square overflow-hidden rounded-[var(--zoru-radius)] bg-zoru-surface"
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
      </ZoruScrollArea>
    </aside>
  );
}

export default ContactPanel;

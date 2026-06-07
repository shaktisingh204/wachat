'use client';

import * as React from 'react';
import {
  Button,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import { Sticker as StickerIcon, Plus, RefreshCw } from 'lucide-react';

// ---------------------------------------------------------------------------
//  Header
// ---------------------------------------------------------------------------

export function Header({
  onCreate,
  onRefresh,
  refreshing,
  disabled,
}: {
  onCreate: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  disabled?: boolean;
}) {
  return (
    <PageHeader>
      <PageHeaderHeading className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#37BBFE] to-[#007DBB] shadow-[0_10px_28px_rgba(34,158,217,0.25)]">
          <StickerIcon className="h-6 w-6 text-white" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div>
          <PageEyebrow>Telegram</PageEyebrow>
          <PageTitle>Telegram Stickers</PageTitle>
          <PageDescription>
            Create, edit and publish sticker packs through the bot you select.
            Files come from your SabFiles library, no external URLs.
          </PageDescription>
        </div>
      </PageHeaderHeading>
      <PageActions>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={disabled || refreshing}
          loading={refreshing}
          iconLeft={refreshing ? undefined : RefreshCw}
        >
          Refresh
        </Button>
        <Button size="sm" variant="primary" onClick={onCreate} disabled={disabled} iconLeft={Plus}>
          New sticker pack
        </Button>
      </PageActions>
    </PageHeader>
  );
}

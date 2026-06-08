'use client';

import { X } from 'lucide-react';

import { Dot, IconButton } from '@/components/sabcrm/20ui';

interface ChatHeaderProps {
  widgetName: string;
  primaryColor: string;
  onClose: () => void;
  isOnline: boolean;
}

export function ChatHeader({ widgetName, primaryColor, onClose, isOnline }: ChatHeaderProps) {
  return (
    <header
      className="20ui flex items-center justify-between px-4 py-3 text-[var(--st-text-inverted)]"
      style={{ background: primaryColor }}
    >
      <div className="flex items-center gap-2">
        <strong className="text-[length:var(--st-font-size-sm,14px)]">{widgetName}</strong>
        <Dot
          tone={isOnline ? 'success' : 'danger'}
          title={isOnline ? 'Online' : 'Offline'}
          aria-label={isOnline ? 'Online' : 'Offline'}
          className="shadow-[0_0_0_2px_rgba(255,255,255,0.2)] transition-colors"
        />
      </div>
      <IconButton
        label="Close chat"
        icon={X}
        onClick={onClose}
        className="text-[var(--st-text-inverted)] hover:text-[var(--st-text-inverted)]"
      />
    </header>
  );
}

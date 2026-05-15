/**
 * Thin wrapper around `<ContactPanel>` that wires chat-level mutations
 * to the engine. Kept separate from `conversation.tsx` so the right pane
 * can mount/unmount independently of the message list.
 */

'use client';

import * as React from 'react';
import { ContactPanel } from '@/app/sabwa/_components/contact-panel';
import {
  blockContact,
  updateChatState,
} from '@/app/actions/sabwa.actions';
import type { SabwaChat, SabwaMessage } from '@/lib/sabwa/types';

export interface ContactPanelShellProps {
  sessionId: string;
  chat: SabwaChat;
  messages: SabwaMessage[];
  onClose?: () => void;
  className?: string;
}

export function ContactPanelShell({
  sessionId,
  chat,
  messages,
  onClose,
  className,
}: ContactPanelShellProps) {
  const onMute = React.useCallback(() => {
    void updateChatState(sessionId, chat.jid, { muted: !chat.muted }).catch(
      () => {},
    );
  }, [sessionId, chat.jid, chat.muted]);

  const onArchive = React.useCallback(() => {
    void updateChatState(sessionId, chat.jid, {
      archived: !chat.archived,
    }).catch(() => {});
  }, [sessionId, chat.jid, chat.archived]);

  const onBlock = React.useCallback(() => {
    void blockContact(sessionId, chat.jid).catch(() => {});
  }, [sessionId, chat.jid]);

  return (
    <ContactPanel
      chat={chat}
      messages={messages}
      onClose={onClose}
      onMute={onMute}
      onArchive={onArchive}
      onBlock={onBlock}
      className={className}
    />
  );
}

export default ContactPanelShell;

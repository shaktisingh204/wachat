'use client';

import Link from 'next/link';
import { UserCircle2, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button, Input, Dialog, DialogContent, Card, Badge } from '@/components/sabcrm/20ui/compat';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';
import type { WsConversationSummary } from '@/lib/worksuite/chat-types';

function Modal({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="p-0">
        {children}
      </DialogContent>
    </Dialog>
  );
}

export interface ConversationsPaneProps {
  conversations: WsConversationSummary[];
  activePeerId: string | null;
}

function formatTime(value?: string | Date): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function truncate(text: string, n = 60): string {
  if (!text) return '';
  return text.length > n ? text.slice(0, n - 1) + '…' : text;
}

export function ConversationsPane({ conversations, activePeerId }: ConversationsPaneProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPeerId, setNewPeerId] = useState('');
  
  const totalUnread = conversations.reduce((acc, c) => acc + c.unread_count, 0);

  const handleStartChat = () => {
    if (newPeerId.trim()) {
      setIsModalOpen(false);
      router.push(`/dashboard/crm/messages/${newPeerId.trim()}`);
    }
  };

  return (
    <>
      <Modal open={isModalOpen} onOpenChange={setIsModalOpen}>
        <div className="p-6">
          <h2 className="text-lg font-medium mb-4">Start New Conversation</h2>
          <Input 
            value={newPeerId} 
            onChange={(e) => setNewPeerId(e.target.value)} 
            placeholder="User ID to chat with..." 
            className="mb-4"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleStartChat} disabled={!newPeerId.trim()}>Start Chat</Button>
          </div>
        </div>
      </Modal>

    <Card className="overflow-hidden p-0">
      <div className="border-b border-[var(--st-border)] px-4 py-3 flex justify-between items-center">
        <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)] flex items-center gap-2">
          Conversations
          {totalUnread > 0 && (
            <Badge variant="danger" className="h-4 px-1.5 text-[10px] leading-none">
              {totalUnread}
            </Badge>
          )}
        </p>
        <Button size="sm" variant="ghost" onClick={() => setIsModalOpen(true)} className="h-6 px-2 text-xs">
          <Plus className="h-3 w-3 mr-1" /> New
        </Button>
      </div>
      {conversations.length === 0 ? (
        <div className="flex h-40 items-center justify-center px-4 text-center text-[12.5px] text-[var(--st-text-secondary)]">
          No conversations yet.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--st-border)]">
          {conversations.map((c) => {
            const active = c.peer_user_id === activePeerId;
            return (
              <li key={c.peer_user_id}>
                <Link
                  href={`/dashboard/crm/messages/${c.peer_user_id}`}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 transition',
                    active ? 'bg-[var(--st-bg-muted)]' : 'hover:bg-[var(--st-bg-muted)]',
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-muted)]">
                    <UserCircle2 className="h-5 w-5 text-[var(--st-text-secondary)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-[var(--st-text)]">
                        {c.peer_user_id}
                      </span>
                      <span className="shrink-0 text-[11px] text-[var(--st-text-secondary)]">
                        {formatTime(c.last_message_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-[var(--st-text-secondary)]">
                      {truncate(c.last_message || '(attachment)')}
                    </p>
                  </div>
                  {c.unread_count > 0 ? (
                    <Badge variant="danger" className="self-center">
                      {c.unread_count}
                    </Badge>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
    </>
  );
}

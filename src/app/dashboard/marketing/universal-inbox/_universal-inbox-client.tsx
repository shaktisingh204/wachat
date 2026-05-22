'use client';

import React, { useState } from 'react';
import { Button, Input, Card, ZoruAvatar } from '@/components/zoruui';
import { Send, CheckCircle2, MessageCircle, MoreVertical } from 'lucide-react';
import { createInboxMessage, updateInboxMessage } from '@/app/actions/marketing/universal-inbox.actions';

export function UniversalInboxClient({ initialData }: { initialData: any[] }) {
  const [messages, setMessages] = useState(initialData);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [reply, setReply] = useState('');

  const handleMarkAsRead = async (id: string) => {
    const res = await updateInboxMessage(id, { isRead: true });
    if (res.success) {
      setMessages(messages.map(m => m._id === id ? { ...m, isRead: true } : m));
    }
  };

  const handleSendReply = async () => {
    if (!reply.trim() || !selectedMessage) return;
    // Simulate sending reply
    const newMsg = {
      channel: selectedMessage.channel,
      senderId: 'Agent',
      content: reply,
      isRead: true,
    };
    const res = await createInboxMessage(newMsg);
    if (res.success) {
      setMessages([{ ...newMsg, _id: Date.now().toString(), createdAt: new Date() }, ...messages]);
      setReply('');
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] w-full rounded-xl border border-zoru-line bg-zoru-surface overflow-hidden shadow-sm">
      {/* Left Pane - Message List */}
      <div className="w-1/3 flex flex-col border-r border-zoru-line bg-zoru-bg">
        <div className="p-4 border-b border-zoru-line flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zoru-ink">Universal Inbox</h2>
          <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="p-8 text-center text-sm text-zoru-ink-muted">No messages yet.</div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg._id}
                onClick={() => {
                  setSelectedMessage(msg);
                  if (!msg.isRead) handleMarkAsRead(msg._id);
                }}
                className={`p-4 border-b border-zoru-line cursor-pointer transition-colors hover:bg-zoru-surface-sheen ${selectedMessage?._id === msg._id ? 'bg-zoru-surface-sheen' : ''} ${!msg.isRead ? 'font-medium' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <ZoruAvatar>
                    <div className="bg-blue-100 text-blue-600 w-full h-full flex items-center justify-center font-bold">
                      {msg.senderId.charAt(0).toUpperCase()}
                    </div>
                  </ZoruAvatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="truncate text-sm text-zoru-ink">{msg.senderId}</span>
                      <span className="text-xs text-zoru-ink-muted">{new Date(msg.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-zoru-ink-muted truncate">{msg.content}</p>
                  </div>
                  {!msg.isRead && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Pane - Conversation */}
      <div className="w-2/3 flex flex-col bg-zoru-surface">
        {selectedMessage ? (
          <>
            <div className="p-4 border-b border-zoru-line flex items-center justify-between bg-zoru-bg">
              <div className="flex items-center gap-3">
                <ZoruAvatar>
                  <div className="bg-blue-100 text-blue-600 w-full h-full flex items-center justify-center font-bold">
                    {selectedMessage.senderId.charAt(0).toUpperCase()}
                  </div>
                </ZoruAvatar>
                <div>
                  <h3 className="text-sm font-semibold text-zoru-ink">{selectedMessage.senderId}</h3>
                  <p className="text-xs text-zoru-ink-muted capitalize">{selectedMessage.channel}</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Resolve
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Fake conversation history for visual effect */}
              <div className="flex justify-start">
                <div className="max-w-[70%] rounded-2xl rounded-tl-sm bg-zoru-bg border border-zoru-line px-4 py-2 text-sm text-zoru-ink">
                  {selectedMessage.content}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-zoru-line bg-zoru-bg">
              <form 
                className="flex items-center gap-2"
                onSubmit={(e) => { e.preventDefault(); handleSendReply(); }}
              >
                <Input
                  placeholder={`Reply to ${selectedMessage.senderId}...`}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={!reply.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zoru-ink-muted">
            <MessageCircle className="h-12 w-12 mb-4 opacity-20" />
            <p>Select a message to view the conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Button, Input, Card, ZoruAvatar, Badge } from '@/components/zoruui';
import { Send, CheckCircle2, MessageCircle, MoreVertical, BarChart, Activity, Users, Megaphone, Target } from 'lucide-react';
import { createInboxMessage, updateInboxMessage } from '@/app/actions/marketing/universal-inbox.actions';
import Link from 'next/link';

export function UniversalInboxClient({ initialData, campaigns = [] }: { initialData: any[], campaigns?: any[] }) {
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
          <div className="flex-1 flex flex-col bg-zoru-bg overflow-y-auto">
            {/* Global Campaign Dashboard Header */}
            <div className="p-8 pb-4 border-b border-zoru-line bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
                  <Megaphone className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-zoru-ink">Global Campaign Dashboard</h2>
                  <p className="text-sm text-zoru-ink-muted">Monitor and manage all active marketing initiatives</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Card className="p-4 shadow-sm border-zoru-line flex items-center gap-4">
                  <div className="p-3 rounded-full bg-green-100 text-green-600">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-zoru-ink-muted">Active Campaigns</p>
                    <p className="text-2xl font-bold text-zoru-ink">{campaigns.filter(c => c.status === 'active').length}</p>
                  </div>
                </Card>
                <Card className="p-4 shadow-sm border-zoru-line flex items-center gap-4">
                  <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-zoru-ink-muted">Total Audience</p>
                    <p className="text-2xl font-bold text-zoru-ink">24.5k</p>
                  </div>
                </Card>
                <Card className="p-4 shadow-sm border-zoru-line flex items-center gap-4">
                  <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-zoru-ink-muted">Total Messages</p>
                    <p className="text-2xl font-bold text-zoru-ink">{messages.length}</p>
                  </div>
                </Card>
              </div>
            </div>

            {/* Campaigns List */}
            <div className="p-8 pt-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-zoru-ink flex items-center gap-2">
                  <BarChart className="h-5 w-5 text-zoru-ink-muted" />
                  Recent Drip Campaigns
                </h3>
                <Link href="/dashboard/marketing/drip-campaigns">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {campaigns.length === 0 ? (
                  <div className="text-center p-8 border border-dashed border-zoru-line rounded-lg text-zoru-ink-muted">
                    No campaigns active.
                  </div>
                ) : (
                  campaigns.slice(0, 5).map(campaign => (
                    <Card key={campaign._id} className="p-4 border-zoru-line shadow-sm hover:border-blue-200 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-2 rounded-full ${campaign.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <div>
                            <p className="font-medium text-zoru-ink">{campaign.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className="capitalize text-[10px] py-0 h-4">
                                {campaign.status}
                              </Badge>
                              <span className="text-xs text-zoru-ink-muted flex items-center gap-1">
                                <Users className="h-3 w-3" /> Audience: {campaign.audienceId}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                           <span className="text-xs text-zoru-ink-muted">
                             {new Date(campaign.createdAt).toLocaleDateString()}
                           </span>
                           <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                             Manage
                           </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
            
            {/* Context Notice */}
            <div className="mt-auto p-4 text-center border-t border-zoru-line">
              <div className="inline-flex items-center gap-2 text-sm text-zoru-ink-muted bg-zoru-surface-sheen px-4 py-2 rounded-full">
                <MessageCircle className="h-4 w-4" />
                <span>Select an inbox message on the left to start responding</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

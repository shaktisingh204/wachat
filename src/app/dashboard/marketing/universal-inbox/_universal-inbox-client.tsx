'use client';
import { fmtDate } from "@/lib/utils";

import React, { useState } from 'react';
import { Button, Input, Card, ZoruAvatar, Badge } from '@/components/zoruui';
import { Send, CheckCircle2, MessageCircle, MoreVertical, BarChart, Activity, Users, Megaphone, Target, Link as LinkIcon, Share2, TrendingUp, Mail } from 'lucide-react';
import { createInboxMessage, updateInboxMessage } from '@/app/actions/marketing/universal-inbox.actions';
import Link from 'next/link';

export function UniversalInboxClient({ 
  initialData, 
  campaigns = [], 
  utmLinks = [], 
  socialPosts = [] 
}: { 
  initialData: any[], 
  campaigns?: any[], 
  utmLinks?: any[], 
  socialPosts?: any[] 
}) {
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
                      <span className="text-xs text-zoru-ink-muted">{fmtDate(msg.createdAt)}</span>
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
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
                    <Megaphone className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-zoru-ink">Global Campaign Dashboard</h2>
                    <p className="text-sm text-zoru-ink-muted">Monitor and manage cross-channel ROI</p>
                  </div>
                </div>
                <Badge className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 py-1.5 px-3">
                  <TrendingUp className="h-4 w-4" />
                  ROI +12.4%
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <Card className="p-4 shadow-sm border-zoru-line flex items-center gap-4 hover:border-blue-300 transition-colors cursor-pointer">
                  <div className="p-3 rounded-full bg-green-100 text-green-600">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-zoru-ink-muted uppercase tracking-wider font-semibold">Active Drip</p>
                    <p className="text-xl font-bold text-zoru-ink">{campaigns.filter(c => c.status === 'active').length}</p>
                  </div>
                </Card>
                <Card className="p-4 shadow-sm border-zoru-line flex items-center gap-4 hover:border-blue-300 transition-colors cursor-pointer">
                  <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                    <Share2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-zoru-ink-muted uppercase tracking-wider font-semibold">Social Posts</p>
                    <p className="text-xl font-bold text-zoru-ink">{socialPosts.length}</p>
                  </div>
                </Card>
                <Card className="p-4 shadow-sm border-zoru-line flex items-center gap-4 hover:border-blue-300 transition-colors cursor-pointer">
                  <div className="p-3 rounded-full bg-orange-100 text-orange-600">
                    <LinkIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-zoru-ink-muted uppercase tracking-wider font-semibold">UTM Links</p>
                    <p className="text-xl font-bold text-zoru-ink">{utmLinks.length}</p>
                  </div>
                </Card>
                <Card className="p-4 shadow-sm border-zoru-line flex items-center gap-4 hover:border-blue-300 transition-colors cursor-pointer">
                  <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-zoru-ink-muted uppercase tracking-wider font-semibold">Messages</p>
                    <p className="text-xl font-bold text-zoru-ink">{messages.length}</p>
                  </div>
                </Card>
              </div>
            </div>

            <div className="flex-1 p-8 pt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Campaigns List */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-zoru-ink flex items-center gap-2">
                    <Mail className="h-5 w-5 text-zoru-ink-muted" />
                    Drip Campaigns
                  </h3>
                  <Link href="/dashboard/marketing/drip-campaigns">
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50">View All</Button>
                  </Link>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {campaigns.length === 0 ? (
                    <div className="text-center p-8 border border-dashed border-zoru-line rounded-lg text-zoru-ink-muted">
                      No campaigns active.
                    </div>
                  ) : (
                    campaigns.slice(0, 4).map(campaign => (
                      <Card key={campaign._id} className="p-4 border-zoru-line shadow-sm hover:border-blue-200 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${campaign.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <div>
                              <p className="text-sm font-medium text-zoru-ink">{campaign.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-zoru-ink-muted uppercase font-semibold">
                                  {campaign.status}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                             Manage
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>

              {/* UTM Links List */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-zoru-ink flex items-center gap-2">
                    <LinkIcon className="h-5 w-5 text-zoru-ink-muted" />
                    Top Performing Links
                  </h3>
                  <Link href="/dashboard/marketing/utm-tracking">
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50">View All</Button>
                  </Link>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {utmLinks.length === 0 ? (
                    <div className="text-center p-8 border border-dashed border-zoru-line rounded-lg text-zoru-ink-muted">
                      No UTM links tracked.
                    </div>
                  ) : (
                    utmLinks.slice(0, 4).sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).map(link => (
                      <Card key={link._id} className="p-4 border-zoru-line shadow-sm hover:border-blue-200 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-md">
                              <Target className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1 truncate">
                              <p className="text-sm font-medium text-zoru-ink truncate">{link.campaign || 'Unnamed'}</p>
                              <p className="text-xs text-zoru-ink-muted truncate">{link.source} / {link.medium}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                             <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-md">
                               <BarChart className="h-3 w-3" />
                               <span className="text-xs font-semibold">{link.clicks || 0} clicks</span>
                             </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>

              {/* Social Posts List */}
              <div className="flex flex-col gap-4 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-zoru-ink flex items-center gap-2">
                    <Share2 className="h-5 w-5 text-zoru-ink-muted" />
                    Scheduled Social Media
                  </h3>
                  <Link href="/dashboard/marketing/social-media-scheduler">
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50">View All</Button>
                  </Link>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {socialPosts.length === 0 ? (
                    <div className="lg:col-span-3 text-center p-8 border border-dashed border-zoru-line rounded-lg text-zoru-ink-muted">
                      No social posts scheduled.
                    </div>
                  ) : (
                    socialPosts.slice(0, 3).map(post => (
                      <Card key={post._id} className="p-4 border-zoru-line shadow-sm hover:border-blue-200 transition-colors flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant={post.platform === 'facebook' ? 'default' : post.platform === 'twitter' ? 'secondary' : 'outline'} className="capitalize">
                            {post.platform}
                          </Badge>
                          <Badge variant={post.status === 'published' ? 'default' : post.status === 'scheduled' ? 'outline' : 'destructive'} className="capitalize text-[10px]">
                            {post.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-zoru-ink line-clamp-2 mt-2 mb-4 flex-1">
                          {post.content}
                        </p>
                        <div className="text-xs text-zoru-ink-muted flex items-center gap-1 mt-auto pt-3 border-t border-zoru-line">
                          <CheckCircle2 className="h-3 w-3" />
                          {fmtDate(post.scheduledTime)}
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>

            </div>
            
            {/* Context Notice */}
            <div className="mt-auto p-4 text-center border-t border-zoru-line bg-zoru-bg">
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

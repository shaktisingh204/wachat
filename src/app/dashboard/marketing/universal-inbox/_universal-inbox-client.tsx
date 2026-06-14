'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Send,
  CheckCircle2,
  MessageCircle,
  MoreVertical,
  BarChart,
  Megaphone,
  Target,
  Link as LinkIcon,
  Share2,
  TrendingUp,
} from 'lucide-react';

import {
  Button,
  IconButton,
  Card,
  StatCard,
  Avatar,
  Badge,
  Dot,
  Field,
  Input,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import { fmtDate } from '@/lib/utils';
import { createInboxMessage, updateInboxMessage } from '@/app/actions/marketing/universal-inbox.actions';

export function UniversalInboxClient({
  initialData,
  utmLinks = [],
  socialPosts = [],
}: {
  initialData: any[];
  utmLinks?: any[];
  socialPosts?: any[];
}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState(initialData);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [reply, setReply] = useState('');

  const handleMarkAsRead = async (id: string) => {
    const res = await updateInboxMessage(id, { isRead: true });
    if (res.success) {
      setMessages(messages.map((m) => (m._id === id ? { ...m, isRead: true } : m)));
    }
  };

  const handleSelectMessage = (msg: any) => {
    setSelectedMessage(msg);
    if (!msg.isRead) handleMarkAsRead(msg._id);
  };

  const handleSendReply = async () => {
    if (!reply.trim() || !selectedMessage) return;
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
      toast.success('Reply sent');
    } else {
      toast.error('Could not send reply');
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] w-full overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] shadow-[var(--st-shadow-sm)]">
      {/* Left Pane - Message List */}
      <div className="flex w-1/3 flex-col border-r border-[var(--st-border)] bg-[var(--st-bg)]">
        <div className="flex items-center justify-between border-b border-[var(--st-border)] p-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
            <h2 className="text-base font-semibold tracking-tight text-[var(--st-text)]">Universal inbox</h2>
          </div>
          <IconButton label="Inbox options" icon={MoreVertical} variant="ghost" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={MessageCircle} title="No messages yet" description="Conversations from every channel will land here." size="sm" />
            </div>
          ) : (
            messages.map((msg) => {
              const isSelected = selectedMessage?._id === msg._id;
              return (
                <Card
                  key={msg._id}
                  variant="interactive"
                  padding="md"
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectMessage(msg)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectMessage(msg);
                    }
                  }}
                  className={`w-full rounded-none border-x-0 border-t-0 border-b transition-colors hover:bg-[var(--st-bg-secondary)] ${
                    isSelected ? 'bg-[var(--st-bg-secondary)]' : ''
                  } ${!msg.isRead ? 'font-medium' : ''}`}
                >
                  <div className="flex items-center gap-3 text-left">
                    <Avatar name={msg.senderId} size="md" shape="round" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="truncate text-sm text-[var(--st-text)]">{msg.senderId}</span>
                        <span className="text-xs text-[var(--st-text-secondary)]">{fmtDate(msg.createdAt)}</span>
                      </div>
                      <p className="truncate text-xs text-[var(--st-text-secondary)]">{msg.content}</p>
                    </div>
                    {!msg.isRead && <Dot tone="accent" aria-label="Unread" />}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Right Pane - Conversation */}
      <div className="flex w-2/3 flex-col bg-[var(--st-bg-secondary)]">
        {selectedMessage ? (
          <>
            <div className="flex items-center justify-between border-b border-[var(--st-border)] bg-[var(--st-bg)] p-4">
              <div className="flex items-center gap-3">
                <Avatar name={selectedMessage.senderId} size="md" shape="round" />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--st-text)]">{selectedMessage.senderId}</h3>
                  <p className="text-xs capitalize text-[var(--st-text-secondary)]">{selectedMessage.channel}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" iconLeft={CheckCircle2}>
                Resolve
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {/* Conversation history */}
              <div className="flex justify-start">
                <div className="max-w-[70%] rounded-[var(--st-radius-lg)] rounded-tl-sm border border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-2 text-sm text-[var(--st-text)]">
                  {selectedMessage.content}
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--st-border)] bg-[var(--st-bg)] p-4">
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendReply();
                }}
              >
                <Field label="Reply" className="flex-1">
                  <Input
                    placeholder={`Reply to ${selectedMessage.senderId}...`}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                </Field>
                <IconButton
                  type="submit"
                  label="Send reply"
                  icon={Send}
                  variant="primary"
                  disabled={!reply.trim()}
                />
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col overflow-y-auto bg-[var(--st-bg)]">
            {/* Campaign overview header */}
            <div className="border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-8 pb-4">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-3 text-[var(--st-text)]">
                    <Megaphone className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-[var(--st-text)]">Campaign overview</h2>
                    <p className="text-sm text-[var(--st-text-secondary)]">Track cross-channel performance across your campaigns.</p>
                  </div>
                </div>
                <Badge tone="success" kind="soft" className="flex items-center gap-2 px-3 py-1.5">
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                  ROI +12.4%
                </Badge>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
                <StatCard icon={Share2} label="Social posts" value={socialPosts.length} accent="#3b7af5" />
                <StatCard icon={LinkIcon} label="UTM links" value={utmLinks.length} accent="#1f9d55" />
                <StatCard icon={MessageCircle} label="Messages" value={messages.length} accent="#e0844e" />
              </div>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-8 p-8 pt-6 lg:grid-cols-2">
              {/* UTM Links List */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight text-[var(--st-text)]">
                    <LinkIcon className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                    Top performing links
                  </h3>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/dashboard/sabsense/utm-tracking">View all</Link>
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {utmLinks.length === 0 ? (
                    <EmptyState icon={LinkIcon} title="No UTM links yet" description="Tracked links appear here once you create them." size="sm" />
                  ) : (
                    utmLinks
                      .slice(0, 4)
                      .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
                      .map((link) => (
                        <Card key={link._id} variant="outlined" padding="md">
                          <div className="flex items-center justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-2 text-[var(--st-text)]">
                                <Target className="h-4 w-4" aria-hidden="true" />
                              </div>
                              <div className="min-w-0 flex-1 truncate">
                                <p className="truncate text-sm font-medium text-[var(--st-text)]">{link.campaign || 'Unnamed'}</p>
                                <p className="truncate text-xs text-[var(--st-text-secondary)]">
                                  {link.source} / {link.medium}
                                </p>
                              </div>
                            </div>
                            <Badge tone="neutral" kind="soft" className="ml-4 flex flex-shrink-0 items-center gap-1.5">
                              <BarChart className="h-3 w-3" aria-hidden="true" />
                              {link.clicks || 0} clicks
                            </Badge>
                          </div>
                        </Card>
                      ))
                  )}
                </div>
              </div>

              {/* Social Posts List */}
              <div className="flex flex-col gap-4 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight text-[var(--st-text)]">
                    <Share2 className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                    Scheduled social posts
                  </h3>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/dashboard/marketing/social-media-scheduler">View all</Link>
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {socialPosts.length === 0 ? (
                    <div className="lg:col-span-3">
                      <EmptyState icon={Share2} title="No scheduled posts" description="Posts you schedule will show up here." size="sm" />
                    </div>
                  ) : (
                    socialPosts.slice(0, 3).map((post) => (
                      <Card key={post._id} variant="outlined" padding="md" className="flex flex-col">
                        <div className="mb-2 flex items-start justify-between">
                          <Badge tone="accent" kind="soft" className="capitalize">
                            {post.platform}
                          </Badge>
                          <Badge
                            tone={post.status === 'published' ? 'success' : post.status === 'scheduled' ? 'info' : 'danger'}
                            kind="soft"
                            className="text-[10px] capitalize"
                          >
                            {post.status}
                          </Badge>
                        </div>
                        <p className="mb-4 mt-2 line-clamp-2 flex-1 text-sm text-[var(--st-text)]">{post.content}</p>
                        <div className="mt-auto flex items-center gap-1 border-t border-[var(--st-border)] pt-3 text-xs text-[var(--st-text-secondary)]">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          {fmtDate(post.scheduledTime)}
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Context Notice */}
            <div className="mt-auto border-t border-[var(--st-border)] bg-[var(--st-bg)] p-4 text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--st-bg-secondary)] px-4 py-2 text-sm text-[var(--st-text-secondary)]">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                <span>Select an inbox message on the left to start responding</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UniversalInboxClient;

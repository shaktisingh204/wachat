'use client';

import * as React from 'react';
import { Card, Button, Badge, Input, Textarea, Avatar, AvatarFallback, useToast } from '@/components/sabcrm/20ui';
import {
  MessageSquare,
  Send,
  Mail,
  User,
  CheckSquare,
  AlertCircle,
  FileClock,
  Clock,
  Trash2,
} from 'lucide-react';

export interface TimelineItem {
  id: string;
  type: 'comment' | 'whatsapp' | 'email' | 'audit' | 'task';
  title: string;
  body?: string;
  createdAt: string;
  actorName: string;
  avatarUrl?: string;
  status?: string; // e.g. "delivered", "sent", "failed", "completed"
  diff?: Record<string, { before: any; after: any }>;
}

interface Crm360TimelineProps {
  items: TimelineItem[];
  onAddComment: (body: string) => Promise<boolean>;
  onSendWhatsApp?: (templateId: string, phone: string) => Promise<boolean>;
  onToggleTask?: (taskId: string, completed: boolean) => Promise<void>;
  onDeleteItem?: (id: string) => Promise<void>;
}

export function Crm360Timeline({
  items,
  onAddComment,
  onSendWhatsApp,
  onToggleTask,
  onDeleteItem,
}: Crm360TimelineProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<'comment' | 'whatsapp' | 'task'>('comment');
  const [commentText, setCommentText] = React.useState('');
  const [waPhone, setWaPhone] = React.useState('');
  const [waTemplate, setWaTemplate] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    setIsSubmitting(true);
    const success = await onAddComment(commentText.trim());
    setIsSubmitting(false);
    if (success) {
      setCommentText('');
      toast({ title: 'Comment posted successfully' });
    }
  };

  const handleSendWhatsApp = async () => {
    if (!waPhone.trim() || !waTemplate.trim() || !onSendWhatsApp) return;
    setIsSubmitting(true);
    const success = await onSendWhatsApp(waTemplate.trim(), waPhone.trim());
    setIsSubmitting(false);
    if (success) {
      setWaPhone('');
      setWaTemplate('');
      toast({ title: 'WhatsApp Template triggered successfully' });
    }
  };

  // Icon type mapping
  const iconMap = {
    comment: <MessageSquare className="h-3.5 w-3.5" />,
    whatsapp: <Send className="h-3.5 w-3.5 text-[var(--st-status-ok)]" />,
    email: <Mail className="h-3.5 w-3.5 text-[var(--st-warn)]" />,
    audit: <FileClock className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />,
    task: <CheckSquare className="h-3.5 w-3.5 text-[var(--st-text)]" />,
  };

  const badgeVariants = {
    comment: 'ghost',
    whatsapp: 'success',
    email: 'warning',
    audit: 'neutral',
    task: 'info',
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Activity Composer */}
      <Card className="p-4 border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <div className="flex gap-2 border-b border-[var(--st-border)] pb-3 mb-4">
          <Button
            size="sm"
            variant={activeTab === 'comment' ? 'default' : 'ghost'}
            className="h-8 text-[12px] gap-1.5"
            onClick={() => setActiveTab('comment')}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Post Comment
          </Button>
          {onSendWhatsApp && (
            <Button
              size="sm"
              variant={activeTab === 'whatsapp' ? 'default' : 'ghost'}
              className="h-8 text-[12px] gap-1.5"
              onClick={() => setActiveTab('whatsapp')}
            >
              <Send className="h-3.5 w-3.5" /> Shoot WhatsApp
            </Button>
          )}
        </div>

        {/* Tab Composers */}
        {activeTab === 'comment' && (
          <div className="space-y-3">
            <Textarea
              placeholder="Write a status update, note, or tag @team..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="text-[13px] min-h-[72px]"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handlePostComment}
                className="h-8 text-[12px] px-4"
                disabled={isSubmitting || !commentText.trim()}
              >
                Post Note
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'whatsapp' && onSendWhatsApp && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                placeholder="Recipient Phone, e.g. +919876543210"
                value={waPhone}
                onChange={(e) => setWaPhone(e.target.value)}
                className="h-8.5 text-[12.5px]"
              />
              <select
                className="flex h-8.5 w-full rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-2 text-[12.5px] text-[var(--st-text)] focus-visible:outline-none"
                value={waTemplate}
                onChange={(e) => setWaTemplate(e.target.value)}
              >
                <option value="">Select template notification...</option>
                <option value="welcome_onboarding">welcome_onboarding (Welcome kit)</option>
                <option value="invoice_payment_due">invoice_payment_due (Due reminder)</option>
                <option value="lead_follow_up">lead_follow_up (Quick check)</option>
              </select>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSendWhatsApp}
                className="h-8 text-[12px] px-4"
                disabled={isSubmitting || !waPhone.trim() || !waTemplate}
              >
                Send Message
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Timeline Aggregate List */}
      <div className="relative border-l border-[var(--st-border)] pl-6 ml-4 space-y-6">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="relative group">
              
              {/* Timeline Connector Icon */}
              <span className="absolute -left-[35px] top-1.5 flex h-6.5 w-6.5 items-center justify-center rounded-full border border-[var(--st-border)] bg-[var(--st-bg-secondary)] shadow-[var(--st-shadow-sm)]">
                {iconMap[item.type]}
              </span>

              {/* Card Container */}
              <Card className="p-4 border border-[var(--st-border)] bg-[var(--st-bg-secondary)] hover:shadow-[var(--st-shadow-sm)] transition-shadow">
                
                {/* Meta details */}
                <div className="flex items-center justify-between border-b border-[var(--st-border)] pb-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6.5 w-6.5 border border-[var(--st-border)]">
                      <AvatarFallback className="bg-[var(--st-bg-muted)] text-[9px]">
                        {item.actorName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[12.5px] font-semibold text-[var(--st-text)]">{item.actorName}</span>
                    <Badge variant={badgeVariants[item.type] as any} className="text-[9px] uppercase px-1 py-0 h-4">
                      {item.type}
                    </Badge>
                    {item.status && (
                      <Badge variant="ghost" className="text-[9.5px] bg-[var(--st-bg-muted)] h-4 text-[var(--st-text-secondary)]">
                        {item.status}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[var(--st-text-tertiary)] text-[11px] font-mono">
                    <Clock className="h-3 w-3" />
                    {new Date(item.createdAt).toLocaleString()}
                    {onDeleteItem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteItem(item.id)}
                        className="h-6 w-6 p-0 text-[var(--st-danger)] hover:bg-[var(--st-danger)]/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Delete timeline entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Content rendering */}
                <div className="space-y-2">
                  <div className="text-[13px] font-semibold text-[var(--st-text)]">{item.title}</div>
                  {item.body && (
                    <p className="text-[12.5px] text-[var(--st-text-secondary)] leading-relaxed whitespace-pre-wrap">
                      {item.body}
                    </p>
                  )}

                  {/* Audit change logs grid */}
                  {item.diff && Object.keys(item.diff).length > 0 && (
                    <div className="mt-3 overflow-hidden rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]/10">
                      <table className="min-w-full text-[11px] leading-tight">
                        <thead className="bg-[var(--st-bg-muted)]/30 border-b border-[var(--st-border)]">
                          <tr>
                            <th className="px-2.5 py-1 text-left font-semibold text-[var(--st-text-secondary)]">Changed Field</th>
                            <th className="px-2.5 py-1 text-left font-semibold text-[var(--st-text-secondary)]">Prior Value</th>
                            <th className="px-2.5 py-1 text-left font-semibold text-[var(--st-text-secondary)]">Updated Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(item.diff).map(([key, change]) => (
                            <tr key={key} className="border-b border-[var(--st-border)] last:border-0 hover:bg-[var(--st-bg-muted)]/20">
                              <td className="px-2.5 py-1.5 font-medium text-[var(--st-text)]">{key}</td>
                              <td className="px-2.5 py-1.5 text-[var(--st-text-tertiary)] italic">{String(change.before ?? '—')}</td>
                              <td className="px-2.5 py-1.5 text-[var(--st-text)] font-semibold">{String(change.after ?? '—')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-[var(--st-text-tertiary)] text-[13px] flex flex-col items-center gap-1">
            <AlertCircle className="h-6 w-6" /> No activities recorded on this timeline yet.
          </div>
        )}
      </div>
    </div>
  );
}

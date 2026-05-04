'use client';

/**
 * Wachat Chat Export — export chat history for a contact as JSON or CSV,
 * built on Clay primitives.
 */

import * as React from 'react';
import { useState, useTransition } from 'react';
import { LuDownload, LuLoader, LuFileText } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { exportChatHistory } from '@/app/actions/wachat-features.actions';

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function messagesToCsv(messages: any[]): string {
  const header = 'timestamp,direction,type,status,content\n';
  const rows = messages.map((m) => {
    const ts = m.timestamp || m.createdAt || '';
    const content = (m.messageText || m.content?.text || JSON.stringify(m.content) || '').replace(/"/g, '""');
    return `"${ts}","${m.direction || ''}","${m.type || ''}","${m.status || ''}","${content}"`;
  });
  return header + rows.join('\n');
}

function messagesToTxt(messages: any[]): string {
  return messages
    .map((m) => {
      const ts = m.timestamp || m.createdAt || '';
      const dir = (m.direction || '').toUpperCase();
      const content = m.messageText || m.content?.text || JSON.stringify(m.content);
      return `[${ts}] ${dir}: ${content}`;
    })
    .join('\n');
}

export default function ChatExportPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [contactId, setContactId] = useState('');
  const [format, setFormat] = useState('json');
  const [messageCount, setMessageCount] = useState<number | null>(null);
  const [isExporting, startExport] = useTransition();

  const handleExport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !contactId.trim()) return;

    startExport(async () => {
      const res = await exportChatHistory(contactId.trim(), projectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      const messages = res.messages || [];
      setMessageCount(messages.length);

      if (messages.length === 0) {
        toast({ title: 'No messages', description: 'No chat history found for this contact.' });
        return;
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      if (format === 'json') {
        downloadFile(JSON.stringify(messages, null, 2), `chat-${contactId}-${timestamp}.json`, 'application/json');
      } else if (format === 'txt') {
        downloadFile(messagesToTxt(messages), `chat-${contactId}-${timestamp}.txt`, 'text/plain');
      } else {
        downloadFile(messagesToCsv(messages), `chat-${contactId}-${timestamp}.csv`, 'text/csv');
      }
      toast({ title: 'Exported', description: `${messages.length} messages exported as ${format.toUpperCase()}.` });
    });
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Chat Export' },
        ]}
      />

      <div className="min-w-0">
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
          Chat Export
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Export chat history for any contact as JSON or CSV for record-keeping.
        </p>
      </div>

      <ClayCard padded={false} className="p-6">
        <h2 className="text-[16px] font-semibold text-foreground mb-4">Export settings</h2>
        <form onSubmit={handleExport} className="flex flex-col gap-4 max-w-md">
          <div>
            <label className="text-[13px] font-medium text-foreground mb-1.5 block">Contact ID</label>
            <Input
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              placeholder="Contact ID or phone number"
              required
            />
          </div>
          <div>
            <label className="text-[13px] font-medium text-foreground mb-1.5 block">Export format</label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="txt">Plain text (TXT)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <ClayButton
              type="submit"
              variant="obsidian"
              size="md"
              disabled={isExporting || !projectId || !contactId.trim()}
              leading={
                isExporting
                  ? <LuLoader className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                  : <LuDownload className="h-3.5 w-3.5" strokeWidth={2} />
              }
            >
              {isExporting ? 'Exporting...' : 'Export Chat'}
            </ClayButton>
          </div>
        </form>

        {messageCount !== null && (
          <div className="mt-6 flex items-center gap-2 rounded-[12px] border border-border bg-secondary p-4">
            <LuFileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            <span className="text-[13px] text-foreground">
              {messageCount === 0
                ? 'No messages found for this contact.'
                : `${messageCount} message${messageCount !== 1 ? 's' : ''} found and exported.`}
            </span>
          </div>
        )}
      </ClayCard>

      <div className="h-6" />
    </div>
  );
}

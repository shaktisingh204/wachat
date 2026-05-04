'use client';

/**
 * /wachat/chat-export — Export chat history as JSON / CSV / TXT,
 * rebuilt on ZoruUI primitives.
 */

import * as React from 'react';
import { useState, useTransition } from 'react';
import { Download, Loader2, FileText } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { exportChatHistory } from '@/app/actions/wachat-features.actions';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';

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
      toast({
        title: 'Exported',
        description: `${messages.length} messages exported as ${format.toUpperCase()}.`,
      });
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Chat Export</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="min-w-0">
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Chat Export
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Export chat history for any contact as JSON or CSV for record-keeping.
        </p>
      </div>

      <ZoruCard className="p-6">
        <h2 className="mb-4 text-[16px] text-zoru-ink">Export settings</h2>
        <form onSubmit={handleExport} className="flex max-w-md flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="export-contact-id">Contact ID</ZoruLabel>
            <ZoruInput
              id="export-contact-id"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              placeholder="Contact ID or phone number"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="export-format">Export format</ZoruLabel>
            <ZoruSelect value={format} onValueChange={setFormat}>
              <ZoruSelectTrigger id="export-format" className="w-full">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="json">JSON</ZoruSelectItem>
                <ZoruSelectItem value="csv">CSV</ZoruSelectItem>
                <ZoruSelectItem value="txt">Plain text (TXT)</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div>
            <ZoruButton
              type="submit"
              size="md"
              disabled={isExporting || !projectId || !contactId.trim()}
            >
              {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
              {isExporting ? 'Exporting...' : 'Export Chat'}
            </ZoruButton>
          </div>
        </form>

        {messageCount !== null && (
          <div className="mt-6 flex items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4">
            <FileText className="h-4 w-4 text-zoru-ink-muted" />
            <span className="text-[13px] text-zoru-ink">
              {messageCount === 0
                ? 'No messages found for this contact.'
                : `${messageCount} message${messageCount !== 1 ? 's' : ''} found and exported.`}
            </span>
          </div>
        )}
      </ZoruCard>

      <div className="h-6" />
    </div>
  );
}

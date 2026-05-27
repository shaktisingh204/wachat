'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { Download, Loader2, FileText, FileJson, FileSpreadsheet, FileType } from 'lucide-react';
import { m } from 'motion/react';

import {
  useZoruToast,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import { useProject } from '@/context/project-context';
import { exportChatHistory } from '@/app/actions/wachat-features.actions';

/**
 * /wachat/chat-export — Export chat history as JSON / CSV / TXT.
 * Rebuilt on wachat-ui primitives. All export helpers + server action
 * call preserved verbatim.
 */

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
  const { toast } = useZoruToast();
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

  const formatIcon = format === 'json' ? FileJson : format === 'csv' ? FileSpreadsheet : FileType;

  return (
    <WaPage>
      <PageHeader
        title="Chat export"
        description="Pull a contact's full message history as JSON, CSV, or plain text."
        kicker="Wachat · export"
        backHref="/wachat"
        eyebrowIcon={Download}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Section title="Export settings" description="Choose a contact and a destination format.">
          <form onSubmit={handleExport} className="flex max-w-md flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="export-contact-id">Contact ID</Label>
              <Input
                id="export-contact-id"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                placeholder="Contact ID or phone number"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="export-format">Export format</Label>
              <Select value={format} onValueChange={setFormat}>
                <ZoruSelectTrigger id="export-format" className="w-full">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="json">JSON</ZoruSelectItem>
                  <ZoruSelectItem value="csv">CSV</ZoruSelectItem>
                  <ZoruSelectItem value="txt">Plain text (TXT)</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            <div>
              <WaButton
                type="submit"
                leftIcon={isExporting ? Loader2 : Download}
                disabled={isExporting || !projectId || !contactId.trim()}
              >
                {isExporting ? 'Exporting...' : 'Export chat'}
              </WaButton>
            </div>
          </form>

          {messageCount !== null && (
            <m.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="mt-5 flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3"
            >
              <FileText className="h-4 w-4 text-zinc-500" strokeWidth={2} aria-hidden />
              <span className="text-[13px] text-zinc-700">
                {messageCount === 0
                  ? 'No messages found for this contact.'
                  : `${messageCount.toLocaleString('en-IN')} message${messageCount !== 1 ? 's' : ''} found and exported.`}
              </span>
            </m.div>
          )}
        </Section>

        <Section
          title="Selected format"
          description="A quick preview of what you'll get."
        >
          <div className="flex flex-col items-center gap-3 py-3 text-center">
            <span
              className="grid h-14 w-14 place-items-center rounded-2xl"
              style={{ background: 'var(--mt-accent-soft)' }}
            >
              {React.createElement(formatIcon, {
                className: 'h-6 w-6',
                strokeWidth: 2,
                style: { color: 'var(--mt-accent)' },
                'aria-hidden': true,
              } as any)}
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-900">{format.toUpperCase()}</p>
              <p className="mt-1 text-[12px] text-zinc-500">
                {format === 'json'
                  ? 'Lossless. Every field preserved as structured data.'
                  : format === 'csv'
                  ? 'Spreadsheet-ready. One row per message with timestamp, direction, status, content.'
                  : 'Human-readable. Each line prefixed with timestamp and direction.'}
              </p>
            </div>
          </div>
        </Section>
      </div>
    </WaPage>
  );
}

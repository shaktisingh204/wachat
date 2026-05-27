'use client';

import * as React from 'react';
import { useMemo, useState, useTransition } from 'react';
import {
  Download,
  Loader2,
  FileText,
  FileJson,
  FileSpreadsheet,
  FileType,
  Calendar,
  Hash,
  HardDrive,
  Clock,
  CheckCircle2,
  Folder,
} from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';

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
  MetricTile,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import { useProject } from '@/context/project-context';
import { exportChatHistory } from '@/app/actions/wachat-features.actions';

/**
 * /wachat/chat-export - Export chat history as JSON / CSV / TXT.
 * Adds an inline preview pane showing the exact export shape (CSV
 * header row, JSON schema, plain-text format), plus rows-to-export,
 * file size estimate, and time-range chips.
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

function humanBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const TIME_RANGES = [
  { id: 'all', label: 'All time' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'ytd', label: 'Year to date' },
];

export default function ChatExportPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [contactId, setContactId] = useState('');
  const [format, setFormat] = useState('json');
  const [range, setRange] = useState('all');
  const [messageCount, setMessageCount] = useState<number | null>(null);
  const [bytesEstimate, setBytesEstimate] = useState<number | null>(null);
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(null);
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
        setBytesEstimate(0);
        toast({ title: 'No messages', description: 'No chat history found for this contact.' });
        return;
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      let payload = '';
      let filename = '';
      let mime = '';
      if (format === 'json') {
        payload = JSON.stringify(messages, null, 2);
        filename = `chat-${contactId}-${timestamp}.json`;
        mime = 'application/json';
      } else if (format === 'txt') {
        payload = messagesToTxt(messages);
        filename = `chat-${contactId}-${timestamp}.txt`;
        mime = 'text/plain';
      } else {
        payload = messagesToCsv(messages);
        filename = `chat-${contactId}-${timestamp}.csv`;
        mime = 'text/csv';
      }
      setBytesEstimate(new Blob([payload]).size);
      setLastExportedAt(new Date().toLocaleString());
      downloadFile(payload, filename, mime);
      toast({
        title: 'Exported',
        description: `${messages.length} messages exported as ${format.toUpperCase()}.`,
      });
    });
  };

  const FormatIcon = format === 'json' ? FileJson : format === 'csv' ? FileSpreadsheet : FileType;

  const previewSample = useMemo(() => {
    if (format === 'json') {
      return `[
  {
    "timestamp": "2026-05-28T09:14:02Z",
    "direction": "in",
    "type": "text",
    "status": "delivered",
    "content": { "text": "Hi, I need help" }
  },
  {
    "timestamp": "2026-05-28T09:14:18Z",
    "direction": "out",
    "type": "text",
    "status": "read",
    "content": { "text": "Sure, how can I help?" }
  }
]`;
    }
    if (format === 'csv') {
      return `timestamp,direction,type,status,content
"2026-05-28T09:14:02Z","in","text","delivered","Hi, I need help"
"2026-05-28T09:14:18Z","out","text","read","Sure, how can I help?"`;
    }
    return `[2026-05-28T09:14:02Z] IN: Hi, I need help
[2026-05-28T09:14:18Z] OUT: Sure, how can I help?`;
  }, [format]);

  return (
    <WaPage>
      <PageHeader
        title="Chat export"
        description="Pull a contact's full message history as JSON, CSV, or plain text."
        kicker="Wachat · export"
        backHref="/wachat"
        eyebrowIcon={Download}
      />

      {/* Stats strip */}
      <section aria-labelledby="export-stats" className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <h2 id="export-stats" className="sr-only">Export stats</h2>
        <MetricTile
          label="Rows to export"
          value={messageCount !== null ? messageCount.toLocaleString('en-IN') : '--'}
          icon={Hash}
          delay={0}
        />
        <MetricTile
          label="File size"
          value={bytesEstimate !== null ? humanBytes(bytesEstimate) : '--'}
          icon={HardDrive}
          delay={0.04}
        />
        <MetricTile
          label="Format"
          value={format.toUpperCase()}
          icon={FormatIcon}
          delay={0.08}
        />
        <MetricTile
          label="Last exported"
          value={lastExportedAt ? lastExportedAt.split(',')[1]?.trim() || lastExportedAt : '--'}
          icon={Clock}
          delay={0.12}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Section title="Export settings" description="Choose a contact, time range, and destination format.">
          <form onSubmit={handleExport} className="flex flex-col gap-4">
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
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                Time range
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {TIME_RANGES.map((r) => {
                  const active = range === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRange(r.id)}
                      className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors duration-150 active:scale-[0.97] ${
                        active
                          ? 'border-transparent text-white'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-900'
                      }`}
                      style={active ? { background: 'var(--mt-accent)' } : undefined}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Range filter applies client-side after fetching the full history.
              </p>
            </div>
            <div className="pt-1">
              <WaButton
                type="submit"
                leftIcon={isExporting ? Loader2 : Download}
                disabled={isExporting || !projectId || !contactId.trim()}
              >
                {isExporting ? 'Exporting...' : 'Export chat'}
              </WaButton>
            </div>
          </form>

          <AnimatePresence>
            {messageCount !== null && (
              <m.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="mt-5 flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} style={{ color: 'var(--mt-accent)' }} aria-hidden />
                <span className="text-[13px] text-zinc-700">
                  {messageCount === 0
                    ? 'No messages found for this contact.'
                    : `${messageCount.toLocaleString('en-IN')} message${messageCount !== 1 ? 's' : ''} exported as ${format.toUpperCase()} (${bytesEstimate !== null ? humanBytes(bytesEstimate) : '--'}).`}
                </span>
              </m.div>
            )}
          </AnimatePresence>
        </Section>

        <Section
          title="Output preview"
          description="A sample of what the file will contain."
          action={
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em]"
              style={{ background: 'var(--mt-accent-soft)', color: 'var(--mt-accent)' }}
            >
              <FormatIcon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
              {format}
            </span>
          }
        >
          <div className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2 text-[11.5px] text-zinc-600">
            <Folder className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="font-mono">
              chat-{contactId || '<contactId>'}-{new Date().toISOString().slice(0, 10)}.{format}
            </span>
          </div>
          <pre className="mt-3 max-h-[260px] overflow-auto rounded-xl border border-zinc-100 bg-zinc-50 p-3 font-mono text-[11.5px] leading-relaxed text-zinc-700">
{previewSample}
          </pre>
          <ul className="mt-3 divide-y divide-zinc-100 text-[12px]">
            <li className="flex items-center justify-between py-1.5">
              <span className="text-zinc-500">Encoding</span>
              <span className="font-mono text-zinc-800">UTF-8</span>
            </li>
            <li className="flex items-center justify-between py-1.5">
              <span className="text-zinc-500">Schema</span>
              <span className="text-zinc-800">
                {format === 'json'
                  ? 'Array of message objects'
                  : format === 'csv'
                    ? '5 columns: timestamp, direction, type, status, content'
                    : 'One message per line'}
              </span>
            </li>
            <li className="flex items-center justify-between py-1.5">
              <span className="text-zinc-500">Best for</span>
              <span className="text-zinc-800">
                {format === 'json'
                  ? 'Programmatic re-import'
                  : format === 'csv'
                    ? 'Spreadsheets, BI tools'
                    : 'Human reading, transcripts'}
              </span>
            </li>
          </ul>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-zinc-100 bg-white px-3 py-2">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" strokeWidth={2} aria-hidden />
            <p className="text-[11.5px] leading-relaxed text-zinc-600">
              Exports include text content, direction, status, and timestamps. Media payloads stay on the server and are referenced by URL inside the export.
            </p>
          </div>
        </Section>
      </div>
    </WaPage>
  );
}

'use client';

import {
  useToast,
  Button,
  Card,
  CardTitle,
  Field,
  Input,
  SelectField as Select,
  Alert,
} from '@/components/sabcrm/20ui';
import {
  useState,
  useTransition } from 'react';
import { Download,
  FileText } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { exportChatHistory } from '@/app/actions/wachat-features.actions';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * /wachat/chat-export — Export chat history as JSON / CSV / TXT,
 * rebuilt on 20ui primitives.
 */

import * as React from 'react';

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

const FORMAT_OPTIONS = [
  { value: 'json', label: 'JSON' },
  { value: 'csv', label: 'CSV' },
  { value: 'txt', label: 'Plain text (TXT)' },
];

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
        toast({ title: 'Error', description: res.error, tone: 'danger' });
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
        tone: 'success',
      });
    });
  };

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Chat Export' },
      ]}
      title="Chat Export"
      description="Export chat history for any contact as JSON or CSV for record-keeping."
      width="narrow"
    >
      <Card padding="lg">
        <CardTitle className="mb-4">Export settings</CardTitle>
        <form onSubmit={handleExport} className="flex max-w-md flex-col gap-4">
          <Field label="Contact ID">
            <Input
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              placeholder="Contact ID or phone number"
              required
            />
          </Field>
          <Field label="Export format">
            <Select
              value={format}
              onChange={(v) => setFormat(v ?? 'json')}
              options={FORMAT_OPTIONS}
              aria-label="Export format"
            />
          </Field>
          <div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              iconLeft={Download}
              loading={isExporting}
              disabled={isExporting || !projectId || !contactId.trim()}
            >
              {isExporting ? 'Exporting...' : 'Export Chat'}
            </Button>
          </div>
        </form>

        {messageCount !== null && (
          <Alert
            tone={messageCount === 0 ? 'neutral' : 'success'}
            icon={FileText}
            className="mt-6"
          >
            {messageCount === 0
              ? 'No messages found for this contact.'
              : `${messageCount} message${messageCount !== 1 ? 's' : ''} found and exported.`}
          </Alert>
        )}
      </Card>
    </WachatPage>
  );
}

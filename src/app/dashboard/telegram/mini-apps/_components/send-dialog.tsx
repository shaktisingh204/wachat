'use client';

import { useState, useTransition, useEffect } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, useToast } from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import { sendTelegramMiniAppAction } from '@/app/actions/telegram-extra.actions';
import type { MiniAppRow } from '@/lib/rust-client/telegram-mini-apps';

const ACCENT = '#229ED9';

export function SendDialog({
  app,
  open,
  onOpenChange,
}: {
  app: MiniAppRow | null;
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const { toast } = useToast();
  const { activeProjectId } = useProject();
  const [chatId, setChatId] = useState('');
  const [label, setLabel] = useState('');
  const [style, setStyle] = useState<'inline' | 'keyboard' | 'web_app_button'>(
    'inline',
  );
  const [text, setText] = useState('');
  const [pending, startPending] = useTransition();

  useEffect(() => {
    if (open && app) {
      setLabel(app.defaultButtonLabel || 'Open');
      setText(`Open ${app.name}`);
      setChatId('');
    }
  }, [app, open]);

  const submit = () => {
    if (!app || !activeProjectId || !chatId.trim()) return;
    startPending(async () => {
      try {
        const res = await sendTelegramMiniAppAction(app._id, {
          projectId: activeProjectId,
          chatId: chatId.trim(),
          label: label || undefined,
          replyMarkup: style,
          text: text || undefined,
        });
        if (res.success) {
          toast({
            title: 'Sent',
            description: `Message ${res.messageId ?? ''} delivered.`,
          });
          onOpenChange(false);
        } else {
          toast({
            title: 'Send failed',
            description: res.error,
            variant: 'destructive',
          });
        }
      } catch (e) {
        toast({
          title: 'Send failed',
          description: String(e),
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send mini app to a chat</DialogTitle>
          <DialogDescription>
            {app
              ? `Send ${app.name} as a button in a chat the bot can write to.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label>Chat ID</Label>
            <Input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="e.g. 12345678 or @channelname"
            />
          </div>
          <div>
            <Label>Message text</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label>Button label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <Label>Markup style</Label>
            <Select
              value={style}
              onValueChange={(v) => setStyle(v as typeof style)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inline">
                  Inline keyboard
                </SelectItem>
                <SelectItem value="keyboard">Reply keyboard</SelectItem>
                <SelectItem value="web_app_button">
                  Web app button (inline)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!chatId.trim() || pending}
            style={{ backgroundColor: ACCENT }}
          >
            {pending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

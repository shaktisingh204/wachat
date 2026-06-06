'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, toast } from '@/components/sabcrm/20ui';
import {
  actionCreateEmailApiKey,
  type EmailApiKeyScope,
} from '@/app/actions/email/integrations.actions';

interface ApiKeyCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const AVAILABLE_SCOPES: { value: EmailApiKeyScope; label: string; hint?: string }[] = [
  { value: 'send', label: 'send', hint: 'Send transactional mail' },
  { value: 'campaigns:read', label: 'campaigns:read' },
  { value: 'campaigns:write', label: 'campaigns:write' },
  { value: 'audience:read', label: 'audience:read' },
  { value: 'audience:write', label: 'audience:write' },
  { value: 'reports:read', label: 'reports:read' },
  { value: 'webhooks:read', label: 'webhooks:read' },
  { value: 'webhooks:write', label: 'webhooks:write' },
];

export function ApiKeyCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: ApiKeyCreateDialogProps) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<EmailApiKeyScope[]>(['send']);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  // Reset state every time the dialog reopens.
  useEffect(() => {
    if (open) {
      setName('');
      setScopes(['send']);
      setRawKey(null);
      setCopied(false);
    }
  }, [open]);

  const toggleScope = (s: EmailApiKeyScope) => {
    setScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const handleCreate = () => {
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (scopes.length === 0) {
      toast({ title: 'Pick at least one scope', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const result = await actionCreateEmailApiKey({ name: name.trim(), scopes });
      if (!result.ok) {
        toast({ title: 'Create failed', description: result.error, variant: 'destructive' });
        return;
      }
      setRawKey(result.data.rawKey);
      onCreated();
    });
  };

  const handleCopy = useCallback(async () => {
    if (!rawKey) return;
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  }, [rawKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {rawKey ? 'API key created' : 'New API key'}
          </DialogTitle>
          <DialogDescription>
            {rawKey
              ? 'Copy this key now — you will not be able to see it again.'
              : 'Give the key a label and choose the scopes it can act on.'}
          </DialogDescription>
        </DialogHeader>

        {rawKey ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-[var(--st-radius-sm)] border border-[var(--st-warn)]/30 bg-[var(--st-warn)]/10 p-3 text-sm text-[var(--st-warn)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                This is the only time SabNode will display the raw key. Store it
                in your secret manager before closing this dialog.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2">
              <code className="flex-1 truncate text-xs text-[var(--st-text)]">{rawKey}</code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                id="api-key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production sender"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_SCOPES.map((s) => {
                  const checked = scopes.includes(s.value);
                  const inputId = `scope-${s.value}`;
                  return (
                    <label
                      key={s.value}
                      htmlFor={inputId}
                      className="flex cursor-pointer items-start gap-2 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2 text-sm hover:bg-[var(--st-bg-muted)]"
                    >
                      <Checkbox
                        id={inputId}
                        checked={checked}
                        onCheckedChange={() => toggleScope(s.value)}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-[var(--st-text)]">{s.label}</div>
                        {s.hint ? (
                          <div className="text-xs text-[var(--st-text-secondary)]">{s.hint}</div>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={pending}>
                Create key
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

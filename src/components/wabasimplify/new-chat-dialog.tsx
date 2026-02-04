
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle } from 'lucide-react';

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartChat: (waId: string) => Promise<void>;
}

export function NewChatDialog({ open, onOpenChange, onStartChat }: NewChatDialogProps) {
  const [waId, setWaId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waId) return;
    setLoading(true);
    await onStartChat(waId);
    setWaId('');
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="flex h-full flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Start New Conversation</DialogTitle>
            <DialogDescription>
              Enter the WhatsApp ID (phone number with country code) to start a new chat or reply to a number not in your contact list.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="waId">WhatsApp ID</Label>
                <Input
                  id="waId"
                  name="waId"
                  placeholder="e.g. 15551234567"
                  value={waId}
                  onChange={(e) => setWaId(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading || !waId}>
              {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Start Chat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

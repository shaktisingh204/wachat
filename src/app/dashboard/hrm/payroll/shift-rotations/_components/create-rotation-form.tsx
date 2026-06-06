'use client';

import { useState, useTransition } from 'react';
import { Card, Input, Label, Button } from '@/components/sabcrm/20ui/compat';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { saveShiftRotation } from '@/app/actions/worksuite/shifts.actions';
import type { WsShiftRotation } from '@/lib/worksuite/shifts-types';

export function CreateRotationForm({
  onCreated
}: {
  onCreated: (r: Omit<WsShiftRotation, '_id'> & { _id: string }) => void
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    // Optimistic ID
    const tempId = `temp-${Date.now()}`;
    const newRot = { _id: tempId, name, description, is_active: true, userId: 'temp' };
    
    startTransition(async () => {
      // Optimistic Update
      onCreated(newRot);
      
      try {
        const res = await saveShiftRotation({ name, description, is_active: true });
        if (res.success) {
          toast.success('Shift rotation created successfully', {
            description: `Rotation "${name}" has been added to the system.`,
          });
          setName('');
          setDescription('');
        } else {
          toast.error('Failed to create shift rotation', {
            description: res.error || 'An unexpected error occurred. Please try again.',
          });
        }
      } catch (err) {
        toast.error('Failed to create shift rotation', {
          description: 'Network error or server unavailable.',
        });
      }
    });
  };

  return (
    <Card className="p-6 mb-6">
      <h2 className="mb-3 text-[16px] text-zoru-ink">Create Rotation</h2>
      <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr_auto]">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[12px] text-zoru-ink-muted">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="2-2-3 rotation"
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-[12px] text-zoru-ink-muted">Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            disabled={pending}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-2">Add</span>
          </Button>
        </div>
      </form>
    </Card>
  );
}

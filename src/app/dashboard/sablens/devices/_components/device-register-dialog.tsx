'use client';

import { useState, useTransition } from 'react';
import { CirclePlus } from 'lucide-react';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input, Label, useToast } from '@/components/sabcrm/20ui';
import { registerSablensDevice } from '@/app/actions/sablens.actions';

export function DeviceRegisterDialog() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [fingerprint, setFingerprint] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !fingerprint.trim()) return;
    startTransition(async () => {
      const res = await registerSablensDevice({
        label: label.trim(),
        deviceFingerprint: fingerprint.trim(),
      });
      if (!res.ok) {
        toast({ title: 'Could not register', description: res.error });
        return;
      }
      toast({ title: 'Device registered' });
      setOpen(false);
      setLabel('');
      setFingerprint('');
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CirclePlus className="size-4" /> Register device
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Register a customer device</DialogTitle>
            <DialogDescription>
              Pair a phone or tablet so you can connect to it later without a
              one-off join token.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={label}
                placeholder="Field tech kit #4"
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="fp">Device fingerprint</Label>
              <Input
                id="fp"
                value={fingerprint}
                placeholder="hex string from the SabLens mobile installer"
                onChange={(e) => setFingerprint(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Registering…' : 'Register'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

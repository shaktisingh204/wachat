'use client';

import * as React from 'react';
import { Pin, PinOff } from 'lucide-react';
import { Button, useZoruToast } from '@/components/zoruui';
import { cn } from '@/components/zoruui/lib/cn';
import {
  togglePin,
  isPinned,
  type PinnableEntityType,
} from '@/app/actions/pinned-items.actions';

export interface PinButtonProps {
  entityType: PinnableEntityType;
  entityId: string;
  /** Optional denormalised title captured at pin time. */
  title?: string;
  /** Compact icon-only style (no label). Default true. */
  iconOnly?: boolean;
  /** Visual size override. */
  size?: 'sm' | 'md';
  className?: string;
  /** Optional pre-resolved pin state (skips a roundtrip). */
  initialPinned?: boolean;
  onChange?: (pinned: boolean) => void;
}

/**
 * Small ghost-style icon button that toggles pinning of an entity for
 * the current viewer. Calls `togglePin(entityType, entityId)`.
 *
 * Does not steal layout space — defaults to ghost / icon-only.
 */
export function PinButton({
  entityType,
  entityId,
  title,
  iconOnly = true,
  size = 'sm',
  className,
  initialPinned,
  onChange,
}: PinButtonProps) {
  const { toast } = useZoruToast();
  const [pinned, setPinned] = React.useState<boolean>(initialPinned ?? false);
  const [resolving, setResolving] = React.useState<boolean>(
    initialPinned === undefined,
  );
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (initialPinned !== undefined) {
      setPinned(initialPinned);
      setResolving(false);
      return;
    }
    let cancelled = false;
    void isPinned(entityType, entityId).then((p) => {
      if (cancelled) return;
      setPinned(p);
      setResolving(false);
    });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, initialPinned]);

  const handleClick = React.useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy) return;
      setBusy(true);
      const next = !pinned;
      // Optimistic update.
      setPinned(next);
      try {
        const res = await togglePin(entityType, entityId, title);
        if (res.error) {
          setPinned(!next);
          toast({
            title: 'Pin failed',
            description: res.error,
            variant: 'destructive',
          });
          return;
        }
        if (typeof res.pinned === 'boolean' && res.pinned !== next) {
          setPinned(res.pinned);
        }
        onChange?.(res.pinned ?? next);
      } catch (err) {
        setPinned(!next);
        toast({
          title: 'Pin failed',
          description: (err as Error)?.message ?? 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, pinned, entityType, entityId, title, toast, onChange],
  );

  const label = pinned ? 'Unpin' : 'Pin';
  const Icon = pinned ? Pin : PinOff;

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      onClick={handleClick}
      disabled={resolving || busy}
      aria-pressed={pinned}
      aria-label={label}
      title={label}
      className={cn(
        iconOnly && 'h-8 w-8 p-0',
        pinned && 'text-zoru-warning-ink',
        className,
      )}
    >
      <Icon
        className={cn('h-3.5 w-3.5', pinned && 'fill-current')}
        strokeWidth={1.75}
      />
      {!iconOnly && <span className="ml-1.5 text-[12px]">{label}</span>}
    </Button>
  );
}

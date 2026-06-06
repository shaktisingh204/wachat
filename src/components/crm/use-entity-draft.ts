'use client';

import * as React from 'react';
import { useZoruToast } from '@/components/sabcrm/20ui/compat';

export function draftKey(entityName: string, id: string | null | undefined, userId: string | null | undefined): string {
  return `crm.${entityName}.draft.${userId ?? 'anon'}.${id ?? 'new'}`;
}

interface UseEntityDraftArgs<T> {
  entityName: string;
  recordId?: string | null;
  enabled: boolean;
  dirty: boolean;
  currentUserId?: string | null;
  formRef: React.RefObject<HTMLFormElement | null>;
  snapshotExtras?: () => Partial<T>;
  applyExtras?: (extras: Partial<T>) => void;
}

export function useEntityDraft<T extends Record<string, any>>({
  entityName,
  recordId,
  enabled,
  dirty,
  currentUserId,
  formRef,
  snapshotExtras = () => ({}),
  applyExtras = () => {},
}: UseEntityDraftArgs<T>) {
  const { toast } = useZoruToast();
  const [draftAvailable, setDraftAvailable] = React.useState(false);
  const [draftDismissed, setDraftDismissed] = React.useState(false);

  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(draftKey(entityName, recordId, currentUserId));
      if (raw) setDraftAvailable(true);
    } catch {
      // ignore
    }
  }, [enabled, entityName, recordId, currentUserId]);

  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    if (!dirty) return;
    const interval = window.setInterval(() => {
      try {
        const form = formRef.current;
        if (!form) return;
        const fd = new FormData(form);
        const snapshot: any = {
          ...Object.fromEntries(fd.entries()),
          ...snapshotExtras(),
        };
        window.localStorage.setItem(
          draftKey(entityName, recordId, currentUserId),
          JSON.stringify({ savedAt: Date.now(), values: snapshot })
        );
      } catch {
        // ignore
      }
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [enabled, dirty, entityName, recordId, currentUserId, formRef, snapshotExtras]);

  const restore = React.useCallback(() => {
    try {
      const raw = window.localStorage.getItem(draftKey(entityName, recordId, currentUserId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { savedAt: number; values: any } | null;
      const v = parsed?.values;
      if (!v) return;
      
      applyExtras(v);
      
      const form = formRef.current;
      if (form) {
        Object.entries(v).forEach(([name, val]) => {
          if (val == null) return;
          const el = form.elements.namedItem(name);
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
            el.value = String(val);
          }
        });
      }
      setDraftDismissed(true);
      toast({ title: 'Draft restored', description: 'Your in-progress changes were loaded.' });
    } catch {
      toast({ title: 'Could not restore draft', variant: 'destructive' });
    }
  }, [entityName, recordId, currentUserId, toast, formRef, applyExtras]);

  const discard = React.useCallback(() => {
    try {
      window.localStorage.removeItem(draftKey(entityName, recordId, currentUserId));
    } catch {}
    setDraftAvailable(false);
    setDraftDismissed(true);
  }, [entityName, recordId, currentUserId]);

  const clearOnSave = React.useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(draftKey(entityName, recordId, currentUserId));
    } catch {}
  }, [enabled, entityName, recordId, currentUserId]);

  return { draftAvailable, draftDismissed, restore, discard, clearOnSave };
}

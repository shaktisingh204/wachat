'use client';

import { useToast } from '@/components/sabcrm/20ui';
/**
 * useDealDraft — localStorage-backed draft auto-save for the New Deal
 * form. Detects an existing draft on mount, persists periodically while
 * the form is dirty, and exposes restore / discard helpers.
 *
 * Storage key is scoped per-user so two SabNode operators on the same
 * machine can each keep their own draft.
 */

import * as React from 'react';

import type { ProductRow } from './deal-products-editor';

export interface DealDraft {
  name?: string;
  value?: string;
  currency?: string;
  probability?: string;
  closeDate?: string;
  leadSource?: string;
  priority?: string;
  nextStep?: string;
  campaign?: string;
  lossReason?: string;
  description?: string;
  competitors?: string[];
  products?: ProductRow[];
  partyKind?: 'client' | 'lead';
  accountId?: string | null;
  contactId?: string | null;
  tagIds?: string[];
}

export function draftKey(userId: string | null | undefined): string {
  return `crm.deal.draft.${userId ?? 'anon'}.new`;
}

interface UseDealDraftArgs {
  enabled: boolean;
  dirty: boolean;
  currentUserId?: string | null;
  formRef: React.RefObject<HTMLFormElement | null>;
  /** Reads the non-scalar parts of the draft from React state. */
  snapshotExtras: () => Pick<
    DealDraft,
    'competitors' | 'products' | 'partyKind' | 'accountId' | 'contactId' | 'tagIds'
  >;
  /** Applies draft non-scalar parts back to React state. */
  applyExtras: (extras: DealDraft) => void;
}

export function useDealDraft({
  enabled,
  dirty,
  currentUserId,
  formRef,
  snapshotExtras,
  applyExtras,
}: UseDealDraftArgs) {
  const { toast } = useToast();
  const [draftAvailable, setDraftAvailable] = React.useState(false);
  const [draftDismissed, setDraftDismissed] = React.useState(false);

  // Detect existing draft on mount.
  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(draftKey(currentUserId));
      if (raw) setDraftAvailable(true);
    } catch {
      // ignore
    }
  }, [enabled, currentUserId]);

  // Periodic auto-save (every 30s while dirty).
  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    if (!dirty) return;
    const interval = window.setInterval(() => {
      try {
        const form = formRef.current;
        if (!form) return;
        const fd = new FormData(form);
        const snapshot: DealDraft = {
          name: String(fd.get('name') ?? ''),
          value: String(fd.get('value') ?? ''),
          currency: String(fd.get('currency') ?? ''),
          probability: String(fd.get('probability') ?? ''),
          closeDate: String(fd.get('closeDate') ?? ''),
          leadSource: String(fd.get('leadSource') ?? ''),
          priority: String(fd.get('priority') ?? ''),
          nextStep: String(fd.get('nextStep') ?? ''),
          campaign: String(fd.get('campaign') ?? ''),
          lossReason: String(fd.get('lossReason') ?? ''),
          description: String(fd.get('description') ?? ''),
          ...snapshotExtras(),
        };
        window.localStorage.setItem(
          draftKey(currentUserId),
          JSON.stringify({ savedAt: Date.now(), values: snapshot }),
        );
      } catch {
        // ignore
      }
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [enabled, dirty, currentUserId, formRef, snapshotExtras]);

  const restore = React.useCallback(() => {
    try {
      const raw = window.localStorage.getItem(draftKey(currentUserId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { savedAt: number; values: DealDraft } | null;
      const v = parsed?.values;
      if (!v) return;
      applyExtras(v);
      // Apply scalars by mutating the DOM (uncontrolled inputs).
      const form = formRef.current;
      if (form) {
        const setField = (name: string, val?: string) => {
          if (val == null) return;
          const el = form.elements.namedItem(name);
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            el.value = val;
          }
        };
        setField('name', v.name);
        setField('value', v.value);
        setField('probability', v.probability);
        setField('closeDate', v.closeDate);
        setField('nextStep', v.nextStep);
        setField('campaign', v.campaign);
        setField('lossReason', v.lossReason);
        setField('description', v.description);
      }
      setDraftDismissed(true);
      toast({ title: 'Draft restored', description: 'Your in-progress deal was loaded.' });
    } catch {
      toast({ title: 'Could not restore draft', variant: 'destructive' });
    }
  }, [currentUserId, toast, formRef, applyExtras]);

  const discard = React.useCallback(() => {
    try {
      window.localStorage.removeItem(draftKey(currentUserId));
    } catch {
      // ignore
    }
    setDraftAvailable(false);
    setDraftDismissed(true);
  }, [currentUserId]);

  const clearOnSave = React.useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(draftKey(currentUserId));
    } catch {
      // ignore
    }
  }, [enabled, currentUserId]);

  return {
    draftAvailable,
    draftDismissed,
    restore,
    discard,
    clearOnSave,
  };
}

'use client';

import { useState, useEffect } from 'react';
import { QuotationForm } from '../../_components/quotation-form';
import { QuotationPrintView } from '../../_components/quotation-print-view';
import { Card, Button } from '@/components/sabcrm/20ui';
import type { CrmQuotationDoc } from '@/lib/rust-client/crm-quotations';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import { getQuotation } from '@/app/actions/crm/quotations.actions';
import { History, Eye, Save } from 'lucide-react';

export function EditQuotationClient({
  initial,
  customFields,
}: {
  initial: CrmQuotationDoc;
  customFields: WsCustomField[];
}) {
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [lockWarning, setLockWarning] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // Real-time preview state, starts with initial doc but could be updated via form changes
  const [previewDoc, setPreviewDoc] = useState<CrmQuotationDoc>(initial);

  // Poll for parallel optimistic lock changes
  useEffect(() => {
    let mounted = true;
    const interval = setInterval(async () => {
      if (!initial?._id) return;
      try {
        const { quotation } = await getQuotation(String(initial._id));
        if (!mounted || !quotation) return;
        
        // Simple optimistic lock check: if the fetched updated date is newer than our initial
        if (quotation.updatedAt && initial.updatedAt) {
          const fetchedTime = new Date(quotation.updatedAt).getTime();
          const initialTime = new Date(initial.updatedAt).getTime();
          if (fetchedTime > initialTime) {
            setLockWarning('Warning: This quotation was modified by another user in a different session. Saving now will overwrite their changes.');
          }
        }
      } catch (e) {
        // Ignore poll errors
      }
    }, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [initial]);

  // Draft autosaving wrapper
  const handleFormChange = (e: React.FormEvent<HTMLDivElement>) => {
    const form = e.currentTarget.querySelector('form');
    if (form) {
      const formData = new FormData(form);
      const draft: Record<string, unknown> = {};
      formData.forEach((value, key) => {
        draft[key] = value;
      });
      try {
        localStorage.setItem(`crm.quotations.edit.${initial._id}`, JSON.stringify(draft));
        setDraftSavedAt(new Date());
        
        // Try to update preview doc with simple fields
        setPreviewDoc(prev => ({
          ...prev,
          quotationNo: formData.get('quotationNo') as string || prev.quotationNo,
          subject: formData.get('subject') as string || prev.subject,
          placeOfSupply: formData.get('placeOfSupply') as string || prev.placeOfSupply,
          termsAndConditions: formData.get('termsAndConditions') as string || prev.termsAndConditions,
          customerNotes: formData.get('notes') as string || prev.customerNotes,
        }));
      } catch (err) {
        // ignore storage errors
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      <div 
        className="flex-1 flex flex-col gap-4" 
        onChange={handleFormChange}
      >
        {lockWarning && (
          <div className="rounded border border-[var(--st-danger)] bg-[var(--st-danger-soft)] p-4 text-sm text-[var(--st-danger)] shadow-sm">
            <p className="font-semibold">Concurrent Edit Detected</p>
            <p>{lockWarning}</p>
          </div>
        )}
        
        <div className="flex items-center justify-between rounded-md bg-[var(--st-border)] p-2 text-sm text-[var(--st-text-secondary)]">
          <div className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {draftSavedAt ? (
              <span>Draft autosaved locally at {draftSavedAt.toLocaleTimeString()}</span>
            ) : (
              <span>Edits will be autosaved to your device</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={(e) => { e.preventDefault(); setShowHistory(!showHistory); }}
            >
              <History className="mr-2 h-4 w-4" />
              {showHistory ? 'Hide History' : 'History'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={(e) => { e.preventDefault(); setShowPreview(!showPreview); }}
            >
              <Eye className="mr-2 h-4 w-4" />
              {showPreview ? 'Hide Preview' : 'Preview'}
            </Button>
          </div>
        </div>

        <QuotationForm initial={initial} customFields={customFields} />
      </div>
      
      {(showPreview || showHistory) && (
        <div className="w-full xl:w-96 flex flex-col gap-6">
          {showPreview && (
            <Card className="flex flex-col overflow-hidden">
              <div className="bg-[var(--st-border)] p-3 border-b border-[var(--st-border)]">
                <h3 className="font-semibold text-sm text-[var(--st-text)] flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Embedded Preview
                </h3>
              </div>
              <div className="p-4 origin-top bg-white flex-1 overflow-y-auto max-h-[800px]">
                <div className="scale-75 md:scale-90 lg:scale-100 origin-top">
                  <QuotationPrintView quotation={previewDoc} />
                </div>
              </div>
            </Card>
          )}

          {showHistory && (
            <Card className="flex flex-col">
              <div className="bg-[var(--st-border)] p-3 border-b border-[var(--st-border)]">
                <h3 className="font-semibold text-sm text-[var(--st-text)] flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Revision History
                </h3>
              </div>
              <div className="p-4 flex flex-col gap-4 text-sm">
                <div className="border-l-2 border-[var(--st-text)] pl-4 relative">
                  <div className="absolute w-2.5 h-2.5 bg-[var(--st-text)] rounded-full -left-[6px] top-1.5" />
                  <p className="font-medium">Current Version</p>
                  <p className="text-[var(--st-text-secondary)] text-xs">You are editing this version.</p>
                </div>
                <div className="border-l-2 border-[var(--st-border)] pl-4 relative">
                  <div className="absolute w-2.5 h-2.5 bg-[var(--st-border)] rounded-full -left-[6px] top-1.5" />
                  <p className="font-medium">Original Version</p>
                  <p className="text-[var(--st-text-secondary)] text-xs">{initial.createdAt ? new Date(initial.createdAt).toLocaleString() : 'Unknown date'}</p>
                </div>
                <p className="text-xs text-[var(--st-text-secondary)] mt-2 italic">Note: Granular revision history is not yet available via API.</p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import {
  Sheet,
  ZoruSheetContent,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetDescription,
  ZoruSheetFooter,
  Button,
} from '@/components/sabcrm/20ui/compat';
import { FilePlus2, ChevronRight, CheckCircle2 } from 'lucide-react';

export interface FormSection {
  id: string;
  label: string;
  render: () => React.ReactNode;
}

interface CrmFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  sections: FormSection[];
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
}

export function CrmFormDrawer({
  open,
  onOpenChange,
  title,
  description,
  sections,
  onSave,
  isSaving = false,
}: CrmFormDrawerProps) {
  // Current active section (using segmented sidebar instead of Tab UI packages)
  const [activeSectionId, setActiveSectionId] = React.useState(sections[0]?.id ?? '');

  React.useEffect(() => {
    if (open && sections.length > 0) {
      setActiveSectionId(sections[0].id);
    }
  }, [open, sections]);

  const activeSection = sections.find((s) => s.id === activeSectionId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <ZoruSheetContent className="w-[90vw] max-w-[840px] p-0 flex flex-col bg-[var(--st-bg-secondary)] overflow-hidden border-l border-[var(--st-border)]">
        
        {/* Drawer Header */}
        <ZoruSheetHeader className="px-6 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]/40">
          <ZoruSheetTitle className="text-lg font-semibold text-[var(--st-text)] flex items-center gap-2">
            <FilePlus2 className="h-4 w-4 text-[var(--st-text)]" /> {title}
          </ZoruSheetTitle>
          {description && (
            <ZoruSheetDescription className="text-[13px] text-[var(--st-text-secondary)] mt-0.5">
              {description}
            </ZoruSheetDescription>
          )}
        </ZoruSheetHeader>

        {/* Drawer Body - Split into navigation sidebar & content */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Segmented stepper sidebar (Standard zoruui layout - no tabs) */}
          <aside className="w-[180px] shrink-0 border-r border-[var(--st-border)] bg-[var(--st-bg-muted)]/30 p-3 flex flex-col gap-1 overflow-y-auto">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)] mb-2 px-2">
              Form Sections
            </div>
            {sections.map((sec, idx) => {
              const isActive = sec.id === activeSectionId;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSectionId(sec.id)}
                  className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-md text-[12.5px] transition-all ${
                    isActive
                      ? 'bg-[var(--st-text)] text-white font-medium shadow-[var(--zoru-shadow-sm)]'
                      : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]/70 hover:text-[var(--st-text)]'
                  }`}
                >
                  <span className="truncate flex items-center gap-2">
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[var(--st-border)] text-[var(--st-text-tertiary)]'
                    }`}>
                      {idx + 1}
                    </span>
                    {sec.label}
                  </span>
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${isActive ? 'rotate-90' : 'opacity-30'}`} />
                </button>
              );
            })}
          </aside>

          {/* Section Input Fields Area */}
          <main className="flex-1 p-6 overflow-y-auto bg-[var(--st-bg)]">
            <div className="w-full space-y-6">
              {activeSection ? (
                <div key={activeSection.id} className="animate-in fade-in duration-200">
                  <h3 className="text-sm font-semibold text-[var(--st-text)] border-b border-[var(--st-border)] pb-2 mb-4 uppercase tracking-wider text-[11.5px] text-[var(--st-text-secondary)]">
                    {activeSection.label} Parameters
                  </h3>
                  {activeSection.render()}
                </div>
              ) : (
                <p className="text-[13px] text-[var(--st-text-secondary)] text-center py-12">
                  No active section configured.
                </p>
              )}
            </div>
          </main>
        </div>

        {/* Drawer Footer */}
        <ZoruSheetFooter className="px-6 py-3.5 border-t border-[var(--st-border)] bg-[var(--st-bg-muted)]/20 flex flex-row items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 text-[12.5px]"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            className="h-9 px-4 text-[12.5px] gap-1.5"
            disabled={isSaving}
          >
            {isSaving ? (
              'Saving Changes...'
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> Save Record
              </>
            )}
          </Button>
        </ZoruSheetFooter>

      </ZoruSheetContent>
    </Sheet>
  );
}

'use client';

import { Dialog, ZoruDialogContent, ZoruDialogFooter, ZoruDialogHeader, ZoruDialogTitle, Button, ScrollArea } from '@/components/zoruui';
interface BaseEditorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  componentType: string;
  children: React.ReactNode;
}

export function BaseEditorDialog({ isOpen, onOpenChange, onSave, componentType, children }: BaseEditorDialogProps) {
  return (
    <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-2xl">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Edit Component: {componentType}</ZoruDialogTitle>
        </ZoruDialogHeader>
        <ZoruScrollArea className="max-h-[60vh] -mx-6 px-6">
          <div className="py-6 space-y-6">
            {children}
          </div>
        </ZoruScrollArea>
        <ZoruDialogFooter>
          <ZoruButton variant="outline" onClick={() => onOpenChange(false)}>Cancel</ZoruButton>
          <ZoruButton onClick={onSave}>Apply</ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

'use client';

import { Dialog, ZoruDialogContent, ZoruDialogFooter, ZoruDialogHeader, ZoruDialogTitle, Button, ScrollArea } from '@/components/sabcrm/20ui/compat';
interface BaseEditorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  componentType: string;
  children: React.ReactNode;
}

export function BaseEditorDialog({ isOpen, onOpenChange, onSave, componentType, children }: BaseEditorDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-2xl">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Edit Component: {componentType}</ZoruDialogTitle>
        </ZoruDialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
          <div className="py-6 space-y-6">
            {children}
          </div>
        </ScrollArea>
        <ZoruDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave}>Apply</Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}

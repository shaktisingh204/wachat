import React from 'react';
import { OKR } from '@/lib/hrm-advanced-types';
import { Input, Button, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogFooter } from '@/components/zoruui';

interface OKRFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<OKR>;
  onSave: (data: Partial<OKR>) => Promise<void>;
  isLoading?: boolean;
}

export function OKRForm({ open, onOpenChange, initialData, onSave, isLoading }: OKRFormProps) {
  const [formData, setFormData] = React.useState<Partial<OKR>>({
    objective: '',
    keyResult: '',
    progress: 0,
    ownerId: '',
    quarter: '',
  });

  React.useEffect(() => {
    if (open) {
      setFormData(initialData || {
        objective: '',
        keyResult: '',
        progress: 0,
        ownerId: '',
        quarter: '',
      });
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <ZoruDialogHeader>
            <ZoruDialogTitle>{initialData?._id ? 'Edit OKR' : 'Add OKR'}</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="objective" className="text-sm font-medium">Objective</label>
              <Input
                id="objective"
                value={formData.objective}
                onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="keyResult" className="text-sm font-medium">Key Result</label>
              <Input
                id="keyResult"
                value={formData.keyResult}
                onChange={(e) => setFormData({ ...formData, keyResult: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="progress" className="text-sm font-medium">Progress %</label>
              <Input
                id="progress"
                type="number"
                min="0"
                max="100"
                value={formData.progress}
                onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })}
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="ownerId" className="text-sm font-medium">Owner ID</label>
              <Input
                id="ownerId"
                value={formData.ownerId}
                onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="quarter" className="text-sm font-medium">Quarter (e.g. Q1 2024)</label>
              <Input
                id="quarter"
                value={formData.quarter}
                onChange={(e) => setFormData({ ...formData, quarter: e.target.value })}
                required
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}

import React, { useEffect } from 'react';
import { OrgChartNode } from '@/lib/hrm-advanced-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Button } from '@/components/sabcrm/20ui/compat';

interface OrgChartFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: Partial<OrgChartNode> | null;
  onSave: (data: Partial<OrgChartNode>) => Promise<void>;
  isLoading: boolean;
}

export function OrgChartForm({ open, onOpenChange, initialData, onSave, isLoading }: OrgChartFormProps) {
  const [formData, setFormData] = React.useState<Partial<OrgChartNode>>({});

  useEffect(() => {
    if (open) {
      setFormData(initialData || {});
    }
  }, [open, initialData]);

  const handleSubmit = async () => {
    await onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData?._id ? 'Edit' : 'Add'} Node</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Name</label>
            <Input 
              value={formData.name || ''} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder="e.g. John Doe"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Role</label>
            <Input 
              value={formData.role || ''} 
              onChange={e => setFormData({...formData, role: e.target.value})} 
              placeholder="e.g. Software Engineer"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Department</label>
            <Input 
              value={formData.department || ''} 
              onChange={e => setFormData({...formData, department: e.target.value})} 
              placeholder="e.g. Engineering"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Manager ID</label>
            <Input 
              value={formData.managerId || ''} 
              onChange={e => setFormData({...formData, managerId: e.target.value})} 
              placeholder="Optional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

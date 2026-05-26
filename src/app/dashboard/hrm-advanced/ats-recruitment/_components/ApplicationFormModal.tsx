'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/zoruui';
import { Button } from '@/components/zoruui';
import { Input } from '@/components/zoruui';
import { Label } from '@/components/zoruui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/zoruui';
import { ATSApplication } from '@/lib/hrm-advanced-types';
import { format } from 'date-fns';

interface ApplicationFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: ATSApplication | null;
  onSave: (payload: Partial<ATSApplication>) => void;
}

export default function ApplicationFormModal({ open, onOpenChange, application, onSave }: ApplicationFormModalProps) {
  const [formData, setFormData] = useState<Partial<ATSApplication>>({
    status: 'New',
    appliedDate: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    if (application) {
      setFormData(application);
    } else {
      setFormData({
        status: 'New',
        appliedDate: format(new Date(), 'yyyy-MM-dd')
      });
    }
  }, [application, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{application ? 'Edit Candidate' : 'Add Candidate'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="candidateName">Candidate Name</Label>
            <Input 
              id="candidateName" 
              required
              value={formData.candidateName || ''}
              onChange={(e) => setFormData({ ...formData, candidateName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input 
              id="role" 
              required
              value={formData.role || ''}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(val: any) => setFormData({ ...formData, status: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                {['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="appliedDate">Applied Date</Label>
            <Input 
              id="appliedDate" 
              type="date"
              required
              value={formData.appliedDate ? format(new Date(formData.appliedDate), 'yyyy-MM-dd') : ''}
              onChange={(e) => setFormData({ ...formData, appliedDate: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

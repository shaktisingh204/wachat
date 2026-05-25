import React, { useEffect, useState } from 'react';
import { Button, Input, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogFooter } from '@/components/zoruui';
import { AttendanceRecord } from '@/lib/hrm-advanced-types';

interface AttendanceFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: Partial<AttendanceRecord>) => void;
  initialData: Partial<AttendanceRecord> | null;
}

export function AttendanceForm({ isOpen, onClose, onSave, initialData }: AttendanceFormProps) {
  const [formData, setFormData] = useState<Partial<AttendanceRecord>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData || { isGeofenced: false });
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>{formData._id ? 'Edit' : 'Add'} Attendance Record</ZoruDialogTitle>
        </ZoruDialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Employee ID</label>
            <Input
              required
              value={formData.employeeId || ''}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              required
              value={formData.date || ''}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Check-In</label>
              <Input
                type="time"
                required
                value={formData.checkInTime || ''}
                onChange={(e) => setFormData({ ...formData, checkInTime: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Check-Out</label>
              <Input
                type="time"
                value={formData.checkOutTime || ''}
                onChange={(e) => setFormData({ ...formData, checkOutTime: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="isGeofenced"
              checked={Boolean(formData.isGeofenced)}
              onChange={(e) => setFormData({ ...formData, isGeofenced: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="isGeofenced" className="text-sm font-medium">Geofenced Location</label>
          </div>
          {formData.isGeofenced && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Location Details</label>
              <Input
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. 37.7749, -122.4194 or Office Address"
              />
            </div>
          )}
          <ZoruDialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save</Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}

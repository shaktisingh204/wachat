'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Input, EmptyState } from '@/components/sabcrm/20ui/compat';
import { useZoruToast } from '@/components/zoruui/use-zoru-toast';
import { saveAttendanceRecord, deleteAttendanceRecord, bulkDeleteAttendanceRecords } from '@/app/actions/hrm-advanced/geofenced-attendance';
import { AttendanceRecord } from '@/lib/hrm-advanced-types';
import { AttendanceTable } from './attendance-table';
import { AttendanceForm } from './attendance-form';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function GeofencedAttendanceClient({ initialData }: { initialData: AttendanceRecord[] }) {
  const [data, setData] = useState<AttendanceRecord[]>(initialData);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<AttendanceRecord> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useZoruToast();

  // Mock WebSocket for real-time collaborative updates
  useEffect(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002');
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'ATTENDANCE_UPDATE') {
          // Update data optimistically if received from WS
          setData(prev => {
            const index = prev.findIndex(item => item._id === message.payload._id);
            if (index > -1) {
              const newData = [...prev];
              newData[index] = message.payload;
              return newData;
            } else {
              return [message.payload, ...prev];
            }
          });
        } else if (message.type === 'ATTENDANCE_DELETE') {
          setData(prev => prev.filter(item => item._id !== message.payload.id));
        }
      } catch (err) {
        // ignore parse error
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleSave = async (payload: Partial<AttendanceRecord>) => {
    const isNew = !payload._id;
    // Optimistic UI update
    const tempId = `temp-${Date.now()}`;
    const optimisticRecord = { ...payload, _id: payload._id || tempId } as AttendanceRecord;
    
    setData(prev => {
      if (isNew) return [optimisticRecord, ...prev];
      return prev.map(item => item._id === payload._id ? optimisticRecord : item);
    });
    
    setIsDialogOpen(false);

    try {
      const result = await saveAttendanceRecord(payload);
      if (isNew && result.id) {
        setData(prev => prev.map(item => item._id === tempId ? { ...item, _id: result.id } : item));
      }
      toast({ title: 'Success', description: `Record saved successfully.` });
    } catch (err: any) {
      // Revert on error (simple refresh or filter temp)
      setData(prev => isNew ? prev.filter(item => item._id !== tempId) : data);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    const previousData = [...data];
    setData(prev => prev.filter(item => item._id !== id));
    
    try {
      await deleteAttendanceRecord(id);
      toast({ title: 'Success', description: `Record deleted.` });
    } catch (err: any) {
      setData(previousData);
      toast({ title: 'Error', description: err.message || 'Failed to delete record', variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} records?`)) return;

    const previousData = [...data];
    setData(prev => prev.filter(item => !selectedIds.has(item._id!)));
    
    try {
      await bulkDeleteAttendanceRecords(Array.from(selectedIds));
      toast({ title: 'Success', description: `${selectedIds.size} records deleted.` });
      setSelectedIds(new Set());
    } catch (err: any) {
      setData(previousData);
      toast({ title: 'Error', description: err.message || 'Failed to bulk delete', variant: 'destructive' });
    }
  };

  const handleExportCSV = useCallback(() => {
    if (data.length === 0) {
      toast({ title: 'Error', description: 'No data to export', variant: 'destructive' });
      return;
    }
    
    const headers = ['Employee ID', 'Date', 'Check-In', 'Check-Out', 'Geofenced', 'Location'];
    const csvRows = [
      headers.join(','),
      ...data.map(row => [
        row.employeeId,
        row.date,
        row.checkInTime,
        row.checkOutTime || '',
        row.isGeofenced ? 'Yes' : 'No',
        row.location || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ];
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance_records.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data, toast]);

  const handleExportPDF = useCallback(() => {
    if (data.length === 0) {
      toast({ title: 'Error', description: 'No data to export', variant: 'destructive' });
      return;
    }
    const doc = new jsPDF();
    doc.text('Geofenced Attendance Records', 14, 15);
    
    const tableData = data.map(row => [
      row.employeeId,
      new Date(row.date).toLocaleDateString(),
      row.checkInTime,
      row.checkOutTime || '-',
      row.isGeofenced ? 'Yes' : 'No',
      row.location || '-'
    ]);

    autoTable(doc, {
      head: [['Employee ID', 'Date', 'Check-In', 'Check-Out', 'Geofenced', 'Location']],
      body: tableData,
      startY: 20,
    });

    doc.save('attendance_records.pdf');
  }, [data, toast]);

  // Memoized expensive calculation (filtering)
  const filteredData = useMemo(() => {
    if (!search) return data;
    const lowerSearch = search.toLowerCase();
    return data.filter(item => 
      item.employeeId.toLowerCase().includes(lowerSearch) ||
      item.date.includes(lowerSearch) ||
      (item.location && item.location.toLowerCase().includes(lowerSearch))
    );
  }, [data, search]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Geofenced Attendance</h1>
          <p className="text-zoru-ink-muted text-sm">Track employee check-ins and check-outs</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete}>
              Delete Selected ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" onClick={handleExportCSV}>Export CSV</Button>
          <Button variant="outline" onClick={handleExportPDF}>Export PDF</Button>
          <Button onClick={() => { setEditingItem({ isGeofenced: false }); setIsDialogOpen(true); }}>
            Add Record
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-zoru-surface p-4 rounded-lg border border-zoru-line">
        <Input 
          placeholder="Search records..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="max-w-md"
        />
      </div>

      {filteredData.length === 0 ? (
        <EmptyState
          title="No records found"
          description={search ? "Try adjusting your search query." : "Get started by adding a new attendance record."}
          action={<Button onClick={() => { setEditingItem({ isGeofenced: false }); setIsDialogOpen(true); }}>Add Record</Button>}
        />
      ) : (
        <AttendanceTable 
          data={filteredData} 
          selectedIds={selectedIds} 
          onSelectionChange={setSelectedIds} 
          onEdit={(item) => { setEditingItem(item); setIsDialogOpen(true); }}
          onDelete={handleDelete}
        />
      )}

      <AttendanceForm 
        isOpen={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
        onSave={handleSave} 
        initialData={editingItem} 
      />
    </div>
  );
}

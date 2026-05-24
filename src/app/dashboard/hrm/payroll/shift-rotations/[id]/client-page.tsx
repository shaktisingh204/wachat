'use client';

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  useMemo,
  useRef,
} from 'react';
import { Plus, Trash2, Download, Search, FileText } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/zoruui';
import { useZoruToast } from '@/components/zoruui/use-zoru-toast';

import {
  saveShiftRotation,
  saveRotationSequence,
  deleteRotationSequence,
} from '@/app/actions/worksuite/shifts.actions';
import type {
  WsShiftRotation,
  WsShiftRotationSequence,
  WsEmployeeShift,
} from '@/lib/worksuite/shifts-types';

function AddSequenceForm({
  shifts,
  onAdd,
  disabled
}: {
  shifts: WsEmployeeShift[];
  onAdd: (shiftId: string, duration: number) => void;
  disabled: boolean;
}) {
  const [newShiftId, setNewShiftId] = useState('');
  const [newDuration, setNewDuration] = useState<number>(1);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newShiftId || !newDuration) return;
    onAdd(newShiftId, newDuration);
    setNewShiftId('');
    setNewDuration(1);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_auto]"
    >
      <div className="flex flex-col gap-1.5">
        <Label className="text-[12px] text-zoru-ink-muted">Shift</Label>
        <Select value={newShiftId} onValueChange={setNewShiftId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose shift" />
          </SelectTrigger>
          <SelectContent>
            {shifts.map((s) => (
              <SelectItem key={String(s._id)} value={String(s._id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-[12px] text-zoru-ink-muted">Duration (days)</Label>
        <Input
          type="number"
          min={1}
          value={newDuration}
          onChange={(e) => setNewDuration(Number(e.target.value))}
        />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={disabled || !newShiftId}>
          <Plus className="mr-2 h-4 w-4" strokeWidth={1.75} />
          Add
        </Button>
      </div>
    </form>
  );
}

export default function ShiftRotationClient({
  id,
  initialRotation,
  initialSequences,
  shifts,
}: {
  id: string;
  initialRotation: WsShiftRotation;
  initialSequences: WsShiftRotationSequence[];
  shifts: WsEmployeeShift[];
}) {
  const { toast } = useZoruToast();
  const [rotation, setRotation] = useState<WsShiftRotation>(initialRotation);
  const [sequences, setSequences] = useState<WsShiftRotationSequence[]>(initialSequences);
  const [pending, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSequences, setSelectedSequences] = useState<Set<string>>(new Set());

  // Mock Real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Mock background polling for collaborative updates. In a real app this would fetch or use WS.
    }, 15000);
    return () => clearInterval(interval);
  }, [id]);

  const saveRotationField = (partial: Partial<WsShiftRotation>) => {
    startTransition(async () => {
      // Optimistic
      setRotation(prev => ({ ...prev, ...partial }));
      try {
        await saveShiftRotation({ ...rotation, ...partial });
        toast({ title: 'Rotation updated', description: 'Changes saved successfully.' });
      } catch (err: any) {
        toast({ title: 'Error', description: err.message || 'Failed to update', variant: 'destructive' });
      }
    });
  };

  const addSequence = (newShiftId: string, newDuration: number) => {
    startTransition(async () => {
      const tempId = `temp-${Date.now()}`;
      const newSeqOrder = (sequences.at(-1)?.sequence_order ?? 0) + 1;
      
      const newSeq: WsShiftRotationSequence = {
        _id: tempId,
        shift_rotation_id: id,
        shift_id: newShiftId,
        duration_days: newDuration,
        sequence_order: newSeqOrder,
        userId: rotation.userId,
      };

      // Optimistic
      setSequences(prev => [...prev, newSeq]);
      
      try {
        await saveRotationSequence({
          shift_rotation_id: id,
          shift_id: newShiftId,
          duration_days: newDuration,
          sequence_order: newSeqOrder,
        });
      } catch (err: any) {
        setSequences(prev => prev.filter(s => s._id !== tempId));
        toast({ title: 'Error', description: err.message || 'Failed to add sequence', variant: 'destructive' });
      }
    });
  };

  const removeSeq = (seqId: string) => {
    startTransition(async () => {
      // Optimistic
      const prev = sequences;
      setSequences(prev.filter(s => s._id !== seqId));
      
      try {
        await deleteRotationSequence(seqId);
        toast({ title: 'Sequence removed' });
      } catch (err: any) {
        setSequences(prev);
        toast({ title: 'Error', description: err.message || 'Failed to remove', variant: 'destructive' });
      }
    });
  };

  const bulkDelete = () => {
    if (selectedSequences.size === 0) return;
    if (!confirm('Delete selected sequences?')) return;
    
    startTransition(async () => {
      const prev = sequences;
      const idsToDelete = Array.from(selectedSequences);
      
      // Optimistic
      setSequences(prev.filter(s => s._id && !idsToDelete.includes(s._id)));
      setSelectedSequences(new Set());
      
      try {
        await Promise.all(idsToDelete.map(sid => deleteRotationSequence(sid)));
        toast({ title: 'Sequences deleted' });
      } catch (err: any) {
        setSequences(prev);
        toast({ title: 'Error', description: err.message || 'Bulk delete failed', variant: 'destructive' });
      }
    });
  };

  const shiftById = useCallback((shiftId: string) => shifts.find((s) => String(s._id) === shiftId), [shifts]);
  
  // Memoized Filtering & Calculations
  const filteredSequences = useMemo(() => {
    if (!searchQuery.trim()) return sequences;
    const lowerQ = searchQuery.toLowerCase();
    return sequences.filter(seq => {
      const sh = shiftById(seq.shift_id);
      return sh?.name.toLowerCase().includes(lowerQ);
    });
  }, [sequences, searchQuery, shiftById]);
  
  const totalCycle = useMemo(() => sequences.reduce((acc, s) => acc + Number(s.duration_days ?? 0), 0), [sequences]);

  // Virtualizer for Sequences
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredSequences.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52, // approx row height
    overscan: 5,
  });

  const exportCSV = () => {
    const headers = ['Order', 'Shift Name', 'Duration (Days)'];
    const rows = filteredSequences.map((seq, i) => {
      const sh = shiftById(seq.shift_id);
      return [i + 1, sh?.name || 'Unknown', seq.duration_days];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rotation_${rotation.name || 'Export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      
      const doc = new jsPDF();
      doc.text(`Rotation: ${rotation.name}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Cycle Length: ${totalCycle} days`, 14, 22);

      const tableData = filteredSequences.map((seq, i) => {
        const sh = shiftById(seq.shift_id);
        return [i + 1, sh?.name || 'Unknown', `${seq.duration_days} day(s)`];
      });

      autoTable(doc, {
        startY: 30,
        head: [['Order', 'Shift Name', 'Duration']],
        body: tableData,
      });

      doc.save(`Rotation_${rotation.name || 'Export'}.pdf`);
    } catch (err: any) {
      toast({ title: 'Export Failed', description: 'Could not generate PDF.', variant: 'destructive' });
    }
  };

  return (
    <>
      <Card className="p-6 mb-6">
        <h2 className="mb-3 text-[16px] text-zoru-ink">Rotation Details</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px] text-zoru-ink-muted">Name</Label>
            <Input
              defaultValue={rotation.name}
              onBlur={(e) =>
                e.target.value !== rotation.name &&
                saveRotationField({ name: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px] text-zoru-ink-muted">Description</Label>
            <Input
              defaultValue={rotation.description}
              onBlur={(e) =>
                e.target.value !== rotation.description &&
                saveRotationField({ description: e.target.value })
              }
            />
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2 text-[13px] text-zoru-ink w-fit">
            <Checkbox
              checked={rotation.is_active}
              onCheckedChange={(v) => saveRotationField({ is_active: Boolean(v) })}
            />
            <span>Active</span>
          </label>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] text-zoru-ink">Sequence</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              Cycle length: {totalCycle} day{totalCycle === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-zoru-surface-2 p-3 rounded-lg border border-zoru-line">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
            <Input 
              placeholder="Filter by shift name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          {selectedSequences.size > 0 && (
            <Button variant="outline" className="text-zoru-danger-ink" onClick={bulkDelete} disabled={pending}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({selectedSequences.size})
            </Button>
          )}
        </div>

        {/* Virtualized List Container */}
        <div 
          ref={parentRef} 
          className="max-h-[400px] overflow-y-auto mb-6 rounded-lg border border-zoru-line"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const seq = filteredSequences[virtualRow.index];
              const sh = shiftById(seq.shift_id);
              const isSelected = !!seq._id && selectedSequences.has(seq._id);

              return (
                <div
                  key={seq._id || `temp-${virtualRow.index}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="px-2 py-1"
                >
                  <div className="flex h-full items-center gap-3 rounded-lg border border-zoru-line bg-zoru-bg px-3 py-1.5 transition-colors hover:bg-zoru-surface-2/50">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        if (!seq._id) return;
                        const next = new Set(selectedSequences);
                        if (checked) next.add(seq._id);
                        else next.delete(seq._id);
                        setSelectedSequences(next);
                      }}
                    />
                    <span className="w-6 text-[12px] font-medium text-zoru-ink-muted">
                      {virtualRow.index + 1}
                    </span>
                    <span
                      aria-hidden
                      className="inline-block h-4 w-4 shrink-0 rounded-[4px] border border-zoru-line"
                      style={{ backgroundColor: sh?.color_code || '#999' }}
                    />
                    <span className="flex-1 truncate text-[13px] font-medium text-zoru-ink">
                      {sh?.name ?? 'Unknown shift'}
                    </span>
                    <Badge variant="info" className="shrink-0">
                      {seq.duration_days} day{seq.duration_days === 1 ? '' : 's'}
                    </Badge>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Remove sequence step"
                      onClick={() => seq._id && removeSeq(seq._id)}
                      disabled={pending || !seq._id}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                    </Button>
                  </div>
                </div>
              );
            })}
            
            {filteredSequences.length === 0 && (
              <div className="p-8 text-center text-[13px] text-zoru-ink-muted w-full h-full flex items-center justify-center">
                {searchQuery ? 'No sequences match your filter.' : 'No sequence entries yet.'}
              </div>
            )}
          </div>
        </div>

        {/* Add Sequence Form */}
        <div className="mt-4 border-t border-zoru-line pt-4">
          <h3 className="mb-3 text-[14px] font-medium text-zoru-ink">Add to Sequence</h3>
          <AddSequenceForm shifts={shifts} onAdd={addSequence} disabled={pending} />
        </div>
      </Card>
    </>
  );
}

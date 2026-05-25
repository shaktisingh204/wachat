'use client';

import * as React from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { 
  Button, Dialog, Input, Label, Badge, Card,
  DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  DataTable, StatCard
} from '@/components/zoruui';
import { Search, Plus, Edit2, Trash2, PhoneCall, Play, Pause, Phone, PhoneMissed } from 'lucide-react';
import { getVoiceCalls, createVoiceCall, updateVoiceCall, deleteVoiceCall } from '@/app/actions/crm-advanced/voice-call';
import type { VoiceCallType } from '@/app/actions/crm-advanced/voice-call.schema';
import { ColumnDef } from "@tanstack/react-table";

export default function VoiceCallPage() {
  const [data, setData] = React.useState<VoiceCallType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDialerOpen, setIsDialerOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<VoiceCallType | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [status, setStatus] = React.useState('completed');
  const [playingId, setPlayingId] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getVoiceCalls();
      if (res.success) setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = React.useMemo(() => {
    if (!search) return data;
    return data.filter(item => 
      Object.values(item).some(val => String(val).toLowerCase().includes(search.toLowerCase()))
    );
  }, [data, search]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setStatus('completed');
    setIsDialogOpen(true);
  };

  const handleOpenEdit = React.useCallback((item: VoiceCallType) => {
    setEditingItem(item);
    setStatus(item.status);
    setIsDialogOpen(true);
  }, []);

  const handleDelete = React.useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      await deleteVoiceCall(id);
      loadData();
    } catch (err) {
      console.error('Delete failed', err);
    }
  }, [loadData]);

  const togglePlay = React.useCallback((id: string) => {
    if (playingId === id) setPlayingId(null);
    else setPlayingId(id);
  }, [playingId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const payload = Object.fromEntries(formData.entries());
      
      if (editingItem) {
        await updateVoiceCall(editingItem._id, payload);
      } else {
        await createVoiceCall(payload);
      }
      setIsDialogOpen(false);
      loadData();
    } catch (err) {
      console.error('Submit failed', err);
      alert('Validation error. Check console.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = React.useMemo<ColumnDef<VoiceCallType>[]>(() => [
    {
      accessorKey: "caller",
      header: "Caller",
    },
    {
      accessorKey: "durationSeconds",
      header: "Duration (s)",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.getValue("status") as string;
        let variant: "outline" | "default" | "secondary" | "destructive" = "outline";
        if (s === 'completed') variant = "default";
        if (s === 'missed') variant = "destructive";
        if (s === 'voicemail') variant = "secondary";
        return <Badge variant={variant} className="capitalize">{s}</Badge>;
      }
    },
    {
      id: "recording",
      header: "Recording",
      cell: ({ row }) => {
        const item = row.original;
        if (item.status === 'completed' || item.status === 'voicemail') {
          const isPlaying = playingId === item._id;
          return (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon-sm" onClick={() => togglePlay(item._id)}>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              {isPlaying && <span className="text-xs text-zoru-brand animate-pulse">Playing...</span>}
            </div>
          );
        }
        return <span className="text-xs text-zoru-ink-muted">N/A</span>;
      }
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="icon-sm" onClick={() => handleOpenEdit(item)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" className="text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => handleDelete(item._id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      }
    }
  ], [handleOpenEdit, handleDelete, playingId, togglePlay]);

  const completedCalls = data.filter(d => d.status === 'completed').length;
  const missedCalls = data.filter(d => d.status === 'missed').length;
  const totalDuration = data.reduce((acc, d) => acc + (Number(d.durationSeconds) || 0), 0);
  const avgDuration = completedCalls > 0 ? (totalDuration / completedCalls).toFixed(1) : '0';

  return (
    <>
      <EntityListShell
        title="Voice Calls"
        subtitle="Manage and analyze browser-based voice calls."
        primaryAction={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsDialerOpen(true)}>
              <PhoneCall className="h-4 w-4 mr-2" />
              Dialer
            </Button>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New Record
            </Button>
          </div>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search calls...',
        }}
        loading={loading}
        empty={!loading && filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl border-dashed border-zoru-line">
            <div className="w-12 h-12 bg-zoru-surface rounded-full flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-zoru-ink-muted" />
            </div>
            <h3 className="text-lg font-medium text-zoru-ink">No records found</h3>
            <p className="text-sm text-zoru-ink-muted mt-1">Get started by creating a new record.</p>
            <Button className="mt-4" onClick={handleOpenCreate}>Create Record</Button>
          </div>
        ) : null}
      >
        {data.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard label="Completed Calls" value={completedCalls} icon={<Phone className="h-4 w-4"/>} />
            <StatCard label="Missed Calls" value={missedCalls} icon={<PhoneMissed className="h-4 w-4"/>} />
            <StatCard label="Avg Duration (s)" value={avgDuration} icon={<PhoneCall className="h-4 w-4"/>} />
          </div>
        )}

        {filteredData.length > 0 && (
          <DataTable 
            columns={columns} 
            data={filteredData} 
            filterColumn="caller" 
            filterPlaceholder="Filter by caller..."
          />
        )}
      </EntityListShell>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit' : 'Create'} Voice Call</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div>
                <Label className="capitalize mb-1.5 block">Caller</Label>
                <Input
                  name="caller"
                  type="text"
                  defaultValue={editingItem ? editingItem.caller : ''}
                  required
                />
              </div>
              <div>
                <Label className="capitalize mb-1.5 block">Duration Seconds</Label>
                <Input
                  name="durationSeconds"
                  type="number"
                  defaultValue={editingItem ? editingItem.durationSeconds : ''}
                  required
                />
              </div>
              <div>
                <Label className="capitalize mb-1.5 block">Status</Label>
                <input type="hidden" name="status" value={status} />
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="missed">Missed</SelectItem>
                    <SelectItem value="voicemail">Voicemail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialerOpen} onOpenChange={setIsDialerOpen}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle className="text-center">Browser Dialer</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4 items-center">
             <div className="w-16 h-16 rounded-full bg-zoru-surface-2 flex items-center justify-center mb-2">
               <Phone className="h-8 w-8 text-zoru-brand" />
             </div>
             <Input placeholder="Enter phone number..." className="text-center text-lg h-12" />
             <div className="grid grid-cols-3 gap-3 w-full px-4">
               {['1','2','3','4','5','6','7','8','9','*','0','#'].map(num => (
                 <Button key={num} type="button" variant="outline" className="h-12 w-full text-lg" onClick={() => {}}>{num}</Button>
               ))}
             </div>
          </div>
          <DialogFooter className="sm:justify-center px-4 pb-4">
            <Button size="lg" className="rounded-full bg-green-500 hover:bg-green-600 text-white w-full" onClick={() => alert("Simulating Twilio/WebRTC Call...")}>
              <PhoneCall className="mr-2 h-5 w-5" /> Call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

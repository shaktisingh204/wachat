'use client';

import React, { useState } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button } from '@/components/zoruui';
import { Plus, Edit2, Trash2, MessageSquare, Users, Activity, MessageCircle, Megaphone, TrendingUp, DollarSign, Target } from 'lucide-react';
import { 
  Table, 
  ZoruTableHeader, 
  ZoruTableBody, 
  ZoruTableRow, 
  ZoruTableHead, 
  ZoruTableCell 
} from '@/components/zoruui';
import { 
  Dialog, 
  ZoruDialogTrigger, 
  ZoruDialogContent, 
  ZoruDialogHeader, 
  ZoruDialogFooter, 
  ZoruDialogTitle 
} from '@/components/zoruui';
import { Input, Label, Badge, useZoruToast, StatCard } from '@/components/zoruui';
import { createWhatsappBot, updateWhatsappBot, deleteWhatsappBot } from '@/app/actions/marketing/whatsapp-chatbots.actions';

export function WhatsappBotClient({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useZoruToast();
  
  // Form State
  const [name, setName] = useState<any>("");
  const [phoneNumber, setPhoneNumber] = useState<any>("");
  const [isActive, setIsActive] = useState<any>(false);

  const filteredData = data.filter(item => 
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditingItem(null);
    setName("");
    setPhoneNumber("");
    setIsActive(false);
    setIsDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setName(item.name || "");
    setPhoneNumber(item.phoneNumber || "");
    setIsActive(item.isActive || false);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      name,
      phoneNumber,
      isActive
    };

    try {
      if (editingItem) {
        const res = await updateWhatsappBot(editingItem._id, payload);
        if (res.success) {
          setData(data.map(i => i._id === editingItem._id ? { ...i, ...payload } : i));
          toast({ title: 'Success', description: 'Record updated successfully.' });
          setIsDialogOpen(false);
        } else {
          toast({ title: 'Error', description: res.error || 'Failed to update record.', variant: 'destructive' });
        }
      } else {
        const res = await createWhatsappBot(payload);
        if (res.success) {
          window.location.reload();
        } else {
          toast({ title: 'Error', description: res.error || 'Failed to create record.', variant: 'destructive' });
        }
      }
    } catch (err) {
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    
    const res = await deleteWhatsappBot(id);
    if (res.success) {
      setData(data.filter(i => i._id !== id));
      toast({ title: 'Success', description: 'Record deleted.' });
    } else {
      toast({ title: 'Error', description: res.error || 'Failed to delete record.', variant: 'destructive' });
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 p-4 md:p-6">
      <EntityListShell
        title="WhatsApp Chatbots"
        subtitle="Manage your WhatsApp Chatbots seamlessly."
        search={{ value: search, onChange: setSearch, placeholder: 'Search bots...' }}
        primaryAction={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <ZoruDialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Bot
              </Button>
            </ZoruDialogTrigger>
            <ZoruDialogContent>
              <ZoruDialogHeader>
                <ZoruDialogTitle>{editingItem ? 'Edit Bot' : 'Create New Bot'}</ZoruDialogTitle>
              </ZoruDialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="col-span-3"
                    placeholder="E.g. Sales Assistant"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phoneNumber" className="text-right">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="col-span-3"
                    placeholder="+1234567890"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="isActive" className="text-right">Active</Label>
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="col-span-3"
                  />
                </div>
              </div>
              <ZoruDialogFooter>
                <Button disabled={loading} onClick={handleSave}>Save</Button>
              </ZoruDialogFooter>
            </ZoruDialogContent>
          </Dialog>
        }
      >
        
        {/* Global Campaign Dashboard */}
        <div className="mb-6 rounded-xl border border-zoru-line bg-gradient-to-r from-zoru-surface-2/50 to-zoru-surface-2/50 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-lg bg-zoru-surface-2 p-3 text-zoru-ink">
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zoru-ink">Global Campaign Dashboard</h2>
              <p className="text-sm text-zoru-ink-muted">Aggregated metrics and cross-channel ROI</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Cross-Channel ROI"
              value="245%"
              icon={<TrendingUp />}
              delta={12.5}
              period="vs last month"
            />
            <StatCard
              label="Revenue Attributed"
              value="$124,500"
              icon={<DollarSign />}
              delta={8.2}
              period="vs last month"
            />
            <StatCard
              label="Active Campaigns"
              value={data.filter(d => d.isActive).length}
              icon={<Activity />}
              delta={5.2}
              period="vs last month"
            />
            <StatCard
              label="Cross-Channel Conversion"
              value="18.4%"
              icon={<Target />}
              delta={-2.4}
              period="vs last month"
              invertDelta
            />
          </div>
        </div>


        {filteredData.length === 0 ? (
          <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed text-sm text-zoru-ink-muted">
            No bots found.
          </div>
        ) : (
          <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface overflow-hidden">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Name</ZoruTableHead>
                  <ZoruTableHead>Phone Number</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {filteredData.map((item) => (
                  <ZoruTableRow key={item._id}>
                    <ZoruTableCell className="font-medium">
                      {String(item.name || '')}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {String(item.phoneNumber || '')}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {item.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Edit2 className="h-4 w-4 text-zoru-ink" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item._id)}>
                        <Trash2 className="h-4 w-4 text-zoru-ink" />
                      </Button>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </Table>
          </div>
        )}
      </EntityListShell>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button } from '@/components/sabcrm/20ui/compat';
import { Plus, Edit2, Trash2, MessageSquare, Users, Activity, MessageCircle, Megaphone, TrendingUp, DollarSign, Target } from 'lucide-react';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/sabcrm/20ui/compat';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle } from '@/components/sabcrm/20ui/compat';
import { Input, Label, Badge, useToast, StatCard } from '@/components/sabcrm/20ui/compat';
import { createWhatsappBot, updateWhatsappBot, deleteWhatsappBot } from '@/app/actions/marketing/whatsapp-chatbots.actions';

export function WhatsappBotClient({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  
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
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Bot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Edit Bot' : 'Create New Bot'}</DialogTitle>
              </DialogHeader>
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
              <DialogFooter>
                <Button disabled={loading} onClick={handleSave}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        
        {/* Global Campaign Dashboard */}
        <div className="mb-6 rounded-xl border border-[var(--st-border)] bg-gradient-to-r from-[var(--st-bg-muted)]/50 to-[var(--st-bg-muted)]/50 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-lg bg-[var(--st-bg-muted)] p-3 text-[var(--st-text)]">
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--st-text)]">Global Campaign Dashboard</h2>
              <p className="text-sm text-[var(--st-text-secondary)]">Aggregated metrics and cross-channel ROI</p>
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
          <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed text-sm text-[var(--st-text-secondary)]">
            No bots found.
          </div>
        ) : (
          <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] overflow-hidden">
            <Table>
              <THead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Phone Number</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {filteredData.map((item) => (
                  <Tr key={item._id}>
                    <Td className="font-medium">
                      {String(item.name || '')}
                    </Td>
                    <Td>
                      {String(item.phoneNumber || '')}
                    </Td>
                    <Td>
                      {item.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </Td>
                    <Td className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Edit2 className="h-4 w-4 text-[var(--st-text)]" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item._id)}>
                        <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </EntityListShell>
    </div>
  );
}

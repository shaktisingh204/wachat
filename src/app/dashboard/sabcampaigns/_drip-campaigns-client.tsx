'use client';

import React, { useState } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button } from '@/components/sabcrm/20ui/compat';
import { Plus, Edit2, Trash2, TrendingUp, Mail, MousePointerClick, Target, Activity } from 'lucide-react';
import { 
  Table, 
  ZoruTableHeader, 
  ZoruTableBody, 
  ZoruTableRow, 
  ZoruTableHead, 
  ZoruTableCell 
} from '@/components/sabcrm/20ui/compat';
import { 
  Dialog, 
  ZoruDialogTrigger, 
  ZoruDialogContent, 
  ZoruDialogHeader, 
  ZoruDialogFooter, 
  ZoruDialogTitle 
} from '@/components/sabcrm/20ui/compat';
import { Input } from '@/components/sabcrm/20ui/compat';
import { Label } from '@/components/sabcrm/20ui/compat';
import { Badge } from '@/components/sabcrm/20ui/compat';
import { useZoruToast } from '@/components/sabcrm/20ui/compat';
import { StatCard } from '@/components/sabcrm/20ui/compat';
import { ZoruChart, ZoruChartContainer, ZoruChartTooltip, ZORU_CHART_PALETTE } from '@/components/sabcrm/20ui/compat';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { createDripCampaign, updateDripCampaign, deleteDripCampaign } from '@/app/actions/marketing/drip-campaigns.actions';

export function DripCampaignClient({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useZoruToast();
  
  // Form State
  const [name, setName] = useState<any>("");
  const [status, setStatus] = useState<any>("");
  const [audienceId, setAudienceId] = useState<any>("");

  const filteredData = data.filter(item => 
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  const totalCampaigns = data.length;
  const activeCampaigns = data.filter(c => c.status === 'active').length;
  // Mock data for ROI and engagement as they are not in the schema
  const avgROI = 142; // %
  const openRate = 24.8; // %

  const roiData = [
    { channel: 'Email', roi: 156 },
    { channel: 'SMS', roi: 110 },
    { channel: 'Push', roi: 205 },
    { channel: 'In-App', roi: 98 },
  ];

  const openNew = () => {
    setEditingItem(null);
    setName("");
    setStatus("");
    setAudienceId("");
    setIsDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setName(item.name || "");
    setStatus(item.status || "");
    setAudienceId(item.audienceId || "");
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      name,
      status,
      audienceId
    };

    try {
      if (editingItem) {
        const res = await updateDripCampaign(editingItem._id, payload);
        if (res.success) {
          setData(data.map(i => i._id === editingItem._id ? { ...i, ...payload } : i));
          toast({ title: 'Success', description: 'Record updated successfully.' });
          setIsDialogOpen(false);
        } else {
          toast({ title: 'Error', description: res.error || 'Failed to update record.', variant: 'destructive' });
        }
      } else {
        const res = await createDripCampaign(payload);
        if (res.success) {
          // Optimistically reload page or add
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
    
    const res = await deleteDripCampaign(id);
    if (res.success) {
      setData(data.filter(i => i._id !== id));
      toast({ title: 'Success', description: 'Record deleted.' });
    } else {
      toast({ title: 'Error', description: res.error || 'Failed to delete record.', variant: 'destructive' });
    }
  };

  return (
    <EntityListShell
      title="Drip Campaigns"
      subtitle="Manage your Drip Campaigns seamlessly."
      search={{ value: search, onChange: setSearch, placeholder: 'Search...' }}
      primaryAction={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <ZoruDialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Create New
            </Button>
          </ZoruDialogTrigger>
          <ZoruDialogContent>
            <ZoruDialogHeader>
              <ZoruDialogTitle>{editingItem ? 'Edit Record' : 'Create New'}</ZoruDialogTitle>
            </ZoruDialogHeader>
            <div className="grid gap-4 py-4">
              
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">name</Label>
                  
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="col-span-3"
                    />
                  
                </div>
              
              
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="status" className="text-right">status</Label>
                  
                    <select
                      id="status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="col-span-3 flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zoru-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select option</option>
                      <option value="draft">draft</option>
                      <option value="active">active</option>
                      <option value="paused">paused</option>
                      <option value="completed">completed</option>
                    </select>
                  
                </div>
              
              
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="audienceId" className="text-right">audienceId</Label>
                  
                    <Input
                      id="audienceId"
                      type="text"
                      value={audienceId}
                      onChange={(e) => setAudienceId(e.target.value)}
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
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Campaigns"
          value={totalCampaigns}
          icon={<Mail className="h-4 w-4" />}
          delta={12}
          period="vs last month"
        />
        <StatCard
          label="Active Campaigns"
          value={activeCampaigns}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Avg. Open Rate"
          value={`${openRate}%`}
          icon={<MousePointerClick className="h-4 w-4" />}
          delta={2.4}
          period="vs last month"
        />
        <StatCard
          label="Cross-Channel ROI"
          value={`${avgROI}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          delta={15.2}
          period="vs last quarter"
        />
      </div>

      <div className="mb-8 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-6">
        <h3 className="mb-4 text-sm font-medium text-zoru-ink">Cross-Channel ROI (%)</h3>
        <ZoruChartContainer height={250}>
          <BarChart data={roiData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--zoru-line))" />
            <XAxis 
              dataKey="channel" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--zoru-ink-muted))", fontSize: 12 }}
              dy={10}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--zoru-ink-muted))", fontSize: 12 }}
            />
            <Tooltip content={<ZoruChartTooltip />} cursor={{ fill: "hsl(var(--zoru-line-strong))", opacity: 0.2 }} />
            <Bar dataKey="roi" fill={ZORU_CHART_PALETTE[0]} radius={[4, 4, 0, 0]} barSize={40} />
          </BarChart>
        </ZoruChartContainer>
      </div>

      {filteredData.length === 0 ? (
        <div className="flex h-[300px] flex-col items-center justify-center rounded-md border border-dashed border-zoru-line text-sm text-zoru-ink-muted space-y-4">
          <Target className="h-10 w-10 text-zoru-ink-muted opacity-50" />
          <p>No campaigns found.</p>
          {data.length === 0 && (
            <Button onClick={openNew} variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create your first campaign
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface overflow-hidden">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead className="capitalize">name</ZoruTableHead>
                <ZoruTableHead className="capitalize">status</ZoruTableHead>
                <ZoruTableHead className="capitalize">audienceId</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {filteredData.map((item) => (
                <ZoruTableRow key={item._id}>
                  
                    <ZoruTableCell>
                      {String(item.name || '')}
                    </ZoruTableCell>
                  
                  
                    <ZoruTableCell>
                      {item.status === 'active' ? (
                        <Badge tone="green">Active</Badge>
                      ) : item.status === 'paused' ? (
                        <Badge tone="amber">Paused</Badge>
                      ) : item.status === 'completed' ? (
                        <Badge tone="blue">Completed</Badge>
                      ) : (
                        <Badge tone="neutral">Draft</Badge>
                      )}
                    </ZoruTableCell>
                  
                  
                    <ZoruTableCell>
                      {String(item.audienceId || '')}
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
  );
}

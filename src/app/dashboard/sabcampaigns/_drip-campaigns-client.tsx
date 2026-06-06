'use client';

import React, { useState } from 'react';
import { Plus, Pencil, Trash2, TrendingUp, Mail, MousePointerClick, Target, Activity, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  Button,
  IconButton,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  StatCard,
  Card,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  CHART_PALETTE,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  createDripCampaign,
  updateDripCampaign,
  deleteDripCampaign,
} from '@/app/actions/marketing/drip-campaigns.actions';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
] as const;

const ROI_CHART_CONFIG = {
  roi: { label: 'ROI %', color: CHART_PALETTE[0] },
} as const;

export function DripCampaignClient({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  // Form state
  const [name, setName] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [audienceId, setAudienceId] = useState<string>('');

  const filteredData = data.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
  );

  const totalCampaigns = data.length;
  const activeCampaigns = data.filter((c) => c.status === 'active').length;
  // Illustrative ROI + engagement figures (not yet in the schema).
  const avgROI = 142; // percent
  const openRate = 24.8; // percent

  const roiData = [
    { channel: 'Email', roi: 156 },
    { channel: 'SMS', roi: 110 },
    { channel: 'Push', roi: 205 },
    { channel: 'In-App', roi: 98 },
  ];

  const openNew = () => {
    setEditingItem(null);
    setName('');
    setStatus('');
    setAudienceId('');
    setIsDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setName(item.name || '');
    setStatus(item.status || '');
    setAudienceId(item.audienceId || '');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = { name, status, audienceId };

    try {
      if (editingItem) {
        const res = await updateDripCampaign(editingItem._id, payload);
        if (res.success) {
          setData(data.map((i) => (i._id === editingItem._id ? { ...i, ...payload } : i)));
          toast.success({ title: 'Campaign updated', description: 'Your changes have been saved.' });
          setIsDialogOpen(false);
        } else {
          toast.error({ title: 'Update failed', description: res.error || 'Could not update the campaign.' });
        }
      } else {
        const res = await createDripCampaign(payload);
        if (res.success) {
          // Reload to pick up the server-generated record.
          window.location.reload();
        } else {
          toast.error({ title: 'Create failed', description: res.error || 'Could not create the campaign.' });
        }
      }
    } catch (err) {
      toast.error({ title: 'Something went wrong', description: 'An unexpected error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;

    const res = await deleteDripCampaign(id);
    if (res.success) {
      setData(data.filter((i) => i._id !== id));
      toast.success({ title: 'Campaign deleted' });
    } else {
      toast.error({ title: 'Delete failed', description: res.error || 'Could not delete the campaign.' });
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Drip Campaigns</PageTitle>
          <PageDescription>Manage your drip campaigns seamlessly.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <div className="w-full sm:w-64">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns..."
              iconLeft={Search}
              aria-label="Search campaigns"
            />
          </div>
          <Button variant="primary" iconLeft={Plus} onClick={openNew}>
            Create New
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Campaigns"
          value={totalCampaigns}
          icon={Mail}
          delta={{ value: '+12%', tone: 'up' }}
        />
        <StatCard label="Active Campaigns" value={activeCampaigns} icon={Activity} />
        <StatCard
          label="Avg. Open Rate"
          value={`${openRate}%`}
          icon={MousePointerClick}
          delta={{ value: '+2.4%', tone: 'up' }}
        />
        <StatCard
          label="Cross-Channel ROI"
          value={`${avgROI}%`}
          icon={TrendingUp}
          delta={{ value: '+15.2%', tone: 'up' }}
        />
      </div>

      <Card padding="lg">
        <h3 className="mb-4 text-sm font-medium text-[var(--st-text)]">Cross-Channel ROI (%)</h3>
        <ChartContainer config={ROI_CHART_CONFIG} style={{ height: 250 }}>
          <BarChart data={roiData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--st-border)" />
            <XAxis
              dataKey="channel"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--st-text-secondary)', fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--st-text-secondary)', fontSize: 12 }}
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              cursor={{ fill: 'var(--st-border-strong)', opacity: 0.2 }}
            />
            <Bar dataKey="roi" fill={CHART_PALETTE[0]} radius={[4, 4, 0, 0]} barSize={40} />
          </BarChart>
        </ChartContainer>
      </Card>

      {filteredData.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={Target}
            title="No campaigns found"
            description={
              data.length === 0
                ? 'Get started by creating your first drip campaign.'
                : 'No campaigns match your search.'
            }
            action={
              data.length === 0 ? (
                <Button variant="outline" size="sm" iconLeft={Plus} onClick={openNew}>
                  Create your first campaign
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Audience ID</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredData.map((item) => (
                <Tr key={item._id}>
                  <Td>{String(item.name || '')}</Td>
                  <Td>
                    {item.status === 'active' ? (
                      <Badge tone="success" dot>
                        Active
                      </Badge>
                    ) : item.status === 'paused' ? (
                      <Badge tone="warning" dot>
                        Paused
                      </Badge>
                    ) : item.status === 'completed' ? (
                      <Badge tone="info" dot>
                        Completed
                      </Badge>
                    ) : (
                      <Badge tone="neutral" dot>
                        Draft
                      </Badge>
                    )}
                  </Td>
                  <Td>{String(item.audienceId || '')}</Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label="Edit campaign"
                        icon={Pencil}
                        size="sm"
                        onClick={() => openEdit(item)}
                      />
                      <IconButton
                        label="Delete campaign"
                        icon={Trash2}
                        size="sm"
                        onClick={() => handleDelete(item._id)}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Campaign' : 'Create New Campaign'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field label="Name">
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Welcome series"
              />
            </Field>

            <Field label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger aria-label="Status">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Audience ID">
              <Input
                type="text"
                value={audienceId}
                onChange={(e) => setAudienceId(e.target.value)}
                placeholder="aud_12345"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={loading} onClick={handleSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

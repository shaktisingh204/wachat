'use client';

import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Globe, Eye, MousePointerClick, Percent } from 'lucide-react';

import { fmtINR } from '@/lib/utils';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Button,
  IconButton,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  StatCard,
  Switch,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  Field,
  Input,
  Badge,
  EmptyState,
  useToast,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ChartContainer,
  ChartTooltip,
  Recharts,
  CHART_PALETTE,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
} from '@/components/sabcrm/20ui';
import {
  createLandingPage,
  updateLandingPage,
  deleteLandingPage,
} from '@/app/actions/marketing/landing-page-builder.actions';

function deltaUp(value: string) {
  return { value, tone: 'up' as const };
}
function deltaDown(value: string) {
  return { value, tone: 'down' as const };
}

export function LandingPageClient({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  // Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  const filteredData = data.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
  );

  // Metrics computation
  const totalPages = data.length;
  const totalViews = data.reduce((sum, item) => sum + (item.views || 0), 0);
  const totalConversions = data.reduce((sum, item) => sum + (item.conversions || 0), 0);
  const avgConversionRate = totalViews > 0 ? ((totalConversions / totalViews) * 100).toFixed(1) : '0';

  const openNew = () => {
    setEditingItem(null);
    setTitle('');
    setSlug('');
    setIsPublished(false);
    setIsDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setTitle(item.title || '');
    setSlug(item.slug || '');
    setIsPublished(item.isPublished || false);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      title,
      slug,
      isPublished,
    };

    try {
      if (editingItem) {
        const res = await updateLandingPage(editingItem._id, payload);
        if (res.success) {
          setData(data.map((i) => (i._id === editingItem._id ? { ...i, ...payload } : i)));
          toast.success({ title: 'Record updated successfully.' });
          setIsDialogOpen(false);
        } else {
          toast.error({ title: 'Update failed', description: res.error || 'Failed to update record.' });
        }
      } else {
        const res = await createLandingPage(payload);
        if (res.success) {
          window.location.reload();
        } else {
          toast.error({ title: 'Create failed', description: res.error || 'Failed to create record.' });
        }
      }
    } catch (err) {
      toast.error({ title: 'Something went wrong', description: 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    const res = await deleteLandingPage(id);
    if (res.success) {
      setData(data.filter((i) => i._id !== id));
      toast.success({ title: 'Record deleted.' });
    } else {
      toast.error({ title: 'Delete failed', description: res.error || 'Failed to delete record.' });
    }
  };

  const mockChannelData = [
    { channel: 'Organic Search', spend: 0, revenue: 12500, roi: 0, cpa: 0 }, // ROI is inf, handled separately
    { channel: 'Paid Social', spend: 5000, revenue: 15000, roi: 200, cpa: 45 },
    { channel: 'Paid Search', spend: 8000, revenue: 22000, roi: 175, cpa: 35 },
    { channel: 'Email Marketing', spend: 500, revenue: 8500, roi: 1600, cpa: 5 },
    { channel: 'Affiliates', spend: 2000, revenue: 6000, roi: 200, cpa: 25 },
  ];

  const totalSpend = mockChannelData.reduce((sum, item) => sum + item.spend, 0);
  const totalRevenue = mockChannelData.reduce((sum, item) => sum + item.revenue, 0);
  const overallROI = (((totalRevenue - totalSpend) / totalSpend) * 100).toFixed(1);
  const blendedCPA = totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : '0.00';

  return (
    <div className="flex flex-col gap-6 w-full">
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard">Global Campaign Dashboard</TabsTrigger>
          <TabsTrigger value="landing-pages">Landing Pages</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Cross-Channel Spend"
              value={fmtINR(totalSpend)}
              icon={Globe}
              delta={deltaUp('+5.2%')}
            />
            <StatCard
              label="Total Revenue Generated"
              value={fmtINR(totalRevenue)}
              icon={MousePointerClick}
              delta={deltaUp('+12.4%')}
            />
            <StatCard
              label="Overall Campaign ROI"
              value={`${overallROI}%`}
              icon={Percent}
              delta={deltaUp('+8.1%')}
            />
            <StatCard
              label="Blended CPA"
              value={`$${blendedCPA}`}
              icon={Eye}
              delta={deltaDown('-2.3%')}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cross-Channel Revenue vs Spend</CardTitle>
              </CardHeader>
              <CardBody>
                <ChartContainer height={300}>
                  <Recharts.BarChart data={mockChannelData}>
                    <Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <Recharts.XAxis dataKey="channel" axisLine={false} tickLine={false} />
                    <Recharts.YAxis
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val: number) => `$${val / 1000}k`}
                    />
                    <Recharts.Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: 'var(--st-bg-secondary)' }}
                    />
                    <Recharts.Bar dataKey="revenue" name="Revenue" fill={CHART_PALETTE[0]} radius={[4, 4, 0, 0]} />
                    <Recharts.Bar dataKey="spend" name="Spend" fill={CHART_PALETTE[3]} radius={[4, 4, 0, 0]} />
                  </Recharts.BarChart>
                </ChartContainer>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Channel ROI (%)</CardTitle>
              </CardHeader>
              <CardBody>
                <ChartContainer height={300}>
                  <Recharts.LineChart data={mockChannelData}>
                    <Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <Recharts.XAxis dataKey="channel" axisLine={false} tickLine={false} />
                    <Recharts.YAxis axisLine={false} tickLine={false} />
                    <Recharts.Tooltip content={<ChartTooltip />} />
                    <Recharts.Line
                      type="monotone"
                      dataKey="roi"
                      name="ROI (%)"
                      stroke={CHART_PALETTE[0]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </Recharts.LineChart>
                </ChartContainer>
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="landing-pages" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Landing Pages" value={totalPages} icon={Globe} delta={deltaUp('+12%')} />
            <StatCard label="Total Views" value={totalViews} icon={Eye} delta={deltaUp('+24%')} />
            <StatCard
              label="Total Conversions"
              value={totalConversions}
              icon={MousePointerClick}
              delta={deltaUp('+18%')}
            />
            <StatCard
              label="Avg Conversion Rate"
              value={`${avgConversionRate}%`}
              icon={Percent}
              delta={deltaUp('+4.5%')}
            />
          </div>

          <EntityListShell
            title="Landing Pages"
            subtitle="Manage your Landing Pages and marketing funnels seamlessly."
            search={{ value: search, onChange: setSearch, placeholder: 'Search...' }}
            primaryAction={
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="primary" iconLeft={Plus} onClick={openNew}>
                    Create New
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingItem ? 'Edit Record' : 'Create New'}</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <Field label="Title">
                      <Input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </Field>
                    <Field label="Slug">
                      <Input
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                      />
                    </Field>
                    <Field label="Published">
                      <Switch
                        checked={isPublished}
                        onCheckedChange={setIsPublished}
                        aria-label="Published"
                      />
                    </Field>
                  </div>
                  <DialogFooter>
                    <Button variant="primary" loading={loading} onClick={handleSave}>
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            }
          >
            {filteredData.length === 0 ? (
              <EmptyState
                icon={Globe}
                title="No landing pages yet"
                description="Create your first landing page to start capturing conversions."
                action={
                  <Button variant="primary" iconLeft={Plus} onClick={openNew}>
                    Create New
                  </Button>
                }
              />
            ) : (
              <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] overflow-hidden">
                <Table>
                  <THead>
                    <Tr>
                      <Th>Title</Th>
                      <Th>Slug</Th>
                      <Th>Status</Th>
                      <Th align="right">Views</Th>
                      <Th align="right">Conversions</Th>
                      <Th align="right">Actions</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {filteredData.map((item) => (
                      <Tr key={item._id}>
                        <Td>{String(item.title || '')}</Td>
                        <Td>{String(item.slug || '')}</Td>
                        <Td>
                          {item.isPublished ? (
                            <Badge tone="success">Published</Badge>
                          ) : (
                            <Badge tone="neutral">Draft</Badge>
                          )}
                        </Td>
                        <Td align="right">{item.views?.toLocaleString() || 0}</Td>
                        <Td align="right">{item.conversions?.toLocaleString() || 0}</Td>
                        <Td align="right">
                          <div className="flex items-center justify-end gap-2">
                            <IconButton
                              label="Edit landing page"
                              icon={Pencil}
                              variant="ghost"
                              onClick={() => openEdit(item)}
                            />
                            <IconButton
                              label="Delete landing page"
                              icon={Trash2}
                              variant="ghost"
                              onClick={() => handleDelete(item._id)}
                            />
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </EntityListShell>
        </TabsContent>
      </Tabs>
    </div>
  );
}

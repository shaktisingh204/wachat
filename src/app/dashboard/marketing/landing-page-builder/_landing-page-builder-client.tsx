import { fmtINR } from "@/lib/utils";
'use client';

import React, { useState } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button } from '@/components/zoruui';
import { Plus, Edit2, Trash2, Globe, Eye, MousePointerClick, Percent } from 'lucide-react';
import { 
  Table, 
  ZoruTableHeader, 
  ZoruTableBody, 
  ZoruTableRow, 
  ZoruTableHead, 
  ZoruTableCell,
  StatCard,
  Switch
} from '@/components/zoruui';
import { 
  Dialog, 
  ZoruDialogTrigger, 
  ZoruDialogContent, 
  ZoruDialogHeader, 
  ZoruDialogFooter, 
  ZoruDialogTitle 
} from '@/components/zoruui';
import { Input } from '@/components/zoruui';
import { Label } from '@/components/zoruui';
import { Badge } from '@/components/zoruui';
import { useZoruToast } from '@/components/zoruui';
import { createLandingPage, updateLandingPage, deleteLandingPage } from '@/app/actions/marketing/landing-page-builder.actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ZoruChartContainer, ZoruChartTooltip, ZoruChart, ZORU_CHART_PALETTE } from '@/components/zoruui/chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/zoruui/card';

export function LandingPageClient({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useZoruToast();
  
  // Form State
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  const filteredData = data.filter(item => 
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  // Metrics computation
  const totalPages = data.length;
  const totalViews = data.reduce((sum, item) => sum + (item.views || 0), 0);
  const totalConversions = data.reduce((sum, item) => sum + (item.conversions || 0), 0);
  const avgConversionRate = totalViews > 0 ? ((totalConversions / totalViews) * 100).toFixed(1) : 0;

  const openNew = () => {
    setEditingItem(null);
    setTitle("");
    setSlug("");
    setIsPublished(false);
    setIsDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setTitle(item.title || "");
    setSlug(item.slug || "");
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
          setData(data.map(i => i._id === editingItem._id ? { ...i, ...payload } : i));
          toast({ title: 'Success', description: 'Record updated successfully.' });
          setIsDialogOpen(false);
        } else {
          toast({ title: 'Error', description: res.error || 'Failed to update record.', variant: 'destructive' });
        }
      } else {
        const res = await createLandingPage(payload);
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
    
    const res = await deleteLandingPage(id);
    if (res.success) {
      setData(data.filter(i => i._id !== id));
      toast({ title: 'Success', description: 'Record deleted.' });
    } else {
      toast({ title: 'Error', description: res.error || 'Failed to delete record.', variant: 'destructive' });
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
  const overallROI = ((totalRevenue - totalSpend) / totalSpend * 100).toFixed(1);
  const blendedCPA = totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : "0.00";

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
              icon={<Globe />}
              delta={5.2}
              period="vs last month"
            />
            <StatCard
              label="Total Revenue Generated"
              value={fmtINR(totalRevenue)}
              icon={<MousePointerClick />}
              delta={12.4}
              period="vs last month"
            />
            <StatCard
              label="Overall Campaign ROI"
              value={`${overallROI}%`}
              icon={<Percent />}
              delta={8.1}
              period="vs last month"
            />
            <StatCard
              label="Blended CPA"
              value={`$${blendedCPA}`}
              icon={<Eye />}
              delta={-2.3}
              period="vs last month"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cross-Channel Revenue vs Spend</CardTitle>
              </CardHeader>
              <CardContent>
                <ZoruChartContainer height={300}>
                  <ZoruChart.BarChart data={mockChannelData}>
                    <ZoruChart.CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <ZoruChart.XAxis dataKey="channel" axisLine={false} tickLine={false} />
                    <ZoruChart.YAxis axisLine={false} tickLine={false} tickFormatter={(val: number) => `$${val/1000}k`} />
                    <ZoruChart.Tooltip content={<ZoruChartTooltip />} cursor={{ fill: 'var(--zoru-bg-muted)' }} />
                    <ZoruChart.Bar dataKey="revenue" name="Revenue" fill={ZORU_CHART_PALETTE[0]} radius={[4, 4, 0, 0]} />
                    <ZoruChart.Bar dataKey="spend" name="Spend" fill={ZORU_CHART_PALETTE[3]} radius={[4, 4, 0, 0]} />
                  </ZoruChart.BarChart>
                </ZoruChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Channel ROI (%)</CardTitle>
              </CardHeader>
              <CardContent>
                <ZoruChartContainer height={300}>
                  <ZoruChart.LineChart data={mockChannelData}>
                    <ZoruChart.CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <ZoruChart.XAxis dataKey="channel" axisLine={false} tickLine={false} />
                    <ZoruChart.YAxis axisLine={false} tickLine={false} />
                    <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                    <ZoruChart.Line type="monotone" dataKey="roi" name="ROI (%)" stroke={ZORU_CHART_PALETTE[0]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </ZoruChart.LineChart>
                </ZoruChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="landing-pages" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Landing Pages"
          value={totalPages}
          icon={<Globe />}
          delta={12}
          period="vs last month"
        />
        <StatCard
          label="Total Views"
          value={totalViews}
          icon={<Eye />}
          delta={24}
          period="vs last month"
        />
        <StatCard
          label="Total Conversions"
          value={totalConversions}
          icon={<MousePointerClick />}
          delta={18}
          period="vs last month"
        />
        <StatCard
          label="Avg Conversion Rate"
          value={`${avgConversionRate}%`}
          icon={<Percent />}
          delta={4.5}
          period="vs last month"
        />
      </div>

      <EntityListShell
        title="Landing Pages"
        subtitle="Manage your Landing Pages and marketing funnels seamlessly."
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
                  <Label htmlFor="title" className="text-right">Title</Label>
                  <Input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="slug" className="text-right">Slug</Label>
                  <Input
                    id="slug"
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="isPublished" className="text-right">Published</Label>
                  <div className="col-span-3 flex items-center h-full">
                    <Switch
                      id="isPublished"
                      checked={isPublished}
                      onCheckedChange={setIsPublished}
                    />
                  </div>
                </div>
              </div>
              <ZoruDialogFooter>
                <Button disabled={loading} onClick={handleSave}>Save</Button>
              </ZoruDialogFooter>
            </ZoruDialogContent>
          </Dialog>
        }
      >
        {filteredData.length === 0 ? (
          <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            No records found.
          </div>
        ) : (
          <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface overflow-hidden">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead className="capitalize">Title</ZoruTableHead>
                  <ZoruTableHead className="capitalize">Slug</ZoruTableHead>
                  <ZoruTableHead className="capitalize">Status</ZoruTableHead>
                  <ZoruTableHead className="capitalize text-right">Views</ZoruTableHead>
                  <ZoruTableHead className="capitalize text-right">Conversions</ZoruTableHead>
                  <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {filteredData.map((item) => (
                  <ZoruTableRow key={item._id}>
                    <ZoruTableCell>
                      {String(item.title || '')}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {String(item.slug || '')}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {item.isPublished ? (
                        <Badge variant="success">Published</Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      {item.views?.toLocaleString() || 0}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      {item.conversions?.toLocaleString() || 0}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Edit2 className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item._id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </Table>
          </div>
        )}
      </EntityListShell>
        </TabsContent>
      </Tabs>
    </div>
  );
}

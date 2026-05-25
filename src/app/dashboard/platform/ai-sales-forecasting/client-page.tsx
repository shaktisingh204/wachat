import { fmtINR } from "@/lib/utils";
'use client';

import { useState, useTransition } from 'react';
import useSWR from 'swr';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Card, Input, Label, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogFooter, Table, ZoruTableHeader, ZoruTableBody, ZoruTableRow, ZoruTableHead, ZoruTableCell, useZoruToast, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/zoruui';
import { createSalesForecast, deleteSalesForecast, getSalesForecasts } from '@/app/actions/platform/ai-sales-forecasting.actions';
import type { AISalesForecast } from '@/types/platform';
import { LoaderCircle, Plus, Trash2 } from 'lucide-react';

export function ClientSalesForecastingPage({ initialData }: { initialData: AISalesForecast[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();
  const { data: forecasts = initialData, mutate } = useSWR<AISalesForecast[]>('ai-sales-forecasts', () => getSalesForecasts(), {
    fallbackData: initialData,
  });

  const [form, setForm] = useState({ period: '', predictedRevenue: 0, confidenceScore: 0, aiModel: 'gpt-4', drivers: '' });

  const handleCreate = async () => {
    if (!form.period) return;
    startTransition(async () => {
      try {
        await createSalesForecast({
          ...form,
          drivers: form.drivers.split(',').map(d => d.trim()).filter(Boolean)
        });
        toast({ title: 'Forecast created', variant: 'success' });
        setDialogOpen(false);
        setForm({ period: '', predictedRevenue: 0, confidenceScore: 0, aiModel: 'gpt-4', drivers: '' });
        await mutate();
      } catch (err) {
        toast({ title: 'Error creating forecast', variant: 'destructive' });
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteSalesForecast(id);
      toast({ title: 'Forecast deleted', variant: 'success' });
      await mutate();
    } catch (err) {
      toast({ title: 'Error deleting forecast', variant: 'destructive' });
    }
  };

  const filteredData = forecasts.filter(d => d.period.toLowerCase().includes(query.toLowerCase()));

  return (
    <EntityListShell
      title="AI Sales Forecasting"
      subtitle="Predict revenue and analyze sales trends using AI."
      primaryAction={<Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Run Forecast</Button>}
      search={{ value: query, onChange: setQuery, placeholder: 'Search by period...' }}
    >
      <Card className="border-zoru-line bg-zoru-bg overflow-hidden">
        <Table>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead>Period</ZoruTableHead>
              <ZoruTableHead>Model</ZoruTableHead>
              <ZoruTableHead>Predicted Revenue</ZoruTableHead>
              <ZoruTableHead>Confidence</ZoruTableHead>
              <ZoruTableHead>Drivers</ZoruTableHead>
              <ZoruTableHead className="text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {filteredData.map(item => (
              <ZoruTableRow key={item.id}>
                <ZoruTableCell className="font-medium">{item.period}</ZoruTableCell>
                <ZoruTableCell>{item.aiModel || 'N/A'}</ZoruTableCell>
                <ZoruTableCell>{fmtINR(item.predictedRevenue)}</ZoruTableCell>
                <ZoruTableCell>{item.confidenceScore}%</ZoruTableCell>
                <ZoruTableCell>{item.drivers.join(', ')}</ZoruTableCell>
                <ZoruTableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </ZoruTableCell>
              </ZoruTableRow>
            ))}
            {filteredData.length === 0 && (
              <ZoruTableRow>
                <ZoruTableCell colSpan={6} className="text-center py-8 text-zoru-ink-light">No forecasts found.</ZoruTableCell>
              </ZoruTableRow>
            )}
          </ZoruTableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New Sales Forecast</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Period (e.g. Q4 2026)</Label>
              <Input value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>AI Model</Label>
              <Select value={form.aiModel} onValueChange={v => setForm({ ...form, aiModel: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an AI Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                  <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                  <SelectItem value="llama-3">Llama 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Predicted Revenue ($)</Label>
              <Input type="number" value={form.predictedRevenue} onChange={e => setForm({ ...form, predictedRevenue: parseFloat(e.target.value) })} />
            </div>
            <div className="grid gap-2">
              <Label>Confidence Score (%)</Label>
              <Input type="number" value={form.confidenceScore} onChange={e => setForm({ ...form, confidenceScore: parseInt(e.target.value) })} />
            </div>
            <div className="grid gap-2">
              <Label>Key Drivers (comma separated)</Label>
              <Input value={form.drivers} onChange={e => setForm({ ...form, drivers: e.target.value })} placeholder="Marketing spend, new leads" />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending ? <LoaderCircle className="w-4 h-4 mr-2 animate-spin" /> : null} Create
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </EntityListShell>
  );
}

'use client';
import { fmtINR } from '@/lib/utils';

import { useState, useTransition } from 'react';
import useSWR from 'swr';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Button,
  IconButton,
  Card,
  Field,
  Input,
  Badge,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  useToast,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import {
  createSalesForecast,
  deleteSalesForecast,
  getSalesForecasts,
} from '@/app/actions/platform/ai-sales-forecasting.actions';
import type { AISalesForecast } from '@/types/platform';
import { Plus, Trash2, TrendingUp } from 'lucide-react';

export function ClientSalesForecastingPage({ initialData }: { initialData: AISalesForecast[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { data: forecasts = initialData, mutate } = useSWR<AISalesForecast[]>(
    'ai-sales-forecasts',
    () => getSalesForecasts(),
    { fallbackData: initialData },
  );

  const [form, setForm] = useState({
    period: '',
    predictedRevenue: 0,
    confidenceScore: 0,
    aiModel: 'gpt-4',
    drivers: '',
  });

  const handleCreate = async () => {
    if (!form.period) return;
    startTransition(async () => {
      try {
        await createSalesForecast({
          ...form,
          drivers: form.drivers
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean),
        });
        toast.success('Forecast created');
        setDialogOpen(false);
        setForm({ period: '', predictedRevenue: 0, confidenceScore: 0, aiModel: 'gpt-4', drivers: '' });
        await mutate();
      } catch {
        toast.error('Error creating forecast');
      }
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSalesForecast(id);
      toast.success('Forecast deleted');
      await mutate();
    } catch {
      toast.error('Error deleting forecast');
    } finally {
      setPendingDeleteId(null);
    }
  };

  const filteredData = forecasts.filter((d) =>
    d.period.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <EntityListShell
      title="AI Sales Forecasting"
      subtitle="Predict revenue and analyze sales trends using AI."
      primaryAction={
        <Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>
          Run Forecast
        </Button>
      }
      search={{ value: query, onChange: setQuery, placeholder: 'Search by period...' }}
    >
      <Card padding="none" className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Period</Th>
              <Th>Model</Th>
              <Th align="right">Predicted Revenue</Th>
              <Th align="right">Confidence</Th>
              <Th>Drivers</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {filteredData.map((item) => (
              <Tr key={item.id}>
                <Td className="font-medium">{item.period}</Td>
                <Td>{item.aiModel || 'N/A'}</Td>
                <Td align="right">{fmtINR(item.predictedRevenue)}</Td>
                <Td align="right">
                  <Badge
                    tone={
                      item.confidenceScore >= 75
                        ? 'success'
                        : item.confidenceScore >= 50
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {item.confidenceScore}%
                  </Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {item.drivers.length > 0 ? (
                      item.drivers.map((driver, i) => (
                        <Badge key={`${item.id}-driver-${i}`} tone="neutral">
                          {driver}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[var(--st-text-tertiary)]">None</span>
                    )}
                  </div>
                </Td>
                <Td align="right">
                  <IconButton
                    label={`Delete forecast for ${item.period}`}
                    icon={Trash2}
                    variant="ghost"
                    onClick={() => setPendingDeleteId(item.id)}
                  />
                </Td>
              </Tr>
            ))}
            {filteredData.length === 0 && (
              <Tr>
                <Td colSpan={6}>
                  <EmptyState
                    icon={TrendingUp}
                    title="No forecasts found"
                    description="Run a forecast to predict revenue and analyze sales trends."
                  />
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Sales Forecast</DialogTitle>
            <DialogDescription>
              Configure the period and model, then generate a predicted revenue forecast.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field label="Period (e.g. Q4 2026)">
              <Input
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
              />
            </Field>
            <Field label="AI Model">
              <Select value={form.aiModel} onValueChange={(v) => setForm({ ...form, aiModel: v })}>
                <SelectTrigger aria-label="AI Model">
                  <SelectValue placeholder="Select an AI Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                  <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                  <SelectItem value="llama-3">Llama 3</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Predicted Revenue">
              <Input
                type="number"
                prefix="₹"
                value={form.predictedRevenue}
                onChange={(e) =>
                  setForm({ ...form, predictedRevenue: parseFloat(e.target.value) || 0 })
                }
              />
            </Field>
            <Field label="Confidence Score">
              <Input
                type="number"
                suffix="%"
                value={form.confidenceScore}
                onChange={(e) =>
                  setForm({ ...form, confidenceScore: parseInt(e.target.value, 10) || 0 })
                }
              />
            </Field>
            <Field label="Key Drivers (comma separated)">
              <Input
                value={form.drivers}
                onChange={(e) => setForm({ ...form, drivers: e.target.value })}
                placeholder="Marketing spend, new leads"
              />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="primary" onClick={handleCreate} loading={isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this forecast?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the forecast. You cannot undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep forecast</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteId) void handleDelete(pendingDeleteId);
              }}
            >
              Delete forecast
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EntityListShell>
  );
}

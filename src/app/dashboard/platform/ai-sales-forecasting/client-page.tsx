'use client';
import { fmtINR } from '@/lib/utils';

import { useMemo, useState, useTransition } from 'react';
import useSWR from 'swr';
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Badge,
  StatCard,
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
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import {
  createSalesForecast,
  deleteSalesForecast,
  getSalesForecasts,
} from '@/app/actions/platform/ai-sales-forecasting.actions';
import type { AISalesForecast } from '@/types/platform';
import { Plus, Trash2, TrendingUp, Search, Gauge, IndianRupee } from 'lucide-react';

function confidenceTone(score: number): BadgeTone {
  if (score >= 75) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

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
          drivers: form.drivers.split(',').map((d) => d.trim()).filter(Boolean),
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

  const stats = useMemo(() => {
    const count = forecasts.length;
    const totalRevenue = forecasts.reduce((sum, f) => sum + (f.predictedRevenue || 0), 0);
    const avgConfidence = count
      ? Math.round(forecasts.reduce((sum, f) => sum + (f.confidenceScore || 0), 0) / count)
      : 0;
    return { count, totalRevenue, avgConfidence };
  }, [forecasts]);

  const filteredData = forecasts.filter((d) =>
    d.period.toLowerCase().includes(query.toLowerCase()),
  );

  const runButton = (
    <Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>
      Run forecast
    </Button>
  );

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Platform · AI</PageEyebrow>
          <PageTitle>AI sales forecasting</PageTitle>
          <PageDescription>
            Predict revenue per period and track the drivers and confidence behind each model run.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>{runButton}</PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Forecasts" value={stats.count} icon={TrendingUp} />
        <StatCard label="Predicted revenue" value={fmtINR(stats.totalRevenue)} icon={IndianRupee} />
        <StatCard label="Avg confidence" value={`${stats.avgConfidence}%`} icon={Gauge} />
      </div>

      <Card padding="none" className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 border-b border-[var(--st-border)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
            <CardTitle>Forecast runs</CardTitle>
          </div>
          <div className="w-full sm:w-56">
            <Field label="Search by period" className="[&_.u-field__label]:sr-only">
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by period…"
                iconLeft={Search}
              />
            </Field>
          </div>
        </CardHeader>

        {filteredData.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title={query ? 'No matching forecasts' : 'No forecasts yet'}
            description={
              query
                ? 'Try a different search term.'
                : 'Run a forecast to predict revenue and analyze sales trends.'
            }
            action={query ? undefined : runButton}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Period</Th>
                <Th>Model</Th>
                <Th align="right">Predicted revenue</Th>
                <Th align="right">Confidence</Th>
                <Th>Drivers</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredData.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium">{item.period}</Td>
                  <Td>
                    <Badge tone="info" kind="soft" className="font-mono text-xs">
                      {item.aiModel || 'N/A'}
                    </Badge>
                  </Td>
                  <Td align="right" className="font-medium">
                    {fmtINR(item.predictedRevenue)}
                  </Td>
                  <Td align="right">
                    <Badge tone={confidenceTone(item.confidenceScore)}>
                      {item.confidenceScore}%
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {item.drivers.length > 0 ? (
                        item.drivers.map((driver, i) => (
                          <Badge key={`${item.id}-driver-${i}`} tone="neutral" kind="soft">
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
                      variant="danger"
                      onClick={() => setPendingDeleteId(item.id)}
                    />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New sales forecast</DialogTitle>
            <DialogDescription>
              Configure the period and model, then generate a predicted revenue forecast.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field label="Period">
              <Input
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                placeholder="e.g. Q4 2026"
              />
            </Field>
            <Field label="AI model">
              <Select value={form.aiModel} onValueChange={(v) => setForm({ ...form, aiModel: v })}>
                <SelectTrigger aria-label="AI model">
                  <SelectValue placeholder="Select an AI model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                  <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                  <SelectItem value="llama-3">Llama 3</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Predicted revenue">
              <Input
                type="number"
                prefix="₹"
                value={form.predictedRevenue}
                onChange={(e) =>
                  setForm({ ...form, predictedRevenue: parseFloat(e.target.value) || 0 })
                }
              />
            </Field>
            <Field label="Confidence score">
              <Input
                type="number"
                suffix="%"
                value={form.confidenceScore}
                onChange={(e) =>
                  setForm({ ...form, confidenceScore: parseInt(e.target.value, 10) || 0 })
                }
              />
            </Field>
            <Field label="Key drivers" help="Comma separated.">
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
              intent="danger"
              onClick={() => {
                if (pendingDeleteId) void handleDelete(pendingDeleteId);
              }}
            >
              Delete forecast
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

'use client';

/**
 * Rewards catalog CRUD. Each item is a redeemable reward with a SabFiles
 * image reference (NEVER a free-text URL — SabFiles policy) and a point
 * cost. Stock is optional; when set, redemptions can drain it.
 */

import * as React from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Switch,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { SabFilePickerButton } from '@/components/sabfiles';

import {
  createRewardsCatalogItem,
  deleteRewardsCatalogItem,
  updateRewardsCatalogItem,
} from '@/app/actions/rewards.actions';
import type { RewardsCatalogItemDoc } from '@/lib/rust-client/rewards-catalog';

interface ProgramOption {
  id: string;
  name: string;
}

interface CatalogFormState {
  name: string;
  description: string;
  programId: string;
  imageFileId: string;
  imagePreviewUrl: string;
  pointsCost: number;
  stock: string;
  active: boolean;
}

const EMPTY_FORM: CatalogFormState = {
  name: '',
  description: '',
  programId: '',
  imageFileId: '',
  imagePreviewUrl: '',
  pointsCost: 0,
  stock: '',
  active: true,
};

export function CatalogClient({
  initialItems,
  programs,
}: {
  initialItems: RewardsCatalogItemDoc[];
  programs: ProgramOption[];
}): React.JSX.Element {
  const { toast } = useZoruToast();

  const [items, setItems] = React.useState<RewardsCatalogItemDoc[]>(initialItems);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RewardsCatalogItemDoc | null>(null);
  const [form, setForm] = React.useState<CatalogFormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  const openNew = React.useCallback(() => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((item: RewardsCatalogItemDoc) => {
    setEditing(item);
    setForm({
      name: item.name ?? '',
      description: item.description ?? '',
      programId: item.programId ?? '',
      imageFileId: item.imageFileId ?? '',
      imagePreviewUrl: '',
      pointsCost: item.pointsCost ?? 0,
      stock: item.stock != null ? String(item.stock) : '',
      active: item.active ?? true,
    });
    setDialogOpen(true);
  }, []);

  const handleSave = React.useCallback(async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (form.pointsCost < 0) {
      toast({ title: 'Points cost must be ≥ 0', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      programId: form.programId || undefined,
      imageFileId: form.imageFileId || undefined,
      pointsCost: form.pointsCost,
      stock: form.stock.trim() === '' ? undefined : Number(form.stock),
      active: form.active,
    };
    try {
      if (editing) {
        const res = await updateRewardsCatalogItem(editing._id, payload);
        if (!res.success) throw new Error(res.error);
        setItems((prev) =>
          prev.map((i) => (i._id === editing._id ? { ...i, ...payload } : i)),
        );
        toast({ title: 'Reward updated' });
      } else {
        const res = await createRewardsCatalogItem(payload);
        if (!res.success) throw new Error(res.error);
        const id = res.data?.id ?? '';
        setItems((prev) => [
          {
            _id: id,
            ...payload,
            active: payload.active,
            pointsCost: payload.pointsCost,
          } as RewardsCatalogItemDoc,
          ...prev,
        ]);
        toast({ title: 'Reward created' });
      }
      setDialogOpen(false);
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [editing, form, toast]);

  const handleDelete = React.useCallback(
    async (id: string) => {
      if (!confirm('Delete this reward?')) return;
      const res = await deleteRewardsCatalogItem(id);
      if (res.success) {
        setItems((prev) => prev.filter((i) => i._id !== id));
        toast({ title: 'Reward deleted' });
      } else {
        toast({
          title: 'Delete failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  const programNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    programs.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [programs]);

  return (
    <div className="zoruui flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zoru-ink">Catalog</h2>
          <p className="text-sm text-zoru-ink-muted">
            Rewards customers can redeem with their points. Images come from
            SabFiles — no free-text URLs.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> New reward
        </Button>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line">
                <ZoruTableHead>Reward</ZoruTableHead>
                <ZoruTableHead>Program</ZoruTableHead>
                <ZoruTableHead>Points</ZoruTableHead>
                <ZoruTableHead>Stock</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {items.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell colSpan={6} className="p-0">
                    <EmptyState
                      title="No rewards yet"
                      description="Create your first catalog item to let customers redeem points."
                    />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                items.map((item) => (
                  <ZoruTableRow key={item._id} className="border-zoru-line">
                    <ZoruTableCell className="text-zoru-ink">
                      <div className="flex flex-col">
                        <span className="font-medium">{item.name}</span>
                        {item.description ? (
                          <span className="text-[12px] text-zoru-ink-muted">
                            {item.description}
                          </span>
                        ) : null}
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">
                      {item.programId
                        ? programNameById.get(item.programId) ?? '—'
                        : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">
                      {item.pointsCost.toLocaleString()}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">
                      {item.stock == null ? '∞' : item.stock.toLocaleString()}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge variant={item.active ? 'success' : 'ghost'}>
                        {item.active ? 'active' : 'inactive'}
                      </Badge>
                    </ZoruTableCell>
                    <ZoruTableCell className="space-x-1 text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item._id)}
                      >
                        <Trash2 className="h-4 w-4 text-zoru-ink" />
                      </Button>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>{editing ? 'Edit reward' : 'New reward'}</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reward-name">Name</Label>
              <Input
                id="reward-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reward-description">Description</Label>
              <Textarea
                id="reward-description"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Program</Label>
                <Select
                  value={form.programId}
                  onValueChange={(v) => setForm((f) => ({ ...f, programId: v }))}
                >
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="No program" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {programs.map((p) => (
                      <ZoruSelectItem key={p.id} value={p.id}>
                        {p.name}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reward-points">Points cost</Label>
                <Input
                  id="reward-points"
                  type="number"
                  min={0}
                  value={form.pointsCost}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, pointsCost: Number(e.target.value) }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reward-stock">Stock (blank = unlimited)</Label>
                <Input
                  id="reward-stock"
                  type="number"
                  min={0}
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reward-active">Active</Label>
                <div className="flex h-9 items-center">
                  <Switch
                    id="reward-active"
                    checked={form.active}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, active: !!v }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Image</Label>
              <div className="flex items-center gap-3">
                {form.imagePreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.imagePreviewUrl}
                    alt="Reward preview"
                    className="h-12 w-12 rounded-md border border-zoru-line object-cover"
                  />
                ) : form.imageFileId ? (
                  <div className="flex h-12 w-12 items-center justify-center rounded-md border border-zoru-line text-[10px] text-zoru-ink-muted">
                    Set
                  </div>
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-zoru-line text-[10px] text-zoru-ink-muted">
                    None
                  </div>
                )}
                <SabFilePickerButton
                  accept="image"
                  onPick={(pick) =>
                    setForm((f) => ({
                      ...f,
                      imageFileId: pick.id ?? f.imageFileId,
                      imagePreviewUrl: pick.url ?? '',
                    }))
                  }
                >
                  {form.imageFileId ? 'Change image' : 'Choose image'}
                </SabFilePickerButton>
                {form.imageFileId ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setForm((f) => ({ ...f, imageFileId: '', imagePreviewUrl: '' }))
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create reward'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}

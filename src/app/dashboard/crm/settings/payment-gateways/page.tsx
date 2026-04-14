'use client';

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  useActionState,
} from 'react';
import {
  KeyRound,
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  Eye,
  EyeOff,
  Power,
} from 'lucide-react';

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  getGatewayCredentials,
  saveGatewayCredential,
  deleteGatewayCredential,
  toggleGateway,
} from '@/app/actions/worksuite/payments.actions';

const GATEWAY_PROVIDERS = [
  'razorpay',
  'stripe',
  'paypal',
  'payfast',
  'paytm',
  'mollie',
  'authorize_net',
  'square',
];

const COLORS: Record<string, string> = {
  razorpay: 'bg-clay-blue-soft text-clay-blue',
  stripe: 'bg-clay-rose-soft text-clay-rose-ink',
  paypal: 'bg-clay-amber-soft text-clay-amber',
  payfast: 'bg-clay-green-soft text-clay-green',
  paytm: 'bg-clay-blue-soft text-clay-blue',
  mollie: 'bg-clay-red-soft text-clay-red',
  authorize_net: 'bg-clay-rose-soft text-clay-rose-ink',
  square: 'bg-clay-obsidian text-white',
};

function SecretInput({
  id,
  name,
  defaultValue,
}: {
  id: string;
  name: string;
  defaultValue?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        defaultValue={defaultValue || ''}
        type={show ? 'text' : 'password'}
        className="h-10 rounded-clay-md border-clay-border bg-clay-surface pr-10 text-[13px]"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-clay-ink-muted hover:text-clay-ink"
        aria-label={show ? 'Hide' : 'Show'}
      >
        {show ? (
          <EyeOff className="h-4 w-4" strokeWidth={1.75} />
        ) : (
          <Eye className="h-4 w-4" strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}

export default function PaymentGatewaysPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [isLoading, startLoad] = useTransition();
  const [isPending, startPending] = useTransition();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const [state, formAction] = useActionState(saveGatewayCredential, {});

  const load = useCallback(() => {
    startLoad(async () => {
      const data = await getGatewayCredentials();
      setRows((data || []) as any[]);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (state.message) {
      toast({ title: state.message });
      setOpen(false);
      setEditing(null);
      load();
    } else if (state.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onToggle = (id: string) => {
    startPending(async () => {
      const r = await toggleGateway(id);
      if (r.message) toast({ title: r.message });
      if (r.error)
        toast({
          title: 'Error',
          description: r.error,
          variant: 'destructive',
        });
      load();
    });
  };

  const onDelete = () => {
    if (!confirmDelete) return;
    startPending(async () => {
      const r = await deleteGatewayCredential(confirmDelete._id);
      if (r.success) toast({ title: 'Gateway deleted.' });
      else
        toast({
          title: 'Error',
          description: r.error,
          variant: 'destructive',
        });
      setConfirmDelete(null);
      load();
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Payment Gateways"
        subtitle="Configure API credentials for each supported gateway."
        icon={KeyRound}
        actions={
          <ClayButton
            variant="obsidian"
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Add Gateway
          </ClayButton>
        }
      />

      <ClayCard>
        {isLoading && rows.length === 0 ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="h-5 w-5 animate-spin text-clay-ink-muted" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-clay-ink-muted">
            No gateway credentials configured yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-clay-md border border-clay-border">
            <Table>
              <TableHeader>
                <TableRow className="border-clay-border hover:bg-transparent">
                  <TableHead className="text-clay-ink-muted">Gateway</TableHead>
                  <TableHead className="text-clay-ink-muted">Mode</TableHead>
                  <TableHead className="text-clay-ink-muted">
                    API Key
                  </TableHead>
                  <TableHead className="text-clay-ink-muted">Active</TableHead>
                  <TableHead className="text-right text-clay-ink-muted">
                    &nbsp;
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const letter = (r.gateway || '?')
                    .charAt(0)
                    .toUpperCase();
                  return (
                    <TableRow key={r._id} className="border-clay-border">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-clay-md text-[12px] font-semibold ${
                              COLORS[r.gateway] || 'bg-clay-surface-2 text-clay-ink'
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="font-medium text-clay-ink">
                            {r.gateway}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <ClayBadge tone={r.mode === 'live' ? 'green' : 'amber'}>
                          {r.mode}
                        </ClayBadge>
                      </TableCell>
                      <TableCell className="font-mono text-[12px] text-clay-ink">
                        {r.api_key
                          ? `${String(r.api_key).slice(0, 6)}…`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <ClayBadge tone={r.is_active ? 'green' : 'neutral'} dot>
                          {r.is_active ? 'active' : 'inactive'}
                        </ClayBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={r.is_active ? 'Deactivate' : 'Activate'}
                          disabled={isPending}
                          onClick={() => onToggle(r._id)}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit"
                          onClick={() => {
                            setEditing(r);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          onClick={() => setConfirmDelete(r)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </ClayCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Gateway' : 'Add Gateway'}
            </DialogTitle>
          </DialogHeader>
          <form action={formAction} className="grid gap-3">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}

            <div>
              <Label htmlFor="gateway">Gateway</Label>
              <Select
                name="gateway"
                defaultValue={editing?.gateway || 'razorpay'}
              >
                <SelectTrigger
                  id="gateway"
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GATEWAY_PROVIDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="mode">Mode</Label>
              <Select
                name="mode"
                defaultValue={editing?.mode || 'test'}
              >
                <SelectTrigger
                  id="mode"
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">test</SelectItem>
                  <SelectItem value="live">live</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                name="api_key"
                defaultValue={editing?.api_key || ''}
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="api_secret">API Secret</Label>
              <SecretInput
                id="api_secret"
                name="api_secret"
                defaultValue={editing?.api_secret}
              />
            </div>
            <div>
              <Label htmlFor="webhook_secret">Webhook Secret</Label>
              <SecretInput
                id="webhook_secret"
                name="webhook_secret"
                defaultValue={editing?.webhook_secret}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-[12.5px] text-clay-ink">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={!!editing?.is_active}
                className="h-4 w-4 accent-clay-rose"
              />
              Active
            </label>
            <label className="inline-flex items-center gap-2 text-[12.5px] text-clay-ink">
              <input
                type="checkbox"
                name="show_on_public"
                defaultChecked={!!editing?.show_on_public}
                className="h-4 w-4 accent-clay-rose"
              />
              Show on public invoice/proposal pay pages
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete gateway?</AlertDialogTitle>
            <AlertDialogDescription>
              Credentials for <strong>{confirmDelete?.gateway}</strong> will be
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} disabled={isPending}>
              {isPending && (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  StatCard,
  Switch,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  useActionState,
} from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FlaskConical,
  LoaderCircle,
  Pencil,
  Plus,
  Power,
  Trash2,
  Wifi,
} from 'lucide-react';

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getGatewayCredentials,
  saveGatewayCredential,
  deleteGatewayCredential,
  toggleGateway,
} from '@/app/actions/worksuite/payments.actions';

interface GatewayRow {
  _id: string;
  gateway: string;
  mode: 'live' | 'test';
  api_key?: string;
  api_secret?: string;
  webhook_secret?: string;
  is_active: boolean;
  show_on_public: boolean;
}

const COLORS: Record<string, string> = {
  razorpay: 'bg-zoru-info/10 text-zoru-info-ink',
  stripe: 'bg-zoru-surface-2 text-zoru-ink',
  paypal: 'bg-zoru-warning/15 text-zoru-warning-ink',
  payfast: 'bg-zoru-success/10 text-zoru-success-ink',
  paytm: 'bg-zoru-info/10 text-zoru-info-ink',
  mollie: 'bg-zoru-danger/10 text-zoru-danger-ink',
  authorize_net: 'bg-zoru-surface-2 text-zoru-ink',
  square: 'bg-zoru-ink text-white',
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
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-zoru-ink-muted hover:text-zoru-ink"
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

function ActiveSwitch({
  initialChecked,
  name,
}: {
  initialChecked: boolean;
  name: string;
}) {
  const [checked, setChecked] = useState(initialChecked);
  return (
    <>
      <Switch
        id={name}
        checked={checked}
        onCheckedChange={setChecked}
      />
      <input type="hidden" name={name} value={checked ? 'on' : ''} />
    </>
  );
}

export default function PaymentGatewaysPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<GatewayRow[]>([]);
  const [isLoading, startLoad] = useTransition();
  const [isPending, startPending] = useTransition();
  const [editing, setEditing] = useState<GatewayRow | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<GatewayRow | null>(null);

  const [state, formAction] = useActionState(saveGatewayCredential, {});

  const load = useCallback(() => {
    startLoad(async () => {
      const data = await getGatewayCredentials();
      setRows((data || []) as GatewayRow[]);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if ((state as { message?: string }).message) {
      toast({ title: (state as { message: string }).message });
      setOpen(false);
      setEditing(null);
      load();
    } else if ((state as { error?: string }).error) {
      toast({
        title: 'Error',
        description: (state as { error: string }).error,
        variant: 'destructive',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onToggle = (id: string) => {
    startPending(async () => {
      const r = await toggleGateway(id);
      if ((r as { message?: string }).message)
        toast({ title: (r as { message: string }).message });
      if ((r as { error?: string }).error)
        toast({
          title: 'Error',
          description: (r as { error: string }).error,
          variant: 'destructive',
        });
      load();
    });
  };

  const onDelete = () => {
    if (!confirmDelete) return;
    startPending(async () => {
      const r = await deleteGatewayCredential(confirmDelete._id);
      if ((r as { success?: boolean }).success) toast({ title: 'Gateway deleted.' });
      else
        toast({
          title: 'Error',
          description: (r as { error?: string }).error,
          variant: 'destructive',
        });
      setConfirmDelete(null);
      load();
    });
  };

  // KPI computed values
  const totalConfigured = rows.length;
  const totalActive = rows.filter((r) => r.is_active).length;
  const totalTestMode = rows.filter((r) => r.mode === 'test').length;

  return (
    <EntityListShell
      title="Payment Gateways"
      subtitle="Configure API credentials for each supported gateway."
      primaryAction={
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Add Gateway
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Configured"
          value={totalConfigured}
          icon={<Wifi className="h-4 w-4" />}
        />
        <StatCard
          label="Active"
          value={totalActive}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Test mode"
          value={totalTestMode}
          icon={<FlaskConical className="h-4 w-4" />}
        />
      </div>

      <Card className="p-6">
        {isLoading && rows.length === 0 ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="h-5 w-5 animate-spin text-zoru-ink-muted" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-zoru-ink-muted">
            No gateway credentials configured yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow className="hover:bg-transparent">
                  <ZoruTableHead className="text-zoru-ink-muted">Gateway</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Mode</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">API Key</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Active</ZoruTableHead>
                  <ZoruTableHead className="text-right text-zoru-ink-muted">
                    &nbsp;
                  </ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {rows.map((r) => {
                  const letter = (r.gateway || '?').charAt(0).toUpperCase();
                  return (
                    <ZoruTableRow key={r._id}>
                      <ZoruTableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-lg text-[12px] ${
                              COLORS[r.gateway] || 'bg-zoru-surface-2 text-zoru-ink'
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="text-zoru-ink">{r.gateway}</span>
                        </div>
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <Badge variant={r.mode === 'live' ? 'success' : 'warning'}>
                          {r.mode}
                        </Badge>
                      </ZoruTableCell>
                      <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                        {r.api_key ? `${String(r.api_key).slice(0, 6)}…` : '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <Badge variant={r.is_active ? 'success' : 'ghost'}>
                          {r.is_active ? 'active' : 'inactive'}
                        </Badge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
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
                          <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                        </Button>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })}
              </ZoruTableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editing ? 'Edit Gateway' : 'Add Gateway'}
            </ZoruDialogTitle>
          </ZoruDialogHeader>
          <form action={formAction} className="grid gap-3">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}

            <div>
              <Label htmlFor="gateway">Gateway</Label>
              <EnumFormField
                name="gateway"
                enumName="paymentGatewayType"
                initialId={editing?.gateway || 'razorpay'}
              />
            </div>
            <div>
              <Label htmlFor="mode">Mode</Label>
              <EnumFormField
                name="mode"
                enumName="gatewayMode"
                initialId={editing?.mode || 'test'}
                placeholder="Mode"
              />
            </div>
            <div>
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                name="api_key"
                defaultValue={editing?.api_key || ''}
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
            <div className="flex items-center gap-3 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-3">
              <ActiveSwitch
                name="is_active"
                initialChecked={editing?.is_active ?? false}
              />
              <Label htmlFor="is_active" className="text-[13px] text-zoru-ink">
                Active
              </Label>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-3">
              <ActiveSwitch
                name="show_on_public"
                initialChecked={editing?.show_on_public ?? false}
              />
              <Label
                htmlFor="show_on_public"
                className="text-[13px] text-zoru-ink"
              >
                Show on public invoice/proposal pay pages
              </Label>
            </div>
            <ZoruDialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </Dialog>

      <ZoruAlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete gateway?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Credentials for <strong>{confirmDelete?.gateway}</strong> will be
              removed.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={onDelete} disabled={isPending}>
              {isPending && (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </EntityListShell>
  );
}

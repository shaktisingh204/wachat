'use client';

import {
  Alert,
  Skeleton,
  EmptyState,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Field,
  Input,
  Button,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { useFormStatus } from 'react-dom';
import { formatUTC, fmtINR } from '@/lib/utils';
import { Key, Save, FolderX, LinkIcon, Receipt } from 'lucide-react';

import {
  getRazorpayLogs,
  getRazorpaySettings,
  saveRazorpaySettings,
} from '@/app/actions/integrations.actions';
import { useProject } from '@/context/project-context';
import type { RazorpayLogItem } from '@/lib/rust-client/wachat-razorpay';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

type SaveState = { message?: string; error?: string };
const initialSaveState: SaveState = {};

function SaveSettingsButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending} iconLeft={pending ? undefined : Save}>
      Save Razorpay Keys
    </Button>
  );
}

/**
 * Razorpay credentials form. Reads the (masked) settings from the Rust crate
 * via `getRazorpaySettings` — the secret comes back as bullets when stored, so
 * the field is left BLANK and must be re-entered to change it; we never persist
 * the masked placeholder back. Calls `onConfigured` so the page can reveal the
 * logs once both creds are present.
 */
function RazorpaySettingsForm({
  projectId,
  onConfigured,
}: {
  projectId: string;
  onConfigured: (configured: boolean) => void;
}) {
  const { toast } = useToast();
  const [state, formAction] = useActionState(saveRazorpaySettings, initialSaveState);

  const [keyId, setKeyId] = useState('');
  const [hasStoredSecret, setHasStoredSecret] = useState(false);
  const [isLoading, startLoading] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    startLoading(async () => {
      try {
        const data = await getRazorpaySettings(projectId);
        if ('error' in data) {
          setLoadError(data.error);
          return;
        }
        setLoadError(null);
        setKeyId(data.keyId ?? '');
        // The secret arrives masked (`••••••••`) when configured; never put it
        // in the input — a blank field forces an explicit re-entry to change it.
        setHasStoredSecret(Boolean(data.keySecret));
        onConfigured(data.configured);
      } catch (e: any) {
        setLoadError(e?.message || 'Failed to load Razorpay settings.');
      }
    });
    // onConfigured is stable enough for this one-shot load; projectId drives it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success', description: state.message, tone: 'success' });
      // A successful save means a fresh secret was stored.
      setHasStoredSecret(true);
      onConfigured(true);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, tone: 'danger' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (isLoading) {
    return <Skeleton className="h-72 w-full" />;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Razorpay Integration
          </CardTitle>
          <CardDescription>Enter your Razorpay API keys to enable payments.</CardDescription>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          {loadError && (
            <Alert tone="danger" title="Could not load saved settings">
              {loadError}
            </Alert>
          )}
          <Field label="Key ID" required>
            <Input
              name="keyId"
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              placeholder="rzp_test_..."
              autoComplete="off"
              required
            />
          </Field>
          <Field
            label="Key Secret"
            required
            help={
              hasStoredSecret
                ? 'A secret is already saved (hidden for security). Re-enter it to change it.'
                : undefined
            }
          >
            <Input
              name="keySecret"
              type="password"
              placeholder={hasStoredSecret ? 'Enter a new secret to replace the stored one' : 'Your Key Secret'}
              autoComplete="new-password"
              required
            />
          </Field>
        </CardBody>
        <CardFooter>
          <SaveSettingsButton />
        </CardFooter>
      </Card>
    </form>
  );
}

function RazorpayLogs({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<{ paymentLinks: RazorpayLogItem[]; transactions: RazorpayLogItem[] } | null>(null);
  const [isLoading, startLoadingTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startLoadingTransition(async () => {
      try {
        const data = await getRazorpayLogs(projectId);
        if ('error' in data) {
          setError(data.error);
        } else {
          setLogs({
            paymentLinks: data.paymentLinks || [],
            transactions: data.transactions || [],
          });
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load logs');
      }
    });
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="mt-8 flex flex-col gap-8">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8">
        <Alert tone="danger" title="Error loading logs">
          {error}
        </Alert>
      </div>
    );
  }

  if (!logs) return null;

  return (
    <div className="mt-8 flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">Recent Transactions</h3>
        {logs.transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="You haven't processed any transactions through WhatsApp yet."
            icon={Receipt}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>ID</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th>Method</Th>
                <Th>Date</Th>
              </Tr>
            </THead>
            <TBody>
              {logs.transactions.map((txn) => (
                <Tr key={txn.id}>
                  <Td className="font-medium">{txn.id}</Td>
                  <Td>{fmtINR((txn.amount ?? 0) / 100)}</Td>
                  <Td>
                    <Badge tone={txn.status === 'captured' ? 'success' : 'neutral'}>
                      {txn.status}
                    </Badge>
                  </Td>
                  <Td>{txn.method || 'N/A'}</Td>
                  <Td>{txn.created_at ? formatUTC(txn.created_at * 1000, true) : 'N/A'}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">Payment Links</h3>
        {logs.paymentLinks.length === 0 ? (
          <EmptyState
            title="No payment links"
            description="You haven't generated any payment links yet."
            icon={LinkIcon}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>ID</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th>Description</Th>
                <Th>Date</Th>
              </Tr>
            </THead>
            <TBody>
              {logs.paymentLinks.map((link) => (
                <Tr key={link.id}>
                  <Td className="font-medium">{link.id}</Td>
                  <Td>{fmtINR((link.amount ?? 0) / 100)}</Td>
                  <Td>
                    <Badge tone={link.status === 'paid' ? 'success' : 'neutral'}>
                      {link.status}
                    </Badge>
                  </Td>
                  <Td>{link.description || 'N/A'}</Td>
                  <Td>{link.created_at ? formatUTC(link.created_at * 1000, true) : 'N/A'}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}

export default function RazorpayIntegrationPage() {
  const { activeProject } = useProject();
  const [configured, setConfigured] = useState(false);

  const projectId = activeProject?._id?.toString() ?? null;

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Integrations', href: '/wachat/integrations' },
        { label: 'Razorpay' },
      ]}
      title="Razorpay"
      description="Connect Razorpay to collect payments and share payment links over WhatsApp."
      width="wide"
    >
      {!projectId ? (
        <div className="max-w-2xl">
          <EmptyState
            title="No project selected"
            description="Please select a project from the main dashboard to view and manage Razorpay settings."
            icon={FolderX}
          />
        </div>
      ) : (
        <div className={cx('max-w-4xl', 'flex', 'flex-col', 'gap-6')}>
          <div className="max-w-2xl">
            <RazorpaySettingsForm
              key={projectId}
              projectId={projectId}
              onConfigured={setConfigured}
            />
          </div>

          {configured && <RazorpayLogs key={`${projectId}-logs`} projectId={projectId} />}
        </div>
      )}
    </WachatPage>
  );
}

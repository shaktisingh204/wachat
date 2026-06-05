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
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import type { WithId } from 'mongodb';
import { formatUTC, fmtINR } from '@/lib/utils';

import { getProjectById } from '@/app/actions/project.actions';
import { getRazorpayLogs } from '@/app/actions/integrations.actions';
import type { Project } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { RazorpaySettingsForm } from '@/components/zoruui-domain/razorpay-settings-form';
import { FolderX, LinkIcon, Receipt } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

function RazorpayLogs({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<{ paymentLinks: any[], transactions: any[] } | null>(null);
  const [isLoading, startLoadingTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startLoadingTransition(async () => {
      try {
        const data = await getRazorpayLogs(projectId);
        if (data.error) {
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
        <h3 className="text-lg font-semibold">
          Recent Transactions
        </h3>
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
                  <Td>{fmtINR(txn.amount / 100)}</Td>
                  <Td>
                    <Badge tone={txn.status === 'captured' ? 'success' : 'neutral'}>
                      {txn.status}
                    </Badge>
                  </Td>
                  <Td>{txn.method || 'N/A'}</Td>
                  <Td>
                    {formatUTC(txn.created_at * 1000, true)}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">
          Payment Links
        </h3>
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
                  <Td>{fmtINR(link.amount / 100)}</Td>
                  <Td>
                    <Badge tone={link.status === 'paid' ? 'success' : 'neutral'}>
                      {link.status}
                    </Badge>
                  </Td>
                  <Td>{link.description || 'N/A'}</Td>
                  <Td>
                    {formatUTC(link.created_at * 1000, true)}
                  </Td>
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
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [isLoading, startLoadingTransition] = useTransition();

  useEffect(() => {
    const id = activeProject?._id?.toString();
    if (id) {
      startLoadingTransition(async () => {
        const data = await getProjectById(id);
        setProject(data);
      });
    }
  }, [activeProject]);

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
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !project ? (
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
            <RazorpaySettingsForm project={project} />
          </div>

          {project.razorpaySettings?.keyId && project.razorpaySettings?.keySecret && (
            <RazorpayLogs projectId={project._id.toString()} />
          )}
        </div>
      )}
    </WachatPage>
  );
}

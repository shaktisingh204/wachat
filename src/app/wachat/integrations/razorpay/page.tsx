'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Skeleton,
  EmptyState,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
} from '@/components/zoruui';
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
import { RazorpaySettingsForm } from '@/components/wabasimplify/razorpay-settings-form';
import { FolderX, LinkIcon, Receipt, AlertCircle } from 'lucide-react';

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
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Error loading logs</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      </div>
    );
  }

  if (!logs) return null;

  return (
    <div className="mt-8 flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-zoru-ink">Recent Transactions</h3>
        {logs.transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="You haven't processed any transactions through WhatsApp yet."
            icon={<Receipt className="h-6 w-6" />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.transactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="font-medium">{txn.id}</TableCell>
                  <TableCell>{fmtINR(txn.amount / 100)}</TableCell>
                  <TableCell>
                    <Badge variant={txn.status === 'captured' ? 'default' : 'secondary'}>
                      {txn.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{txn.method || 'N/A'}</TableCell>
                  <TableCell>
                    {formatUTC(txn.created_at * 1000, true)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-zoru-ink">Payment Links</h3>
        {logs.paymentLinks.length === 0 ? (
          <EmptyState
            title="No payment links"
            description="You haven't generated any payment links yet."
            icon={<LinkIcon className="h-6 w-6" />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.paymentLinks.map((link) => (
                <TableRow key={link.id}>
                  <TableCell className="font-medium">{link.id}</TableCell>
                  <TableCell>{fmtINR(link.amount / 100)}</TableCell>
                  <TableCell>
                    <Badge variant={link.status === 'paid' ? 'default' : 'secondary'}>
                      {link.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{link.description || 'N/A'}</TableCell>
                  <TableCell>
                    {formatUTC(link.created_at * 1000, true)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
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
    <div className="flex h-full w-full flex-col">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat/integrations">Integrations</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Razorpay</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="mt-5 flex-1 pb-10">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !project ? (
          <div className="max-w-2xl">
            <EmptyState
              title="No project selected"
              description="Please select a project from the main dashboard to view and manage Razorpay settings."
              icon={<FolderX className="h-6 w-6" />}
            />
          </div>
        ) : (
          <div className="max-w-4xl flex flex-col gap-6">
            <div className="max-w-2xl">
              <RazorpaySettingsForm project={project} />
            </div>
            
            {project.razorpaySettings?.keyId && project.razorpaySettings?.keySecret && (
              <RazorpayLogs projectId={project._id.toString()} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

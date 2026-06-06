'use client';

import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, ZoruFileUploadCard, PageActions, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle, StatCard, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
import { useCallback, useState } from 'react';
import {
  CheckCircle2,
  FileCode2,
  FileJson,
  Plus,
  RefreshCw,
  ServerCog,
  Upload,
  Workflow,
  XCircle,
} from 'lucide-react';

type FlowNodePreview = {
  id: string;
  type: string;
  label: string;
  status: 'valid' | 'invalid' | 'warning';
  message?: string;
};

type FlowPreview = {
  name: string;
  version: string;
  nodeCount: number;
  edgeCount: number;
  nodes: FlowNodePreview[];
};

export default function SabFlowImportPage() {
  const { toast } = useToast();
  const [fileSelected, setFileSelected] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<FlowPreview | null>(null);

  const mockValidation = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setPreviewData({
        name: 'Customer Onboarding Sequence',
        version: '1.2.0',
        nodeCount: 14,
        edgeCount: 18,
        nodes: [
          {
            id: 'node_start',
            type: 'trigger',
            label: 'Webhook Received',
            status: 'valid',
            message: 'All properties present.',
          },
          {
            id: 'node_filter_1',
            type: 'filter',
            label: 'Check Subscription Status',
            status: 'valid',
            message: 'Condition logic is sound.',
          },
          {
            id: 'node_action_email',
            type: 'action',
            label: 'Send Welcome Email',
            status: 'warning',
            message: 'Template ID might be deprecated soon.',
          },
          {
            id: 'node_action_db',
            type: 'action',
            label: 'Update CRM Record',
            status: 'invalid',
            message: 'Missing required property "recordId".',
          },
          {
            id: 'node_end',
            type: 'terminator',
            label: 'End Flow',
            status: 'valid',
            message: 'Clean termination.',
          },
        ],
      });
      setIsProcessing(false);
      setFileSelected(true);
      toast({
        title: 'Validation Complete',
        description: 'Review the flow preview before importing.',
      });
    }, 1500);
  };

  const handleFiles = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (file) {
        toast({
          title: 'File Uploaded',
          description: `Reading ${file.name}...`,
        });
        mockValidation();
      }
    },
    [toast]
  );

  const validNodesCount =
    previewData?.nodes.filter((n) => n.status === 'valid').length || 0;
  const warningNodesCount =
    previewData?.nodes.filter((n) => n.status === 'warning').length || 0;
  const invalidNodesCount =
    previewData?.nodes.filter((n) => n.status === 'invalid').length || 0;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/sabflow">
              SabFlow
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Import Flow</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <PageHeading>
          <PageEyebrow>SabFlow Engine</PageEyebrow>
          <PageTitle>Import Automation Flow</PageTitle>
          <PageDescription>
            Upload a JSON payload of your SabFlow configuration to safely
            validate, preview, and import it into your workspace.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" size="sm" disabled={!previewData}>
            <RefreshCw className="mr-2 h-4 w-4" /> Re-validate
          </Button>
          <Button
            size="sm"
            disabled={!previewData || invalidNodesCount > 0}
            onClick={() => {
              toast({
                title: 'Flow Imported',
                description: 'The flow has been successfully saved to your workspace.',
              });
            }}
          >
            <ServerCog className="mr-2 h-4 w-4" /> Import Configuration
          </Button>
        </PageActions>
      </PageHeader>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-0 border-[var(--st-border)]/50 shadow-sm bg-gradient-to-br from-[var(--st-bg)] to-[var(--st-bg)]">
            <CardHeader className="pb-3 border-b border-[var(--st-border)]/30">
              <CardTitle className="flex items-center gap-2 text-base text-[var(--st-text)]">
                <FileJson className="h-5 w-5 text-[var(--st-accent)]" />
                Upload Configuration
              </CardTitle>
            </CardHeader>
            <CardBody className="p-4 pt-5">
              <ZoruFileUploadCard
                accept=".json,application/json"
                multiple={false}
                onFilesSelected={handleFiles}
                hint="Drop a .json flow export file here"
                disabled={isProcessing}
              />
              <div className="mt-4 flex items-start gap-3 rounded-md bg-[var(--st-accent)]/5 p-3 text-sm text-[var(--st-text-secondary)]">
                <FileCode2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--st-accent)]" />
                <p>
                  We recommend validating large flows before finalizing the import
                  to prevent logical loops and missing connections.
                </p>
              </div>
            </CardBody>
          </Card>

          {previewData && (
            <Card className="p-0 border-[var(--st-border)]/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-[var(--st-border)]/30">
                <CardTitle className="text-base">Overview</CardTitle>
              </CardHeader>
              <CardBody className="p-4">
                <dl className="space-y-4 text-sm">
                  <div>
                    <dt className="text-[var(--st-text-secondary)]">Flow Name</dt>
                    <dd className="font-medium text-[var(--st-text)] mt-1">
                      {previewData.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--st-text-secondary)]">Schema Version</dt>
                    <dd className="font-medium text-[var(--st-text)] mt-1">
                      <Badge variant="secondary" className="font-mono">
                        v{previewData.version}
                      </Badge>
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[var(--st-border)]/30">
                    <div>
                      <dt className="text-[var(--st-text-secondary)]">Total Nodes</dt>
                      <dd className="text-xl font-semibold text-[var(--st-text)] mt-1">
                        {previewData.nodeCount}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--st-text-secondary)]">Total Edges</dt>
                      <dd className="text-xl font-semibold text-[var(--st-text)] mt-1">
                        {previewData.edgeCount}
                      </dd>
                    </div>
                  </div>
                </dl>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          {!fileSelected && !isProcessing ? (
            <Card className="h-full min-h-[400px] flex items-center justify-center border-dashed border-[var(--st-border)]/50 bg-[var(--st-bg)]/50">
              <EmptyState
                compact
                icon={<Workflow className="h-8 w-8 text-[var(--st-text-secondary)]" />}
                title="Awaiting Configuration"
                description="Upload a SabFlow JSON export to generate a detailed validation preview."
              />
            </Card>
          ) : isProcessing ? (
            <Card className="h-full min-h-[400px] flex items-center justify-center border-[var(--st-border)]/50 shadow-sm">
              <div className="flex flex-col items-center text-center space-y-4">
                <RefreshCw className="h-8 w-8 animate-spin text-[var(--st-accent)]" />
                <div>
                  <h3 className="text-lg font-medium text-[var(--st-text)]">
                    Parsing & Validating...
                  </h3>
                  <p className="text-sm text-[var(--st-text-secondary)] mt-1 max-w-[250px]">
                    Checking node references, validating required properties, and
                    building the structural map.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                  label="Valid Nodes"
                  value={validNodesCount.toString()}
                  period="Passed checks"
                  icon={<CheckCircle2 className="text-[var(--st-status-ok)]" />}
                />
                <StatCard
                  label="Warnings"
                  value={warningNodesCount.toString()}
                  period="Review suggested"
                  icon={<FileJson className="text-[var(--st-warn)]" />}
                />
                <StatCard
                  label="Invalid Nodes"
                  value={invalidNodesCount.toString()}
                  period="Fix required to import"
                  icon={<XCircle className="text-[var(--st-danger)]" />}
                />
              </div>

              <Card className="p-0 shadow-sm border-[var(--st-border)]/50">
                <CardHeader className="border-b border-[var(--st-border)]/30 bg-[var(--st-bg)]/50">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span>Validation Preview Table</span>
                    {invalidNodesCount > 0 && (
                      <Badge variant="destructive">
                        {invalidNodesCount} Errors Found
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <THead>
                        <Tr className="bg-[var(--st-bg)]/30">
                          <Th className="w-[120px]">
                            Node ID
                          </Th>
                          <Th className="w-[100px]">
                            Type
                          </Th>
                          <Th>Label</Th>
                          <Th className="w-[100px]">
                            Status
                          </Th>
                          <Th className="w-[250px]">
                            Message
                          </Th>
                        </Tr>
                      </THead>
                      <TBody>
                        {previewData?.nodes.map((node) => (
                          <Tr key={node.id}>
                            <Td className="font-mono text-xs text-[var(--st-text-secondary)]">
                              {node.id}
                            </Td>
                            <Td>
                              <Badge
                                variant="outline"
                                className="uppercase text-[10px]"
                              >
                                {node.type}
                              </Badge>
                            </Td>
                            <Td className="font-medium">
                              {node.label}
                            </Td>
                            <Td>
                              {node.status === 'valid' && (
                                <Badge
                                  variant="secondary"
                                  className="bg-[var(--st-status-ok)]/10 text-[var(--st-status-ok)] hover:bg-[var(--st-status-ok)]/20 border-[var(--st-status-ok)]/20"
                                >
                                  Valid
                                </Badge>
                              )}
                              {node.status === 'warning' && (
                                <Badge
                                  variant="secondary"
                                  className="bg-[var(--st-warn)]/10 text-[var(--st-warn)] hover:bg-[var(--st-warn)]/20 border-[var(--st-warn)]/20"
                                >
                                  Warning
                                </Badge>
                              )}
                              {node.status === 'invalid' && (
                                <Badge
                                  variant="destructive"
                                  className="bg-[var(--st-danger)]/10 text-[var(--st-danger)] hover:bg-[var(--st-danger)]/20 border-[var(--st-danger)]/20"
                                >
                                  Invalid
                                </Badge>
                              )}
                            </Td>
                            <Td className="text-sm text-[var(--st-text-secondary)]">
                              {node.message}
                            </Td>
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

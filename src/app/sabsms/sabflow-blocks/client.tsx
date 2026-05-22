"use client";

import * as React from "react";
import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsDataTable,
  SabsmsDetailDrawer,
  type SabsmsColumn,
  type SabsmsFacet,
  useSabsmsUrlState,
} from "@/components/sabsms/page-toolkit";
import {
  Badge,
  Button,
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  ZoruFeatureGrid,
  ZoruFeatureCard,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
} from "@/components/zoruui";
import { Sparkles, Copy, Plus, Activity, AlertTriangle, Workflow, Settings, FileCode2 } from "lucide-react";
import { MOCK_BLOCKS, MOCK_TEMPLATES, type SabflowBlock, type SabflowTemplate } from "./mock-data";

export function SabflowBlocksClient({ workspaceId }: { workspaceId: string }) {
  const urlState = useSabsmsUrlState({
    defaultSort: { id: "name", desc: false },
    defaultPageSize: 25,
  });

  const [selectedBlock, setSelectedBlock] = React.useState<SabflowBlock | null>(null);
  const [selectedTemplate, setSelectedTemplate] = React.useState<SabflowTemplate | null>(null);

  // Filter blocks
  const filteredBlocks = React.useMemo(() => {
    let result = MOCK_BLOCKS;
    if (urlState.search) {
      const q = urlState.search.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)
      );
    }
    const catFacet = urlState.facets.find((f) => f.id === "category");
    if (catFacet && catFacet.values.length > 0) {
      result = result.filter((b) => catFacet.values.includes(b.category));
    }
    const typeFacet = urlState.facets.find((f) => f.id === "type");
    if (typeFacet && typeFacet.values.length > 0) {
      result = result.filter((b) => typeFacet.values.includes(b.type));
    }
    return result;
  }, [urlState.search, urlState.facets]);

  const columns: SabsmsColumn<SabflowBlock>[] = [
    {
      id: "name",
      header: "Block",
      render: (b) => (
        <div className="flex flex-col">
          <span className="font-medium">{b.name}</span>
          <span className="text-xs text-slate-500">{b.description}</span>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      render: (b) => (
        <Badge variant="outline" className="capitalize">
          {b.type}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Status",
      render: (b) => (
        <Badge
          variant={b.status === "deprecated" ? "destructive" : b.status === "beta" ? "secondary" : "default"}
          className="uppercase text-[10px]"
        >
          {b.status}
        </Badge>
      ),
    },
    {
      id: "cost",
      header: "Cost",
      render: (b) => (
        <span className="text-sm">
          {b.creditCost === 0 ? "Free" : `${b.creditCost} cr`}
        </span>
      ),
      align: "right",
    },
    {
      id: "usage",
      header: "Usage",
      render: (b) => <span className="text-sm font-mono">{b.usageCount.toLocaleString()}</span>,
      align: "right",
    },
    {
      id: "compatibility",
      header: "Compatible",
      render: (b) => (
        <div className="flex gap-1 text-xs text-slate-500">
          {b.compatibility.wachat && <span title="Wachat">Wa</span>}
          {b.compatibility.sabwa && <span title="SabWa">Sa</span>}
          {b.compatibility.crm && <span title="CRM">Cr</span>}
        </div>
      ),
    },
  ];

  const facets: SabsmsFacet[] = [
    {
      id: "type",
      label: "Type",
      options: [
        { label: "Trigger", value: "trigger" },
        { label: "Action", value: "action" },
      ],
    },
    {
      id: "category",
      label: "Category",
      options: [
        { label: "Messaging", value: "messaging" },
        { label: "Logic", value: "logic" },
        { label: "Compliance", value: "compliance" },
        { label: "Data", value: "data" },
      ],
    },
  ];

  return (
    <SabsmsPageShell
      title="SabFlow Blocks"
      description="Reference for all SabSMS triggers and actions available in the SabFlow visual builder."
      breadcrumbs={[{ label: "Developer", href: "/sabsms/api-docs" }, { label: "SabFlow Blocks" }]}
      helpTitle="What are SabFlow blocks?"
      helpBody="Blocks are the atomic units of SabFlow. Triggers start a flow, and actions perform tasks like sending SMS or checking compliance."
      secondaryActions={[
        {
          label: "AI: Pick blocks for me",
          icon: <Sparkles className="h-4 w-4" />,
          onClick: () => alert("AI assistant opening..."),
        }
      ]}
      toolbar={
        <SabsmsFilterBar
          searchPlaceholder="Search blocks..."
          search={urlState.search}
          onSearchChange={urlState.setSearch}
          facets={facets}
          activeFacets={urlState.facets}
          onFacetChange={urlState.setFacet}
        />
      }
    >
      <div className="space-y-8">
        <SabsmsDataTable
          rows={filteredBlocks}
          columns={columns}
          rowKey={(b) => b.id}
          onRowClick={setSelectedBlock}
          rowActions={[
            {
              label: "Add to SabFlow",
              icon: <Plus className="h-4 w-4" />,
              onSelect: (b) => alert(`Deep-linking to add ${b.name} to flow...`),
            },
            {
              label: "Change Icon (Admin)",
              icon: <Settings className="h-4 w-4" />,
              onSelect: (b) => alert(`Opening icon picker for ${b.id}...`),
            }
          ]}
          page={urlState.page}
          pageSize={urlState.pageSize}
          total={filteredBlocks.length}
          onPageChange={urlState.setPage}
          onPageSizeChange={urlState.setPageSize}
        />

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Suggested Flows</ZoruCardTitle>
            <ZoruCardDescription>
              Ready-made templates combining these blocks for common use cases.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MOCK_TEMPLATES.map(tpl => (
                <div 
                  key={tpl.id} 
                  className="border rounded-md p-4 flex flex-col gap-2 hover:border-slate-400 cursor-pointer transition-colors"
                  onClick={() => setSelectedTemplate(tpl)}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Workflow className="h-4 w-4 text-slate-500" />
                    {tpl.name}
                  </div>
                  <p className="text-sm text-slate-600">{tpl.description}</p>
                </div>
              ))}
            </div>
          </ZoruCardContent>
        </Card>
      </div>

      <SabsmsDetailDrawer
        title={selectedBlock?.name || ""}
        description={`Block ID: ${selectedBlock?.id}`}
        open={!!selectedBlock}
        onOpenChange={(open) => !open && setSelectedBlock(null)}
        actions={[
          <Button key="add" size="sm" onClick={() => alert("Added to flow")}>
            <Plus className="mr-2 h-4 w-4" /> Add to SabFlow
          </Button>
        ]}
      >
        {selectedBlock && (
          <div className="space-y-6">
            {selectedBlock.status === "deprecated" && (
              <div className="bg-rose-50 text-rose-800 p-3 rounded-md text-sm flex items-start gap-2 border border-rose-200">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <div>
                  <strong>Deprecated</strong>
                  <p>This block will be removed in a future update. {selectedBlock.changelog}</p>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <FileCode2 className="h-4 w-4 text-slate-500" /> Schema Viewer
              </h4>
              <pre className="bg-slate-900 text-slate-50 p-3 rounded-md text-xs overflow-auto">
                {selectedBlock.schema}
              </pre>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Workflow className="h-4 w-4 text-slate-500" /> Example Workflow
              </h4>
              <div className="text-sm bg-slate-50 p-3 rounded border border-slate-200">
                {selectedBlock.exampleWorkflow}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4 text-slate-500" /> Dependency Graph
              </h4>
              <div className="text-sm">
                {selectedBlock.dependencies.length > 0 ? (
                  <ul className="list-disc pl-5 text-slate-600">
                    {selectedBlock.dependencies.map(dep => <li key={dep}>{dep}</li>)}
                  </ul>
                ) : (
                  <span className="text-slate-500">No external dependencies.</span>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Embed Snippet</h4>
              <div className="relative">
                <pre className="bg-slate-100 p-3 rounded-md text-xs border border-slate-200 overflow-x-auto">
                  {selectedBlock.copySnippet}
                </pre>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-1 right-1 h-6 w-6" 
                  onClick={() => alert("Snippet copied")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-1">Changelog</h4>
              <p className="text-sm text-slate-600">{selectedBlock.changelog}</p>
            </div>
          </div>
        )}
      </SabsmsDetailDrawer>

      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>{selectedTemplate?.name}</ZoruDialogTitle>
            <ZoruDialogDescription>{selectedTemplate?.description}</ZoruDialogDescription>
          </ZoruDialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm">Installation Guide</h4>
                <p className="text-sm text-slate-600">{selectedTemplate.installGuide}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm">Test Data Generator</h4>
                <pre className="bg-slate-100 p-2 rounded text-xs mt-1 border">
                  {selectedTemplate.testData}
                </pre>
                <Button variant="outline" size="sm" className="mt-2 text-xs">
                  Generate Payload
                </Button>
              </div>
              <div>
                <h4 className="font-medium text-sm">Audit Details</h4>
                <p className="text-sm text-slate-600">{selectedTemplate.auditInfo}</p>
              </div>
            </div>
          )}
        </ZoruDialogContent>
      </Dialog>
    </SabsmsPageShell>
  );
}

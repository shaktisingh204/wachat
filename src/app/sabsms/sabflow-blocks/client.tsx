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
import { Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardBody, FeatureGrid, FeatureCard, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Textarea } from '@/components/sabcrm/20ui/compat';
import { Sparkles, Copy, Plus, Activity, AlertTriangle, Workflow, Settings, FileCode2, Code, Download, Upload } from "lucide-react";
import { MOCK_BLOCKS, MOCK_TEMPLATES, type SabflowBlock, type SabflowTemplate } from "./mock-data";

export function SabflowBlocksClient({ workspaceId }: { workspaceId: string }) {
  const urlState = useSabsmsUrlState({
    defaultSort: { id: "name", desc: false },
    defaultPageSize: 25,
  });

  const [selectedBlock, setSelectedBlock] = React.useState<SabflowBlock | null>(null);
  const [selectedTemplate, setSelectedTemplate] = React.useState<SabflowTemplate | null>(null);

  const [viewMode, setViewMode] = React.useState<"local" | "marketplace">("local");
  const [isFlowBuilderOpen, setIsFlowBuilderOpen] = React.useState(false);
  
  const [flowJson, setFlowJson] = React.useState('{\n  "nodes": [\n    {"id": "Trigger1", "next": ["Action1"]},\n    {"id": "Action1", "next": ["Action2"]},\n    {"id": "Action2", "next": ["Action1"]}\n  ]\n}');
  const [analysis, setAnalysis] = React.useState<{ valid: boolean; message: string; cycles?: string[][] } | null>(null);

  const analyzeFlow = () => {
    try {
      const data = JSON.parse(flowJson);
      if (!data.nodes || !Array.isArray(data.nodes)) {
        throw new Error("Invalid format. Must have a 'nodes' array.");
      }

      // Build graph
      const adjList: Record<string, string[]> = {};
      data.nodes.forEach((n: any) => {
        adjList[n.id] = n.next || [];
      });

      // DFS cycle detection
      const visited = new Set<string>();
      const recStack = new Set<string>();
      const cycles: string[][] = [];
      const path: string[] = [];

      const dfs = (node: string) => {
        visited.add(node);
        recStack.add(node);
        path.push(node);

        const neighbors = adjList[node] || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            dfs(neighbor);
          } else if (recStack.has(neighbor)) {
            const cycleStart = path.indexOf(neighbor);
            if (cycleStart !== -1) {
              cycles.push([...path.slice(cycleStart), neighbor]);
            }
          }
        }

        recStack.delete(node);
        path.pop();
      };

      for (const node of Object.keys(adjList)) {
        if (!visited.has(node)) {
          dfs(node);
        }
      }

      if (cycles.length > 0) {
        setAnalysis({ valid: false, message: "Infinite loop detected! Please fix before saving.", cycles });
      } else {
        setAnalysis({ valid: true, message: "Flow is valid. No infinite loops detected." });
      }
    } catch (e: any) {
      setAnalysis({ valid: false, message: `Parse error: ${e.message}` });
    }
  };

  // Filter blocks
  const filteredBlocks = React.useMemo(() => {
    let result = MOCK_BLOCKS.filter(b => viewMode === "marketplace" ? b.isMarketplace : !b.isMarketplace);
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
          <span className="text-xs text-[var(--st-text)]">{b.description}</span>
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
    ...(viewMode === "marketplace" ? [{
      id: "downloads",
      header: "Downloads",
      render: (b: SabflowBlock) => (
        <span className="text-sm text-[var(--st-text)] flex items-center gap-1">
          <Download className="h-3 w-3" /> {b.downloads || 0}
        </span>
      ),
      align: "right" as const,
    }] : []),
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
        <div className="flex gap-1 text-xs text-[var(--st-text)]">
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
      helpBody="Blocks are the atomic units of SabFlow. Triggers start a flow, and actions perform tasks like sending SMS or checking compliance. Use the static analyzer to detect infinite loops in your block configurations."
      secondaryActions={[
        {
          label: "Analyze Configuration",
          icon: <Code className="h-4 w-4" />,
          onClick: () => setIsFlowBuilderOpen(true),
        },
        {
          label: "AI: Pick blocks for me",
          icon: <Sparkles className="h-4 w-4" />,
          onClick: () => alert("AI assistant opening..."),
        }
      ]}
      toolbar={
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex bg-[var(--st-bg-muted)] p-1 rounded-md">
            <button
              onClick={() => setViewMode("local")}
              className={`px-3 py-1.5 text-sm font-medium rounded ${viewMode === "local" ? "bg-white shadow-sm text-[var(--st-text)]" : "text-[var(--st-text)] hover:text-[var(--st-text)]"}`}
            >
              My Workspace
            </button>
            <button
              onClick={() => setViewMode("marketplace")}
              className={`px-3 py-1.5 text-sm font-medium rounded ${viewMode === "marketplace" ? "bg-white shadow-sm text-[var(--st-text)]" : "text-[var(--st-text)] hover:text-[var(--st-text)]"}`}
            >
              Marketplace
            </button>
          </div>
          <div className="flex-1 w-full">
            <SabsmsFilterBar
              searchPlaceholder="Search blocks..."
              search={urlState.search}
              onSearchChange={urlState.setSearch}
              facets={facets}
              activeFacets={urlState.facets}
              onFacetChange={urlState.setFacet}
            />
          </div>
        </div>
      }
    >
      <div className="space-y-8">
        <SabsmsDataTable
          rows={filteredBlocks}
          columns={columns}
          rowKey={(b) => b.id}
          onRowClick={setSelectedBlock}
          rowActions={viewMode === "local" ? [
            {
              label: "Add to SabFlow",
              icon: <Plus className="h-4 w-4" />,
              onSelect: (b) => alert(`Deep-linking to add ${b.name} to flow...`),
            },
            {
              label: "Publish to Marketplace",
              icon: <Upload className="h-4 w-4" />,
              onSelect: (b) => alert(`Publishing ${b.name} to marketplace...`),
            },
            {
              label: "Change Icon (Admin)",
              icon: <Settings className="h-4 w-4" />,
              onSelect: (b) => alert(`Opening icon picker for ${b.id}...`),
            }
          ] : [
            {
              label: "Install Block",
              icon: <Download className="h-4 w-4" />,
              onSelect: (b) => alert(`Installing ${b.name} to your workspace...`),
            }
          ]}
          page={urlState.page}
          pageSize={urlState.pageSize}
          total={filteredBlocks.length}
          onPageChange={urlState.setPage}
          onPageSizeChange={urlState.setPageSize}
        />

        <Card>
          <CardHeader>
            <CardTitle>Suggested Flows</CardTitle>
            <CardDescription>
              Ready-made templates combining these blocks for common use cases.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MOCK_TEMPLATES.map(tpl => (
                <div 
                  key={tpl.id} 
                  className="border rounded-md p-4 flex flex-col gap-2 hover:border-[var(--st-border)] cursor-pointer transition-colors"
                  onClick={() => setSelectedTemplate(tpl)}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Workflow className="h-4 w-4 text-[var(--st-text)]" />
                    {tpl.name}
                  </div>
                  <p className="text-sm text-[var(--st-text)]">{tpl.description}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <SabsmsDetailDrawer
        title={selectedBlock?.name || ""}
        description={`Block ID: ${selectedBlock?.id}`}
        open={!!selectedBlock}
        onOpenChange={(open) => !open && setSelectedBlock(null)}
        actions={
          viewMode === "local" ? [
            <Button key="add" size="sm" onClick={() => alert("Added to flow")}>
              <Plus className="mr-2 h-4 w-4" /> Add to SabFlow
            </Button>
          ] : [
            <Button key="install" size="sm" onClick={() => alert("Installing block")}>
              <Download className="mr-2 h-4 w-4" /> Install to Workspace
            </Button>
          ]
        }
      >
        {selectedBlock && (
          <div className="space-y-6">
            {selectedBlock.status === "deprecated" && (
              <div className="bg-[var(--st-bg-muted)] text-[var(--st-text)] p-3 rounded-md text-sm flex items-start gap-2 border border-[var(--st-border)]">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <div>
                  <strong>Deprecated</strong>
                  <p>This block will be removed in a future update. {selectedBlock.changelog}</p>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <FileCode2 className="h-4 w-4 text-[var(--st-text)]" /> Schema Viewer
              </h4>
              <pre className="bg-[var(--st-text)] text-white p-3 rounded-md text-xs overflow-auto">
                {selectedBlock.schema}
              </pre>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Workflow className="h-4 w-4 text-[var(--st-text)]" /> Example Workflow
              </h4>
              <div className="text-sm bg-[var(--st-bg-muted)] p-3 rounded border border-[var(--st-border)]">
                {selectedBlock.exampleWorkflow}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4 text-[var(--st-text)]" /> Dependency Graph
              </h4>
              <div className="text-sm">
                {selectedBlock.dependencies.length > 0 ? (
                  <ul className="list-disc pl-5 text-[var(--st-text)]">
                    {selectedBlock.dependencies.map(dep => <li key={dep}>{dep}</li>)}
                  </ul>
                ) : (
                  <span className="text-[var(--st-text)]">No external dependencies.</span>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Embed Snippet</h4>
              <div className="relative">
                <pre className="bg-[var(--st-bg-muted)] p-3 rounded-md text-xs border border-[var(--st-border)] overflow-x-auto">
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
              <p className="text-sm text-[var(--st-text)]">{selectedBlock.changelog}</p>
            </div>
          </div>
        )}
      </SabsmsDetailDrawer>

      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>{selectedTemplate?.description}</DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm">Installation Guide</h4>
                <p className="text-sm text-[var(--st-text)]">{selectedTemplate.installGuide}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm">Test Data Generator</h4>
                <pre className="bg-[var(--st-bg-muted)] p-2 rounded text-xs mt-1 border">
                  {selectedTemplate.testData}
                </pre>
                <Button variant="outline" size="sm" className="mt-2 text-xs">
                  Generate Payload
                </Button>
              </div>
              <div>
                <h4 className="font-medium text-sm">Audit Details</h4>
                <p className="text-sm text-[var(--st-text)]">{selectedTemplate.auditInfo}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isFlowBuilderOpen} onOpenChange={setIsFlowBuilderOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Block Configuration Static Analyzer</DialogTitle>
            <DialogDescription>
              Test your flow configuration logic for infinite loops before deploying.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={flowJson}
              onChange={(e) => setFlowJson(e.target.value)}
              className="font-mono text-sm h-48 bg-[var(--st-bg-muted)] border-[var(--st-border)]"
              placeholder="Enter JSON block configuration..."
            />
            <Button onClick={analyzeFlow} className="w-full">
              <Code className="mr-2 h-4 w-4" /> Analyze Logic
            </Button>
            
            {analysis && (
              <div className={`p-4 rounded-md border ${analysis.valid ? 'bg-[var(--st-bg-muted)] border-[var(--st-border)] text-[var(--st-text)]' : 'bg-[var(--st-bg-muted)] border-[var(--st-border)] text-[var(--st-text)]'}`}>
                <div className="font-semibold flex items-center gap-2">
                  {!analysis.valid && <AlertTriangle className="h-4 w-4" />}
                  {analysis.message}
                </div>
                {analysis.cycles && analysis.cycles.length > 0 && (
                  <div className="mt-2 text-sm bg-white/50 p-2 rounded">
                    <strong>Cycle Path:</strong> {analysis.cycles.map(c => c.join(" → ")).join(" | ")}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </SabsmsPageShell>
  );
}

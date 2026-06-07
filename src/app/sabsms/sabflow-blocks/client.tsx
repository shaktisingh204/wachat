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
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Field,
  Textarea,
  Alert,
  SegmentedControl,
  useToast,
} from "@/components/sabcrm/20ui";
import { Sparkles, Copy, Plus, Activity, AlertTriangle, Workflow, Settings, FileCode2, Code, Download, Upload } from "lucide-react";
import { MOCK_BLOCKS, MOCK_TEMPLATES, type SabflowBlock, type SabflowTemplate } from "./mock-data";

export function SabflowBlocksClient({ workspaceId }: { workspaceId: string }) {
  const { toast } = useToast();

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
        setAnalysis({ valid: false, message: "Infinite loop detected. Please fix before saving.", cycles });
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
  }, [urlState.search, urlState.facets, viewMode]);

  const columns: SabsmsColumn<SabflowBlock>[] = [
    {
      id: "name",
      header: "Block",
      render: (b) => (
        <div className="flex flex-col">
          <span className="font-medium text-[var(--st-text)]">{b.name}</span>
          <span className="text-xs text-[var(--st-text-secondary)]">{b.description}</span>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      render: (b) => (
        <Badge kind="outline" className="capitalize">
          {b.type}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Status",
      render: (b) => (
        <Badge
          tone={b.status === "deprecated" ? "danger" : b.status === "beta" ? "warning" : "success"}
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
        <span className="text-sm text-[var(--st-text)]">
          {b.creditCost === 0 ? "Free" : `${b.creditCost} cr`}
        </span>
      ),
      align: "right",
    },
    ...(viewMode === "marketplace" ? [{
      id: "downloads",
      header: "Downloads",
      render: (b: SabflowBlock) => (
        <span className="text-sm text-[var(--st-text-secondary)] flex items-center gap-1">
          <Download className="h-3 w-3" aria-hidden="true" /> {b.downloads || 0}
        </span>
      ),
      align: "right" as const,
    }] : []),
    {
      id: "usage",
      header: "Usage",
      render: (b) => <span className="text-sm font-mono text-[var(--st-text)]">{b.usageCount.toLocaleString()}</span>,
      align: "right",
    },
    {
      id: "compatibility",
      header: "Compatible",
      render: (b) => (
        <div className="flex gap-1 text-xs text-[var(--st-text-secondary)]">
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
          icon: <Code className="h-4 w-4" aria-hidden="true" />,
          onSelectAction: () => setIsFlowBuilderOpen(true),
        },
        {
          label: "AI: Pick blocks for me",
          icon: <Sparkles className="h-4 w-4" aria-hidden="true" />,
          onSelectAction: () => toast({ title: "AI assistant opening...", tone: "info" }),
        }
      ]}
      toolbar={
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <SegmentedControl
            aria-label="Block source"
            value={viewMode}
            onChange={(v) => setViewMode(v)}
            items={[
              { value: "local", label: "My Workspace" },
              { value: "marketplace", label: "Marketplace" },
            ]}
          />
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
              icon: <Plus className="h-4 w-4" aria-hidden="true" />,
              onSelect: (b) => toast({ title: `Deep-linking to add ${b.name} to flow...`, tone: "info" }),
            },
            {
              label: "Publish to Marketplace",
              icon: <Upload className="h-4 w-4" aria-hidden="true" />,
              onSelect: (b) => toast({ title: `Publishing ${b.name} to marketplace...`, tone: "info" }),
            },
            {
              label: "Change Icon (Admin)",
              icon: <Settings className="h-4 w-4" aria-hidden="true" />,
              onSelect: (b) => toast({ title: `Opening icon picker for ${b.id}...`, tone: "info" }),
            }
          ] : [
            {
              label: "Install Block",
              icon: <Download className="h-4 w-4" aria-hidden="true" />,
              onSelect: (b) => toast({ title: `Installing ${b.name} to your workspace...`, tone: "info" }),
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
                <Card
                  key={tpl.id}
                  variant="interactive"
                  padding="md"
                  className="flex flex-col gap-2"
                  onClick={() => setSelectedTemplate(tpl)}
                >
                  <div className="flex items-center gap-2 font-medium text-[var(--st-text)]">
                    <Workflow className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                    {tpl.name}
                  </div>
                  <p className="text-sm text-[var(--st-text-secondary)]">{tpl.description}</p>
                </Card>
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
            <Button key="add" size="sm" variant="primary" iconLeft={Plus} onClick={() => toast.success("Added to flow")}>
              Add to SabFlow
            </Button>
          ] : [
            <Button key="install" size="sm" variant="primary" iconLeft={Download} onClick={() => toast.success("Installing block")}>
              Install to Workspace
            </Button>
          ]
        }
      >
        {selectedBlock && (
          <div className="space-y-6">
            {selectedBlock.status === "deprecated" && (
              <Alert tone="warning" title="Deprecated">
                This block will be removed in a future update. {selectedBlock.changelog}
              </Alert>
            )}

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-[var(--st-text)]">
                <FileCode2 className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" /> Schema Viewer
              </h4>
              <pre className="bg-[var(--st-bg-muted)] text-[var(--st-text)] p-3 rounded-[var(--st-radius)] text-xs overflow-auto border border-[var(--st-border)]">
                {selectedBlock.schema}
              </pre>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-[var(--st-text)]">
                <Workflow className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" /> Example Workflow
              </h4>
              <div className="text-sm text-[var(--st-text-secondary)] bg-[var(--st-bg-muted)] p-3 rounded-[var(--st-radius)] border border-[var(--st-border)]">
                {selectedBlock.exampleWorkflow}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-[var(--st-text)]">
                <Activity className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" /> Dependency Graph
              </h4>
              <div className="text-sm">
                {selectedBlock.dependencies.length > 0 ? (
                  <ul className="list-disc pl-5 text-[var(--st-text-secondary)]">
                    {selectedBlock.dependencies.map(dep => <li key={dep}>{dep}</li>)}
                  </ul>
                ) : (
                  <span className="text-[var(--st-text-secondary)]">No external dependencies.</span>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 text-[var(--st-text)]">Embed Snippet</h4>
              <div className="relative">
                <pre className="bg-[var(--st-bg-muted)] text-[var(--st-text)] p-3 rounded-[var(--st-radius)] text-xs border border-[var(--st-border)] overflow-x-auto">
                  {selectedBlock.copySnippet}
                </pre>
                <IconButton
                  label="Copy snippet"
                  icon={Copy}
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1"
                  onClick={() => {
                    navigator.clipboard?.writeText(selectedBlock.copySnippet);
                    toast.success("Snippet copied");
                  }}
                />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-1 text-[var(--st-text)]">Changelog</h4>
              <p className="text-sm text-[var(--st-text-secondary)]">{selectedBlock.changelog}</p>
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
                <h4 className="font-medium text-sm text-[var(--st-text)]">Installation Guide</h4>
                <p className="text-sm text-[var(--st-text-secondary)]">{selectedTemplate.installGuide}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-[var(--st-text)]">Test Data Generator</h4>
                <pre className="bg-[var(--st-bg-muted)] text-[var(--st-text)] p-2 rounded-[var(--st-radius)] text-xs mt-1 border border-[var(--st-border)]">
                  {selectedTemplate.testData}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={() => toast.success("Test payload generated")}
                >
                  Generate Payload
                </Button>
              </div>
              <div>
                <h4 className="font-medium text-sm text-[var(--st-text)]">Audit Details</h4>
                <p className="text-sm text-[var(--st-text-secondary)]">{selectedTemplate.auditInfo}</p>
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
            <Field label="Block configuration (JSON)">
              <Textarea
                value={flowJson}
                onChange={(e) => setFlowJson(e.target.value)}
                rows={10}
                className="font-mono text-sm"
                placeholder="Enter JSON block configuration..."
              />
            </Field>
            <Button variant="primary" block iconLeft={Code} onClick={analyzeFlow}>
              Analyze Logic
            </Button>

            {analysis && (
              <Alert
                tone={analysis.valid ? "success" : "danger"}
                icon={analysis.valid ? undefined : AlertTriangle}
                title={analysis.message}
              >
                {analysis.cycles && analysis.cycles.length > 0 && (
                  <div className="mt-1 text-sm">
                    <strong>Cycle Path:</strong>{" "}
                    {analysis.cycles.map(c => c.join(" -> ")).join(" | ")}
                  </div>
                )}
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </SabsmsPageShell>
  );
}

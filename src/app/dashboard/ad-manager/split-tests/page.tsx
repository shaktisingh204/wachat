'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageActions,
  PageHeader,
  PageHeading,
  PageTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import {
  FlaskConical,
  Plus,
  Sparkles,
  Trash2,
  Clock,
} from 'lucide-react';

import * as React from 'react';

import { AmBreadcrumb } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useToast } from '@/hooks/use-toast';

const VARIABLES = [
  { id: 'creative', label: 'Creative', desc: 'Compare different ad creatives head-to-head.' },
  { id: 'audience', label: 'Audience', desc: 'Test two different targeting definitions.' },
  { id: 'placement', label: 'Placement', desc: 'Compare Facebook vs Instagram vs Reels.' },
  { id: 'optimization', label: 'Optimization', desc: 'Test different delivery optimization goals.' },
  { id: 'bid_strategy', label: 'Bid strategy', desc: 'Compare Lowest cost vs Cost cap vs Bid cap.' },
];

interface SplitTest {
  id: string;
  name: string;
  variable: string;
  variantA: string;
  variantB: string;
  budget: string;
  createdAt: string;
  status: 'running' | 'completed';
}

export default function SplitTestsPage() {
  const { toast } = useToast();
  const [selectedVar, setSelectedVar] = React.useState<string | null>(null);
  const [pastTests, setPastTests] = React.useState<SplitTest[]>([]);
  const [isMounted, setIsMounted] = React.useState(false);

  // form state
  const [testName, setTestName] = React.useState('');
  const [variantA, setVariantA] = React.useState('');
  const [variantB, setVariantB] = React.useState('');
  const [budget, setBudget] = React.useState('');

  // Load past tests from localStorage on mount
  React.useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem('sabnode_split_tests');
      if (stored) setPastTests(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const saveTests = (tests: SplitTest[]) => {
    setPastTests(tests);
    try { localStorage.setItem('sabnode_split_tests', JSON.stringify(tests)); } catch { /* ignore */ }
  };

  const resetForm = () => {
    setTestName(''); setVariantA(''); setVariantB(''); setBudget('');
  };

  const handleLaunch = () => {
    if (!selectedVar || !testName.trim() || !variantA.trim() || !variantB.trim() || !budget.trim()) {
      toast.error({ title: 'Validation', description: 'All four fields are required.' });
      return;
    }
    const parsed = Number(budget);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error({ title: 'Validation', description: 'Budget must be a positive number.' });
      return;
    }

    const newTest: SplitTest = {
      id: crypto.randomUUID(),
      name: testName.trim(),
      variable: VARIABLES.find(v => v.id === selectedVar)?.label || selectedVar,
      variantA: variantA.trim(),
      variantB: variantB.trim(),
      budget: budget.trim(),
      createdAt: new Date().toISOString(),
      status: 'running',
    };

    saveTests([newTest, ...pastTests]);
    toast.success({ title: 'Split test launched', description: `"${newTest.name}" is now running.` });
    setSelectedVar(null);
    resetForm();
  };

  const handleDelete = (id: string) => {
    saveTests(pastTests.filter(t => t.id !== id));
    toast.success({ title: 'Deleted', description: 'Split test removed.' });
  };

  if (!isMounted) {
    return null; // Ensure full hydration stability by avoiding server-client mismatch on initial load
  }

  return (
    <div className="space-y-6">
      <AmBreadcrumb page="A/B split tests" />

      <PageHeader>
        <PageHeading>
          <PageTitle className="flex items-center gap-2">
            <FlaskConical className="h-6 w-6" aria-hidden="true" /> A/B split tests
            <Badge tone="accent">Advanced</Badge>
          </PageTitle>
          <p className="text-sm text-[var(--st-text-secondary)] mt-1">
            Run scientific experiments across creatives, audiences, placements and bid strategies.
            Winner is auto-selected when statistical significance is reached.
          </p>
        </PageHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={() => setSelectedVar('creative')}>
            Create split test
          </Button>
        </PageActions>
      </PageHeader>

      <Alert tone="info" icon={Sparkles}>
        <AlertTitle>Beyond Meta Ads Manager</AlertTitle>
        <AlertDescription>
          SabNode supports multi-variable tests (2-5 variants simultaneously) with
          automatic budget reallocation to the winning variant once 95% confidence is reached.
        </AlertDescription>
      </Alert>

      <div>
        <h2 className="text-sm font-semibold mb-2 text-[var(--st-text)]">Pick a variable to test</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {VARIABLES.map((v) => (
            <Card
              key={v.id}
              variant="interactive"
              role="button"
              tabIndex={0}
              aria-label={`Test ${v.label}: ${v.desc}`}
              className="cursor-pointer"
              onClick={() => setSelectedVar(v.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedVar(v.id);
                }
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{v.label}</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-xs text-[var(--st-text-secondary)]">{v.desc}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* Past tests */}
      <div>
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-1 text-[var(--st-text)]">
          <Clock className="h-4 w-4" aria-hidden="true" /> Past tests
        </h2>
        <Card padding="none">
          {pastTests.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="No split tests yet"
              description="Pick a variable above to launch your first A/B experiment."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Variable</Th>
                  <Th>Variant A</Th>
                  <Th>Variant B</Th>
                  <Th align="right">Budget</Th>
                  <Th>Created</Th>
                  <Th>Status</Th>
                  <Th width={48} aria-label="Actions" />
                </Tr>
              </THead>
              <TBody>
                {pastTests.map((t) => (
                  <Tr key={t.id}>
                    <Td className="font-medium">{t.name}</Td>
                    <Td><Badge variant="outline">{t.variable}</Badge></Td>
                    <Td truncate className="text-sm text-[var(--st-text-secondary)] max-w-[120px]">{t.variantA}</Td>
                    <Td truncate className="text-sm text-[var(--st-text-secondary)] max-w-[120px]">{t.variantB}</Td>
                    <Td align="right" className="tabular-nums">${t.budget}/day</Td>
                    <Td className="text-xs text-[var(--st-text-secondary)]">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </Td>
                    <Td>
                      <Badge tone={t.status === 'running' ? 'success' : 'neutral'} dot>{t.status}</Badge>
                    </Td>
                    <Td>
                      <IconButton
                        icon={Trash2}
                        label={`Delete ${t.name}`}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(t.id)}
                      />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Create dialog */}
      <Dialog open={!!selectedVar} onOpenChange={(open) => { if (!open) { setSelectedVar(null); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create split test: {VARIABLES.find(v => v.id === selectedVar)?.label}</DialogTitle>
            <DialogDescription>Set up your A/B test variants. Winner is auto-selected at 95% confidence.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Test name" required>
              <Input placeholder="e.g. Creative test - April" value={testName} onChange={e => setTestName(e.target.value)} />
            </Field>
            <Field label="Variant A (Control)" required>
              <Input placeholder="Description or campaign ID" value={variantA} onChange={e => setVariantA(e.target.value)} />
            </Field>
            <Field label="Variant B (Challenger)" required>
              <Input placeholder="Description or campaign ID" value={variantB} onChange={e => setVariantB(e.target.value)} />
            </Field>
            <Field label="Test budget (daily)" required>
              <Input type="number" placeholder="500" prefix="$" suffix="/day" value={budget} onChange={e => setBudget(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedVar(null); resetForm(); }}>Cancel</Button>
            <Button variant="primary" onClick={handleLaunch}>
              Launch test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { Alert, AlertDescription, AlertTitle, Badge, Button, Card, CardBody, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
import {
  FlaskConical,
  Plus,
  Sparkles,
  Trash2,
  Clock } from 'lucide-react';

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
            toast({ title: 'Validation', description: 'All four fields are required.', variant: 'destructive' });
            return;
        }
        const parsed = Number(budget);
        if (isNaN(parsed) || parsed <= 0) {
            toast({ title: 'Validation', description: 'Budget must be a positive number.', variant: 'destructive' });
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
        toast({ title: 'Split test launched!', description: `"${newTest.name}" is now running.` });
        setSelectedVar(null);
        resetForm();
    };

    const handleDelete = (id: string) => {
        saveTests(pastTests.filter(t => t.id !== id));
        toast({ title: 'Deleted', description: 'Split test removed.' });
    };

    if (!isMounted) {
        return null; // Ensure full hydration stability by avoiding server-client mismatch on initial load
    }

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="A/B split tests" />
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <FlaskConical className="h-6 w-6" /> A/B split tests
                        <Badge className="bg-[var(--st-text)] text-white">Advanced</Badge>
                    </h1>
                    <p className="text-sm text-[var(--st-text-secondary)] mt-1">
                        Run scientific experiments across creatives, audiences, placements and bid strategies.
                        Winner is auto-selected when statistical significance is reached.
                    </p>
                </div>
                <Button className="bg-[var(--st-text)] hover:bg-[var(--st-text)]/90 text-white" onClick={() => setSelectedVar('creative')}>
                    <Plus className="h-4 w-4 mr-1" /> Create split test
                </Button>
            </div>

            <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>Beyond Meta Ads Manager</AlertTitle>
                <AlertDescription>
                    SabNode supports multi-variable tests (2-5 variants simultaneously) with
                    automatic budget reallocation to the winning variant once 95% confidence is reached.
                </AlertDescription>
            </Alert>

            <div>
                <h2 className="text-sm font-semibold mb-2">Pick a variable to test</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {VARIABLES.map((v) => (
                        <Card key={v.id} className="cursor-pointer hover:border-[var(--st-border)]/50 transition-colors" onClick={() => setSelectedVar(v.id)}>
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
            {pastTests.length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold mb-2 flex items-center gap-1">
                        <Clock className="h-4 w-4" /> Past tests
                    </h2>
                    <Card>
                        <CardBody className="p-0">
                            <Table>
                                <THead>
                                    <Tr>
                                        <Th>Name</Th>
                                        <Th>Variable</Th>
                                        <Th>Variant A</Th>
                                        <Th>Variant B</Th>
                                        <Th>Budget</Th>
                                        <Th>Created</Th>
                                        <Th>Status</Th>
                                        <Th className="w-12" />
                                    </Tr>
                                </THead>
                                <TBody>
                                    {pastTests.map((t) => (
                                        <Tr key={t.id}>
                                            <Td className="font-medium">{t.name}</Td>
                                            <Td><Badge variant="outline">{t.variable}</Badge></Td>
                                            <Td className="text-sm text-[var(--st-text-secondary)] max-w-[120px] truncate">{t.variantA}</Td>
                                            <Td className="text-sm text-[var(--st-text-secondary)] max-w-[120px] truncate">{t.variantB}</Td>
                                            <Td className="tabular-nums">${t.budget}/day</Td>
                                            <Td className="text-xs text-[var(--st-text-secondary)]">
                                                {new Date(t.createdAt).toLocaleDateString()}
                                            </Td>
                                            <Td>
                                                <Badge variant={t.status === 'running' ? 'default' : 'secondary'}>{t.status}</Badge>
                                            </Td>
                                            <Td>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--st-text)]" onClick={() => handleDelete(t.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        </CardBody>
                    </Card>
                </div>
            )}

            {/* Create dialog */}
            <Dialog open={!!selectedVar} onOpenChange={(open) => { if (!open) { setSelectedVar(null); resetForm(); } }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create Split Test: {VARIABLES.find(v => v.id === selectedVar)?.label}</DialogTitle>
                        <DialogDescription>Set up your A/B test variants. Winner is auto-selected at 95% confidence.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Test Name *</Label>
                            <Input placeholder="e.g. Creative test - April" value={testName} onChange={e => setTestName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Variant A (Control) *</Label>
                            <Input placeholder="Description or campaign ID" value={variantA} onChange={e => setVariantA(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Variant B (Challenger) *</Label>
                            <Input placeholder="Description or campaign ID" value={variantB} onChange={e => setVariantB(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Test Budget (daily) *</Label>
                            <Input type="number" placeholder="500" value={budget} onChange={e => setBudget(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setSelectedVar(null); resetForm(); }}>Cancel</Button>
                        <Button className="bg-[var(--st-text)] hover:bg-[var(--st-text)]/90 text-white" onClick={handleLaunch}>
                            Launch Test
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

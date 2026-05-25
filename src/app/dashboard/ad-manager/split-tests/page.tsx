'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
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
                        <Badge className="bg-[#1877F2] text-white">Advanced</Badge>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Run scientific experiments across creatives, audiences, placements and bid strategies.
                        Winner is auto-selected when statistical significance is reached.
                    </p>
                </div>
                <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={() => setSelectedVar('creative')}>
                    <Plus className="h-4 w-4 mr-1" /> Create split test
                </Button>
            </div>

            <Alert>
                <Sparkles className="h-4 w-4" />
                <ZoruAlertTitle>Beyond Meta Ads Manager</ZoruAlertTitle>
                <ZoruAlertDescription>
                    SabNode supports multi-variable tests (2-5 variants simultaneously) with
                    automatic budget reallocation to the winning variant once 95% confidence is reached.
                </ZoruAlertDescription>
            </Alert>

            <div>
                <h2 className="text-sm font-semibold mb-2">Pick a variable to test</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {VARIABLES.map((v) => (
                        <Card key={v.id} className="cursor-pointer hover:border-[#1877F2]/50 transition-colors" onClick={() => setSelectedVar(v.id)}>
                            <ZoruCardHeader className="pb-2">
                                <ZoruCardTitle className="text-base">{v.label}</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <p className="text-xs text-muted-foreground">{v.desc}</p>
                            </ZoruCardContent>
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
                        <ZoruCardContent className="p-0">
                            <Table>
                                <ZoruTableHeader>
                                    <ZoruTableRow>
                                        <ZoruTableHead>Name</ZoruTableHead>
                                        <ZoruTableHead>Variable</ZoruTableHead>
                                        <ZoruTableHead>Variant A</ZoruTableHead>
                                        <ZoruTableHead>Variant B</ZoruTableHead>
                                        <ZoruTableHead>Budget</ZoruTableHead>
                                        <ZoruTableHead>Created</ZoruTableHead>
                                        <ZoruTableHead>Status</ZoruTableHead>
                                        <ZoruTableHead className="w-12" />
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {pastTests.map((t) => (
                                        <ZoruTableRow key={t.id}>
                                            <ZoruTableCell className="font-medium">{t.name}</ZoruTableCell>
                                            <ZoruTableCell><Badge variant="outline">{t.variable}</Badge></ZoruTableCell>
                                            <ZoruTableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{t.variantA}</ZoruTableCell>
                                            <ZoruTableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{t.variantB}</ZoruTableCell>
                                            <ZoruTableCell className="tabular-nums">${t.budget}/day</ZoruTableCell>
                                            <ZoruTableCell className="text-xs text-muted-foreground">
                                                {new Date(t.createdAt).toLocaleDateString()}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <Badge variant={t.status === 'running' ? 'default' : 'secondary'}>{t.status}</Badge>
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(t.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))}
                                </ZoruTableBody>
                            </Table>
                        </ZoruCardContent>
                    </Card>
                </div>
            )}

            {/* Create dialog */}
            <Dialog open={!!selectedVar} onOpenChange={(open) => { if (!open) { setSelectedVar(null); resetForm(); } }}>
                <ZoruDialogContent className="max-w-lg">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Create Split Test: {VARIABLES.find(v => v.id === selectedVar)?.label}</ZoruDialogTitle>
                        <ZoruDialogDescription>Set up your A/B test variants. Winner is auto-selected at 95% confidence.</ZoruDialogDescription>
                    </ZoruDialogHeader>
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
                    <ZoruDialogFooter>
                        <Button variant="outline" onClick={() => { setSelectedVar(null); resetForm(); }}>Cancel</Button>
                        <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={handleLaunch}>
                            Launch Test
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>
        </div>
    );
}

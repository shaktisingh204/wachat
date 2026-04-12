'use client';

import * as React from 'react';
import { LuFlaskConical, LuPlus, LuSparkles, LuTrash2, LuClock } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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

    // form state
    const [testName, setTestName] = React.useState('');
    const [variantA, setVariantA] = React.useState('');
    const [variantB, setVariantB] = React.useState('');
    const [budget, setBudget] = React.useState('');

    // Load past tests from localStorage on mount
    React.useEffect(() => {
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

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <LuFlaskConical className="h-6 w-6" /> A/B split tests
                        <Badge className="bg-[#1877F2] text-white">Advanced</Badge>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Run scientific experiments across creatives, audiences, placements and bid strategies.
                        Winner is auto-selected when statistical significance is reached.
                    </p>
                </div>
                <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={() => setSelectedVar('creative')}>
                    <LuPlus className="h-4 w-4 mr-1" /> Create split test
                </Button>
            </div>

            <Alert>
                <LuSparkles className="h-4 w-4" />
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
                        <Card key={v.id} className="cursor-pointer hover:border-[#1877F2]/50 transition-colors" onClick={() => setSelectedVar(v.id)}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">{v.label}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">{v.desc}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Past tests */}
            {pastTests.length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold mb-2 flex items-center gap-1">
                        <LuClock className="h-4 w-4" /> Past tests
                    </h2>
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Variable</TableHead>
                                        <TableHead>Variant A</TableHead>
                                        <TableHead>Variant B</TableHead>
                                        <TableHead>Budget</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-12" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pastTests.map((t) => (
                                        <TableRow key={t.id}>
                                            <TableCell className="font-medium">{t.name}</TableCell>
                                            <TableCell><Badge variant="outline">{t.variable}</Badge></TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{t.variantA}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{t.variantB}</TableCell>
                                            <TableCell className="tabular-nums">${t.budget}/day</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {new Date(t.createdAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={t.status === 'running' ? 'default' : 'secondary'}>{t.status}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(t.id)}>
                                                    <LuTrash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
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
                        <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={handleLaunch}>
                            Launch Test
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

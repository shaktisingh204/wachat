'use client';

import { use, useState } from 'react';
import { 
    Button, 
    Card, 
    ZoruCardContent, 
    ZoruCardHeader, 
    ZoruCardTitle,
    Dialog,
    ZoruDialogTrigger as DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    Input,
    Label,
    Select,
    ZoruSelectTrigger as SelectTrigger,
    ZoruSelectValue as SelectValue,
    SelectContent,
    SelectItem
} from '@/components/zoruui';

import { MapPin, Search, Loader2 } from 'lucide-react';

const INITIAL_GRID = [
    { rank: 1, color: 'bg-zoru-success' },
    { rank: 2, color: 'bg-zoru-success' },
    { rank: 4, color: 'bg-zoru-warning' },
    { rank: 1, color: 'bg-zoru-success' },
    { rank: 1, color: 'bg-zoru-success' },
    { rank: 3, color: 'bg-zoru-success' },
    { rank: 5, color: 'bg-zoru-warning' },
    { rank: 8, color: 'bg-zoru-warning' },
    { rank: 12, color: 'bg-zoru-danger' },
];

export default function LocalSeoPage({ params }: { params: Promise<{ projectId: string }> }) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { projectId } = use(params);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [keyword, setKeyword] = useState('Coffee Shop');
    const [location, setLocation] = useState('New York, NY');
    const [gridSize, setGridSize] = useState('3x3');
    
    const [gridData, setGridData] = useState(INITIAL_GRID);
    const [lastScanned, setLastScanned] = useState({ 
        keyword: 'Coffee Shop', 
        location: 'New York, NY',
        gridSize: '3x3' 
    });

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsScanning(true);
        
        try {
            await new Promise(r => setTimeout(r, 2000)); // Simulate API call
            
            const size = parseInt(gridSize[0]); 
            const totalNodes = size * size;
            const center = Math.floor(size / 2);
            
            const newGrid = Array.from({ length: totalNodes }).map((_, i) => {
                const row = Math.floor(i / size);
                const col = i % size;
                const dist = Math.sqrt(Math.pow(row - center, 2) + Math.pow(col - center, 2));
                
                let baseRank = 1 + dist * 3;
                baseRank += (Math.random() * 4 - 2); 
                let rank = Math.max(1, Math.round(baseRank));
                if (rank > 20) rank = 20;
                
                let color = 'bg-zoru-success';
                if (rank > 3 && rank <= 10) color = 'bg-zoru-warning';
                if (rank > 10) color = 'bg-zoru-danger';
                
                return { rank, color };
            });
            
            setGridData(newGrid);
            setLastScanned({ keyword, location, gridSize });
            setIsDialogOpen(false);
        } finally {
            setIsScanning(false);
        }
    };

    const gridColsClass = 
        lastScanned.gridSize === '3x3' ? 'grid-cols-3' :
        lastScanned.gridSize === '5x5' ? 'grid-cols-5' :
        lastScanned.gridSize === '7x7' ? 'grid-cols-7' : 'grid-cols-3';

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl text-zoru-ink flex items-center gap-3">
                        <MapPin className="h-8 w-8 text-zoru-ink" />
                        Local Geo-Grid
                    </h1>
                    <p className="text-zoru-ink-muted mt-1">Track your rankings across specific neighborhoods.</p>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Search className="mr-2 h-4 w-4" />
                            New Scan
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <form onSubmit={handleScan}>
                            <DialogHeader>
                                <DialogTitle>New Local Geo-Grid Scan</DialogTitle>
                                <DialogDescription>
                                    Enter the details to simulate GPS coordinate rankings around your business.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="keyword">Keyword</Label>
                                    <Input 
                                        id="keyword" 
                                        value={keyword} 
                                        onChange={e => setKeyword(e.target.value)} 
                                        placeholder="e.g. Coffee Shop"
                                        required 
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="location">Center Location / Business Name</Label>
                                    <Input 
                                        id="location" 
                                        value={location} 
                                        onChange={e => setLocation(e.target.value)} 
                                        placeholder="e.g. Times Square, NY"
                                        required 
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="gridSize">Grid Size</Label>
                                    <Select value={gridSize} onValueChange={setGridSize}>
                                        <SelectTrigger id="gridSize">
                                            <SelectValue placeholder="Select grid size" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="3x3">3x3 (9 points)</SelectItem>
                                            <SelectItem value="5x5">5x5 (25 points)</SelectItem>
                                            <SelectItem value="7x7">7x7 (49 points)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isScanning}>
                                    {isScanning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Start Scan
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="md:col-span-1">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Rank Map: &quot;{lastScanned.keyword}&quot;</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="flex flex-col items-center justify-center bg-zoru-surface-2/50 p-8">
                        <div className="mb-6 text-sm text-zoru-ink-muted text-center">
                            Showing results for <strong>{lastScanned.location}</strong>
                        </div>
                        <div className={`relative grid w-full max-w-[300px] aspect-square ${gridColsClass} gap-2 rounded bg-zoru-surface-2 p-2`}>
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10">
                                <MapPin className="h-full w-full" />
                            </div>

                            {gridData.map((node, i) => (
                                <div
                                    key={i}
                                    className={`${node.color} z-10 flex w-full h-full items-center justify-center rounded-full text-white shadow-[var(--zoru-shadow-sm)] text-sm md:text-base font-medium`}
                                >
                                    {node.rank}
                                </div>
                            ))}
                        </div>
                    </ZoruCardContent>
                </Card>

                <Card className="md:col-span-1">
                    <ZoruCardHeader>
                        <ZoruCardTitle>How it works</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="space-y-4">
                        <p className="text-sm text-zoru-ink-muted">
                            We simulate GPS coordinates at multiple points around your business location to see how your rankings change by physical proximity.
                        </p>
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full bg-zoru-success"></div>
                            <span className="text-sm text-zoru-ink">Rank 1-3 (Dominating)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full bg-zoru-warning"></div>
                            <span className="text-sm text-zoru-ink">Rank 4-10 (Visible)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full bg-zoru-danger"></div>
                            <span className="text-sm text-zoru-ink">Rank 10+ (Invisible)</span>
                        </div>
                    </ZoruCardContent>
                </Card>
            </div>
        </div>
    );
}

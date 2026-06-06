'use client';

import * as React from 'react';
import {
    Dialog,
    ZoruDialogContent,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruDialogDescription,
    ZoruDialogFooter,
    Button,
    Input,
    Label,
} from '@/components/sabcrm/20ui/compat';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (total: number) => void;
}

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

export function PosCashCounterDialog({ open, onOpenChange, onConfirm }: Props) {
    const [counts, setCounts] = React.useState<Record<number, number>>({});
    const [manualTotal, setManualTotal] = React.useState<string>('');
    const [mode, setMode] = React.useState<'manual' | 'counter'>('counter');

    const totalFromCounter = React.useMemo(() => {
        return DENOMINATIONS.reduce((sum, denom) => {
            return sum + (counts[denom] || 0) * denom;
        }, 0);
    }, [counts]);

    const handleConfirm = () => {
        if (mode === 'manual') {
            const parsed = Number(manualTotal);
            if (Number.isFinite(parsed) && parsed >= 0) {
                onConfirm(parsed);
            }
        } else {
            onConfirm(totalFromCounter);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-[400px]">
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Reconciliation</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        Count the cash in the drawer to close the session.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>

                <div className="flex justify-center gap-2 mb-4">
                    <Button 
                        size="sm" 
                        variant={mode === 'counter' ? 'default' : 'outline'}
                        onClick={() => setMode('counter')}
                    >
                        Bill Counter
                    </Button>
                    <Button 
                        size="sm" 
                        variant={mode === 'manual' ? 'default' : 'outline'}
                        onClick={() => setMode('manual')}
                    >
                        Manual Entry
                    </Button>
                </div>

                <div className="py-2">
                    {mode === 'manual' ? (
                        <div className="flex flex-col gap-2">
                            <Label>Total Cash Amount (₹)</Label>
                            <Input 
                                type="number" 
                                min={0} 
                                value={manualTotal} 
                                onChange={(e) => setManualTotal(e.target.value)} 
                                placeholder="Enter total amount"
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 max-h-[40vh] overflow-y-auto px-1">
                            {DENOMINATIONS.map((denom) => (
                                <div key={denom} className="flex items-center justify-between gap-2">
                                    <Label className="w-10 text-right">₹{denom}</Label>
                                    <Input 
                                        type="number" 
                                        min={0}
                                        placeholder="0"
                                        className="h-8 text-right"
                                        value={counts[denom] || ''}
                                        onChange={(e) => {
                                            const val = Math.max(0, parseInt(e.target.value) || 0);
                                            setCounts(prev => ({ ...prev, [denom]: val }));
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between border-t border-zoru-line pt-4 mt-2">
                    <span className="text-sm text-zoru-ink-muted">Total counted:</span>
                    <span className="text-lg font-bold text-zoru-ink">
                        ₹{mode === 'manual' ? (Number(manualTotal) || 0) : totalFromCounter}
                    </span>
                </div>

                <ZoruDialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleConfirm}>Close Session</Button>
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </Dialog>
    );
}

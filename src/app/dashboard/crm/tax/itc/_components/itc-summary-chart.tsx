'use client';

import { Card } from '@/components/zoruui';

export function ItcSummaryChart({
    matched,
    onlyInBooks,
    onlyIn2B,
}: {
    matched: number;
    onlyInBooks: number;
    onlyIn2B: number;
}) {
    const total = matched + onlyInBooks + onlyIn2B;
    if (total === 0) return null;

    const pMatched = (matched / total) * 100;
    const pBooks = (onlyInBooks / total) * 100;
    const p2B = (onlyIn2B / total) * 100;

    return (
        <Card className="flex flex-col gap-4 p-4">
            <div>
                <h3 className="text-[14px] font-semibold text-foreground">ITC Reconciliation Breakdown</h3>
                <p className="text-[12px] text-muted-foreground">Visual summary of ITC claimed vs pending</p>
            </div>
            
            <div className="h-4 w-full overflow-hidden rounded-full bg-muted flex">
                {pMatched > 0 && <div style={{ width: `${pMatched}%` }} className="h-full bg-emerald-500" title={`Matched: ${pMatched.toFixed(1)}%`} />}
                {pBooks > 0 && <div style={{ width: `${pBooks}%` }} className="h-full bg-amber-500" title={`Only in Books: ${pBooks.toFixed(1)}%`} />}
                {p2B > 0 && <div style={{ width: `${p2B}%` }} className="h-full bg-rose-500" title={`Only in 2B: ${p2B.toFixed(1)}%`} />}
            </div>
            
            <div className="flex gap-4 text-[12px]">
                <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-muted-foreground">Matched ({pMatched.toFixed(0)}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                    <span className="text-muted-foreground">Pending in 2B ({pBooks.toFixed(0)}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
                    <span className="text-muted-foreground">Unrecorded in Books ({p2B.toFixed(0)}%)</span>
                </div>
            </div>
        </Card>
    );
}

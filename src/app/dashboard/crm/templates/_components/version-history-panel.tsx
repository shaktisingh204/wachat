'use client';

import * as React from 'react';
import { History, RotateCcw, Eye, ArrowLeft, CheckCircle2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui/compat';

const fmtVerDateTime = (ts: string | Date) => {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return '—';
    const day = String(date.getUTCDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${minutes} UTC`;
};

const fmtVerTime = (ts: string | Date) => {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return '—';
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes} UTC`;
};

const fmtVerDate = (ts: string | Date) => {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return '—';
    const day = String(date.getUTCDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    return `${day} ${month} ${year}`;
};

interface VersionHistory {
    versionId: string;
    timestamp: string | Date;
    content: string;
    subject?: string;
    description: string;
}

interface VersionHistoryPanelProps {
    history?: VersionHistory[];
    currentContent: string;
    currentSubject?: string;
    onRestore: (content: string, subject?: string, versionObj?: any) => void;
}

export function VersionHistoryPanel({ history = [], currentContent, currentSubject, onRestore }: VersionHistoryPanelProps): React.JSX.Element {
    const [selectedVersion, setSelectedVersion] = React.useState<VersionHistory | null>(null);

    const handleRestoreClick = (version: VersionHistory) => {
        onRestore(version.content, version.subject, version);
        setSelectedVersion(null);
    };

    const getDiffMarkup = (oldVal: string, newVal: string) => {
        // Basic line-by-line comparison visual simulator for premium look
        const oldLines = oldVal.split('\n');
        const newLines = newVal.split('\n');
        
        return (
            <div className="flex flex-col gap-0.5 font-mono text-[10px] leading-normal bg-zoru-ink p-3 rounded-lg overflow-x-auto border border-zoru-line text-left">
                {oldLines.map((line, idx) => {
                    const isDifferent = newLines[idx] !== line;
                    return (
                        <div 
                            key={idx} 
                            className={isDifferent ? "bg-zoru-ink/40 text-zoru-ink-muted px-1 border-l-2 border-zoru-line" : "text-zoru-ink-muted px-1"}
                        >
                            <span className="inline-block w-6 text-zoru-ink select-none">{idx + 1}</span>
                            {line || ' '}
                        </div>
                    );
                })}
                {newLines.slice(oldLines.length).map((line, idx) => (
                    <div key={idx + oldLines.length} className="bg-zoru-ink/40 text-zoru-ink-muted px-1 border-l-2 border-zoru-line">
                        <span className="inline-block w-6 text-zoru-ink select-none">{idx + oldLines.length + 1}</span>
                        {line}
                    </div>
                ))}
            </div>
        );
    };

    if (selectedVersion) {
        return (
            <div className="flex h-full flex-col gap-4 p-4 text-zoru-ink">
                <div className="flex items-center gap-2 border-b border-zoru-line pb-3">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedVersion(null)}
                        className="h-7 w-7 p-0 bg-zoru-ink border-zoru-line"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                    </Button>
                    <div>
                        <h3 className="font-semibold text-sm">Compare Snapshot</h3>
                        <p className="text-[10px] text-zoru-ink-muted">
                            {fmtVerDateTime(selectedVersion.timestamp)}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col gap-3">
                    <div className="rounded-lg bg-zoru-ink/40 border border-zoru-line p-3 flex flex-col gap-1">
                        <span className="text-[10px] text-zoru-ink-muted uppercase font-semibold">Change Description</span>
                        <p className="text-xs font-medium text-white">{selectedVersion.description}</p>
                        {selectedVersion.subject && (
                            <p className="text-[11px] mt-1 font-mono text-zoru-ink-muted">
                                Subject: {selectedVersion.subject}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1 min-h-0">
                        <span className="text-[10px] text-zoru-ink-muted uppercase font-semibold">Visual Differences</span>
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            {getDiffMarkup(selectedVersion.content, currentContent)}
                        </div>
                    </div>
                </div>

                <div className="border-t border-zoru-line/80 pt-3 flex gap-2">
                    <Button 
                        variant="outline" 
                        className="flex-1 text-xs h-8.5 bg-zoru-ink border-zoru-line" 
                        onClick={() => setSelectedVersion(null)}
                    >
                        Cancel
                    </Button>
                    <Button 
                        className="flex-1 text-xs h-8.5 bg-gradient-to-r from-zoru-ink to-zoru-ink text-white gap-1.5 font-medium"
                        onClick={() => handleRestoreClick(selectedVersion)}
                    >
                        <RotateCcw className="h-3.5 w-3.5" /> Restore This Version
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-4 p-4 text-zoru-ink">
            <div className="flex items-center gap-2 border-b border-zoru-line pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zoru-ink/20 text-zoru-ink-muted">
                    <History className="h-4.5 w-4.5" />
                </div>
                <div>
                    <h3 className="font-semibold text-sm">Version History</h3>
                    <p className="text-[11px] text-zoru-ink-muted">Inspect and restore automated snapshots</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
                {/* Active version */}
                <div className="rounded-lg border-2 border-zoru-line bg-zoru-ink/15 p-3 flex flex-col gap-1">
                    <div className="flex justify-between items-start">
                        <Badge variant="outline" className="border-zoru-line/30 bg-zoru-ink text-zoru-ink-muted text-[9px] font-semibold h-4 px-1.5">
                            ACTIVE CURRENT
                        </Badge>
                        <span className="text-[9px] text-zoru-ink-muted/80 font-mono">Live Session</span>
                    </div>
                    <p className="text-xs font-semibold mt-1">Current Workspace Edits</p>
                    <p className="text-[10px] text-zoru-ink-muted">Continuous auto-saving active</p>
                </div>

                <span className="text-[10px] font-semibold text-zoru-ink-muted uppercase tracking-wider mt-2">Saved Snapshots ({history.length})</span>

                {history.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        {history.map((ver, idx) => (
                            <div 
                                key={ver.versionId} 
                                className="group rounded-lg border border-zoru-line bg-zoru-ink/20 hover:bg-zoru-ink/30 p-3 transition-colors flex flex-col gap-1 text-left relative"
                            >
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-semibold text-zoru-ink-muted">
                                        Snapshot #{history.length - idx}
                                    </span>
                                    <span className="text-[9px] text-zoru-ink-subtle">
                                        {fmtVerTime(ver.timestamp)}
                                    </span>
                                </div>
                                <p className="text-xs text-zoru-ink font-medium mt-0.5">{ver.description}</p>
                                <p className="text-[9px] text-zoru-ink-muted">
                                    {fmtVerDate(ver.timestamp)}
                                </p>
                                
                                <div className="mt-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[10px] px-2 bg-zoru-ink border-zoru-line flex-1 hover:text-zoru-ink-muted gap-1"
                                        onClick={() => setSelectedVersion(ver)}
                                    >
                                        <Eye className="h-2.5 w-2.5" /> Compare Diff
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[10px] px-2 bg-zoru-ink border-zoru-line flex-1 hover:text-zoru-ink-muted gap-1"
                                        onClick={() => handleRestoreClick(ver)}
                                    >
                                        <RotateCcw className="h-2.5 w-2.5" /> Restore
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-zoru-line bg-zoru-ink/10 p-6 text-center text-xs text-zoru-ink-muted">
                        <History className="h-8 w-8 text-zoru-ink mb-2" strokeWidth={1} />
                        No snapshot snapshots saved yet. Press "Save Changes" inside the designer toolbar to trigger your first version save.
                    </div>
                )}
            </div>
        </div>
    );
}

'use client';

import * as React from 'react';
import { History, RotateCcw, Eye, ArrowLeft, CheckCircle2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/zoruui';

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
            <div className="flex flex-col gap-0.5 font-mono text-[10px] leading-normal bg-slate-950 p-3 rounded-lg overflow-x-auto border border-slate-800 text-left">
                {oldLines.map((line, idx) => {
                    const isDifferent = newLines[idx] !== line;
                    return (
                        <div 
                            key={idx} 
                            className={isDifferent ? "bg-red-950/40 text-red-300 px-1 border-l-2 border-red-500" : "text-slate-400 px-1"}
                        >
                            <span className="inline-block w-6 text-slate-600 select-none">{idx + 1}</span>
                            {line || ' '}
                        </div>
                    );
                })}
                {newLines.slice(oldLines.length).map((line, idx) => (
                    <div key={idx + oldLines.length} className="bg-green-950/40 text-green-300 px-1 border-l-2 border-green-500">
                        <span className="inline-block w-6 text-slate-600 select-none">{idx + oldLines.length + 1}</span>
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
                        className="h-7 w-7 p-0 bg-slate-950 border-slate-800"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                    </Button>
                    <div>
                        <h3 className="font-semibold text-sm">Compare Snapshot</h3>
                        <p className="text-[10px] text-zoru-ink-muted">
                            {new Date(selectedVersion.timestamp).toLocaleString()}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col gap-3">
                    <div className="rounded-lg bg-slate-900/40 border border-slate-800 p-3 flex flex-col gap-1">
                        <span className="text-[10px] text-zoru-ink-muted uppercase font-semibold">Change Description</span>
                        <p className="text-xs font-medium text-slate-200">{selectedVersion.description}</p>
                        {selectedVersion.subject && (
                            <p className="text-[11px] mt-1 font-mono text-indigo-300">
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

                <div className="border-t border-slate-800/80 pt-3 flex gap-2">
                    <Button 
                        variant="outline" 
                        className="flex-1 text-xs h-8.5 bg-slate-950 border-slate-800" 
                        onClick={() => setSelectedVersion(null)}
                    >
                        Cancel
                    </Button>
                    <Button 
                        className="flex-1 text-xs h-8.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white gap-1.5 font-medium"
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
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600/20 text-blue-400">
                    <History className="h-4.5 w-4.5" />
                </div>
                <div>
                    <h3 className="font-semibold text-sm">Version History</h3>
                    <p className="text-[11px] text-zoru-ink-muted">Inspect and restore automated snapshots</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
                {/* Active version */}
                <div className="rounded-lg border-2 border-blue-500 bg-blue-950/15 p-3 flex flex-col gap-1">
                    <div className="flex justify-between items-start">
                        <Badge variant="outline" className="border-blue-500/30 bg-blue-950 text-blue-400 text-[9px] font-semibold h-4 px-1.5">
                            ACTIVE CURRENT
                        </Badge>
                        <span className="text-[9px] text-blue-400/80 font-mono">Live Session</span>
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
                                className="group rounded-lg border border-slate-800 bg-slate-950/20 hover:bg-slate-900/30 p-3 transition-colors flex flex-col gap-1 text-left relative"
                            >
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-semibold text-slate-300">
                                        Snapshot #{history.length - idx}
                                    </span>
                                    <span className="text-[9px] text-zoru-ink-subtle">
                                        {new Date(ver.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-xs text-zoru-ink font-medium mt-0.5">{ver.description}</p>
                                <p className="text-[9px] text-zoru-ink-muted">
                                    {new Date(ver.timestamp).toLocaleDateString()}
                                </p>
                                
                                <div className="mt-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[10px] px-2 bg-slate-950 border-slate-800 flex-1 hover:text-blue-400 gap-1"
                                        onClick={() => setSelectedVersion(ver)}
                                    >
                                        <Eye className="h-2.5 w-2.5" /> Compare Diff
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[10px] px-2 bg-slate-950 border-slate-800 flex-1 hover:text-green-400 gap-1"
                                        onClick={() => handleRestoreClick(ver)}
                                    >
                                        <RotateCcw className="h-2.5 w-2.5" /> Restore
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950/10 p-6 text-center text-xs text-zoru-ink-muted">
                        <History className="h-8 w-8 text-slate-800 mb-2" strokeWidth={1} />
                        No snapshot snapshots saved yet. Press "Save Changes" inside the designer toolbar to trigger your first version save.
                    </div>
                )}
            </div>
        </div>
    );
}

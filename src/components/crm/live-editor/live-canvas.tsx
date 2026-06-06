'use client';

import React, { useRef, useEffect } from 'react';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui/compat';

interface LiveCanvasProps {
    docState: any;
    updateDocState: (patch: any) => void;
    documentType: string;
}

export function LiveCanvas({ docState, updateDocState, documentType }: LiveCanvasProps) {
    const { designMetadata } = docState;

    // Apply layout styles based on metadata
    const paddingMap = {
        small: 'p-4',
        normal: 'p-8 sm:p-12',
        large: 'p-12 sm:p-20'
    };

    const containerPadding = paddingMap[designMetadata.marginSize as keyof typeof paddingMap] || paddingMap.normal;

    const fontMap = {
        'Inter': 'font-sans',
        'Roboto': 'font-sans',
        'Merriweather': 'font-serif',
        'Fira Code': 'font-mono'
    };
    
    const fontClass = fontMap[designMetadata.fontFamily as keyof typeof fontMap] || 'font-sans';

    const addSection = () => {
        updateDocState({
            sections: [...docState.sections, { heading: 'New Section', body: 'Start typing here...' }]
        });
    };

    const updateSection = (idx: number, patch: any) => {
        const newSections = [...docState.sections];
        newSections[idx] = { ...newSections[idx], ...patch };
        updateDocState({ sections: newSections });
    };

    const removeSection = (idx: number) => {
        if (docState.sections.length === 1) return;
        updateDocState({
            sections: docState.sections.filter((_: any, i: number) => i !== idx)
        });
    };

    return (
        <div 
            className={`w-full max-w-[800px] min-h-[1056px] bg-white shadow-lg ring-1 ring-zoru-line ${containerPadding} ${fontClass} transition-all duration-300 relative`}
            style={{ 
                fontFamily: designMetadata.fontFamily !== 'Inter' ? `"${designMetadata.fontFamily}", sans-serif` : undefined,
            }}
        >
            {/* Custom CSS Injection */}
            {designMetadata.customCss && (
                <style dangerouslySetInnerHTML={{ __html: designMetadata.customCss }} />
            )}

            {/* Document Header */}
            <div className={`flex items-start justify-between border-b pb-8 mb-8 border-opacity-30`} style={{ borderColor: designMetadata.themeColor }}>
                <div className="flex-1 space-y-4">
                    {designMetadata.showLogo && (
                        <div className="h-12 w-32 bg-zoru-surface-2 flex items-center justify-center rounded text-xs text-zoru-ink-muted">
                            Company Logo
                        </div>
                    )}
                    
                    {/* Live Title Editor */}
                    <input 
                        type="text"
                        value={docState.title}
                        onChange={(e) => updateDocState({ title: e.target.value })}
                        className="text-4xl font-bold bg-transparent outline-none w-full hover:bg-zoru-surface-2 transition-colors placeholder:text-zoru-ink-muted"
                        placeholder="Document Title"
                        style={{ color: designMetadata.themeColor }}
                    />
                    
                    <div className="text-sm text-zoru-ink uppercase tracking-widest">
                        {documentType} 
                        {docState.status && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-zoru-surface-2">{docState.status}</span>}
                    </div>
                </div>
                
                <div className="text-right space-y-1 text-sm text-zoru-ink">
                    <div><span className="font-semibold text-zoru-ink">Total Amount:</span> {docState.currency} <input type="number" value={docState.totalAmount} onChange={(e) => updateDocState({ totalAmount: Number(e.target.value) })} className="w-24 text-right bg-transparent outline-none hover:bg-zoru-surface-2 p-1 rounded" /></div>
                    {docState.validUntil && <div><span className="font-semibold text-zoru-ink">Valid Until:</span> {new Date(docState.validUntil).toLocaleDateString()}</div>}
                </div>
            </div>

            {/* Sections / Blocks */}
            <div className="space-y-8">
                {docState.sections.map((section: any, idx: number) => (
                    <div key={idx} className="group relative">
                        {/* WYSIWYG Editable Heading */}
                        <input 
                            value={section.heading}
                            onChange={(e) => updateSection(idx, { heading: e.target.value })}
                            placeholder="Section Heading"
                            className="text-xl font-semibold mb-3 w-full bg-transparent outline-none hover:bg-zoru-surface-2 p-1 -ml-1 rounded transition-colors"
                            style={{ color: designMetadata.themeColor }}
                        />
                        
                        {/* WYSIWYG Editable Body (using text area for now, could be rich text later) */}
                        <textarea
                            value={section.body}
                            onChange={(e) => updateSection(idx, { body: e.target.value })}
                            placeholder="Enter section content here. Markdown is supported."
                            className="w-full min-h-[100px] text-zoru-ink leading-relaxed bg-transparent outline-none hover:bg-zoru-surface-2 p-1 -ml-1 rounded transition-colors resize-none overflow-hidden"
                            onInput={(e) => {
                                // Auto-resize
                                e.currentTarget.style.height = 'auto';
                                e.currentTarget.style.height = (e.currentTarget.scrollHeight) + 'px';
                            }}
                        />

                        {/* Hover actions for blocks */}
                        <div className="absolute -left-12 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-zoru-ink-muted hover:text-zoru-ink cursor-move">
                                <GripVertical className="h-4 w-4" />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-zoru-ink-muted hover:text-zoru-ink"
                                onClick={() => removeSection(idx)}
                                disabled={docState.sections.length === 1}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add block trigger */}
            <div className="mt-8 pt-4 border-t border-dashed border-zoru-line text-center">
                <Button variant="outline" size="sm" onClick={addSection} className="text-zoru-ink">
                    <Plus className="mr-2 h-4 w-4" /> Add Section
                </Button>
            </div>

            {/* Footer */}
            <div className="absolute bottom-12 left-12 right-12 text-center text-xs text-zoru-ink-muted border-t pt-4">
                Generated dynamically via Sabnode Live Editor
            </div>
        </div>
    );
}

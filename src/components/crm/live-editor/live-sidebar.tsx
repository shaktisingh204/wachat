'use client';

import React, { useState } from 'react';
import { Label, Input, Textarea, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/zoruui';
import { ChevronDown, ChevronRight, Palette, Layout, Settings, Blocks, Type, FileCode } from 'lucide-react';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { Paperclip, X } from 'lucide-react';
import { Button } from '@/components/zoruui';

interface LiveSidebarProps {
    docState: any;
    updateDocState: (patch: any) => void;
    updateDesignMetadata: (patch: any) => void;
    documentType: string;
}

function Accordion({ title, icon: Icon, children, defaultOpen = false }: { title: string, icon: any, children: React.ReactNode, defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-zoru-line">
            <button 
                className="flex w-full items-center justify-between px-4 py-3 hover:bg-zoru-surface-2"
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <div className="flex items-center gap-2 text-sm font-medium text-zoru-ink">
                    <Icon className="h-4 w-4 text-zoru-ink-muted" />
                    {title}
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4 text-zoru-ink-muted" /> : <ChevronRight className="h-4 w-4 text-zoru-ink-muted" />}
            </button>
            {isOpen && (
                <div className="px-4 pb-4 pt-1">
                    {children}
                </div>
            )}
        </div>
    );
}

export function LiveSidebar({ docState, updateDocState, updateDesignMetadata, documentType }: LiveSidebarProps) {
    const { designMetadata } = docState;

    const handleAttachmentPick = (pick: SabFilePick) => {
        updateDocState({
            attachments: [...docState.attachments, { url: pick.url, name: pick.name || pick.url }]
        });
    };

    const removeAttachment = (idx: number) => {
        updateDocState({
            attachments: docState.attachments.filter((_: any, i: number) => i !== idx)
        });
    };

    return (
        <div className="flex h-full flex-col overflow-y-auto">
            <div className="p-4 border-b border-zoru-line">
                <h2 className="text-sm font-semibold text-zoru-ink">Document Customization</h2>
                <p className="text-xs text-zoru-ink-muted">Configure your live document</p>
            </div>

            <Accordion title="Document Settings" icon={Settings} defaultOpen>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            enumName={`${documentType}Status`}
                            name="status"
                            initialId={docState.status}
                            onChange={(v) => updateDocState({ status: v || 'draft' })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Client / Account</Label>
                        <EntityFormField
                            entity="account"
                            name="accountId"
                            initialId={docState.accountId}
                            onChange={(v) => updateDocState({ accountId: v })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Currency</Label>
                        <EnumFormField
                            enumName="currency"
                            name="currency"
                            initialId={docState.currency}
                            onChange={(v) => updateDocState({ currency: v || 'INR' })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Valid Until / Due Date</Label>
                        <Input
                            type="date"
                            value={docState.validUntil ? new Date(docState.validUntil).toISOString().split('T')[0] : ''}
                            onChange={(e) => updateDocState({ validUntil: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                        />
                    </div>
                </div>
            </Accordion>

            <Accordion title="Branding & Colors" icon={Palette}>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Theme Color</Label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="color" 
                                value={designMetadata.themeColor} 
                                onChange={(e) => updateDesignMetadata({ themeColor: e.target.value })}
                                className="h-8 w-8 cursor-pointer rounded border-none p-0"
                            />
                            <Input 
                                value={designMetadata.themeColor} 
                                onChange={(e) => updateDesignMetadata({ themeColor: e.target.value })}
                                className="flex-1 font-mono text-xs"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Show Logo</Label>
                        <div className="flex items-center gap-2 mt-1">
                            <input 
                                type="checkbox" 
                                checked={designMetadata.showLogo}
                                onChange={(e) => updateDesignMetadata({ showLogo: e.target.checked })}
                                className="h-4 w-4 rounded border-zoru-line text-zoru-primary focus:ring-zoru-primary"
                            />
                            <span className="text-sm text-zoru-ink">Display company logo in header</span>
                        </div>
                    </div>
                </div>
            </Accordion>

            <Accordion title="Typography" icon={Type}>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Font Family</Label>
                        <Select
                            value={designMetadata.fontFamily}
                            onValueChange={(value) => updateDesignMetadata({ fontFamily: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select font" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Inter">Inter (Sans Serif)</SelectItem>
                                <SelectItem value="Roboto">Roboto</SelectItem>
                                <SelectItem value="Merriweather">Merriweather (Serif)</SelectItem>
                                <SelectItem value="Fira Code">Fira Code (Monospace)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Accordion>

            <Accordion title="Layout Structure" icon={Layout}>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Template Style</Label>
                        <Select
                            value={designMetadata.layoutStyle}
                            onValueChange={(value) => updateDesignMetadata({ layoutStyle: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select layout" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="modern">Modern (Clean, generous spacing)</SelectItem>
                                <SelectItem value="classic">Classic (Traditional invoice look)</SelectItem>
                                <SelectItem value="minimal">Minimal (Bare bones, content focus)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Margins</Label>
                        <Select
                            value={designMetadata.marginSize}
                            onValueChange={(value) => updateDesignMetadata({ marginSize: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select margin" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="small">Small (Compact)</SelectItem>
                                <SelectItem value="normal">Normal (Standard A4)</SelectItem>
                                <SelectItem value="large">Large (Spacious)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Accordion>

            <Accordion title="Attachments" icon={Paperclip}>
                <div className="space-y-2">
                    <SabFilePickerButton
                        accept="any"
                        onPick={handleAttachmentPick}
                        title="Attach a file from SabFiles"
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                    >
                        <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                        Add from SabFiles
                    </SabFilePickerButton>
                    
                    {docState.attachments.length > 0 && (
                        <ul className="flex flex-col gap-1.5 mt-2">
                            {docState.attachments.map((a: any, idx: number) => (
                                <li key={idx} className="flex items-center gap-2 rounded border border-zoru-line bg-zoru-surface-2 px-2 py-1">
                                    <span className="min-w-0 flex-1 truncate text-xs text-zoru-ink">{a.name}</span>
                                    <Button variant="ghost" size="icon" onClick={() => removeAttachment(idx)} className="h-5 w-5">
                                        <X className="h-3 w-3" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Accordion>
            
            <Accordion title="Advanced CSS" icon={FileCode}>
                <div className="space-y-1.5">
                    <Label>Custom CSS Injections</Label>
                    <Textarea 
                        placeholder=".custom-header { ... }" 
                        className="font-mono text-xs" 
                        rows={6}
                        value={designMetadata.customCss || ''}
                        onChange={(e) => updateDesignMetadata({ customCss: e.target.value })}
                    />
                </div>
            </Accordion>
        </div>
    );
}

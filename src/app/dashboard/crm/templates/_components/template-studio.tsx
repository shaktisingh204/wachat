'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    Sparkles,
    LoaderCircle,
    Save,
    ChevronLeft,
    Monitor,
    Tablet,
    Smartphone,
    Layers,
    Type,
    Smile,
    History,
    Eye,
    Code,
    Plus,
    Trash2,
    ArrowUp,
    ArrowDown,
    Download,
    Upload,
    Palette,
    Link as LinkIcon,
    AlertCircle,
    Check,
    HelpCircle,
    RefreshCw
} from 'lucide-react';

import {
    Button,
    Input,
    Label,
    Textarea,
    Select,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruSelectContent,
    ZoruSelectItem,
    Badge,
    Switch,
    useZoruToast,
    ZoruColorPicker,
    Tooltip,
    ZoruTooltipTrigger,
    ZoruTooltipContent,
    ZoruTooltipProvider
} from '@/components/zoruui';

import { cn } from '@/components/zoruui/lib/cn';
import { AiCopilotPanel } from './ai-copilot-panel';
import { VersionHistoryPanel } from './version-history-panel';
import {
    saveCrmTemplate,
    compileCrmTemplate,
    type UnifiedTemplate
} from '@/app/actions/crm-templates.actions';
import { CRM_STUDIO_VARIABLES } from '@/data/reference/crm-template-variables';

import DOMPurify from 'dompurify';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableEmailBlock({ block, isActive, onSelect, onMove, onDelete, index, total, themeColor, fontFamily }: any) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });
    
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onSelect}
            className={cn(
                "group relative border rounded-lg p-2 transition-all cursor-pointer",
                isActive 
                    ? "border-zoru-line bg-zoru-ink/10 shadow-lg" 
                    : "border-zoru-line/80 bg-zoru-ink/20 hover:border-zoru-line/80 hover:bg-zoru-ink/10"
            )}
        >
            <div className="absolute left-2 top-3 z-20 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-zoru-ink hover:text-zoru-ink-muted" {...attributes} {...listeners}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01"/></svg>
            </div>
            
            <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button 
                    onClick={(e) => { e.stopPropagation(); onMove(index, 'up', e); }}
                    disabled={index === 0}
                    className="p-1 rounded bg-zoru-ink border border-zoru-line hover:border-zoru-line disabled:opacity-30 disabled:pointer-events-none text-zoru-ink-muted hover:text-white"
                >
                    <ArrowUp className="h-3 w-3" />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onMove(index, 'down', e); }}
                    disabled={index === total - 1}
                    className="p-1 rounded bg-zoru-ink border border-zoru-line hover:border-zoru-line disabled:opacity-30 disabled:pointer-events-none text-zoru-ink-muted hover:text-white"
                >
                    <ArrowDown className="h-3 w-3" />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(block.id, e); }}
                    className="p-1 rounded bg-zoru-ink border border-zoru-line text-zoru-ink hover:bg-zoru-ink/20"
                >
                    <Trash2 className="h-3 w-3" />
                </button>
            </div>

            <div className="pl-6">
                {block.type === 'header' && (
                    <h1 className="text-xl font-bold tracking-tight text-white pr-16" style={{ fontFamily: fontFamily, color: themeColor }}>
                        {block.content.title}
                    </h1>
                )}

                {block.type === 'text' && (
                    <p className="text-xs text-zoru-ink-muted leading-relaxed whitespace-pre-wrap pr-16" style={{ fontFamily: fontFamily }}>
                        {block.content.html}
                    </p>
                )}

                {block.type === 'button' && (
                    <div className="py-2" style={{ textAlign: block.style?.align || 'center' }}>
                        <span 
                            className="inline-block px-4 py-2 text-xs font-semibold rounded-md shadow text-white" 
                            style={{ backgroundColor: themeColor, fontFamily: fontFamily }}
                        >
                            {block.content.text}
                        </span>
                    </div>
                )}

                {block.type === 'divider' && (
                    <hr className="border-t border-zoru-line my-2" />
                )}

                {block.type === 'footer' && (
                    <div className="text-[10px] text-zoru-ink font-mono whitespace-pre-wrap mt-2 pr-16" style={{ fontFamily: fontFamily }}>
                        {block.content.signature}
                    </div>
                )}

                <span className="absolute left-6 bottom-1 text-[8px] uppercase text-zoru-ink font-mono tracking-wider font-semibold pointer-events-none opacity-40">
                    {block.type} component
                </span>
            </div>
        </div>
    );
}
interface TemplateStudioProps {
    initialTemplate?: UnifiedTemplate | null;
}

type ViewportMode = 'desktop' | 'tablet' | 'mobile';
type CreatorTab = 'blocks' | 'placeholders' | 'starters';

export function TemplateStudio({ initialTemplate }: TemplateStudioProps): React.JSX.Element {
    const { toast } = useZoruToast();
    const router = useRouter();
    const [saving, setSaving] = React.useState(false);
    
    // Core state
    const [templateId, setTemplateId] = React.useState(initialTemplate?._id?.toString() || '');
    const [name, setName] = React.useState(initialTemplate?.name || 'Vibrant Sales Campaign');
    const [type, setType] = React.useState<'email' | 'sms' | 'whatsapp' | 'document'>(initialTemplate?.type || 'email');
    const [subject, setSubject] = React.useState(initialTemplate?.subject || '');
    const [content, setContent] = React.useState(initialTemplate?.content || '');
    const [themeColor, setThemeColor] = React.useState(initialTemplate?.themeColor || '#2563EB');
    const [fontFamily, setFontFamily] = React.useState(initialTemplate?.fontFamily || 'Inter');
    const [status, setStatus] = React.useState<'active' | 'archived'>(initialTemplate?.status || 'active');
    
    // WhatsApp specific
    const [whatsappConfig, setWhatsappConfig] = React.useState(
        initialTemplate?.whatsappConfig || {
            headerType: 'text',
            headerText: 'IMPORTANT ANNOUNCEMENT',
            footerText: 'Powered by SabNode CRM',
            buttons: [{ type: 'quick_reply', text: 'Opt In' }]
        }
    );

    // Document PDF specific
    const [documentConfig, setDocumentConfig] = React.useState(
        initialTemplate?.documentConfig || {
            margins: 'normal',
            showSignature: true,
            showItemsTable: true,
            footerTerms: 'All pricing quotation values are exclusive of statutory GST charges.'
        }
    );

    // Email blocks dynamic structure builder
    const [emailConfig, setEmailConfig] = React.useState(
        initialTemplate?.emailConfig || {
            blocks: [
                { id: 'h1', type: 'header', content: { title: 'Welcome to SabNode Platform!' }, style: { padding: '24px', align: 'center' } },
                { id: 't1', type: 'text', content: { html: 'Hello {{contact.first_name}},\n\nWe are absolutely delighted to welcome you and the team at {{company.name}} to our visual templates studio!' }, style: { padding: '16px' } },
                { id: 'b1', type: 'button', content: { text: 'Access Workspace Portal', url: 'https://sabnode.com/dashboard' }, style: { padding: '20px', align: 'center' } },
                { id: 'f1', type: 'footer', content: { signature: 'Best regards,\n{{company.signature}}' }, style: { padding: '24px' } }
            ]
        }
    );

    // Active block index selected inside right inspector
    const [activeBlockId, setActiveBlockId] = React.useState<string | null>(null);

    // Dynamic views & layout selectors
    const [viewportMode, setViewportMode] = React.useState<ViewportMode>('desktop');
    const [leftTab, setLeftTab] = React.useState<CreatorTab>('blocks');
    const [showAiCopilot, setShowAiCopilot] = React.useState(false);
    const [showHistory, setShowHistory] = React.useState(false);
    const [compilePreview, setCompilePreview] = React.useState(false);
    const [compiledHtml, setCompiledHtml] = React.useState('');
    const [compiledText, setCompiledText] = React.useState('');
    const [history, setHistory] = React.useState<any[]>(initialTemplate?.versionHistory || []);

    // Current focused textarea / input ref reference to insert merge tags
    const activeInputRef = React.useRef<any>(null);
    const [lastFocusedField, setLastFocusedField] = React.useState<'subject' | 'body' | 'whatsappHeader' | 'whatsappBody' | 'whatsappFooter' | 'docTerms'>('body');

    // Live dynamic variable compilation hook
    React.useEffect(() => {
        let textToCompile = '';
        if (type === 'email') {
            // Build raw html from blocks
            textToCompile = emailConfig.blocks.map(b => {
                if (b.type === 'header') return `<h1 style="color: ${themeColor}; text-align: ${b.style?.align || 'left'}; margin: 0; padding: ${b.style?.padding || '12px'}; font-family: ${fontFamily};">${b.content.title}</h1>`;
                if (b.type === 'text') return `<div style="color: #cbd5e1; font-family: ${fontFamily}; line-height: 1.6; padding: ${b.style?.padding || '12px'}; white-space: pre-line;">${b.content.html}</div>`;
                if (b.type === 'button') return `<div style="text-align: ${b.style?.align || 'center'}; padding: ${b.style?.padding || '12px'};"><a href="${b.content.url}" style="display: inline-block; background-color: ${themeColor}; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-family: ${fontFamily}; font-weight: 600;">${b.content.text}</a></div>`;
                if (b.type === 'divider') return `<hr style="border: 0; border-top: 1px solid #334155; margin: 16px 0;"/>`;
                if (b.type === 'footer') return `<div style="color: #64748b; font-size: 12px; font-family: ${fontFamily}; padding: ${b.style?.padding || '12px'}; border-t: 1px solid #334155; white-space: pre-line;">${b.content.signature}</div>`;
                return '';
            }).join('\n');
            setContent(textToCompile);
        } else if (type === 'document') {
            textToCompile = content || JSON.stringify({
                companyName: '{{company.name}}',
                recipientName: '{{contact.first_name}} {{contact.last_name}}',
                quoteNumber: 'QT-2026-908',
                amount: '{{deal.amount}}',
                items: [
                    { desc: 'Cloud migration architect planning & setup', rate: '₹3,50,000', qty: '1' },
                    { desc: 'Core server deployment & Node clusters configuration', rate: '₹9,00,000', qty: '1' }
                ],
                terms: documentConfig.footerTerms || ''
            });
        } else {
            textToCompile = content;
        }

        if (compilePreview) {
            compileCrmTemplate(textToCompile, {}).then(res => {
                if (type === 'email') setCompiledHtml(res);
                else setCompiledText(res);
            });
        }
    }, [compilePreview, content, emailConfig, type, fontFamily, themeColor, whatsappConfig, documentConfig]);

    // Insert merge tag placeholder directly at cursor
    const handleInsertPlaceholder = (placeholderKey: string) => {
        const token = `{{${placeholderKey}}}`;
        
        if (type === 'email' && emailConfig.blocks.length > 0) {
            // Find active block or fallback to first text block
            const targetId = activeBlockId || emailConfig.blocks.find(b => b.type === 'text')?.id;
            if (targetId) {
                setEmailConfig(prev => {
                    const next = [...prev.blocks];
                    const idx = next.findIndex(b => b.id === targetId);
                    if (idx !== -1) {
                        if (next[idx].type === 'text') {
                            next[idx] = {
                                ...next[idx],
                                content: {
                                    ...next[idx].content,
                                    html: (next[idx].content.html || '') + token
                                }
                            };
                        } else if (next[idx].type === 'header') {
                            next[idx] = {
                                ...next[idx],
                                content: {
                                    ...next[idx].content,
                                    title: (next[idx].content.title || '') + token
                                }
                            };
                        } else if (next[idx].type === 'footer') {
                            next[idx] = {
                                ...next[idx],
                                content: {
                                    ...next[idx].content,
                                    signature: (next[idx].content.signature || '') + token
                                }
                            };
                        }
                    }
                    return { blocks: next };
                });
                toast({ title: 'Tag inserted', description: `Added ${token} into active element.` });
                return;
            }
        }

        // Fallback or text-based fields
        if (lastFocusedField === 'subject') {
            setSubject(prev => prev + token);
        } else if (lastFocusedField === 'whatsappHeader') {
            setWhatsappConfig(prev => ({ ...prev, headerText: (prev.headerText || '') + token }));
        } else if (lastFocusedField === 'whatsappFooter') {
            setWhatsappConfig(prev => ({ ...prev, footerText: (prev.footerText || '') + token }));
        } else if (lastFocusedField === 'docTerms') {
            setDocumentConfig(prev => ({ ...prev, footerTerms: (prev.footerTerms || '') + token }));
        } else {
            setContent(prev => prev + token);
        }
        
        toast({ title: 'Tag inserted', description: `Added ${token} at cursor position.` });
    };

    // AI Optimize content insert callback
    const handleInsertAiText = (aiText: string) => {
        if (type === 'email') {
            // Find active text block and append
            const targetId = activeBlockId || emailConfig.blocks.find(b => b.type === 'text')?.id || 't1';
            setEmailConfig(prev => {
                const next = [...prev.blocks];
                const idx = next.findIndex(b => b.id === targetId);
                if (idx !== -1 && next[idx].type === 'text') {
                    next[idx] = {
                        ...next[idx],
                        content: {
                            ...next[idx].content,
                            html: aiText
                        }
                    };
                }
                return { blocks: next };
            });
        } else {
            setContent(aiText);
        }
        toast({ title: 'Copy optimization injected', description: 'Content successfully populated.' });
    };

    // Add structural block into email/pdf layout
    const handleAddBlock = (blockType: 'header' | 'text' | 'image' | 'button' | 'divider' | 'footer') => {
        const id = Math.random().toString(36).substring(2, 9);
        let blockContent = {};
        
        if (blockType === 'header') blockContent = { title: 'New Structural Section' };
        else if (blockType === 'text') blockContent = { html: 'Insert beautiful customizable text here...' };
        else if (blockType === 'button') blockContent = { text: 'Click Here Now', url: 'https://sabnode.com' };
        else if (blockType === 'footer') blockContent = { signature: '{{company.signature}}' };

        const newBlock = {
            id,
            type: blockType,
            content: blockContent,
            style: { padding: '16px', align: blockType === 'button' ? 'center' : 'left' }
        };

        setEmailConfig(prev => ({
            blocks: [...prev.blocks, newBlock]
        }));
        setActiveBlockId(id);
    };

    // Remove block
    const handleDeleteBlock = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEmailConfig(prev => ({
            blocks: prev.blocks.filter(b => b.id !== id)
        }));
        if (activeBlockId === id) setActiveBlockId(null);
    };

    // Move blocks up / down
    const handleMoveBlock = (index: number, direction: 'up' | 'down', e: React.MouseEvent) => {
        e.stopPropagation();
        const nextBlocks = [...emailConfig.blocks];
        const targetIdx = direction === 'up' ? index - 1 : index + 1;
        if (targetIdx < 0 || targetIdx >= nextBlocks.length) return;
        
        // Swap
        const temp = nextBlocks[index];
        nextBlocks[index] = nextBlocks[targetIdx];
        nextBlocks[targetIdx] = temp;
        
        setEmailConfig({ blocks: nextBlocks });
    };

    // Theme preset starter loader
    const handleLoadStarter = (starterKey: 'gradient' | 'minimal' | 'bold') => {
        if (starterKey === 'gradient') {
            setThemeColor('#A855F7'); // HSL purple
            setFontFamily('Outfit');
            if (type === 'email') {
                setEmailConfig({
                    blocks: [
                        { id: 's1', type: 'header', content: { title: 'Premium Cloud Automation Unleashed' }, style: { padding: '30px', align: 'center' } },
                        { id: 's2', type: 'text', content: { html: 'Hello {{contact.first_name}},\n\nGet ready to experience the next evolution in CRM pipeline synchronization. Visual template studio integrates perfectly in real-time.' }, style: { padding: '20px' } },
                        { id: 's3', type: 'button', content: { text: 'Launch Studio Platform', url: 'https://sabnode.com' }, style: { padding: '24px', align: 'center' } }
                    ]
                });
            }
        } else if (starterKey === 'minimal') {
            setThemeColor('#0F172A'); // Dark slate
            setFontFamily('Inter');
        }
        toast({ title: 'Theme injected', description: `${starterKey} design preset successfully loaded.` });
    };

    // Version history rollback execution
    const handleVersionRestore = (restoredContent: string, restoredSubject?: string, versionObj?: any) => {
        setContent(restoredContent);
        if (restoredSubject) setSubject(restoredSubject);
        if (versionObj?.emailConfig) setEmailConfig(versionObj.emailConfig);
        if (versionObj?.whatsappConfig) setWhatsappConfig(versionObj.whatsappConfig);
        if (versionObj?.documentConfig) setDocumentConfig(versionObj.documentConfig);
        toast({ title: 'Rollback complete', description: 'Snapshot successfully restored into designer.' });
    };

    // Export template configuration JSON
    const handleExportJson = () => {
        const fullConfig = {
            name,
            type,
            subject,
            content,
            themeColor,
            fontFamily,
            whatsappConfig,
            documentConfig,
            emailConfig
        };
        const blob = new Blob([JSON.stringify(fullConfig, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${name.toLowerCase().replace(/\s+/g, '_')}_template.json`;
        link.click();
        toast({ title: 'Export success', description: 'JSON template schema downloaded.' });
    };

    // Import template configuration JSON
    const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (parsed.name) setName(parsed.name);
                if (parsed.type) setType(parsed.type);
                if (parsed.subject) setSubject(parsed.subject);
                if (parsed.content) setContent(parsed.content);
                if (parsed.themeColor) setThemeColor(parsed.themeColor);
                if (parsed.fontFamily) setFontFamily(parsed.fontFamily);
                if (parsed.whatsappConfig) setWhatsappConfig(parsed.whatsappConfig);
                if (parsed.documentConfig) setDocumentConfig(parsed.documentConfig);
                if (parsed.emailConfig) setEmailConfig(parsed.emailConfig);
                
                toast({ title: 'Import success', description: 'Template configuration loaded successfully.' });
            } catch (err) {
                toast({ title: 'Import failed', description: 'Invalid JSON template schema file.', variant: 'destructive' });
            }
        };
        reader.readAsText(file);
    };

    // Save Template Database execution
    const handleSaveTemplate = async () => {
        setSaving(true);
        
        // Add active state to history snapshot array
        const snapId = Math.random().toString(36).substring(2, 9);
        const newHistory = [
            {
                versionId: snapId,
                timestamp: new Date(),
                content: content,
                subject: subject,
                description: `Manual update of ${name} details`,
                emailConfig: emailConfig,
                whatsappConfig: whatsappConfig,
                documentConfig: documentConfig
            },
            ...history
        ];

        const payload: Partial<UnifiedTemplate> = {
            name,
            type,
            subject,
            content,
            themeColor,
            fontFamily,
            status,
            whatsappConfig,
            documentConfig,
            emailConfig,
            versionHistory: newHistory
        };

        if (templateId) {
            payload._id = templateId;
        }

        const res = await saveCrmTemplate(payload);
        if (res.ok) {
            setTemplateId(res.id || '');
            setHistory(newHistory);
            toast({ title: 'Template saved successfully', description: 'Global workspace synced.' });
            router.refresh();
        } else {
            toast({ title: 'Save failed', description: res.error || 'Server rejected request.', variant: 'destructive' });
        }
        setSaving(false);
    };

    const activeBlock = emailConfig.blocks.find(b => b.id === activeBlockId);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        
        setEmailConfig(prev => {
            const oldIndex = prev.blocks.findIndex(b => b.id === active.id);
            const newIndex = prev.blocks.findIndex(b => b.id === over.id);
            return { blocks: arrayMove(prev.blocks, oldIndex, newIndex) };
        });
    };

    return (
        <div className="flex h-screen w-full flex-col bg-zoru-ink text-zoru-ink-muted overflow-hidden select-none font-sans">
            
            {/* Header Design Panel */}
            <header className="flex h-14 items-center justify-between border-b border-zoru-line/80 bg-zoru-ink/80 backdrop-blur-md px-4 shrink-0 z-30">
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        onClick={() => router.push('/dashboard/crm/templates')}
                        className="h-8.5 px-2 bg-zoru-ink border-zoru-line hover:bg-zoru-ink"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" /> Studio
                    </Button>
                    <div className="flex items-center gap-2">
                        <Input 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            className="h-8.5 w-[220px] bg-zoru-ink border-zoru-line focus:border-zoru-line font-semibold text-sm px-2 text-white" 
                        />
                        <Badge variant="secondary" className="bg-zoru-ink border-zoru-line/30 text-zoru-ink-muted capitalize text-[10px]">
                            {type} Designer
                        </Badge>
                    </div>
                </div>

                {/* Viewport controls with glassmorphism */}
                <div className="hidden sm:flex items-center bg-zoru-ink/60 border border-zoru-line/80 rounded-lg p-0.5">
                    <button
                        onClick={() => setViewportMode('desktop')}
                        className={cn("p-1.5 rounded transition-all", viewportMode === 'desktop' ? "bg-zoru-ink text-white shadow" : "text-zoru-ink-muted hover:text-white")}
                        title="Desktop Preview"
                    >
                        <Monitor className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setViewportMode('tablet')}
                        className={cn("p-1.5 rounded transition-all", viewportMode === 'tablet' ? "bg-zoru-ink text-white shadow" : "text-zoru-ink-muted hover:text-white")}
                        title="Tablet Preview"
                    >
                        <Tablet className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setViewportMode('mobile')}
                        className={cn("p-1.5 rounded transition-all", viewportMode === 'mobile' ? "bg-zoru-ink text-white shadow" : "text-zoru-ink-muted hover:text-white")}
                        title="Mobile Preview"
                    >
                        <Smartphone className="h-4 w-4" />
                    </button>
                </div>

                {/* Actions Hub */}
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        onClick={() => setCompilePreview(!compilePreview)}
                        className={cn("h-8.5 text-xs bg-zoru-ink border-zoru-line gap-1.5", compilePreview && "bg-zoru-ink text-zoru-ink-muted border-zoru-line/50")}
                    >
                        <Eye className="h-3.5 w-3.5" /> {compilePreview ? "Edit Mode" : "Preview compiled"}
                    </Button>

                    <Button 
                        variant="outline" 
                        onClick={() => setShowAiCopilot(!showAiCopilot)}
                        className={cn("h-8.5 text-xs bg-zoru-ink border-zoru-line gap-1.5 hover:text-zoru-ink-muted", showAiCopilot && "bg-zoru-ink text-zoru-ink-muted border-zoru-line/50")}
                    >
                        <Sparkles className="h-3.5 w-3.5 animate-pulse text-zoru-ink-muted" /> Copilot
                    </Button>

                    <Button 
                        variant="outline" 
                        onClick={() => setShowHistory(!showHistory)}
                        className={cn("h-8.5 text-xs bg-zoru-ink border-zoru-line gap-1.5 hover:text-zoru-ink-muted", showHistory && "bg-zoru-ink text-zoru-ink-muted border-zoru-line/50")}
                    >
                        <History className="h-3.5 w-3.5 text-zoru-ink-muted" /> History
                    </Button>

                    <Button 
                        onClick={handleSaveTemplate} 
                        disabled={saving}
                        className="h-8.5 bg-zoru-ink hover:bg-zoru-ink text-white text-xs font-semibold gap-1.5 shadow-lg shadow-zoru-line/20"
                    >
                        {saving ? (
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Save className="h-3.5 w-3.5" />
                        )} Save
                    </Button>
                </div>
            </header>

            {/* Layout Panels Grid */}
            <div className="flex flex-1 min-h-0 relative z-10 w-full overflow-hidden">

                {/* Left Side toolbox */}
                <aside className="w-80 border-r border-zoru-line bg-zoru-ink/90 backdrop-blur shrink-0 flex flex-col overflow-hidden">
                    <div className="flex border-b border-zoru-line bg-zoru-ink/40 p-1">
                        <button
                            onClick={() => setLeftTab('blocks')}
                            className={cn("flex-1 text-center py-2 text-[11px] font-semibold uppercase tracking-wider rounded transition-all", leftTab === 'blocks' ? "bg-zoru-ink text-white" : "text-zoru-ink-muted hover:text-white")}
                        >
                            Designer
                        </button>
                        <button
                            onClick={() => setLeftTab('placeholders')}
                            className={cn("flex-1 text-center py-2 text-[11px] font-semibold uppercase tracking-wider rounded transition-all", leftTab === 'placeholders' ? "bg-zoru-ink text-white" : "text-zoru-ink-muted hover:text-white")}
                        >
                            Variables
                        </button>
                        <button
                            onClick={() => setLeftTab('starters')}
                            className={cn("flex-1 text-center py-2 text-[11px] font-semibold uppercase tracking-wider rounded transition-all", leftTab === 'starters' ? "bg-zoru-ink text-white" : "text-zoru-ink-muted hover:text-white")}
                        >
                            Presets
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                        {leftTab === 'blocks' && (
                            <div className="flex flex-col gap-4">
                                {type === 'email' && (
                                    <>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-zoru-ink">Insert Grid Component</span>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button onClick={() => handleAddBlock('header')} className="flex flex-col items-center justify-center p-3 rounded-lg border border-zoru-line hover:border-zoru-line/40 bg-zoru-ink/50 hover:bg-zoru-ink/50 text-zoru-ink-muted hover:text-zoru-ink-muted transition-all gap-1.5">
                                                    <Layers className="h-4 w-4" />
                                                    <span className="text-[10px] font-medium">Header block</span>
                                                </button>
                                                <button onClick={() => handleAddBlock('text')} className="flex flex-col items-center justify-center p-3 rounded-lg border border-zoru-line hover:border-zoru-line/40 bg-zoru-ink/50 hover:bg-zoru-ink/50 text-zoru-ink-muted hover:text-zoru-ink-muted transition-all gap-1.5">
                                                    <Type className="h-4 w-4" />
                                                    <span className="text-[10px] font-medium">Rich Paragraph</span>
                                                </button>
                                                <button onClick={() => handleAddBlock('button')} className="flex flex-col items-center justify-center p-3 rounded-lg border border-zoru-line hover:border-zoru-line/40 bg-zoru-ink/50 hover:bg-zoru-ink/50 text-zoru-ink-muted hover:text-zoru-ink-muted transition-all gap-1.5">
                                                    <LinkIcon className="h-4 w-4" />
                                                    <span className="text-[10px] font-medium">Call to Action</span>
                                                </button>
                                                <button onClick={() => handleAddBlock('divider')} className="flex flex-col items-center justify-center p-3 rounded-lg border border-zoru-line hover:border-zoru-line/40 bg-zoru-ink/50 hover:bg-zoru-ink/50 text-zoru-ink-muted hover:text-zoru-ink-muted transition-all gap-1.5">
                                                    <Plus className="h-4 w-4" />
                                                    <span className="text-[10px] font-medium">Separator line</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5 border-t border-zoru-line/80 pt-3">
                                            <Label htmlFor="email-campaign-subject" className="text-xs font-medium">Campaign Subject Line</Label>
                                            <Input
                                                id="email-campaign-subject"
                                                value={subject}
                                                onChange={(e) => setSubject(e.target.value)}
                                                onFocus={() => setLastFocusedField('subject')}
                                                placeholder="e.g. Save 20% on next billing cycle"
                                                className="bg-zoru-ink border-zoru-line focus:border-zoru-line text-xs px-2.5 h-8.5"
                                            />
                                        </div>
                                    </>
                                )}

                                {type === 'whatsapp' && (
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="wa-header-text" className="text-xs font-medium">Header text (optional)</Label>
                                            <Input
                                                id="wa-header-text"
                                                value={whatsappConfig.headerText}
                                                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, headerText: e.target.value }))}
                                                onFocus={() => setLastFocusedField('whatsappHeader')}
                                                className="bg-zoru-ink border-zoru-line text-xs px-2.5 h-8.5"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="wa-body" className="text-xs font-medium">Message Body Text</Label>
                                            <Textarea
                                                id="wa-body"
                                                value={content}
                                                onChange={(e) => setContent(e.target.value)}
                                                onFocus={() => setLastFocusedField('body')}
                                                rows={6}
                                                className="bg-zoru-ink border-zoru-line text-xs font-mono resize-none focus:border-zoru-line/50"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="wa-footer" className="text-xs font-medium">Footer Disclaimer</Label>
                                            <Input
                                                id="wa-footer"
                                                value={whatsappConfig.footerText}
                                                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, footerText: e.target.value }))}
                                                onFocus={() => setLastFocusedField('whatsappFooter')}
                                                className="bg-zoru-ink border-zoru-line text-xs px-2.5 h-8.5"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-2 border-t border-zoru-line/80 pt-3">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-zoru-ink">Interactive Buttons</span>
                                            {whatsappConfig.buttons.map((btn, idx) => (
                                                <div key={idx} className="flex gap-1.5 items-center">
                                                    <Input
                                                        value={btn.text}
                                                        onChange={(e) => setWhatsappConfig(prev => {
                                                            const next = [...prev.buttons];
                                                            next[idx].text = e.target.value;
                                                            return { ...prev, buttons: next };
                                                        })}
                                                        placeholder="Button label"
                                                        className="bg-zoru-ink border-zoru-line text-xs px-2.5 h-8.5 flex-1"
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        className="h-8.5 w-8.5 p-0 bg-zoru-ink border-zoru-line hover:text-zoru-ink-muted"
                                                        onClick={() => setWhatsappConfig(prev => ({
                                                            ...prev,
                                                            buttons: prev.buttons.filter((_, i) => i !== idx)
                                                        }))}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button 
                                                onClick={() => setWhatsappConfig(prev => ({
                                                    ...prev,
                                                    buttons: [...prev.buttons, { type: 'quick_reply', text: 'Quick Reply' }]
                                                }))}
                                                variant="outline" 
                                                className="h-8 text-[10px] bg-zoru-ink border-zoru-line/80 border-dashed justify-center text-zoru-ink-muted hover:text-white"
                                            >
                                                Add Reply Option
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {type === 'sms' && (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="sms-body" className="text-xs font-medium">Text Message Body</Label>
                                            <Textarea
                                                id="sms-body"
                                                value={content}
                                                onChange={(e) => setContent(e.target.value)}
                                                onFocus={() => setLastFocusedField('body')}
                                                rows={8}
                                                maxLength={480}
                                                className="bg-zoru-ink border-zoru-line text-xs font-mono resize-none focus:border-zoru-line"
                                            />
                                        </div>
                                        
                                        {/* Character segment tracker */}
                                        <div className="rounded-lg bg-zoru-ink/40 border border-zoru-line p-3 flex flex-col gap-1">
                                            <div className="flex justify-between text-[10px] text-zoru-ink-muted">
                                                <span>Characters: <b className="text-white">{content.length}</b></span>
                                                <span>GSM Segment: <b className="text-white">{Math.ceil(content.length / 160) || 1}</b></span>
                                            </div>
                                            <div className="w-full bg-zoru-ink rounded-full h-1 mt-1">
                                                <div 
                                                    className="bg-zoru-ink h-1 rounded-full transition-all" 
                                                    style={{ width: `${(content.length % 160) / 1.6}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {type === 'document' && (
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="doc-subj" className="text-xs font-medium">Document Title / Subject</Label>
                                            <Input
                                                id="doc-subj"
                                                value={subject}
                                                onChange={(e) => setSubject(e.target.value)}
                                                onFocus={() => setLastFocusedField('subject')}
                                                className="bg-zoru-ink border-zoru-line text-xs px-2.5 h-8.5"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="doc-terms" className="text-xs font-medium">Terms & Conditions</Label>
                                            <Textarea
                                                id="doc-terms"
                                                value={documentConfig.footerTerms}
                                                onChange={(e) => setDocumentConfig(prev => ({ ...prev, footerTerms: e.target.value }))}
                                                onFocus={() => setLastFocusedField('docTerms')}
                                                rows={4}
                                                className="bg-zoru-ink border-zoru-line text-xs resize-none"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-2 border-t border-zoru-line/80 pt-3">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-zoru-ink">Document Layout options</span>
                                            <div className="flex items-center justify-between text-xs py-1">
                                                <span className="text-zoru-ink-muted">Statutory Tax Table</span>
                                                <Switch 
                                                    checked={documentConfig.showItemsTable} 
                                                    onCheckedChange={(checked) => setDocumentConfig(prev => ({ ...prev, showItemsTable: checked }))} 
                                                />
                                            </div>
                                            <div className="flex items-center justify-between text-xs py-1">
                                                <span className="text-zoru-ink-muted">Authorized Signature Block</span>
                                                <Switch 
                                                    checked={documentConfig.showSignature} 
                                                    onCheckedChange={(checked) => setDocumentConfig(prev => ({ ...prev, showSignature: checked }))} 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {leftTab === 'placeholders' && (
                            <div className="flex flex-col gap-3">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zoru-ink">CRM Field Merge Tags</span>
                                <div className="flex flex-col gap-1.5">
                                    {CRM_STUDIO_VARIABLES.map((v) => (
                                        <button
                                            key={v.key}
                                            type="button"
                                            onClick={() => handleInsertPlaceholder(v.key)}
                                            className="flex w-full flex-col rounded-lg border border-zoru-line bg-zoru-ink/20 hover:bg-zoru-ink/30 p-2.5 text-left transition-colors group"
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <span className="font-mono text-[11px] text-zoru-ink-muted group-hover:text-zoru-ink-muted">{`{{${v.key}}}`}</span>
                                                <span className="text-[9px] text-zoru-ink">{v.category}</span>
                                            </div>
                                            <p className="text-[10px] text-zoru-ink-muted font-medium mt-1">{v.label}</p>
                                            <p className="text-[9px] text-zoru-ink mt-0.5">e.g. {v.example}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {leftTab === 'starters' && (
                            <div className="flex flex-col gap-3">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zoru-ink">Starter Presets</span>
                                <div className="flex flex-col gap-2">
                                    <button 
                                        onClick={() => handleLoadStarter('gradient')}
                                        className="w-full text-left p-3 rounded-lg border border-zoru-line hover:border-zoru-line/50 bg-zoru-ink/50 transition-all flex flex-col gap-1"
                                    >
                                        <span className="text-xs font-semibold text-white">Executive Lavender</span>
                                        <p className="text-[10px] text-zoru-ink-muted">High-converting layout with Outfit font & deep gradients.</p>
                                    </button>
                                    <button 
                                        onClick={() => handleLoadStarter('minimal')}
                                        className="w-full text-left p-3 rounded-lg border border-zoru-line hover:border-zoru-line bg-zoru-ink/50 transition-all flex flex-col gap-1"
                                    >
                                        <span className="text-xs font-semibold text-white">Monochromatic Minimal</span>
                                        <p className="text-[10px] text-zoru-ink-muted">Perfect Inter typeface layout for direct operations updates.</p>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Left sidebar footer */}
                    <div className="border-t border-zoru-line p-3 bg-zoru-ink/40 flex items-center justify-between gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                            <input
                                id="schema-import-input"
                                type="file"
                                accept=".json"
                                onChange={handleImportJson}
                                className="hidden"
                            />
                            <Button 
                                variant="outline" 
                                className="h-7 px-2 text-[10px] bg-zoru-ink border-zoru-line text-zoru-ink-muted hover:text-white gap-1"
                                onClick={() => document.getElementById('schema-import-input')?.click()}
                            >
                                <Upload className="h-3 w-3" /> Import
                            </Button>
                            <Button 
                                variant="outline" 
                                className="h-7 px-2 text-[10px] bg-zoru-ink border-zoru-line text-zoru-ink-muted hover:text-white gap-1"
                                onClick={handleExportJson}
                            >
                                <Download className="h-3 w-3" /> Export
                            </Button>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-mono border-zoru-line text-zoru-ink uppercase">
                            v2.0 active
                        </Badge>
                    </div>
                </aside>

                {/* Center Canvas Viewport */}
                <main className="flex-1 flex flex-col overflow-hidden bg-zoru-ink p-6 relative">
                    
                    {/* Viewport resizing frame container */}
                    <div className="flex-1 min-h-0 flex items-center justify-center relative w-full">
                        <div 
                            className={cn(
                                "flex flex-col border border-zoru-line/80 bg-zoru-ink/40 backdrop-blur-md rounded-xl shadow-2xl transition-all duration-300 ease-out overflow-hidden h-full max-h-[720px]",
                                viewportMode === 'desktop' && "w-full",
                                viewportMode === 'tablet' && "w-[768px] border-x-4 border-zoru-line",
                                viewportMode === 'mobile' && "w-[375px] border-x-8 border-zoru-line rounded-2xl"
                            )}
                        >
                            
                            {/* Device frame header */}
                            <div className="h-10 bg-zoru-ink/60 border-b border-zoru-line/50 flex items-center px-4 justify-between shrink-0">
                                <div className="flex gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-zoru-ink/60" />
                                    <span className="w-2.5 h-2.5 rounded-full bg-zoru-ink/60" />
                                    <span className="w-2.5 h-2.5 rounded-full bg-zoru-ink/60" />
                                </div>
                                <span className="text-[10px] font-mono text-zoru-ink uppercase tracking-widest">
                                    {viewportMode} viewport frame
                                </span>
                                <div className="w-12" />
                            </div>

                            {/* Frame content */}
                            <div className="flex-1 overflow-y-auto p-8 bg-zoru-ink/15">
                                {compilePreview ? (
                                    /* Live Compiled view */
                                    type === 'email' ? (
                                        <div className="w-full max-w-[600px] bg-zoru-ink border border-zoru-line/60 rounded-xl p-6 shadow-inner mx-auto">
                                            {subject && (
                                                <div className="border-b border-zoru-line pb-3 mb-4">
                                                    <span className="text-[9px] uppercase font-bold text-zoru-ink">Subject</span>
                                                    <p className="text-xs font-semibold text-white">{subject}</p>
                                                </div>
                                            )}
                                            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(compiledHtml) }} />
                                        </div>
                                    ) : type === 'whatsapp' ? (
                                        /* Simulated WhatsApp iOS message box */
                                        <div className="w-full max-w-[340px] bg-zoru-ink/10 rounded-xl p-4 shadow-inner border border-zoru-line/40 mx-auto relative min-h-[300px] flex flex-col justify-end" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')" }}>
                                            <div className="bg-zoru-ink/20 text-white rounded-lg p-2.5 border border-zoru-line/30 text-xs shadow-md backdrop-blur-sm relative self-end max-w-[85%] mb-2">
                                                {whatsappConfig.headerText && (
                                                    <div className="font-bold text-[10px] text-zoru-ink-muted mb-1 border-b border-zoru-line/30 pb-0.5">
                                                        {whatsappConfig.headerText}
                                                    </div>
                                                )}
                                                <div className="whitespace-pre-wrap text-[11px] leading-relaxed text-white font-mono">
                                                    {compiledText}
                                                </div>
                                                {whatsappConfig.footerText && (
                                                    <div className="text-[9px] text-zoru-ink-muted/80 mt-1 italic">
                                                        {whatsappConfig.footerText}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* WhatsApp Interactive buttons */}
                                            {whatsappConfig.buttons.map((btn, i) => (
                                                <div key={i} className="bg-zoru-ink hover:bg-zoru-ink text-zoru-ink border border-zoru-line/80 text-center py-2 text-[11px] font-semibold rounded-lg shadow-sm w-[85%] self-end mt-1 cursor-pointer">
                                                    {btn.text}
                                                </div>
                                            ))}
                                        </div>
                                    ) : type === 'sms' ? (
                                        /* Simulated Android SMS bubbles */
                                        <div className="w-full max-w-[320px] bg-zoru-ink/30 rounded-xl p-4 shadow-inner border border-zoru-line mx-auto min-h-[220px] flex flex-col justify-end">
                                            <div className="bg-zoru-ink text-white rounded-2xl rounded-br-none p-3.5 text-xs shadow-md self-end max-w-[80%] mb-1 font-mono leading-relaxed">
                                                {compiledText}
                                            </div>
                                            <span className="text-[9px] text-zoru-ink self-end mr-1 mt-0.5">SabNode SMS Gateway • Just Now</span>
                                        </div>
                                    ) : (
                                        /* Document PDF representation */
                                        <div className="w-full max-w-[560px] bg-zoru-ink border border-zoru-line rounded-lg p-8 shadow-inner mx-auto text-xs text-zoru-ink-muted font-mono flex flex-col gap-4">
                                            <div className="flex justify-between items-start border-b border-zoru-line pb-4">
                                                <div>
                                                    <h2 className="text-sm font-bold text-white">QUOTATION DOCUMENT</h2>
                                                    <p className="text-[10px] text-zoru-ink mt-1">Ref: QT-2026-908</p>
                                                </div>
                                                <div className="text-right">
                                                    <h3 className="font-bold text-zoru-ink-muted">SabNode Tech Pvt Ltd</h3>
                                                    <p className="text-[10px] text-zoru-ink">Corporate Head Office, Mumbai</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 text-[10px]">
                                                <div>
                                                    <span className="text-zoru-ink block uppercase font-bold">Prepared For</span>
                                                    <p className="font-semibold text-white mt-0.5">Aarav Sharma</p>
                                                    <p className="text-zoru-ink-muted">aarav.sharma@example.com</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-zoru-ink block uppercase font-bold">Terms Valid Until</span>
                                                    <p className="font-semibold text-white mt-0.5">June 15, 2026</p>
                                                </div>
                                            </div>

                                            {documentConfig.showItemsTable && (
                                                <table className="w-full border-collapse border border-zoru-line text-[10px] mt-2">
                                                    <thead>
                                                        <tr className="bg-zoru-ink text-zoru-ink-muted font-bold border-b border-zoru-line">
                                                            <th className="p-2 text-left">Description</th>
                                                            <th className="p-2 text-right">Qty</th>
                                                            <th className="p-2 text-right">Rate</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr className="border-b border-zoru-line/60">
                                                            <td className="p-2 text-zoru-ink-muted">Cloud migration architect planning & setup</td>
                                                            <td className="p-2 text-right text-zoru-ink-muted">1</td>
                                                            <td className="p-2 text-right text-zoru-ink-muted">₹3,50,000</td>
                                                        </tr>
                                                        <tr className="border-b border-zoru-line/60">
                                                            <td className="p-2 text-zoru-ink-muted">Core server deployment & Node clusters configuration</td>
                                                            <td className="p-2 text-right text-zoru-ink-muted">1</td>
                                                            <td className="p-2 text-right text-zoru-ink-muted">₹9,00,000</td>
                                                        </tr>
                                                        <tr className="border-b border-zoru-line/60">
                                                            <td className="p-2 text-zoru-ink-muted">Enterprise SabNode CRM integration keys & licenses</td>
                                                            <td className="p-2 text-right text-zoru-ink-muted">1</td>
                                                            <td className="p-2 text-right text-zoru-ink-muted">₹6,00,000</td>
                                                        </tr>
                                                        <tr className="bg-zoru-ink/60 font-bold border-t border-zoru-line">
                                                            <td colSpan={2} className="p-2 text-right text-zoru-ink-muted">Total Price Estimate:</td>
                                                            <td className="p-2 text-right text-zoru-ink-muted">₹18,50,000</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            )}

                                            <div className="border-t border-zoru-line pt-3 mt-4 text-[10px] text-zoru-ink">
                                                <span className="block font-bold text-zoru-ink-muted uppercase">Terms & Notes</span>
                                                <p className="mt-1 italic leading-relaxed">{documentConfig.footerTerms}</p>
                                            </div>

                                            {documentConfig.showSignature && (
                                                <div className="flex justify-between items-end mt-6 pt-4 border-t border-zoru-line">
                                                    <div>
                                                        <span className="block text-[9px] text-zoru-ink">Authorized Signature</span>
                                                        <p className="font-semibold text-white mt-2 font-serif italic text-sm">Vikas Patel, Director of Accounts</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="block text-[9px] text-zoru-ink">Date Issued</span>
                                                        <p className="font-semibold text-white mt-1">23rd May 2026</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                ) : (
                                    /* Interactive Designer grid edit workspace canvas */
                                    type === 'email' ? (
                                        <div className="w-full max-w-[600px] bg-zoru-ink/90 border border-zoru-line rounded-xl p-6 shadow-2xl mx-auto flex flex-col gap-3 min-h-[420px]">
                                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                                <SortableContext items={emailConfig.blocks.map((b: any) => b.id)} strategy={verticalListSortingStrategy}>
                                                    {emailConfig.blocks.map((block: any, index: number) => (
                                                        <SortableEmailBlock
                                                            key={block.id}
                                                            block={block}
                                                            isActive={activeBlockId === block.id}
                                                            onSelect={() => setActiveBlockId(block.id)}
                                                            onMove={(idx: number, dir: 'up' | 'down', e: any) => handleMoveBlock(idx, dir, e)}
                                                            onDelete={(id: string, e: any) => handleDeleteBlock(id, e)}
                                                            index={index}
                                                            total={emailConfig.blocks.length}
                                                            themeColor={themeColor}
                                                            fontFamily={fontFamily}
                                                        />
                                                    ))}
                                                </SortableContext>
                                            </DndContext>
                                            
                                            {emailConfig.blocks.length === 0 && (
                                                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-xs text-zoru-ink border border-dashed border-zoru-line rounded-lg">
                                                    Empty block grid. Click on elements in the toolbox sidebar to compose.
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Interactive Standard raw code fallback */
                                        <div className="h-full flex flex-col gap-4 w-full">
                                            <div className="flex flex-col gap-1.5 flex-1 min-h-0">
                                                <Label htmlFor="canvas-editor-raw" className="text-xs font-semibold text-zoru-ink-muted">Design Schema Source Code Editor</Label>
                                                <Textarea
                                                    id="canvas-editor-raw"
                                                    value={content}
                                                    onChange={(e) => setContent(e.target.value)}
                                                    onFocus={() => setLastFocusedField('body')}
                                                    spellCheck={false}
                                                    className="flex-1 font-mono text-[12.5px] leading-relaxed bg-zoru-ink border-zoru-line text-zoru-ink-muted resize-none h-[420px]"
                                                />
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </main>

                {/* Right Side Inspector & Styling settings panel */}
                <aside className="w-80 border-l border-zoru-line bg-zoru-ink/90 backdrop-blur shrink-0 flex flex-col overflow-y-auto p-4 gap-4">
                    <div className="flex items-center gap-2 border-b border-zoru-line/80 pb-3">
                        <Palette className="h-4.5 w-4.5 text-zoru-ink-muted" />
                        <div>
                            <h3 className="font-semibold text-sm">Design Inspector</h3>
                            <p className="text-[10px] text-zoru-ink-muted">Tailor colors, spacing, and brand identity</p>
                        </div>
                    </div>

                    {/* Global style theme config */}
                    <div className="flex flex-col gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zoru-ink">Corporate Branding</span>
                        
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-zoru-ink-muted">Accent Brand Color</span>
                            <ZoruColorPicker
                                value={themeColor}
                                onChange={setThemeColor}
                                align="end"
                                className="w-full justify-between"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="global-font" className="text-xs font-medium">Typography Font</Label>
                            <Select value={fontFamily} onValueChange={setFontFamily}>
                                <ZoruSelectTrigger id="global-font" className="h-8.5 text-xs bg-zoru-ink/40 border-zoru-line">
                                    <ZoruSelectValue placeholder="Font family" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent className="bg-zoru-ink border-zoru-line">
                                    <ZoruSelectItem value="Inter">🖥️ Inter (System Modern)</ZoruSelectItem>
                                    <ZoruSelectItem value="Outfit">✨ Outfit (Vibrant Premium)</ZoruSelectItem>
                                    <ZoruSelectItem value="Roboto">📊 Roboto (Clean Data)</ZoruSelectItem>
                                    <ZoruSelectItem value="serif">📚 Classic Serif</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Active Block Inspector settings */}
                    {type === 'email' && activeBlock && (
                        <div className="flex flex-col gap-4 border-t border-zoru-line/80 pt-4 mt-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zoru-ink capitalize">
                                    Block: {activeBlock.type}
                                </span>
                                <Badge variant="outline" className="border-zoru-line/20 text-[9px] bg-zoru-ink text-zoru-ink-muted">
                                    Active Element
                                </Badge>
                            </div>

                            {activeBlock.type === 'header' && (
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="header-block-text" className="text-xs">Header Text</Label>
                                    <Input
                                        id="header-block-text"
                                        value={activeBlock.content.title}
                                        onChange={(e) => setEmailConfig(prev => {
                                            const next = [...prev.blocks];
                                            const idx = next.findIndex(b => b.id === activeBlock.id);
                                            if (idx !== -1) next[idx].content.title = e.target.value;
                                            return { blocks: next };
                                        })}
                                        className="bg-zoru-ink border-zoru-line text-xs px-2.5 h-8.5"
                                    />
                                </div>
                            )}

                            {activeBlock.type === 'text' && (
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="text-block-html" className="text-xs">Paragraph Content</Label>
                                    <Textarea
                                        id="text-block-html"
                                        value={activeBlock.content.html}
                                        onChange={(e) => setEmailConfig(prev => {
                                            const next = [...prev.blocks];
                                            const idx = next.findIndex(b => b.id === activeBlock.id);
                                            if (idx !== -1) next[idx].content.html = e.target.value;
                                            return { blocks: next };
                                        })}
                                        rows={5}
                                        className="bg-zoru-ink border-zoru-line text-xs resize-none"
                                    />
                                </div>
                            )}

                            {activeBlock.type === 'button' && (
                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-col gap-1">
                                        <Label htmlFor="btn-block-text" className="text-xs">Button Label</Label>
                                        <Input
                                            id="btn-block-text"
                                            value={activeBlock.content.text}
                                            onChange={(e) => setEmailConfig(prev => {
                                                const next = [...prev.blocks];
                                                const idx = next.findIndex(b => b.id === activeBlock.id);
                                                if (idx !== -1) next[idx].content.text = e.target.value;
                                                return { blocks: next };
                                            })}
                                            className="bg-zoru-ink border-zoru-line text-xs px-2.5 h-8.5"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <Label htmlFor="btn-block-url" className="text-xs">Button URL / Link</Label>
                                        <Input
                                            id="btn-block-url"
                                            value={activeBlock.content.url}
                                            onChange={(e) => setEmailConfig(prev => {
                                                const next = [...prev.blocks];
                                                const idx = next.findIndex(b => b.id === activeBlock.id);
                                                if (idx !== -1) next[idx].content.url = e.target.value;
                                                return { blocks: next };
                                            })}
                                            className="bg-zoru-ink border-zoru-line text-xs px-2.5 h-8.5"
                                        />
                                    </div>
                                </div>
                            )}

                            {activeBlock.type === 'footer' && (
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="footer-block-sig" className="text-xs">Signature Content</Label>
                                    <Textarea
                                        id="footer-block-sig"
                                        value={activeBlock.content.signature}
                                        onChange={(e) => setEmailConfig(prev => {
                                            const next = [...prev.blocks];
                                            const idx = next.findIndex(b => b.id === activeBlock.id);
                                            if (idx !== -1) next[idx].content.signature = e.target.value;
                                            return { blocks: next };
                                        })}
                                        rows={4}
                                        className="bg-zoru-ink border-zoru-line text-xs resize-none"
                                    />
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <Label htmlFor="block-padding" className="text-xs">Block Padding Spacer</Label>
                                <Select 
                                    value={activeBlock.style?.padding || '16px'} 
                                    onValueChange={(val) => setEmailConfig(prev => {
                                        const next = [...prev.blocks];
                                        const idx = next.findIndex(b => b.id === activeBlock.id);
                                        if (idx !== -1) next[idx].style = { ...next[idx].style, padding: val };
                                        return { blocks: next };
                                    })}
                                >
                                    <ZoruSelectTrigger id="block-padding" className="h-8 text-xs bg-zoru-ink/40 border-zoru-line">
                                        <ZoruSelectValue placeholder="Padding" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent className="bg-zoru-ink border-zoru-line">
                                        <ZoruSelectItem value="8px">Compact (8px)</ZoruSelectItem>
                                        <ZoruSelectItem value="16px">Normal (16px)</ZoruSelectItem>
                                        <ZoruSelectItem value="24px">Comfortable (24px)</ZoruSelectItem>
                                        <ZoruSelectItem value="36px">Wide (36px)</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </aside>
            </div>

            {/* Dynamic AI Copilot Sidebar Panel Overlay */}
            {showAiCopilot && (
                <div className="absolute right-0 top-14 bottom-0 w-80 bg-zoru-ink border-l border-zoru-line shadow-2xl z-40 animate-in slide-in-from-right duration-200">
                    <div className="h-full relative flex flex-col">
                        <AiCopilotPanel 
                            templateType={type} 
                            onInsert={handleInsertAiText}
                            currentContent={content}
                        />
                        <button 
                            onClick={() => setShowAiCopilot(false)} 
                            className="absolute right-3 top-3 text-zoru-ink hover:text-zoru-ink-muted"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Dynamic Version History Snapshot Sidebar Panel Overlay */}
            {showHistory && (
                <div className="absolute right-0 top-14 bottom-0 w-80 bg-zoru-ink border-l border-zoru-line shadow-2xl z-40 animate-in slide-in-from-right duration-200">
                    <div className="h-full relative flex flex-col">
                        <VersionHistoryPanel 
                            history={history}
                            currentContent={content}
                            currentSubject={subject}
                            onRestore={handleVersionRestore}
                        />
                        <button 
                            onClick={() => setShowHistory(false)} 
                            className="absolute right-3 top-3 text-zoru-ink hover:text-zoru-ink-muted"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    Mail,
    MessageSquare,
    FileText,
    Sparkles,
    Plus,
    Search,
    SlidersHorizontal,
    Copy,
    Trash2,
    Calendar,
    ChevronRight,
    LoaderCircle,
    ArrowUpRight,
    TrendingUp,
    Bookmark
} from 'lucide-react';

import { Button, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter, Card, CardBody, Badge, useToast } from '@/components/sabcrm/20ui/compat';

import { cn } from '@/components/sabcrm/20ui/compat';
import {
    saveCrmTemplate,
    deleteCrmTemplate,
    type UnifiedTemplate
} from '@/app/actions/crm-templates.actions';

interface TemplatesListClientProps {
    initialTemplates: UnifiedTemplate[];
}

type FilterType = 'all' | 'email' | 'whatsapp' | 'sms' | 'document';

export function TemplatesListClient({ initialTemplates }: TemplatesListClientProps): React.JSX.Element {
    const { toast } = useToast();
    const router = useRouter();
    
    // Core state
    const [templates, setTemplates] = React.useState<UnifiedTemplate[]>(initialTemplates);
    const [search, setSearch] = React.useState('');
    const [filter, setFilter] = React.useState<FilterType>('all');
    
    // Creation dialog state
    const [openCreator, setOpenCreator] = React.useState(false);
    const [newName, setNewName] = React.useState('');
    const [newType, setNewType] = React.useState<'email' | 'sms' | 'whatsapp' | 'document'>('email');
    const [creating, setCreating] = React.useState(false);

    // Dynamic stats computations
    const emailCount = templates.filter(t => t.type === 'email').length;
    const whatsappCount = templates.filter(t => t.type === 'whatsapp').length;
    const smsCount = templates.filter(t => t.type === 'sms').length;
    const docCount = templates.filter(t => t.type === 'document').length;

    // Filter templates list
    const filteredTemplates = React.useMemo(() => {
        return templates.filter(t => {
            const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
                (t.subject && t.subject.toLowerCase().includes(search.toLowerCase()));
            const matchesFilter = filter === 'all' || t.type === filter;
            return matchesSearch && matchesFilter;
        });
    }, [templates, search, filter]);

    // Handle template duplicate/clone
    const handleDuplicate = async (target: UnifiedTemplate, e: React.MouseEvent) => {
        e.stopPropagation();
        toast({ title: 'Duplicating template', description: 'Copying config schema...' });
        
        const clonedPayload: Partial<UnifiedTemplate> = {
            name: `${target.name} (Copy)`,
            type: target.type,
            subject: target.subject,
            content: target.content,
            themeColor: target.themeColor,
            fontFamily: target.fontFamily,
            status: 'active',
            whatsappConfig: target.whatsappConfig,
            documentConfig: target.documentConfig,
            emailConfig: target.emailConfig,
            versionHistory: []
        };

        const res = await saveCrmTemplate(clonedPayload);
        if (res.ok) {
            toast({ title: 'Template duplicated', description: `${target.name} copied successfully.` });
            
            // Append locally
            const newObj: UnifiedTemplate = {
                ...clonedPayload,
                _id: res.id,
                createdAt: new Date(),
                updatedAt: new Date()
            } as UnifiedTemplate;
            
            setTemplates(prev => [newObj, ...prev]);
        } else {
            toast({ title: 'Cloning failed', description: res.error || 'Server error', variant: 'destructive' });
        }
    };

    // Handle template delete
    const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Are you absolutely sure you want to delete "${name}" template?`)) return;
        
        const res = await deleteCrmTemplate(id);
        if (res.success) {
            toast({ title: 'Template deleted', description: `Successfully removed ${name}.` });
            setTemplates(prev => prev.filter(t => t._id?.toString() !== id));
        } else {
            toast({ title: 'Deletion failed', description: res.error || 'Server error', variant: 'destructive' });
        }
    };

    // Handle initial template creation submit
    const handleCreateTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true);

        const initialPayload: Partial<UnifiedTemplate> = {
            name: newName.trim(),
            type: newType,
            status: 'active',
            content: newType === 'email' ? '' : newType === 'whatsapp' ? 'Welcome to {{company.name}}!' : 'Hi {{contact.first_name}}!',
            versionHistory: []
        };

        const res = await saveCrmTemplate(initialPayload);
        setCreating(false);
        if (res.ok && res.id) {
            setOpenCreator(false);
            setNewName('');
            toast({ title: 'Template initialized', description: 'Redirecting to Visual Studio Canvas...' });
            
            // Redirect to studio dynamic route
            router.push(`/dashboard/crm/templates/${res.id}`);
        } else {
            toast({ title: 'Initialization failed', description: res.error || 'Server rejected creation.', variant: 'destructive' });
        }
    };

    const typeIcons = {
        email: <Mail className="h-4.5 w-4.5 text-[var(--st-text-secondary)]" />,
        whatsapp: <MessageSquare className="h-4.5 w-4.5 text-[var(--st-text-secondary)]" />,
        sms: <MessageSquare className="h-4.5 w-4.5 text-[var(--st-text-secondary)]" />,
        document: <FileText className="h-4.5 w-4.5 text-[var(--st-text-secondary)]" />
    };

    return (
        <div className="flex flex-col gap-6">
            
            {/* Stat Overlay Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="bg-[var(--st-text)]/80 border-[var(--st-border)]/80 hover:border-[var(--st-border)]/80 backdrop-blur-md rounded-xl transition-all shadow-lg p-4 group">
                    <CardBody className="p-0 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-[var(--st-text)] tracking-wider">All Templates</span>
                            <span className="text-2xl font-extrabold text-white mt-1 group-hover:scale-105 transition-transform duration-200">{templates.length}</span>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-[var(--st-text)] border border-[var(--st-border)]/80 flex items-center justify-center text-[var(--st-text-secondary)]">
                            <Bookmark className="h-5 w-5" />
                        </div>
                    </CardBody>
                </Card>

                <Card className="bg-[var(--st-text)]/80 border-[var(--st-border)]/80 hover:border-[var(--st-border)]/30 backdrop-blur-md rounded-xl transition-all shadow-lg p-4 group">
                    <CardBody className="p-0 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-[var(--st-text)] tracking-wider">Email Templates</span>
                            <span className="text-2xl font-extrabold text-[var(--st-text-secondary)] mt-1">{emailCount}</span>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-[var(--st-text)]/20 border border-[var(--st-border)]/30 flex items-center justify-center text-[var(--st-text-secondary)]">
                            <Mail className="h-5 w-5" />
                        </div>
                    </CardBody>
                </Card>

                <Card className="bg-[var(--st-text)]/80 border-[var(--st-border)]/80 hover:border-[var(--st-border)]/30 backdrop-blur-md rounded-xl transition-all shadow-lg p-4 group">
                    <CardBody className="p-0 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-[var(--st-text)] tracking-wider">WhatsApp Templates</span>
                            <span className="text-2xl font-extrabold text-[var(--st-text-secondary)] mt-1">{whatsappCount}</span>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-[var(--st-text)]/20 border border-[var(--st-border)]/30 flex items-center justify-center text-[var(--st-text-secondary)]">
                            <MessageSquare className="h-5 w-5" />
                        </div>
                    </CardBody>
                </Card>

                <Card className="bg-[var(--st-text)]/80 border-[var(--st-border)]/80 hover:border-[var(--st-border)]/30 backdrop-blur-md rounded-xl transition-all shadow-lg p-4 group">
                    <CardBody className="p-0 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-[var(--st-text)] tracking-wider">SMS Segments</span>
                            <span className="text-2xl font-extrabold text-[var(--st-text-secondary)] mt-1">{smsCount}</span>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-[var(--st-text)]/20 border border-[var(--st-border)]/30 flex items-center justify-center text-[var(--st-text-secondary)]">
                            <MessageSquare className="h-5 w-5" />
                        </div>
                    </CardBody>
                </Card>

                <Card className="bg-[var(--st-text)]/80 border-[var(--st-border)]/80 hover:border-[var(--st-border)]/30 backdrop-blur-md rounded-xl transition-all shadow-lg p-4 group col-span-2 md:col-span-1">
                    <CardBody className="p-0 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-[var(--st-text)] tracking-wider">PDF Quotations</span>
                            <span className="text-2xl font-extrabold text-[var(--st-text-secondary)] mt-1">{docCount}</span>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-[var(--st-text)]/20 border border-[var(--st-border)]/30 flex items-center justify-center text-[var(--st-text-secondary)]">
                            <FileText className="h-5 w-5" />
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--st-border)]/60 pb-4">
                
                {/* Visual Category Tabs */}
                <div className="flex items-center bg-[var(--st-text)]/60 border border-[var(--st-border)]/80 rounded-lg p-0.5 max-w-full overflow-x-auto">
                    {[
                        { key: 'all', label: 'All Layouts' },
                        { key: 'email', label: 'Email' },
                        { key: 'whatsapp', label: 'WhatsApp' },
                        { key: 'sms', label: 'SMS' },
                        { key: 'document', label: 'PDF Documents' }
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key as FilterType)}
                            className={cn(
                                "px-3.5 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap",
                                filter === tab.key 
                                    ? "bg-[var(--st-text)] text-white shadow" 
                                    : "text-[var(--st-text-secondary)] hover:text-white"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text)]" />
                        <Input
                            placeholder="Search campaign templates..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-[var(--st-text)] border-[var(--st-border)] focus:border-[var(--st-border)] pl-9 pr-4 text-xs h-9 w-full"
                        />
                    </div>

                    <Dialog open={openCreator} onOpenChange={setOpenCreator}>
                        <DialogTrigger asChild>
                            <Button className="bg-gradient-to-r from-[var(--st-text)] to-[var(--st-text)] hover:from-[var(--st-text)] hover:to-[var(--st-text)] text-white font-bold text-xs h-9 px-4 gap-1.5 shadow-lg shadow-[var(--st-border)]/20 shrink-0">
                                <Plus className="h-4 w-4" /> Create Template
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[var(--st-text)] border-[var(--st-border)]/80 text-white max-w-md">
                            <form onSubmit={handleCreateTemplate} className="flex flex-col gap-4">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold bg-gradient-to-r from-[var(--st-bg-muted)] to-[var(--st-bg-muted)] bg-clip-text text-transparent flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-[var(--st-text-secondary)]" /> New Campaign Template
                                    </DialogTitle>
                                    <DialogDescription className="text-[var(--st-text-secondary)]">
                                        Initialize your campaign layout details. Once created, you will enter our Visual Studio designer workspace.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="creator-name" className="text-xs font-semibold">Template Name</Label>
                                        <Input
                                            id="creator-name"
                                            placeholder="e.g. VIP Member Welcome Flow"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            required
                                            className="bg-[var(--st-text)] border-[var(--st-border)] focus:border-[var(--st-border)] text-xs px-3 h-9"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="creator-type" className="text-xs font-semibold">Communication Type</Label>
                                        <Select value={newType} onValueChange={(val: any) => setNewType(val)}>
                                            <SelectTrigger id="creator-type" className="bg-[var(--st-text)] border-[var(--st-border)] text-xs h-9">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-[var(--st-text)] border-[var(--st-border)] text-white">
                                                <SelectItem value="email">📧 Custom Rich Email Campaigns</SelectItem>
                                                <SelectItem value="whatsapp">💬 Interactive WhatsApp Messages</SelectItem>
                                                <SelectItem value="sms">📱 Standard Bulk SMS Alerts</SelectItem>
                                                <SelectItem value="document">📄 Professional PDF Invoice/Quotation</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <DialogFooter className="mt-2 flex gap-2">
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline" className="bg-[var(--st-text)] border-[var(--st-border)] text-xs h-9">
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button
                                        type="submit"
                                        disabled={creating || !newName.trim()}
                                        className="bg-[var(--st-text)] hover:bg-[var(--st-text-secondary)] text-white font-semibold text-xs h-9 gap-1.5"
                                    >
                                        {creating ? (
                                            <>
                                                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                                Creating Studio...
                                            </>
                                        ) : (
                                            <>
                                                Create and Design
                                            </>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Templates List Grid layout */}
            {filteredTemplates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map((t) => (
                        <div
                            key={t._id?.toString()}
                            onClick={() => router.push(`/dashboard/crm/templates/${t._id}`)}
                            className="group relative flex flex-col justify-between rounded-xl border border-[var(--st-border)]/80 bg-[var(--st-text)]/70 hover:bg-[var(--st-text)]/80 hover:border-[var(--st-border)]/80 p-5 transition-all shadow-lg cursor-pointer hover:shadow-[var(--st-border)]/10 hover:shadow-2xl text-left"
                        >
                            <div>
                                <div className="flex items-center justify-between gap-2 border-b border-[var(--st-border)]/50 pb-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-text)] border border-[var(--st-border)]/80">
                                            {typeIcons[t.type]}
                                        </div>
                                        <Badge className="bg-[var(--st-text)] border-[var(--st-border)] text-[var(--st-text-secondary)] capitalize text-[9px] font-mono h-4.5 px-1.5">
                                            {t.type}
                                        </Badge>
                                    </div>
                                    
                                    {/* Action cluster on card */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="outline"
                                            className="h-7 w-7 p-0 bg-[var(--st-text)] border-[var(--st-border)] hover:text-[var(--st-text-secondary)]"
                                            onClick={(e) => handleDuplicate(t, e)}
                                            title="Duplicate template"
                                        >
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                        {/* Avoid deleting starter kits */}
                                        {!t._id?.toString().startsWith('starter-') && (
                                            <Button
                                                variant="outline"
                                                className="h-7 w-7 p-0 bg-[var(--st-text)] border-[var(--st-border)] hover:text-[var(--st-text-secondary)]"
                                                onClick={(e) => handleDelete(t._id!.toString(), t.name, e)}
                                                title="Delete template"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-[var(--st-text-secondary)] transition-colors truncate">
                                    {t.name}
                                </h3>
                                
                                {t.subject ? (
                                    <p className="text-[11px] text-[var(--st-text-secondary)] mt-1 line-clamp-1 italic font-medium">
                                        Subject: {t.subject}
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-[var(--st-text)] mt-1 italic">
                                        No subject header
                                    </p>
                                )}

                                <p className="text-[11px] text-[var(--st-text)] mt-2 line-clamp-2 leading-relaxed font-mono bg-[var(--st-text)]/40 p-2 rounded-lg border border-[var(--st-border)]/60">
                                    {t.content.startsWith('<!DOCTYPE') || t.content.startsWith('{') 
                                        ? `Custom dynamic ${t.type} schema model.` 
                                        : t.content
                                    }
                                </p>
                            </div>

                            <div className="flex items-center justify-between border-t border-[var(--st-border)]/40 pt-3 mt-4 text-[10px] text-[var(--st-text)]">
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>Updated {(() => {
                                        const date = new Date(t.updatedAt || new Date());
                                        if (Number.isNaN(date.getTime())) return '—';
                                        const day = String(date.getUTCDate()).padStart(2, '0');
                                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                        const month = months[date.getUTCMonth()];
                                        const year = date.getUTCFullYear();
                                        return `${day} ${month} ${year}`;
                                    })()}</span>
                                </div>
                                <span className="flex items-center text-[var(--st-text-secondary)] font-semibold group-hover:translate-x-0.5 transition-transform gap-0.5">
                                    Open Designer <ChevronRight className="h-3 w-3" />
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--st-border)] bg-[var(--st-text)]/30 p-12 text-center shadow-lg">
                    <Bookmark className="h-12 w-12 text-[var(--st-text)] mb-3" strokeWidth={1} />
                    <h3 className="font-bold text-white">No matching templates found</h3>
                    <p className="text-xs text-[var(--st-text)] max-w-sm mt-1">
                        Try modifying your query or click "Create Template" to build a premium visual Campaign from scratch.
                    </p>
                </div>
            )}

        </div>
    );
}

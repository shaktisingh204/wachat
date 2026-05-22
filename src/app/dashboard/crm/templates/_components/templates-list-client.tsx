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

import {
    Button,
    Input,
    Label,
    Select,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruSelectContent,
    ZoruSelectItem,
    Dialog,
    ZoruDialogTrigger,
    ZoruDialogContent,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruDialogDescription,
    ZoruDialogClose,
    ZoruDialogFooter,
    Card,
    ZoruCardContent,
    Badge,
    useZoruToast
} from '@/components/zoruui';

import { cn } from '@/components/zoruui/lib/cn';
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
    const { toast } = useZoruToast();
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
        email: <Mail className="h-4.5 w-4.5 text-blue-400" />,
        whatsapp: <MessageSquare className="h-4.5 w-4.5 text-emerald-400" />,
        sms: <MessageSquare className="h-4.5 w-4.5 text-indigo-400" />,
        document: <FileText className="h-4.5 w-4.5 text-purple-400" />
    };

    return (
        <div className="flex flex-col gap-6">
            
            {/* Stat Overlay Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="bg-[#0e1017]/80 border-slate-800/80 hover:border-slate-700/80 backdrop-blur-md rounded-xl transition-all shadow-lg p-4 group">
                    <ZoruCardContent className="p-0 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">All Templates</span>
                            <span className="text-2xl font-extrabold text-white mt-1 group-hover:scale-105 transition-transform duration-200">{templates.length}</span>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-center text-slate-400">
                            <Bookmark className="h-5 w-5" />
                        </div>
                    </ZoruCardContent>
                </Card>

                <Card className="bg-[#0e1017]/80 border-slate-800/80 hover:border-blue-500/30 backdrop-blur-md rounded-xl transition-all shadow-lg p-4 group">
                    <ZoruCardContent className="p-0 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Email Templates</span>
                            <span className="text-2xl font-extrabold text-blue-400 mt-1">{emailCount}</span>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-blue-950/20 border border-blue-900/30 flex items-center justify-center text-blue-400">
                            <Mail className="h-5 w-5" />
                        </div>
                    </ZoruCardContent>
                </Card>

                <Card className="bg-[#0e1017]/80 border-slate-800/80 hover:border-emerald-500/30 backdrop-blur-md rounded-xl transition-all shadow-lg p-4 group">
                    <ZoruCardContent className="p-0 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">WhatsApp Templates</span>
                            <span className="text-2xl font-extrabold text-emerald-400 mt-1">{whatsappCount}</span>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-emerald-950/20 border border-emerald-900/30 flex items-center justify-center text-emerald-400">
                            <MessageSquare className="h-5 w-5" />
                        </div>
                    </ZoruCardContent>
                </Card>

                <Card className="bg-[#0e1017]/80 border-slate-800/80 hover:border-indigo-500/30 backdrop-blur-md rounded-xl transition-all shadow-lg p-4 group">
                    <ZoruCardContent className="p-0 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">SMS Segments</span>
                            <span className="text-2xl font-extrabold text-indigo-400 mt-1">{smsCount}</span>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-indigo-950/20 border border-indigo-900/30 flex items-center justify-center text-indigo-400">
                            <MessageSquare className="h-5 w-5" />
                        </div>
                    </ZoruCardContent>
                </Card>

                <Card className="bg-[#0e1017]/80 border-slate-800/80 hover:border-purple-500/30 backdrop-blur-md rounded-xl transition-all shadow-lg p-4 group col-span-2 md:col-span-1">
                    <ZoruCardContent className="p-0 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">PDF Quotations</span>
                            <span className="text-2xl font-extrabold text-purple-400 mt-1">{docCount}</span>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-purple-950/20 border border-purple-900/30 flex items-center justify-center text-purple-400">
                            <FileText className="h-5 w-5" />
                        </div>
                    </ZoruCardContent>
                </Card>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
                
                {/* Visual Category Tabs */}
                <div className="flex items-center bg-slate-900/60 border border-slate-800/80 rounded-lg p-0.5 max-w-full overflow-x-auto">
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
                                    ? "bg-indigo-600 text-white shadow" 
                                    : "text-slate-400 hover:text-slate-200"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Search campaign templates..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-slate-950 border-slate-800 focus:border-indigo-500 pl-9 pr-4 text-xs h-9 w-full"
                        />
                    </div>

                    <Dialog open={openCreator} onOpenChange={setOpenCreator}>
                        <ZoruDialogTrigger asChild>
                            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs h-9 px-4 gap-1.5 shadow-lg shadow-indigo-950/20 shrink-0">
                                <Plus className="h-4 w-4" /> Create Template
                            </Button>
                        </ZoruDialogTrigger>
                        <ZoruDialogContent className="bg-[#0b0c10] border-slate-800/80 text-slate-100 max-w-md">
                            <form onSubmit={handleCreateTemplate} className="flex flex-col gap-4">
                                <ZoruDialogHeader>
                                    <ZoruDialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-indigo-400" /> New Campaign Template
                                    </ZoruDialogTitle>
                                    <ZoruDialogDescription className="text-slate-400">
                                        Initialize your campaign layout details. Once created, you will enter our Visual Studio designer workspace.
                                    </ZoruDialogDescription>
                                </ZoruDialogHeader>

                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="creator-name" className="text-xs font-semibold">Template Name</Label>
                                        <Input
                                            id="creator-name"
                                            placeholder="e.g. VIP Member Welcome Flow"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            required
                                            className="bg-slate-950 border-slate-800 focus:border-indigo-500 text-xs px-3 h-9"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="creator-type" className="text-xs font-semibold">Communication Type</Label>
                                        <Select value={newType} onValueChange={(val: any) => setNewType(val)}>
                                            <ZoruSelectTrigger id="creator-type" className="bg-slate-950 border-slate-800 text-xs h-9">
                                                <ZoruSelectValue placeholder="Select type" />
                                            </ZoruSelectTrigger>
                                            <ZoruSelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                                                <ZoruSelectItem value="email">📧 Custom Rich Email Campaigns</ZoruSelectItem>
                                                <ZoruSelectItem value="whatsapp">💬 Interactive WhatsApp Messages</ZoruSelectItem>
                                                <ZoruSelectItem value="sms">📱 Standard Bulk SMS Alerts</ZoruSelectItem>
                                                <ZoruSelectItem value="document">📄 Professional PDF Invoice/Quotation</ZoruSelectItem>
                                            </ZoruSelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <ZoruDialogFooter className="mt-2 flex gap-2">
                                    <ZoruDialogClose asChild>
                                        <Button type="button" variant="outline" className="bg-slate-950 border-slate-800 text-xs h-9">
                                            Cancel
                                        </Button>
                                    </ZoruDialogClose>
                                    <Button
                                        type="submit"
                                        disabled={creating || !newName.trim()}
                                        className="bg-indigo-600 hover:bg-indigo-505 text-white font-semibold text-xs h-9 gap-1.5"
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
                                </ZoruDialogFooter>
                            </form>
                        </ZoruDialogContent>
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
                            className="group relative flex flex-col justify-between rounded-xl border border-slate-800/80 bg-[#0e1017]/70 hover:bg-[#121420]/80 hover:border-slate-700/80 p-5 transition-all shadow-lg cursor-pointer hover:shadow-indigo-950/10 hover:shadow-2xl text-left"
                        >
                            <div>
                                <div className="flex items-center justify-between gap-2 border-b border-slate-800/50 pb-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 border border-slate-800/80">
                                            {typeIcons[t.type]}
                                        </div>
                                        <Badge className="bg-slate-900 border-slate-800 text-slate-400 capitalize text-[9px] font-mono h-4.5 px-1.5">
                                            {t.type}
                                        </Badge>
                                    </div>
                                    
                                    {/* Action cluster on card */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="outline"
                                            className="h-7 w-7 p-0 bg-slate-950 border-slate-850 hover:text-indigo-400"
                                            onClick={(e) => handleDuplicate(t, e)}
                                            title="Duplicate template"
                                        >
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                        {/* Avoid deleting starter kits */}
                                        {!t._id?.toString().startsWith('starter-') && (
                                            <Button
                                                variant="outline"
                                                className="h-7 w-7 p-0 bg-slate-950 border-slate-850 hover:text-red-400"
                                                onClick={(e) => handleDelete(t._id!.toString(), t.name, e)}
                                                title="Delete template"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <h3 className="font-bold text-slate-100 text-sm mt-3 group-hover:text-indigo-400 transition-colors truncate">
                                    {t.name}
                                </h3>
                                
                                {t.subject ? (
                                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 italic font-medium">
                                        Subject: {t.subject}
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-slate-500 mt-1 italic">
                                        No subject header
                                    </p>
                                )}

                                <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed font-mono bg-slate-950/40 p-2 rounded-lg border border-slate-900/60">
                                    {t.content.startsWith('<!DOCTYPE') || t.content.startsWith('{') 
                                        ? `Custom dynamic ${t.type} schema model.` 
                                        : t.content
                                    }
                                </p>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-800/40 pt-3 mt-4 text-[10px] text-slate-500">
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>Updated {new Date(t.updatedAt || new Date()).toLocaleDateString()}</span>
                                </div>
                                <span className="flex items-center text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform gap-0.5">
                                    Open Designer <ChevronRight className="h-3 w-3" />
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-[#0e1017]/30 p-12 text-center shadow-lg">
                    <Bookmark className="h-12 w-12 text-slate-700 mb-3" strokeWidth={1} />
                    <h3 className="font-bold text-slate-200">No matching templates found</h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                        Try modifying your query or click "Create Template" to build a premium visual Campaign from scratch.
                    </p>
                </div>
            )}

        </div>
    );
}

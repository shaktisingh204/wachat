'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruDialog as Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/zoruui';
import { useState, useEffect } from 'react';
import { Save, Trash2, Download } from 'lucide-react';

interface SchemaTemplate {
  id: string;
  name: string;
  type: string;
  data: any;
}

export default function SchemaBuilder() {
    const [type, setType] = useState('LocalBusiness');
    const [data, setData] = useState<any>({ name: '', image: '', telephone: '' });
    const [jsonLd, setJsonLd] = useState('');
    const [templates, setTemplates] = useState<SchemaTemplate[]>([]);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('schema_templates');
        if (saved) {
            try {
                setTemplates(JSON.parse(saved));
            } catch (e) {
                console.error(e);
            }
        }
    }, []);

    const saveTemplate = () => {
        if (!newTemplateName.trim()) return;
        const newTemplate: SchemaTemplate = {
            id: Date.now().toString(),
            name: newTemplateName,
            type,
            data
        };
        const updated = [...templates, newTemplate];
        setTemplates(updated);
        localStorage.setItem('schema_templates', JSON.stringify(updated));
        setNewTemplateName('');
        setIsSaveDialogOpen(false);
    };

    const loadTemplate = (id: string) => {
        const template = templates.find(t => t.id === id);
        if (template) {
            setType(template.type);
            setData(template.data);
        }
    };

    const deleteTemplate = (id: string) => {
        const updated = templates.filter(t => t.id !== id);
        setTemplates(updated);
        localStorage.setItem('schema_templates', JSON.stringify(updated));
    };

    useEffect(() => {
        const schema = {
            "@context": "https://schema.org",
            "@type": type,
            ...data
        };
        
        // Clean up empty fields to avoid invalid JSON-LD properties where possible
        const cleanData = Object.fromEntries(
            Object.entries(schema).filter(([_, v]) => v !== '')
        );
        
        setJsonLd(JSON.stringify(cleanData, null, 2));
    }, [type, data]);

    const handleChange = (key: string, value: string) => {
        setData({ ...data, [key]: value });
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-6">
                <Card>
                    <ZoruCardHeader className="flex flex-row items-center justify-between">
                        <ZoruCardTitle>Configure Schema</ZoruCardTitle>
                        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2">
                                    <Save className="h-4 w-4" />
                                    Save Template
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Save Schema Template</DialogTitle>
                                    <DialogDescription>
                                        Save your current schema configuration to reuse it later.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Template Name</Label>
                                        <Input
                                            placeholder="e.g. Main Local Business"
                                            value={newTemplateName}
                                            onChange={(e) => setNewTemplateName(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
                                    <Button onClick={saveTemplate} disabled={!newTemplateName.trim()}>Save</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </ZoruCardHeader>
                    <ZoruCardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Schema Type</Label>
                            <Select value={type} onValueChange={setType}>
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="LocalBusiness">Local Business</ZoruSelectItem>
                                    <ZoruSelectItem value="Organization">Organization</ZoruSelectItem>
                                    <ZoruSelectItem value="Person">Person</ZoruSelectItem>
                                    <ZoruSelectItem value="Product">Product</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input placeholder="Name" value={data.name || ''} onChange={(e) => handleChange('name', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Image URL</Label>
                            <Input placeholder="https://..." value={data.image || ''} onChange={(e) => handleChange('image', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Telephone</Label>
                            <Input placeholder="+1..." value={data.telephone || ''} onChange={(e) => handleChange('telephone', e.target.value)} />
                        </div>
                    </ZoruCardContent>
                </Card>

                {templates.length > 0 && (
                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Saved Templates</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-3">
                                {templates.map(template => (
                                    <div key={template.id} className="flex items-center justify-between p-3 border rounded-[var(--zoru-radius)] border-zoru-line bg-zoru-surface-2">
                                        <div>
                                            <p className="font-medium text-sm text-zoru-ink">{template.name}</p>
                                            <p className="text-xs text-zoru-ink-muted">{template.type}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="secondary" size="sm" onClick={() => loadTemplate(template.id)}>
                                                <Download className="h-4 w-4 mr-1" />
                                                Load
                                            </Button>
                                            <Button variant="ghost" size="sm" className="text-zoru-danger hover:text-zoru-danger hover:bg-zoru-danger/10" onClick={() => deleteTemplate(template.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ZoruCardContent>
                    </Card>
                )}
            </div>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>JSON-LD Preview</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="relative">
                        <pre className="bg-zoru-ink text-white p-4 rounded-[var(--zoru-radius-lg)] overflow-auto text-xs min-h-[300px]">
                            {jsonLd}
                        </pre>
                        <Button
                            className="absolute top-2 right-2"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(`<script type="application/ld+json">\n${jsonLd}\n</script>`)}
                        >
                            Copy Script
                        </Button>
                    </div>
                </ZoruCardContent>
            </Card>
        </div>
    );
}

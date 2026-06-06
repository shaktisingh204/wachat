'use client';

import { Card, CardBody, CardHeader, CardTitle, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/sabcrm/20ui';
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
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Configure Schema</CardTitle>
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
                    </CardHeader>
                    <CardBody className="space-y-4">
                        <div className="space-y-2">
                            <Label>Schema Type</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LocalBusiness">Local Business</SelectItem>
                                    <SelectItem value="Organization">Organization</SelectItem>
                                    <SelectItem value="Person">Person</SelectItem>
                                    <SelectItem value="Product">Product</SelectItem>
                                </SelectContent>
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
                    </CardBody>
                </Card>

                {templates.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Saved Templates</CardTitle>
                        </CardHeader>
                        <CardBody>
                            <div className="space-y-3">
                                {templates.map(template => (
                                    <div key={template.id} className="flex items-center justify-between p-3 border rounded-[var(--st-radius)] border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                                        <div>
                                            <p className="font-medium text-sm text-[var(--st-text)]">{template.name}</p>
                                            <p className="text-xs text-[var(--st-text-secondary)]">{template.type}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="secondary" size="sm" onClick={() => loadTemplate(template.id)}>
                                                <Download className="h-4 w-4 mr-1" />
                                                Load
                                            </Button>
                                            <Button variant="ghost" size="sm" className="text-[var(--st-danger)] hover:text-[var(--st-danger)] hover:bg-[var(--st-danger)]/10" onClick={() => deleteTemplate(template.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>JSON-LD Preview</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="relative">
                        <pre className="bg-[var(--st-text)] text-white p-4 rounded-[var(--st-radius-lg)] overflow-auto text-xs min-h-[300px]">
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
                </CardBody>
            </Card>
        </div>
    );
}

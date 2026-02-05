'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SchemaBuilder() {
    const [type, setType] = useState('LocalBusiness');
    const [data, setData] = useState<any>({ name: '', image: '', telephone: '' });
    const [jsonLd, setJsonLd] = useState('');

    useEffect(() => {
        const schema = {
            "@context": "https://schema.org",
            "@type": type,
            ...data
        };
        setJsonLd(JSON.stringify(schema, null, 2));
    }, [type, data]);

    const handleChange = (key: string, value: string) => {
        setData({ ...data, [key]: value });
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Configure Schema</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                        <Input placeholder="Business Name" value={data.name} onChange={(e) => handleChange('name', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Image URL</Label>
                        <Input placeholder="https://..." value={data.image} onChange={(e) => handleChange('image', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Telephone</Label>
                        <Input placeholder="+1..." value={data.telephone} onChange={(e) => handleChange('telephone', e.target.value)} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>JSON-LD Preview</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative">
                        <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-auto text-xs min-h-[300px]">
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
                </CardContent>
            </Card>
        </div>
    );
}

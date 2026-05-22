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
} from '@/components/zoruui';
import {
  useState,
  useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
                <ZoruCardHeader>
                    <ZoruCardTitle>Configure Schema</ZoruCardTitle>
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
                </ZoruCardContent>
            </Card>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>JSON-LD Preview</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
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
                </ZoruCardContent>
            </Card>
        </div>
    );
}

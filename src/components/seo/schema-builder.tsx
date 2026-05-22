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
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Configure Schema</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <div className="space-y-2">
                        <ZoruLabel>Schema Type</ZoruLabel>
                        <ZoruSelect value={type} onValueChange={setType}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="LocalBusiness">Local Business</ZoruSelectItem>
                                <ZoruSelectItem value="Organization">Organization</ZoruSelectItem>
                                <ZoruSelectItem value="Person">Person</ZoruSelectItem>
                                <ZoruSelectItem value="Product">Product</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>

                    <div className="space-y-2">
                        <ZoruLabel>Name</ZoruLabel>
                        <ZoruInput placeholder="Business Name" value={data.name} onChange={(e) => handleChange('name', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Image URL</ZoruLabel>
                        <ZoruInput placeholder="https://..." value={data.image} onChange={(e) => handleChange('image', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Telephone</ZoruLabel>
                        <ZoruInput placeholder="+1..." value={data.telephone} onChange={(e) => handleChange('telephone', e.target.value)} />
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>JSON-LD Preview</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="relative">
                        <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-auto text-xs min-h-[300px]">
                            {jsonLd}
                        </pre>
                        <ZoruButton
                            className="absolute top-2 right-2"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(`<script type="application/ld+json">\n${jsonLd}\n</script>`)}
                        >
                            Copy Script
                        </ZoruButton>
                    </div>
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}

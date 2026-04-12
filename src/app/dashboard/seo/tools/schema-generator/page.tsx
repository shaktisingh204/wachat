'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ToolShell } from '@/components/seo-tools/tool-shell';

type SchemaType = 'Article' | 'Product' | 'LocalBusiness' | 'FAQPage' | 'BreadcrumbList';

export default function SchemaGeneratorPage() {
  const [type, setType] = useState<SchemaType>('Article');
  const [fields, setFields] = useState({
    headline: '', author: '', date: '', image: '',
    name: '', price: '', currency: 'USD', sku: '',
    address: '', phone: '', telephone: '',
    question: '', answer: '',
    items: '',
  });
  const update = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));
  const schema = useMemo(() => {
    let obj: any = { '@context': 'https://schema.org', '@type': type };
    switch (type) {
      case 'Article':
        obj = { ...obj, headline: fields.headline, author: { '@type': 'Person', name: fields.author }, datePublished: fields.date, image: fields.image };
        break;
      case 'Product':
        obj = { ...obj, name: fields.name, image: fields.image, sku: fields.sku, offers: { '@type': 'Offer', price: fields.price, priceCurrency: fields.currency } };
        break;
      case 'LocalBusiness':
        obj = { ...obj, name: fields.name, address: fields.address, telephone: fields.phone };
        break;
      case 'FAQPage':
        obj = { ...obj, mainEntity: [{ '@type': 'Question', name: fields.question, acceptedAnswer: { '@type': 'Answer', text: fields.answer } }] };
        break;
      case 'BreadcrumbList':
        const list = fields.items.split(/\r?\n/).filter(Boolean);
        obj = { ...obj, itemListElement: list.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it })) };
        break;
    }
    return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;
  }, [type, fields]);

  return (
    <ToolShell title="Schema Markup Generator" description="Generate JSON-LD structured data.">
      <div className="flex gap-2">
        <select className="border rounded h-9 px-2 bg-background" value={type} onChange={(e) => setType(e.target.value as SchemaType)}>
          <option value="Article">Article</option>
          <option value="Product">Product</option>
          <option value="LocalBusiness">LocalBusiness</option>
          <option value="FAQPage">FAQPage</option>
          <option value="BreadcrumbList">BreadcrumbList</option>
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {type === 'Article' && <>
          <div className="space-y-1 md:col-span-2"><Label>Headline</Label><Input value={fields.headline} onChange={(e) => update('headline', e.target.value)} /></div>
          <div className="space-y-1"><Label>Author</Label><Input value={fields.author} onChange={(e) => update('author', e.target.value)} /></div>
          <div className="space-y-1"><Label>Published date</Label><Input type="date" value={fields.date} onChange={(e) => update('date', e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Image URL</Label><Input value={fields.image} onChange={(e) => update('image', e.target.value)} /></div>
        </>}
        {type === 'Product' && <>
          <div className="space-y-1"><Label>Name</Label><Input value={fields.name} onChange={(e) => update('name', e.target.value)} /></div>
          <div className="space-y-1"><Label>SKU</Label><Input value={fields.sku} onChange={(e) => update('sku', e.target.value)} /></div>
          <div className="space-y-1"><Label>Price</Label><Input value={fields.price} onChange={(e) => update('price', e.target.value)} /></div>
          <div className="space-y-1"><Label>Currency</Label><Input value={fields.currency} onChange={(e) => update('currency', e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Image URL</Label><Input value={fields.image} onChange={(e) => update('image', e.target.value)} /></div>
        </>}
        {type === 'LocalBusiness' && <>
          <div className="space-y-1"><Label>Name</Label><Input value={fields.name} onChange={(e) => update('name', e.target.value)} /></div>
          <div className="space-y-1"><Label>Phone</Label><Input value={fields.phone} onChange={(e) => update('phone', e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Address</Label><Input value={fields.address} onChange={(e) => update('address', e.target.value)} /></div>
        </>}
        {type === 'FAQPage' && <>
          <div className="space-y-1 md:col-span-2"><Label>Question</Label><Input value={fields.question} onChange={(e) => update('question', e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Answer</Label><Textarea value={fields.answer} onChange={(e) => update('answer', e.target.value)} /></div>
        </>}
        {type === 'BreadcrumbList' && <>
          <div className="space-y-1 md:col-span-2"><Label>Breadcrumb items (one per line)</Label><Textarea value={fields.items} onChange={(e) => update('items', e.target.value)} /></div>
        </>}
      </div>
      <Button onClick={() => navigator.clipboard.writeText(schema)}>Copy</Button>
      <Textarea readOnly value={schema} className="min-h-[260px] font-mono text-xs" />
    </ToolShell>
  );
}

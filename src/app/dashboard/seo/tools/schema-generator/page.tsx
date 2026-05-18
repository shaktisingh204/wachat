'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useMemo, useState } from 'react';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';

type SchemaType = 'Article' | 'Product' | 'LocalBusiness' | 'FAQPage' | 'ZoruBreadcrumbList';

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
      case 'ZoruBreadcrumbList':
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
          <option value="ZoruBreadcrumbList">ZoruBreadcrumbList</option>
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {type === 'Article' && <>
          <div className="space-y-1 md:col-span-2"><ZoruLabel>Headline</ZoruLabel><ZoruInput value={fields.headline} onChange={(e) => update('headline', e.target.value)} /></div>
          <div className="space-y-1"><ZoruLabel>Author</ZoruLabel><ZoruInput value={fields.author} onChange={(e) => update('author', e.target.value)} /></div>
          <div className="space-y-1"><ZoruLabel>Published date</ZoruLabel><ZoruInput type="date" value={fields.date} onChange={(e) => update('date', e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><ZoruLabel>Image URL</ZoruLabel><ZoruInput value={fields.image} onChange={(e) => update('image', e.target.value)} /></div>
        </>}
        {type === 'Product' && <>
          <div className="space-y-1"><ZoruLabel>Name</ZoruLabel><ZoruInput value={fields.name} onChange={(e) => update('name', e.target.value)} /></div>
          <div className="space-y-1"><ZoruLabel>SKU</ZoruLabel><ZoruInput value={fields.sku} onChange={(e) => update('sku', e.target.value)} /></div>
          <div className="space-y-1"><ZoruLabel>Price</ZoruLabel><ZoruInput value={fields.price} onChange={(e) => update('price', e.target.value)} /></div>
          <div className="space-y-1"><ZoruLabel>Currency</ZoruLabel><ZoruInput value={fields.currency} onChange={(e) => update('currency', e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><ZoruLabel>Image URL</ZoruLabel><ZoruInput value={fields.image} onChange={(e) => update('image', e.target.value)} /></div>
        </>}
        {type === 'LocalBusiness' && <>
          <div className="space-y-1"><ZoruLabel>Name</ZoruLabel><ZoruInput value={fields.name} onChange={(e) => update('name', e.target.value)} /></div>
          <div className="space-y-1"><ZoruLabel>Phone</ZoruLabel><ZoruInput value={fields.phone} onChange={(e) => update('phone', e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><ZoruLabel>Address</ZoruLabel><ZoruInput value={fields.address} onChange={(e) => update('address', e.target.value)} /></div>
        </>}
        {type === 'FAQPage' && <>
          <div className="space-y-1 md:col-span-2"><ZoruLabel>Question</ZoruLabel><ZoruInput value={fields.question} onChange={(e) => update('question', e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><ZoruLabel>Answer</ZoruLabel><ZoruTextarea value={fields.answer} onChange={(e) => update('answer', e.target.value)} /></div>
        </>}
        {type === 'ZoruBreadcrumbList' && <>
          <div className="space-y-1 md:col-span-2"><ZoruLabel>ZoruBreadcrumb items (one per line)</ZoruLabel><ZoruTextarea value={fields.items} onChange={(e) => update('items', e.target.value)} /></div>
        </>}
      </div>
      <ZoruButton onClick={() => navigator.clipboard.writeText(schema)}>Copy</ZoruButton>
      <ZoruTextarea readOnly value={schema} className="min-h-[260px] font-mono text-xs" />
    </ToolShell>
  );
}

'use client';

import { Button, Input, Label, Textarea, cn, Breadcrumb, ZoruBreadcrumbList } from '@/components/zoruui';
import { cn as _zoruCn, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

type SchemaType = 'Article' | 'Product' | 'LocalBusiness' | 'FAQPage' | 'ZoruBreadcrumbList' | 'Person' | 'Recipe';

export default function SchemaGeneratorPage() {
  const [type, setType] = useState<SchemaType>('Article');
  const [fields, setFields] = useState({
    headline: '', author: '', date: '', image: '',
    name: '', price: '', currency: 'USD', sku: '',
    address: '', phone: '', telephone: '',
    question: '', answer: '',
    items: '',
    // Person fields
    jobTitle: '', url: '', sameAs: '',
    // Recipe fields
    description: '', prepTime: '', cookTime: '', totalTime: '', recipeYield: '', recipeCategory: '', recipeCuisine: '', recipeIngredient: '', recipeInstructions: ''
  });
  const update = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));
  const schema = useMemo(() => {
    let obj: any = { '@context': 'https://schema.org', '@type': type === 'ZoruBreadcrumbList' ? 'BreadcrumbList' : type };
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
      case 'Person':
        obj = {
          ...obj,
          name: fields.name,
          jobTitle: fields.jobTitle,
          url: fields.url,
          image: fields.image,
          sameAs: fields.sameAs.split(/\r?\n/).filter(Boolean)
        };
        break;
      case 'Recipe':
        obj = {
          ...obj,
          name: fields.name,
          image: fields.image,
          author: { '@type': 'Person', name: fields.author },
          datePublished: fields.date,
          description: fields.description,
          prepTime: fields.prepTime,
          cookTime: fields.cookTime,
          totalTime: fields.totalTime,
          recipeYield: fields.recipeYield,
          recipeCategory: fields.recipeCategory,
          recipeCuisine: fields.recipeCuisine,
          recipeIngredient: fields.recipeIngredient.split(/\r?\n/).filter(Boolean),
          recipeInstructions: fields.recipeInstructions.split(/\r?\n/).filter(Boolean).map(text => ({
            '@type': 'HowToStep',
            text
          }))
        };
        break;
    }
    return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;
  }, [type, fields]);

  return (
    <ToolShell title="Schema Markup Generator" description="Generate JSON-LD structured data.">
      <div className="flex gap-2">
        <select className="border rounded h-9 px-2 bg-zoru-surface" value={type} onChange={(e) => setType(e.target.value as SchemaType)}>
          <option value="Article">Article</option>
          <option value="Product">Product</option>
          <option value="LocalBusiness">LocalBusiness</option>
          <option value="FAQPage">FAQPage</option>
          <option value="ZoruBreadcrumbList">BreadcrumbList</option>
          <option value="Person">Person</option>
          <option value="Recipe">Recipe</option>
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
        {type === 'ZoruBreadcrumbList' && <>
          <div className="space-y-1 md:col-span-2"><Label>Breadcrumb items (one per line)</Label><Textarea value={fields.items} onChange={(e) => update('items', e.target.value)} /></div>
        </>}
        {type === 'Person' && <>
          <div className="space-y-1"><Label>Name</Label><Input value={fields.name} onChange={(e) => update('name', e.target.value)} /></div>
          <div className="space-y-1"><Label>Job Title</Label><Input value={fields.jobTitle} onChange={(e) => update('jobTitle', e.target.value)} /></div>
          <div className="space-y-1"><Label>URL</Label><Input value={fields.url} onChange={(e) => update('url', e.target.value)} /></div>
          <div className="space-y-1"><Label>Image URL</Label><Input value={fields.image} onChange={(e) => update('image', e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Same As (URLs, one per line)</Label><Textarea value={fields.sameAs} onChange={(e) => update('sameAs', e.target.value)} /></div>
        </>}
        {type === 'Recipe' && <>
          <div className="space-y-1"><Label>Name</Label><Input value={fields.name} onChange={(e) => update('name', e.target.value)} /></div>
          <div className="space-y-1"><Label>Image URL</Label><Input value={fields.image} onChange={(e) => update('image', e.target.value)} /></div>
          <div className="space-y-1"><Label>Author</Label><Input value={fields.author} onChange={(e) => update('author', e.target.value)} /></div>
          <div className="space-y-1"><Label>Published Date</Label><Input type="date" value={fields.date} onChange={(e) => update('date', e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Description</Label><Textarea value={fields.description} onChange={(e) => update('description', e.target.value)} /></div>
          <div className="space-y-1"><Label>Prep Time (e.g. PT20M)</Label><Input value={fields.prepTime} onChange={(e) => update('prepTime', e.target.value)} /></div>
          <div className="space-y-1"><Label>Cook Time (e.g. PT30M)</Label><Input value={fields.cookTime} onChange={(e) => update('cookTime', e.target.value)} /></div>
          <div className="space-y-1"><Label>Total Time (e.g. PT50M)</Label><Input value={fields.totalTime} onChange={(e) => update('totalTime', e.target.value)} /></div>
          <div className="space-y-1"><Label>Recipe Yield</Label><Input value={fields.recipeYield} onChange={(e) => update('recipeYield', e.target.value)} /></div>
          <div className="space-y-1"><Label>Recipe Category</Label><Input value={fields.recipeCategory} onChange={(e) => update('recipeCategory', e.target.value)} /></div>
          <div className="space-y-1"><Label>Recipe Cuisine</Label><Input value={fields.recipeCuisine} onChange={(e) => update('recipeCuisine', e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Ingredients (one per line)</Label><Textarea value={fields.recipeIngredient} onChange={(e) => update('recipeIngredient', e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Instructions (one per line)</Label><Textarea value={fields.recipeInstructions} onChange={(e) => update('recipeInstructions', e.target.value)} /></div>
        </>}
      </div>
      <Button onClick={() => navigator.clipboard.writeText(schema)}>Copy to Clipboard</Button>
      <div className="border rounded-md overflow-hidden bg-zoru-surface">
        <CodeMirror
          value={schema}
          editable={false}
          extensions={[EditorView.lineWrapping]}
          className="text-xs font-mono min-h-[260px]"
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }}
        />
      </div>
    </ToolShell>
  );
}


'use client';

import {
  Button,
  Input,
  Textarea,
  Field,
  Card,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';

import { ToolShell } from '@/components/seo-tools/tool-shell';

type SchemaType = 'Article' | 'Product' | 'LocalBusiness' | 'FAQPage' | 'BreadcrumbList' | 'Person' | 'Recipe';

const SCHEMA_TYPES: SchemaType[] = ['Article', 'Product', 'LocalBusiness', 'FAQPage', 'BreadcrumbList', 'Person', 'Recipe'];

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
    let obj: any = { '@context': 'https://schema.org', '@type': type === 'BreadcrumbList' ? 'BreadcrumbList' : type };
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
      <Field label="Schema type" className="max-w-xs">
        <Select value={type} onValueChange={(v) => setType(v as SchemaType)}>
          <SelectTrigger aria-label="Schema type">
            <SelectValue placeholder="Choose a schema type" />
          </SelectTrigger>
          <SelectContent>
            {SCHEMA_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {type === 'Article' && <>
          <Field label="Headline" className="md:col-span-2"><Input value={fields.headline} onChange={(e) => update('headline', e.target.value)} placeholder="10 SEO tips for 2026" /></Field>
          <Field label="Author"><Input value={fields.author} onChange={(e) => update('author', e.target.value)} placeholder="Jane Cooper" /></Field>
          <Field label="Published date"><Input type="date" value={fields.date} onChange={(e) => update('date', e.target.value)} /></Field>
          <Field label="Image URL" className="md:col-span-2"><Input value={fields.image} onChange={(e) => update('image', e.target.value)} placeholder="https://example.com/cover.jpg" /></Field>
        </>}
        {type === 'Product' && <>
          <Field label="Name"><Input value={fields.name} onChange={(e) => update('name', e.target.value)} placeholder="Wireless Headphones" /></Field>
          <Field label="SKU"><Input value={fields.sku} onChange={(e) => update('sku', e.target.value)} placeholder="WH-1000" /></Field>
          <Field label="Price"><Input value={fields.price} onChange={(e) => update('price', e.target.value)} placeholder="299.00" /></Field>
          <Field label="Currency"><Input value={fields.currency} onChange={(e) => update('currency', e.target.value)} placeholder="USD" /></Field>
          <Field label="Image URL" className="md:col-span-2"><Input value={fields.image} onChange={(e) => update('image', e.target.value)} placeholder="https://example.com/product.jpg" /></Field>
        </>}
        {type === 'LocalBusiness' && <>
          <Field label="Name"><Input value={fields.name} onChange={(e) => update('name', e.target.value)} placeholder="Cooper Coffee Co." /></Field>
          <Field label="Phone"><Input value={fields.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+1 555 123 4567" /></Field>
          <Field label="Address" className="md:col-span-2"><Input value={fields.address} onChange={(e) => update('address', e.target.value)} placeholder="100 Market St, San Francisco, CA" /></Field>
        </>}
        {type === 'FAQPage' && <>
          <Field label="Question" className="md:col-span-2"><Input value={fields.question} onChange={(e) => update('question', e.target.value)} placeholder="What is structured data?" /></Field>
          <Field label="Answer" className="md:col-span-2"><Textarea value={fields.answer} onChange={(e) => update('answer', e.target.value)} placeholder="Structured data helps search engines understand your page." /></Field>
        </>}
        {type === 'BreadcrumbList' && <>
          <Field label="Breadcrumb items" help="One item per line." className="md:col-span-2"><Textarea value={fields.items} onChange={(e) => update('items', e.target.value)} placeholder={'Home\nBlog\nSEO'} /></Field>
        </>}
        {type === 'Person' && <>
          <Field label="Name"><Input value={fields.name} onChange={(e) => update('name', e.target.value)} placeholder="Jane Cooper" /></Field>
          <Field label="Job title"><Input value={fields.jobTitle} onChange={(e) => update('jobTitle', e.target.value)} placeholder="SEO Lead" /></Field>
          <Field label="URL"><Input value={fields.url} onChange={(e) => update('url', e.target.value)} placeholder="https://janecooper.com" /></Field>
          <Field label="Image URL"><Input value={fields.image} onChange={(e) => update('image', e.target.value)} placeholder="https://example.com/jane.jpg" /></Field>
          <Field label="Same as" help="Profile URLs, one per line." className="md:col-span-2"><Textarea value={fields.sameAs} onChange={(e) => update('sameAs', e.target.value)} placeholder={'https://twitter.com/jane\nhttps://linkedin.com/in/jane'} /></Field>
        </>}
        {type === 'Recipe' && <>
          <Field label="Name"><Input value={fields.name} onChange={(e) => update('name', e.target.value)} placeholder="Classic Pancakes" /></Field>
          <Field label="Image URL"><Input value={fields.image} onChange={(e) => update('image', e.target.value)} placeholder="https://example.com/pancakes.jpg" /></Field>
          <Field label="Author"><Input value={fields.author} onChange={(e) => update('author', e.target.value)} placeholder="Jane Cooper" /></Field>
          <Field label="Published date"><Input type="date" value={fields.date} onChange={(e) => update('date', e.target.value)} /></Field>
          <Field label="Description" className="md:col-span-2"><Textarea value={fields.description} onChange={(e) => update('description', e.target.value)} placeholder="Fluffy buttermilk pancakes in 20 minutes." /></Field>
          <Field label="Prep time" help="ISO 8601, e.g. PT20M."><Input value={fields.prepTime} onChange={(e) => update('prepTime', e.target.value)} placeholder="PT20M" /></Field>
          <Field label="Cook time" help="ISO 8601, e.g. PT30M."><Input value={fields.cookTime} onChange={(e) => update('cookTime', e.target.value)} placeholder="PT30M" /></Field>
          <Field label="Total time" help="ISO 8601, e.g. PT50M."><Input value={fields.totalTime} onChange={(e) => update('totalTime', e.target.value)} placeholder="PT50M" /></Field>
          <Field label="Recipe yield"><Input value={fields.recipeYield} onChange={(e) => update('recipeYield', e.target.value)} placeholder="4 servings" /></Field>
          <Field label="Recipe category"><Input value={fields.recipeCategory} onChange={(e) => update('recipeCategory', e.target.value)} placeholder="Breakfast" /></Field>
          <Field label="Recipe cuisine"><Input value={fields.recipeCuisine} onChange={(e) => update('recipeCuisine', e.target.value)} placeholder="American" /></Field>
          <Field label="Ingredients" help="One per line." className="md:col-span-2"><Textarea value={fields.recipeIngredient} onChange={(e) => update('recipeIngredient', e.target.value)} placeholder={'2 cups flour\n2 eggs\n1.5 cups milk'} /></Field>
          <Field label="Instructions" help="One step per line." className="md:col-span-2"><Textarea value={fields.recipeInstructions} onChange={(e) => update('recipeInstructions', e.target.value)} placeholder={'Whisk the dry ingredients.\nAdd eggs and milk.\nCook until golden.'} /></Field>
        </>}
      </div>

      <div>
        <Button variant="primary" iconLeft={Copy} onClick={() => navigator.clipboard.writeText(schema)}>
          Copy to clipboard
        </Button>
      </div>

      <Card padding="none" className="overflow-hidden">
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
      </Card>
    </ToolShell>
  );
}


import { notFound } from 'next/navigation';
import { getEcommShopBySlug, getEcommProducts } from '@/app/actions/custom-ecommerce.actions';
import type { WebsiteBlock, EcommProduct, WithId } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { ObjectId } from 'mongodb';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


const HeroBlock = ({ settings }: { settings: any }) => (
    <div className="relative w-full h-80 md:h-96 text-white rounded-lg overflow-hidden flex items-center justify-center text-center p-4" style={{ backgroundColor: settings.backgroundColor || '#111827' }}>
        {settings.backgroundImageUrl && <Image src={settings.backgroundImageUrl} alt={settings.title || 'Banner'} layout="fill" objectFit="cover" className="opacity-30" data-ai-hint="store banner"/>}
        <div className="relative z-10 space-y-4">
            <h1 className="text-4xl md:text-6xl font-extrabold" style={{fontFamily: settings.fontFamily, color: settings.textColor || '#FFFFFF'}}>{settings.title || 'Welcome to Our Shop'}</h1>
            <p className="text-lg md:text-xl text-white/80" style={{fontFamily: settings.fontFamily}}>{settings.subtitle || 'Discover our amazing products'}</p>
            {settings.buttonText && <Button size="lg" style={{backgroundColor: settings.buttonColor, color: settings.buttonTextColor}}>{settings.buttonText}</Button>}
        </div>
    </div>
);

const FeaturedProductsBlock = ({ settings, products }: { settings: any, products: WithId<EcommProduct>[] }) => {
    const productIds = settings.productIds || [];
    const featuredProducts = products.filter(p => productIds.includes(p._id.toString()));
    const gridCols = settings.columns === '4' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3';

    return (
        <div className="w-full">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold">{settings.title || 'Featured Products'}</h2>
                <p className="text-muted-foreground">{settings.subtitle}</p>
            </div>
             <div className={cn("grid gap-6", gridCols)}>
                {featuredProducts.map(product => (
                    <Card key={product._id.toString()}>
                        <CardHeader className="p-0">
                            <div className="relative aspect-square">
                                <Image src={product.imageUrl || 'https://placehold.co/400x400.png'} alt={product.name} layout="fill" objectFit="cover" className="rounded-t-lg" data-ai-hint="product image"/>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4">
                            <h3 className="font-semibold text-lg">{product.name}</h3>
                            <p className="text-muted-foreground">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(product.price)}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

const RichTextBlock = ({ settings }: { settings: any }) => (
    <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: settings.htmlContent || '' }} />
);

const TestimonialsBlock = ({ settings }: { settings: any }) => (
    <div className="w-full">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold">{settings.title || 'What Our Customers Say'}</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(settings.testimonials || []).map((item: any) => (
                <Card key={item.id}>
                    <CardContent className="p-6">
                        <p className="italic">"{item.quote}"</p>
                    </CardContent>
                    <CardFooter>
                        <p className="font-semibold">{item.author}</p>
                        <p className="text-sm text-muted-foreground ml-2">- {item.title}</p>
                    </CardFooter>
                </Card>
            ))}
        </div>
    </div>
);

const FaqBlock = ({ settings }: { settings: any }) => (
     <div className="w-full max-w-3xl mx-auto">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold">{settings.title || 'Frequently Asked Questions'}</h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
            {(settings.faqItems || []).map((item: any, index: number) => (
                <AccordionItem value={`item-${item.id || index}`} key={item.id || index}>
                    <AccordionTrigger>{item.question}</AccordionTrigger>
                    <AccordionContent>{item.answer}</AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    </div>
);

const CustomHtmlBlock = ({ settings }: { settings: any }) => (
    <div dangerouslySetInnerHTML={{ __html: settings.html || '' }} />
);


export default async function ShopPage({ params }: { params: { slug: string } }) {
    if (!params.slug) {
        notFound();
    }

    const shop = await getEcommShopBySlug(params.slug);

    if (!shop) {
        notFound();
    }
    
    // Fetch all products for the shop to pass to blocks that need them
    const products = await getEcommProducts(shop._id.toString());
    const homepageLayout = shop.homepageLayout || [];

    const BlockRenderer = ({ block }: { block: WebsiteBlock }) => {
        switch (block.type) {
            case 'hero':
                return <HeroBlock settings={block.settings} />;
            case 'featuredProducts':
                return <FeaturedProductsBlock settings={block.settings} products={products} />;
            case 'richText':
                return <RichTextBlock settings={block.settings} />;
            case 'testimonials':
                return <TestimonialsBlock settings={block.settings} />;
            case 'faq':
                return <FaqBlock settings={block.settings} />;
            case 'customHtml':
                return <CustomHtmlBlock settings={block.settings} />;
            default:
                return <div className="text-center text-muted-foreground">Unsupported block type: {block.type}</div>;
        }
    };
    
    // Determine the global font for the body from the Hero block if it exists
    const heroBlock = homepageLayout.find(b => b.type === 'hero');
    const globalFontFamily = heroBlock?.settings?.fontFamily || 'Inter, sans-serif';

    return (
        <div style={{ fontFamily: globalFontFamily }}>
            <main className="flex flex-col items-center space-y-12 md:space-y-16 p-4 md:p-8">
                {homepageLayout.length > 0 ? (
                    homepageLayout.map(block => <BlockRenderer key={block.id} block={block} />)
                ) : (
                    <div className="text-center py-24">
                        <h1 className="text-4xl font-bold">{shop.name}</h1>
                        <p className="text-lg text-muted-foreground mt-4">This shop is under construction. Come back soon!</p>
                    </div>
                )}
            </main>
        </div>
    );
}

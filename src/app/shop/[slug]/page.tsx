
import { notFound } from 'next/navigation';
import { getEcommShopBySlug } from '@/app/actions/custom-ecommerce.actions';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Image from 'next/image';
import { connectToDatabase } from '@/lib/mongodb';
import type { EcommProduct } from '@/lib/definitions';
import { ObjectId } from 'mongodb';

export default async function ShopPage({ params }: { params: { slug: string } }) {
    if (!params.slug) {
        notFound();
    }

    const shop = await getEcommShopBySlug(params.slug);

    if (!shop) {
        notFound();
    }
    
    const { db } = await connectToDatabase();
    const products = await db.collection<EcommProduct>('ecomm_products')
        .find({ shopId: new ObjectId(shop._id) })
        .sort({ createdAt: -1 })
        .toArray();

    return (
        <div className="flex flex-col items-center p-4 md:p-8" style={{fontFamily: shop.appearance?.fontFamily || 'Inter, sans-serif'}}>
            {shop.appearance?.bannerImageUrl && (
                 <div className="relative w-full h-48 md:h-64 mb-8">
                    <Image src={shop.appearance.bannerImageUrl} alt={`${shop.name} banner`} layout="fill" objectFit="cover" className="rounded-lg" data-ai-hint="store banner" />
                 </div>
            )}
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold" style={{color: shop.appearance?.primaryColor}}>{shop.name}</h1>
                <p className="text-lg text-muted-foreground">Welcome to our shop!</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-7xl">
                {products.map(product => (
                    <Card key={product._id.toString()}>
                        <CardHeader className="p-0">
                            <div className="relative aspect-square">
                                <Image src={product.imageUrl || 'https://placehold.co/400x400.png'} alt={product.name} layout="fill" objectFit="cover" className="rounded-t-lg" data-ai-hint="product image" />
                            </div>
                        </CardHeader>
                        <CardContent className="p-4">
                            <h3 className="font-semibold text-lg">{product.name}</h3>
                            <p className="text-muted-foreground">{new Intl.NumberFormat('en-US', { style: 'currency', currency: shop.currency || 'USD' }).format(product.price)}</p>
                        </CardContent>
                    </Card>
                ))}
                {products.length === 0 && (
                    <p className="md:col-span-2 lg:col-span-4 text-center text-muted-foreground">No products available in this shop yet.</p>
                )}
            </div>
        </div>
    );
}



'use server';

import { getProjectById } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';
import type { EcommProduct, EcommOrder, EcommShop, AbandonedCartSettings, WebsiteBlock, EcommProductVariant, EcommPage, EcommTheme } from '@/lib/definitions';
import { ObjectId, WithId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// --- Shop Actions ---

export async function getEcommShops(projectId: string): Promise<WithId<EcommShop>[]> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const shops = await db.collection<EcommShop>('ecomm_shops')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(shops));
    } catch (e) {
        console.error("Failed to get e-commerce shops:", e);
        return [];
    }
}

export async function getEcommShopById(shopId: string): Promise<WithId<EcommShop> | null> {
    if (!ObjectId.isValid(shopId)) return null;

    const { db } = await connectToDatabase();
    const shop = await db.collection<EcommShop>('ecomm_shops').findOne({ _id: new ObjectId(shopId) });

    if (!shop) return null;
    const hasAccess = await getProjectById(shop.projectId.toString());
    if (!hasAccess) return null;

    return JSON.parse(JSON.stringify(shop));
}

export async function getPublicEcommShopById(shopId: string): Promise<WithId<EcommShop> | null> {
    if (!ObjectId.isValid(shopId)) return null;
    try {
        const { db } = await connectToDatabase();
        const shop = await db.collection<EcommShop>('ecomm_shops').findOne({ _id: new ObjectId(shopId) });
        return shop ? JSON.parse(JSON.stringify(shop)) : null;
    } catch (e) {
        console.error("Failed to get public e-commerce shop by ID:", e);
        return null;
    }
}


export async function getEcommShopBySlug(slug: string): Promise<WithId<EcommShop> | null> {
    if (!slug) return null;

    try {
        const { db } = await connectToDatabase();
        const shop = await db.collection<EcommShop>('ecomm_shops').findOne({ slug });

        if (!shop) return null;
        
        // This is a public page, so we don't need to check for user session access.
        
        return JSON.parse(JSON.stringify(shop));
    } catch(e) {
        console.error("Failed to get shop by slug:", e);
        return null;
    }
}


export async function createEcommShop(prevState: any, formData: FormData): Promise<{ message?: string, error?: string, shopId?: string }> {
    const projectId = formData.get('projectId') as string;
    const name = formData.get('name') as string;
    const currency = formData.get('currency') as string;

    if (!projectId || !name || !currency) return { error: 'Project, Shop Name, and Currency are required.' };

    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied or project not found.' };

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    try {
        const { db } = await connectToDatabase();
        
        const existingSlug = await db.collection('ecomm_shops').findOne({ slug });
        if (existingSlug) {
            return { error: 'A shop with this name already exists, resulting in a duplicate URL slug. Please choose a different name.' };
        }

        const newShop: Omit<EcommShop, '_id'> = {
            projectId: new ObjectId(projectId),
            name,
            slug,
            currency,
            createdAt: new Date(),
            updatedAt: new Date(),
            themes: [],
        };

        const result = await db.collection('ecomm_shops').insertOne(newShop as any);
        const shopId = result.insertedId;
        
        // Automatically create a default homepage for the new shop
        const homepage: Omit<EcommPage, '_id'> = {
            shopId,
            projectId: new ObjectId(projectId),
            name: 'Home',
            slug: 'home', // Or derive from name
            layout: [
                {
                    id: uuidv4(),
                    type: "hero",
                    settings: {
                      title: "Your New Favorite Store",
                      subtitle: "Discover amazing products and deals you won't find anywhere else. Quality and style delivered to your door.",
                      buttonText: "Shop All Products",
                      buttonLink: `/shop/${slug}/products`, // Assuming a future products page
                      height: "60vh",
                      backgroundColor: "#e2e8f0",
                      textColor: "#1e293b",
                      buttonColor: "#000000",
                      buttonTextColor: "#FFFFFF",
                      backgroundImageUrl: "https://placehold.co/1920x1080.png",
                      "data-ai-hint": "modern storefront"
                    },
                },
                {
                    id: uuidv4(),
                    type: "featuredProducts",
                    settings: {
                        title: "Featured Products",
                        subtitle: "Check out our hand-picked selection of best-selling items.",
                        columns: '3',
                        productIds: [],
                        showViewAllButton: true,
                    }
                },
                 {
                    id: uuidv4(),
                    type: "testimonials",
                    settings: {
                        title: "What Our Customers Say",
                        testimonials: [
                            { id: uuidv4(), quote: "This is the best store ever! The quality is amazing and the shipping was so fast. Highly recommended.", author: "Jane Doe", title: "Happy Customer", avatar: "https://placehold.co/100x100.png" },
                            { id: uuidv4(), quote: "I'm in love with the products. I will definitely be back for more. The customer service was also top-notch.", author: "John Smith", title: "Loyal Shopper", avatar: "https://placehold.co/100x100.png" },
                            { id: uuidv4(), quote: "A fantastic experience from start to finish. The website is easy to use and my order arrived perfectly.", author: "Sam Wilson", title: "First-time Buyer", avatar: "https://placehold.co/100x100.png" },
                        ]
                    }
                },
            ],
            isHomepage: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await db.collection('ecomm_pages').insertOne(homepage as any);
        
        revalidatePath('/dashboard/facebook/custom-ecommerce');
        return { message: `Shop "${name}" created successfully.`, shopId: shopId.toString() };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateEcommShopSettings(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const shopId = formData.get('shopId') as string;
    if (!shopId || !ObjectId.isValid(shopId)) {
        return { error: 'Shop ID is missing or invalid.' };
    }

    const shop = await getEcommShopById(shopId);
    if (!shop) return { error: 'Access denied or shop not found.' };

    try {
        const { db } = await connectToDatabase();
        const updates: Partial<EcommShop> = {};
        
        const shopName = formData.get('name') as string;
        if(shopName) updates.name = shopName;
        
        const currency = formData.get('currency') as string;
        if(currency) updates.currency = currency;

        const domainValue = formData.get('customDomain') as string;
        updates.customDomain = (domainValue === 'none' || !domainValue) ? undefined : domainValue;
        
        if (formData.has('paymentLinkRazorpay')) updates.paymentLinkRazorpay = (formData.get('paymentLinkRazorpay') as string) || undefined;
        if (formData.has('paymentLinkPaytm')) updates.paymentLinkPaytm = (formData.get('paymentLinkPaytm') as string) || undefined;
        if (formData.has('paymentLinkGPay')) updates.paymentLinkGPay = (formData.get('paymentLinkGPay') as string) || undefined;
        
        if (formData.has('persistentMenu')) {
            try { updates.persistentMenu = JSON.parse(formData.get('persistentMenu') as string); } catch(e) { return { error: 'Invalid persistent menu data format.'}; }
        }

        if (formData.has('headerLayout')) {
            try { updates.headerLayout = JSON.parse(formData.get('headerLayout') as string); } catch(e) { return { error: 'Invalid header layout data format.' }; }
        }
        if (formData.has('footerLayout')) {
            try { updates.footerLayout = JSON.parse(formData.get('footerLayout') as string); } catch(e) { return { error: 'Invalid footer layout data format.' }; }
        }
        if (formData.has('productPageLayout')) {
            try { updates.productPageLayout = JSON.parse(formData.get('productPageLayout') as string); } catch(e) { return { error: 'Invalid product page layout data format.' }; }
        }
         if (formData.has('cartPageLayout')) {
            try { updates.cartPageLayout = JSON.parse(formData.get('cartPageLayout') as string); } catch(e) { return { error: 'Invalid cart page layout data format.' }; }
        }

        if (formData.has('abandonedCart.enabled')) {
            updates.abandonedCart = { ...shop.abandonedCart } as AbandonedCartSettings;
            updates.abandonedCart.enabled = formData.get('abandonedCart.enabled') === 'on';
            updates.abandonedCart.delayMinutes = parseInt(formData.get('abandonedCart.delayMinutes') as string, 10);
            updates.abandonedCart.flowId = formData.get('abandonedCart.flowId') as string;
        }

        if (Object.keys(updates).length > 0) {
            await db.collection('ecomm_shops').updateOne(
                { _id: new ObjectId(shopId) },
                { $set: { ...updates, updatedAt: new Date() } }
            );
        }

        revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${shopId}/settings`);
        revalidatePath(`/shop/${shop.slug}`);
        return { message: 'Shop settings saved successfully!' };
    } catch (e: any) {
        return { error: 'Failed to save shop settings.' };
    }
}

export async function applyEcommShopTheme(shopId: string): Promise<{ message?: string; error?: string }> {
    if (!ObjectId.isValid(shopId)) return { error: 'Invalid Shop ID.' };

    const shop = await getEcommShopById(shopId);
    if (!shop) return { error: 'Access denied or shop not found.' };

      const defaultHomepageLayout: WebsiteBlock[] = [
        {
            id: uuidv4(),
            type: "imageCarousel",
            settings: {
                slidesToShow: 1,
                autoplay: true,
                loop: true,
                navigation: 'dots',
                images: [
                    { id: uuidv4(), src: "https://placehold.co/1200x400.png", link: "#", 'data-ai-hint': "ecommerce sale banner" },
                    { id: uuidv4(), src: "https://placehold.co/1200x400.png", link: "#", 'data-ai-hint': "product promotion" },
                    { id: uuidv4(), src: "https://placehold.co/1200x400.png", link: "#", 'data-ai-hint': "fashion electronics" },
                ]
            }
        },
        {
            id: uuidv4(),
            type: "repeater",
            settings: {
                layout: 'grid',
                columns: 6,
                items: [
                    { id: uuidv4(), imageUrl: "https://placehold.co/150x150.png", title: "Mobiles", "data-ai-hint": 'smartphone' },
                    { id: uuidv4(), imageUrl: "https://placehold.co/150x150.png", title: "Fashion", "data-ai-hint": 'clothing model' },
                    { id: uuidv4(), imageUrl: "https://placehold.co/150x150.png", title: "Electronics", "data-ai-hint": 'laptop' },
                    { id: uuidv4(), imageUrl: "https://placehold.co/150x150.png", title: "Home", "data-ai-hint": 'sofa furniture' },
                    { id: uuidv4(), imageUrl: "https://placehold.co/150x150.png", title: "Appliances", "data-ai-hint": 'refrigerator' },
                    { id: uuidv4(), imageUrl: "https://placehold.co/150x150.png", title: "Travel", "data-ai-hint": 'airplane travel' },
                ],
            },
        },
        {
            id: uuidv4(),
            type: "featuredProducts",
            settings: {
                title: "Deals of the Day",
                columns: '4',
                productIds: [],
                showViewAllButton: true,
            }
        },
    ];

      const defaultHeaderLayout: WebsiteBlock[] = [
        {
            id: uuidv4(),
            type: 'section',
            settings: {
                width: 'full',
                padding: { top: '12', bottom: '12', left: '24', right: '24' },
                backgroundColor: 'hsl(var(--primary))',
                sticky: 'top',
            },
            children: [{
                id: uuidv4(),
                type: 'columns',
                settings: { columnCount: 3, verticalAlign: 'center', gap: 24, columns: [ { width: '20%' }, { width: '50%' }, { width: '30%' } ] },
                children: [
                    {
                        id: uuidv4(),
                        type: 'column',
                        children: [{
                            id: uuidv4(),
                            type: 'heading',
                            settings: { text: shop.name, htmlTag: 'h1', link: `/shop/${shop.slug}`, color: '#FFFFFF', size: 'text-2xl', fontFamily: "'Roboto', sans-serif" }
                        }]
                    },
                    {
                        id: uuidv4(),
                        type: 'column',
                        children: [{
                            id: uuidv4(),
                            type: 'form',
                            settings: {
                                fields: [{ id: uuidv4(), type: 'text', placeholder: 'Search for products, brands and more', fieldId: 'search' }],
                                submitButtonText: 'Search',
                                buttonIcon: 'Search'
                            }
                        }]
                    },
                    {
                        id: uuidv4(),
                        type: 'column',
                        settings: { horizontalAlign: 'flex-end', verticalAlign: 'center'},
                        children: [{
                            id: uuidv4(),
                            type: 'button',
                            settings: { text: 'Cart', link: `/shop/${shop.slug}/cart`, size: 'default', variant: 'secondary', icon: 'ShoppingCart' }
                        }]
                    }
                ]
            }]
        }
      ];

      const defaultFooterLayout: WebsiteBlock[] = [
         {
            id: uuidv4(),
            type: 'section',
            settings: {
                padding: { top: '48', bottom: '48', left: '16', right: '16' },
                width: 'full',
                backgroundColor: '#212529'
            },
            children: [
              {
                id: uuidv4(),
                type: 'columns',
                settings: { columnCount: 4, gap: 32 },
                children: [
                  { id: uuidv4(), type: 'column', children: [{ id: uuidv4(), type: 'richText', settings: { htmlContent: '<h4 style="color: white; margin-bottom: 1rem;">ABOUT</h4><ul style="list-style: none; padding: 0; color: #adb5bd;"><li><a href="#">Contact Us</a></li><li><a href="#">About Us</a></li></ul>' } }] },
                  { id: uuidv4(), type: 'column', children: [{ id: uuidv4(), type: 'richText', settings: { htmlContent: '<h4 style="color: white; margin-bottom: 1rem;">HELP</h4><ul style="list-style: none; padding: 0; color: #adb5bd;"><li><a href="#">Payments</a></li><li><a href="#">Shipping</a></li></ul>' } }] },
                  { id: uuidv4(), type: 'column', children: [{ id: uuidv4(), type: 'richText', settings: { htmlContent: '<h4 style="color: white; margin-bottom: 1rem;">POLICY</h4><ul style="list-style: none; padding: 0; color: #adb5bd;"><li><a href="#">Return Policy</a></li><li><a href="#">Terms Of Use</a></li></ul>' } }] },
                  { id: uuidv4(), type: 'column', children: [{ id: uuidv4(), type: 'richText', settings: { htmlContent: '<h4 style="color: white; margin-bottom: 1rem;">SOCIAL</h4><ul style="list-style: none; padding: 0; color: #adb5bd;"><li><a href="#">Facebook</a></li><li><a href="#">Twitter</a></li></ul>' } }] },
                ]
              },
              { id: uuidv4(), type: 'spacer', settings: { type: 'divider', color: '#495057', margin: {top: 48, bottom: 24}} },
              { id: uuidv4(), type: 'richText', settings: { htmlContent: `<p style="color: #6c757d; font-size: 0.875rem; text-align: center;">© ${new Date().getFullYear()} SabNode Shops. All Rights Reserved.</p>` } }
            ]
          }
      ];

       const defaultProductPageLayout: WebsiteBlock[] = [
        {
            id: uuidv4(), type: 'section', settings: { width: 'boxed', padding: { top: '64', bottom: '64' }},
            children: [{
                id: uuidv4(), type: 'columns', settings: { columnCount: 2, gap: 48, verticalAlign: 'flex-start' },
                children: [
                    { id: uuidv4(), type: 'column', children: [{id: uuidv4(), type: 'productImage', settings: {}}] },
                    { 
                        id: uuidv4(), 
                        type: 'column', 
                        children: [
                            {id: uuidv4(), type: 'productBreadcrumbs', settings: {}},
                            {id: uuidv4(), type: 'heading', settings: {htmlTag: 'div'}, children: [{id: uuidv4(), type: 'productTitle', settings: {}}]},
                            {id: uuidv4(), type: 'richText', settings: {htmlContent: '<div class="flex items-center gap-1"><span class="text-yellow-500">★★★★☆</span><span class="text-sm text-muted-foreground">(12 Reviews)</span></div>', margin: { bottom: '16' }}},
                            {id: uuidv4(), type: 'productPrice', settings: {}},
                            {id: uuidv4(), type: 'spacer', settings: {type: 'spacer', height: 16}},
                            {id: uuidv4(), type: 'productDescription', settings: {}},
                            {id: uuidv4(), type: 'spacer', settings: {type: 'spacer', height: 24}},
                            {id: uuidv4(), type: 'productAddToCart', settings: {}},
                        ]
                    }
                ]
            }]
        }
      ];
      
      const defaultCartPageLayout: WebsiteBlock[] = [
        {
            id: uuidv4(),
            type: 'section',
            settings: { padding: { top: '64', bottom: '64', left: '16', right: '16' }, width: 'boxed' },
            children: [
                 { id: uuidv4(), type: 'heading', settings: { text: 'Your Shopping Cart', htmlTag: 'h1', textAlign: 'center' }},
                 { id: uuidv4(), type: 'spacer', settings: { height: 48 }},
                 { id: uuidv4(), type: 'cart', settings: {}, children: [] }
            ]
        }
      ];

    try {
        const { db } = await connectToDatabase();
        
        // Find or create the homepage for this shop
        await db.collection('ecomm_pages').updateOne(
            { shopId: new ObjectId(shopId), isHomepage: true },
            { 
                $set: { layout: defaultHomepageLayout, updatedAt: new Date() },
                $setOnInsert: {
                    shopId: new ObjectId(shopId),
                    projectId: shop.projectId,
                    name: 'Home',
                    slug: 'home',
                    isHomepage: true,
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );
        
        // Also update the shop document with other layouts
        await db.collection('ecomm_shops').updateOne(
            { _id: new ObjectId(shopId) },
            { $set: { 
                headerLayout: defaultHeaderLayout, 
                footerLayout: defaultFooterLayout,
                productPageLayout: defaultProductPageLayout,
                cartPageLayout: defaultCartPageLayout,
                updatedAt: new Date() 
            }}
        );

        revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${shopId}/website-builder`);
        revalidatePath(`/shop/${shop.slug}`);
        return { message: 'Flipkart-style theme applied successfully! You can now customize it in the Website Builder.' };
    } catch (e: any) {
        return { error: 'Failed to apply theme.' };
    }
}


// --- Page Actions ---

export async function getEcommPages(shopId: string): Promise<WithId<EcommPage>[]> {
    if (!ObjectId.isValid(shopId)) return [];
    try {
        const { db } = await connectToDatabase();
        const pages = await db.collection<EcommPage>('ecomm_pages')
            .find({ shopId: new ObjectId(shopId) })
            .sort({ isHomepage: -1, name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(pages));
    } catch (e) {
        return [];
    }
}

export async function saveEcommPage(data: {
    pageId?: string;
    shopId: string;
    name: string;
    slug: string;
    layout: WebsiteBlock[];
}): Promise<{ message?: string, error?: string, pageId?: string }> {
    const { pageId, shopId, name, slug, layout } = data;
    if (!shopId || !name || !slug) return { error: 'Shop ID, Page Name, and Slug are required.' };
    
    const shop = await getEcommShopById(shopId);
    if (!shop) return { error: 'Access denied' };
    
    const isNew = !pageId || pageId.startsWith('temp_');
    
    const pageData: Omit<EcommPage, '_id' | 'createdAt' | 'isHomepage'> = {
        name,
        slug,
        shopId: new ObjectId(shopId),
        projectId: shop.projectId,
        layout,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        
        if (isNew) {
            const result = await db.collection('ecomm_pages').insertOne({ ...pageData, createdAt: new Date() } as any);
            revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${shopId}/website-builder`);
            return { message: 'Page created successfully.', pageId: result.insertedId.toString() };
        } else {
            await db.collection('ecomm_pages').updateOne(
                { _id: new ObjectId(pageId) },
                { $set: pageData }
            );
            revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${shopId}/website-builder`);
            revalidatePath(`/shop/${shop.slug}/${slug}`);
            return { message: 'Page updated successfully.', pageId };
        }
    } catch (e: any) {
        return { error: 'Failed to save page.' };
    }
}

export async function deleteEcommPage(pageId: string): Promise<{ message?: string; error?: string }> {
    if (!ObjectId.isValid(pageId)) return { error: 'Invalid Page ID.' };

    const { db } = await connectToDatabase();
    const page = await db.collection<EcommPage>('ecomm_pages').findOne({ _id: new ObjectId(pageId) });
    if (!page) return { error: 'Page not found.' };

    const shop = await getEcommShopById(page.shopId.toString());
    if (!shop) return { error: 'Access denied' };
    
    if (page.isHomepage) return { error: 'Cannot delete the homepage. Please set another page as the homepage first.' };

    try {
        await db.collection('ecomm_pages').deleteOne({ _id: new ObjectId(pageId) });
        revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${page.shopId}/website-builder`);
        return { message: 'Page deleted.' };
    } catch (e) {
        return { error: 'Failed to delete page.' };
    }
}

export async function setAsHomepage(pageId: string, shopId: string): Promise<{ message?: string; error?: string }> {
     if (!ObjectId.isValid(pageId) || !ObjectId.isValid(shopId)) return { error: 'Invalid IDs.' };
     const shop = await getEcommShopById(shopId);
     if (!shop) return { error: 'Access denied' };

     try {
        const { db } = await connectToDatabase();
        
        // Unset any existing homepage for this shop
        await db.collection('ecomm_pages').updateMany(
            { shopId: new ObjectId(shopId), isHomepage: true },
            { $set: { isHomepage: false } }
        );
        
        // Set the new homepage
        await db.collection('ecomm_pages').updateOne(
            { _id: new ObjectId(pageId), shopId: new ObjectId(shopId) },
            { $set: { isHomepage: true } }
        );

        revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${shopId}/website-builder`);
        revalidatePath(`/shop/${shop.slug}`);
        return { message: 'Homepage updated.' };
     } catch(e) {
        return { error: 'Failed to set homepage.' };
     }
}


// --- Product Actions ---

export async function getEcommProducts(shopId: string): Promise<WithId<EcommProduct>[]> {
    if (!ObjectId.isValid(shopId)) return [];
    const shop = await getEcommShopById(shopId);
    if (!shop) return [];
    
    try {
        const { db } = await connectToDatabase();
        const products = await db.collection('ecomm_products')
            .find({ shopId: new ObjectId(shopId) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(products));
    } catch (e) {
        console.error("Failed to get e-commerce products:", e);
        return [];
    }
}

export async function getPublicEcommProducts(shopId: string): Promise<WithId<EcommProduct>[]> {
    if (!ObjectId.isValid(shopId)) return [];
    
    try {
        const { db } = await connectToDatabase();
        const products = await db.collection('ecomm_products')
            .find({ shopId: new ObjectId(shopId) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(products));
    } catch (e) {
        console.error("Failed to get public e-commerce products:", e);
        return [];
    }
}

export async function getPublicEcommProductById(productId: string): Promise<WithId<EcommProduct> | null> {
    if (!ObjectId.isValid(productId)) return null;
    
    try {
        const { db } = await connectToDatabase();
        const product = await db.collection<EcommProduct>('ecomm_products').findOne({ _id: new ObjectId(productId) });
        return product ? JSON.parse(JSON.stringify(product)) : null;
    } catch (e) {
        console.error("Failed to get public e-commerce product by ID:", e);
        return null;
    }
}


export async function saveEcommProduct(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const shopId = formData.get('shopId') as string;
    const productId = formData.get('productId') as string | null;
    const isEditing = !!productId;

    if (!shopId) return { error: 'Shop ID is missing.' };
    const shop = await getEcommShopById(shopId);
    if (!shop) return { error: 'Access denied or shop not found.' };

    try {
        const variantsString = formData.get('variants') as string;
        const variants = variantsString ? JSON.parse(variantsString) : [];

        const productData: Partial<EcommProduct> = {
            projectId: new ObjectId(shop.projectId),
            shopId: new ObjectId(shopId),
            name: formData.get('name') as string,
            description: formData.get('description') as string,
            price: parseFloat(formData.get('price') as string),
            stock: formData.get('stock') ? parseInt(formData.get('stock') as string, 10) : undefined,
            variants: variants,
            updatedAt: new Date(),
        };

        if (!productData.name || isNaN(productData.price)) {
            return { error: 'Product name and price are required.' };
        }
        
        const imageFile = formData.get('imageFile') as File | null;
        if (imageFile && imageFile.size > 0) {
            const buffer = Buffer.from(await imageFile.arrayBuffer());
            const dataUri = `data:${imageFile.type};base64,${buffer.toString('base64')}`;
            productData.imageUrl = dataUri;
        } else if (isEditing) {
            productData.imageUrl = formData.get('imageUrl') as string;
        }


        const { db } = await connectToDatabase();

        if (productId && ObjectId.isValid(productId)) {
            await db.collection('ecomm_products').updateOne(
                { _id: new ObjectId(productId), shopId: new ObjectId(shopId) },
                { $set: productData }
            );
        } else {
            productData.createdAt = new Date();
            await db.collection('ecomm_products').insertOne(productData as EcommProduct);
        }
        
        revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${shopId}/products`);
        return { message: `Product "${productData.name}" saved successfully!` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteEcommProduct(productId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(productId)) return { success: false, error: 'Invalid Product ID.' };
    
    const { db } = await connectToDatabase();
    const product = await db.collection('ecomm_products').findOne({ _id: new ObjectId(productId) });
    if (!product) return { success: false, error: 'Product not found.' };

    const shop = await getEcommShopById(product.shopId.toString());
    if(!shop) return { success: false, error: 'Access denied.' };

    try {
        await db.collection('ecomm_products').deleteOne({ _id: new ObjectId(productId) });
        revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${product.shopId.toString()}/products`);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function getEcommOrders(shopId: string): Promise<WithId<EcommOrder>[]> {
    if (!ObjectId.isValid(shopId)) return [];
    const shop = await getEcommShopById(shopId);
    if (!shop) return [];

    try {
        const { db } = await connectToDatabase();
        const orders = await db.collection('ecomm_orders')
            .find({ shopId: new ObjectId(shopId) })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();
        return JSON.parse(JSON.stringify(orders));
    } catch (e) {
        console.error("Failed to get e-commerce orders:", e);
        return [];
    }
}

export async function createEcommOrder(data: {
    shopSlug: string;
    cart: { productId: string; name: string; price: number; quantity: number }[];
    customerInfo: { name: string; email: string; phone?: string };
    shippingAddress: { street: string; city: string; state: string; zip: string; country: string };
}): Promise<{ orderId?: string, paymentUrl?: string, error?: string }> {
    const { shopSlug, cart, customerInfo, shippingAddress } = data;
    if (!shopSlug || cart.length === 0) {
        return { error: 'Invalid order data.' };
    }

    try {
        const { db } = await connectToDatabase();
        const shop = await db.collection<EcommShop>('ecomm_shops').findOne({ slug: shopSlug });
        if (!shop) {
            return { error: 'Shop not found.' };
        }

        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const shipping = 0; // Simplified for now
        const total = subtotal + shipping;

        const order: Omit<EcommOrder, '_id'> = {
            projectId: shop.projectId,
            shopId: shop._id,
            items: cart.map(item => ({
                productId: item.productId,
                productName: item.name,
                quantity: item.quantity,
                price: item.price
            })),
            subtotal,
            shipping,
            total,
            status: 'pending',
            customerInfo,
            shippingAddress,
            paymentStatus: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('ecomm_orders').insertOne(order as any);
        const orderId = result.insertedId.toString();
        
        const paymentLink = shop.paymentLinkRazorpay || shop.paymentLinkPaytm || shop.paymentLinkGPay;
        
        // This is a simplified example. A real integration would involve calling the payment provider's API.
        const paymentUrl = paymentLink ? `${paymentLink}?amount=${total}` : undefined;

        return { orderId, paymentUrl };

    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getEcommOrderById(orderId: string): Promise<WithId<EcommOrder> | null> {
    if (!ObjectId.isValid(orderId)) return null;

    try {
        const { db } = await connectToDatabase();
        const order = await db.collection<EcommOrder>('ecomm_orders').findOne({ _id: new ObjectId(orderId) });
        return order ? JSON.parse(JSON.stringify(order)) : null;
    } catch (e) {
        console.error("Failed to get e-commerce order by ID:", e);
        return null;
    }
}

export async function syncProductsToMetaCatalog(projectId: string, shopId: string, metaCatalogId: string): Promise<{ message?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Project not found or access token missing.' };

    const shop = await getEcommShopById(shopId);
    if (!shop || !shop.currency) {
        return { error: 'E-commerce currency is not set in shop settings.' };
    }
    const { accessToken } = project;
    const currency = shop.currency;

    try {
        const { db } = await connectToDatabase();
        const products = await db.collection<EcommProduct>('ecomm_products')
            .find({ shopId: new ObjectId(shopId) })
            .toArray();
        
        if (products.length === 0) {
            return { message: 'No custom products to sync.' };
        }

        const batchOps = products.map(product => {
            const body = new URLSearchParams({
                retailer_id: product._id.toString(),
                name: product.name,
                description: product.description || '',
                price: String(product.price * 100), // Price in cents
                currency: currency,
                image_url: product.imageUrl || 'https://placehold.co/600x600.png',
                availability: (product.stock ?? 1) > 0 ? 'in_stock' : 'out_of_stock',
                inventory: String(product.stock ?? 100),
                condition: 'new'
            }).toString();

            return {
                method: 'POST',
                relative_url: `${metaCatalogId}/products`,
                body: body
            };
        });
        
        const BATCH_SIZE = 50;
        let successfulSyncs = 0;
        let errors: string[] = [];

        for (let i = 0; i < batchOps.length; i += BATCH_SIZE) {
            const batch = batchOps.slice(i, i + BATCH_SIZE);
            const response = await axios.post(`https://graph.facebook.com/v23.0/`, {
                access_token: accessToken,
                batch: JSON.stringify(batch),
            });

            if (response.data.error) {
                throw new Error(getErrorMessage({ response }));
            }

            response.data.forEach((res: any, index: number) => {
                if (res.code === 200) {
                    successfulSyncs++;
                } else {
                    const errorBody = JSON.parse(res.body);
                    errors.push(`Product #${i+index}: ${errorBody.error?.message || 'Unknown error'}`);
                }
            });
        }
        
        let message = `Successfully synced ${successfulSyncs} of ${products.length} products.`;
        if (errors.length > 0) {
            message += `\nErrors on ${errors.length} products.`;
        }

        return { message, error: errors.length > 0 ? errors.join('\n') : undefined };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// --- Theme Actions ---

export async function getEcommShopThemes(shopId: string): Promise<WithId<EcommTheme>[]> {
    if (!ObjectId.isValid(shopId)) return [];
    const shop = await getEcommShopById(shopId);
    if (!shop) return [];
    return shop.themes || [];
}

export async function saveEcommShopTheme(shopId: string, themeName: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(shopId) || !themeName) return { success: false, error: 'Shop ID and Theme Name are required.' };
    
    const shop = await getEcommShopById(shopId);
    if (!shop) return { success: false, error: 'Access denied.' };

    const newTheme: EcommTheme = {
        _id: new ObjectId(),
        name: themeName,
        layouts: {
            headerLayout: shop.headerLayout || [],
            footerLayout: shop.footerLayout || [],
            productPageLayout: shop.productPageLayout || [],
            cartPageLayout: shop.cartPageLayout || [],
        },
        createdAt: new Date()
    };
    
    try {
        const { db } = await connectToDatabase();
        await db.collection('ecomm_shops').updateOne(
            { _id: new ObjectId(shopId) },
            { $push: { themes: newTheme as any } }
        );
        revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${shopId}/website-builder`);
        return { success: true };
    } catch (e) {
        return { success: false, error: 'Failed to save theme.' };
    }
}

export async function applyTheme(shopId: string, themeId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(shopId) || !ObjectId.isValid(themeId)) return { success: false, error: 'Invalid ID.' };
    
    const shop = await getEcommShopById(shopId);
    if (!shop) return { success: false, error: 'Access denied.' };

    const theme = shop.themes?.find(t => t._id.toString() === themeId);
    if (!theme) return { success: false, error: 'Theme not found.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('ecomm_shops').updateOne(
            { _id: new ObjectId(shopId) },
            { $set: { 
                headerLayout: theme.layouts.headerLayout,
                footerLayout: theme.layouts.footerLayout,
                productPageLayout: theme.layouts.productPageLayout,
                cartPageLayout: theme.layouts.cartPageLayout,
                updatedAt: new Date(),
             }}
        );
        revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${shopId}/website-builder`);
        return { success: true };
    } catch (e) {
        return { success: false, error: 'Failed to apply theme.' };
    }
}

export async function deleteEcommShopTheme(shopId: string, themeId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(shopId) || !ObjectId.isValid(themeId)) return { success: false, error: 'Invalid ID.' };
    
    const shop = await getEcommShopById(shopId);
    if (!shop) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('ecomm_shops').updateOne(
            { _id: new ObjectId(shopId) },
            { $pull: { themes: { _id: new ObjectId(themeId) } } }
        );
        revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${shopId}/website-builder`);
        return { success: true };
    } catch (e) {
        return { success: false, error: 'Failed to delete theme.' };
    }
}

export async function importEcommShopTheme(shopId: string, themeJson: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(shopId)) return { success: false, error: 'Invalid Shop ID.' };

    try {
        const themeData = JSON.parse(themeJson);

        if (!themeData.name || !themeData.layouts) {
            return { success: false, error: 'Invalid theme file. Missing name or layouts property.' };
        }
        
        const newTheme: EcommTheme = {
            _id: new ObjectId(),
            name: themeData.name,
            description: themeData.description || `Imported on ${new Date().toLocaleDateString()}`,
            layouts: {
                headerLayout: themeData.layouts.headerLayout || [],
                footerLayout: themeData.layouts.footerLayout || [],
                productPageLayout: themeData.layouts.productPageLayout || [],
                cartPageLayout: themeData.layouts.cartPageLayout || [],
            },
            createdAt: new Date(),
        };

        const { db } = await connectToDatabase();
        await db.collection('ecomm_shops').updateOne(
            { _id: new ObjectId(shopId) },
            { $push: { themes: newTheme as any } }
        );
        
        revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${shopId}/website-builder`);
        return { success: true };
    } catch(e: any) {
        console.error("Theme import error:", e);
        if(e instanceof SyntaxError) {
            return { success: false, error: 'Invalid JSON file. Please check the file and try again.' };
        }
        return { success: false, error: 'An unexpected error occurred during import.' };
    }
}


'use client';

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    MessageSquare, 
    ToggleRight, 
    GitFork, 
    Webhook, 
    ImageIcon,
    Play,
    Trash2,
    Save,
    Plus,
    Clock,
    Type,
    BrainCircuit,
    ArrowRightLeft,
    ShoppingCart,
    View,
    Server,
    Variable,
    File,
    LoaderCircle,
    BookOpen,
    PanelLeft,
    Settings2,
    Copy,
    ServerCog,
    FileText as FileTextIcon,
    ZoomIn,
    ZoomOut,
    Frame,
    Maximize,
    Minimize,
    CreditCard
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProjects } from '@/app/actions';
import { getTemplates } from '@/app/actions/whatsapp.actions';
import { saveFlow, deleteFlow, getFlowById, getFlowsForProject, getFlowBuilderPageData } from '@/app/actions/flow.actions';
import { getMetaFlows } from '@/app/actions/meta-flow.actions';
import type { Flow, FlowNode, FlowEdge, Template, MetaFlow } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { TestFlowDialog } from '@/components/wabasimplify/test-flow-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

type NodeType = 'start' | 'text' | 'buttons' | 'condition' | 'webhook' | 'image' | 'input' | 'delay' | 'api' | 'carousel' | 'addToCart' | 'language' | 'sendTemplate' | 'triggerMetaFlow' | 'triggerFlow' | 'payment';

type ButtonConfig = {
    id: string;
    type: 'QUICK_REPLY';
    text: string;
};

type CarouselSection = {
    title: string;
    products: { product_retailer_id: string }[];
};

const blockTypes = [
    { type: 'text', label: 'Send Message', icon: MessageSquare },
    { type: 'image', label: 'Send Image', icon: ImageIcon },
    { type: 'buttons', label: 'Add Buttons', icon: ToggleRight },
    { type: 'carousel', label: 'Carousel', icon: View },
    { type: 'payment', label: 'Request Payment', icon: CreditCard },
    { type: 'language', label: 'Set Language', icon: BrainCircuit },
    { type: 'input', label: 'Get User Input', icon: Type },
    { type: 'condition', label: 'Add Condition', icon: GitFork },
    { type: 'delay', label: 'Add Delay', icon: Clock },
    { type: 'api', label: 'Call API', icon: ArrowRightLeft },
    { type: 'sendTemplate', label: 'Send Template', icon: FileTextIcon },
    { type: 'triggerMetaFlow', label: 'Trigger Meta Flow', icon: ServerCog },
    { type: 'triggerFlow', label: 'Trigger Flow', icon: GitFork },
];

const NodePreview = ({ node }: { node: FlowNode }) => {
    const renderTextWithVariables = (text: string) => {
        if (!text) return null;
        const parts = text.split(/({{\s*[\w\d._]+\s*}})/g);
        return parts.map((part, i) =>
            part.match(/^{{.*}}$/) ? (
                <span key={i} className="font-semibold text-primary/90 bg-primary/10 rounded-sm px-1">
                    {part}
                </span>
            ) : (
                part
            )
        );
    };

    const previewContent = () => {
        switch (node.type) {
            case 'text':
                return <p className="whitespace-pre-wrap">{renderTextWithVariables(node.data.text) || <span className="italic opacity-50">Enter message...</span>}</p>;
            case 'image':
                return (
                    <div className="space-y-1">
                        <div className="aspect-video bg-background/50 rounded-md flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-foreground/20" />
                        </div>
                        {node.data.caption && <p className="whitespace-pre-wrap text-xs">{renderTextWithVariables(node.data.caption)}</p>}
                    </div>
                );
            case 'buttons':
                return (
                    <div className="space-y-2">
                        <p className="whitespace-pre-wrap">{renderTextWithVariables(node.data.text) || <span className="italic opacity-50">Enter message...</span>}</p>
                        <div className="space-y-1 mt-2 border-t border-muted-foreground/20 pt-2">
                            {(node.data.buttons || []).map((btn: any, index: number) => (
                                <div key={btn.id || index} className="text-center text-primary font-medium bg-background/50 py-1.5 rounded-md text-xs">
                                    {btn.text || `Button ${index + 1}`}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'sendTemplate':
                 return <p className="text-xs text-muted-foreground italic">Sends template: {node.data.templateName || 'None selected'}</p>;
            case 'triggerMetaFlow':
                 return <p className="text-xs text-muted-foreground italic">Triggers flow: {node.data.metaFlowName || 'None selected'}</p>;
            case 'triggerFlow':
                 return <p className="text-xs text-muted-foreground italic">Triggers flow: {node.data.flowName || 'None selected'}</p>;
            case 'payment':
                 return <p className="text-xs text-muted-foreground italic">Request payment of {node.data.paymentAmount || '0'} INR</p>;
            default:
                return null;
        }
    };

    const content = previewContent();
    if (!content) return null;

    return (
        <CardContent className="p-2 pt-0">
            <div className="bg-muted p-2 rounded-lg text-sm text-card-foreground/80">
                {content}
            </div>
        </CardContent>
    );
};


const NodeComponent = ({ 
    node, 
    onSelectNode, 
    isSelected,
    onNodeMouseDown,
    onHandleClick 
}: { 
    node: FlowNode; 
    onSelectNode: (id: string) => void; 
    isSelected: boolean;
    onNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void;
    onHandleClick: (e: React.MouseEvent, nodeId: string, handleId: string) => void;
}) => {
    const BlockIcon = [...blockTypes, {type: 'start', label: 'Start', icon: Play}].find(b => b.type === node.type)?.icon || MessageSquare;

    const Handle = ({ position, id, style, children }: { position: 'left' | 'right' | 'top' | 'bottom', id: string, style?: React.CSSProperties, children?: React.ReactNode }) => (
        <div 
            id={id}
            style={style}
            data-handle-pos={position}
            className={cn(
                "absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10 flex items-center justify-center",
                position === 'left' && "-left-2 top-1/2 -translate-y-1/2",
                position === 'right' && "-right-2 top-1/2 -translate-y-1/2",
            )} 
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onHandleClick(e, node.id, id); }}
        >
            {children}
        </div>
    );

    return (
        <div 
            className="absolute cursor-grab active:cursor-grabbing transition-all"
            style={{ top: node.position.y, left: node.position.x }}
            onMouseDown={(e) => onNodeMouseDown(e, node.id)}
            onClick={(e) => {e.stopPropagation(); onSelectNode(node.id)}}
        >
            <Card className={cn(
                "w-64 hover:shadow-xl hover:-translate-y-1 bg-card",
                isSelected && "ring-2 ring-primary shadow-2xl"
            )}>
                <CardHeader className="flex flex-row items-center gap-3 p-3">
                    <BlockIcon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{node.data.label}</CardTitle>
                </CardHeader>
                 
                <NodePreview node={node} />

                 {node.type === 'condition' && (
                    <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
                        <div className="flex justify-between items-center"><span>Yes</span></div>
                        <Separator className="my-1"/>
                        <div className="flex justify-between items-center"><span>No</span></div>
                    </CardContent>
                )}
                 {node.type === 'payment' && (
                    <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
                        <div className="flex justify-between items-center"><span>Success</span></div>
                        <Separator className="my-1"/>
                        <div className="flex justify-between items-center"><span>Failure</span></div>
                    </CardContent>
                )}
            </Card>

            {node.type !== 'start' && <Handle position="left" id={`${node.id}-input`} />}
            
            {node.type === 'condition' || node.type === 'payment' ? (
                <>
                    <Handle position="right" id={`${node.id}-output-yes`} style={{ top: '33.33%' }} />
                    <Handle position="right" id={`${node.id}-output-no`} style={{ top: '66.67%' }} />
                </>
            ) : node.type === 'buttons' ? (
                (node.data.buttons || []).map((btn: ButtonConfig, index: number) => {
                    const totalButtons = node.data.buttons.length;
                    const topPosition = totalButtons > 1 ? `${(100 / (totalButtons + 1)) * (index + 1)}%` : '50%';
                    return <Handle key={btn.id || index} position="right" id={`${node.id}-btn-${index}`} style={{ top: topPosition }} />;
                })
            ) : (
                 node.type !== 'addToCart' && <Handle position="right" id={`${node.id}-output-main`} />
            )}
        </div>
    );
};
```
- src/components/wabasimplify/website-builder/product-card.tsx:
```tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import type { WithId, EcommProduct, EcommShop } from '@/lib/definitions';
import { useCart } from '@/context/cart-context';

export function ProductCard({ product, shopSettings, shopSlug }: { product: WithId<EcommProduct>, shopSettings: WithId<EcommShop> | null, shopSlug: string }) {
  const currency = shopSettings?.currency || 'USD';
  const { addToCart } = useCart();
  
  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      productId: product._id.toString(),
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      quantity: 1
    });
  }

  return (
     <Link href={`/shop/${shopSlug}/product/${product._id.toString()}`} className="group block">
       <Card className="overflow-hidden h-full flex flex-col transition-all group-hover:shadow-lg">
        <div className="relative aspect-[4/5] bg-muted">
          <Image
            src={product.imageUrl || 'https://placehold.co/400x500.png'}
            alt={product.name}
            layout="fill"
            objectFit="cover"
            className="transition-transform group-hover:scale-105"
            data-ai-hint="product photo"
          />
        </div>
        <CardContent className="p-4 flex-grow flex flex-col justify-between">
            <div>
                <h3 className="font-semibold text-base line-clamp-2">{product.name}</h3>
                <p className="text-sm text-muted-foreground">{product.category || 'Uncategorized'}</p>
            </div>
            <div className="flex justify-between items-center mt-2">
                <p className="text-lg font-bold text-primary">
                {new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                }).format(product.price)}
                </p>
                 <Button size="sm" variant="outline" onClick={handleAddToCart}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Add
                </Button>
            </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```
- src/app/shop/page.tsx:
```tsx
'use client';

import { getEcommShopBySlug } from '@/app/actions/custom-ecommerce.actions';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/wabasimplify/website-builder/product-card';
import type { EcommProduct, EcommShop, WithId } from '@/lib/definitions';
import { useEffect, useState } from 'react';

export default function ShopIndexPage({ params }: { params: { slug: string } }) {
    const [shop, setShop] = useState<WithId<EcommShop> | null>(null);
    const [products, setProducts] = useState<WithId<EcommProduct>[]>([]);
    
    useEffect(() => {
        async function fetchData() {
            const shopData = await getEcommShopBySlug(params.slug);
            if (!shopData) {
                notFound();
            }
            setShop(shopData);
        }
        fetchData();
    }, [params.slug]);

    if (!shop) {
        return <div>Loading...</div>
    }

    return (
        <main className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold mb-8">{shop.name}</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {products.map((product) => (
                    <ProductCard key={product._id.toString()} product={product} shopSettings={shop} shopSlug={shop.slug} />
                ))}
            </div>
        </main>
    );
}
```
- src/app/shop/[slug]/order-confirmation/[orderId]/page.tsx:
```tsx
'use client';

import { getEcommOrderById } from '@/app/actions/custom-ecommerce.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { WithId, EcommOrder } from '@/lib/definitions';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function OrderConfirmationPage() {
    const params = useParams();
    const [order, setOrder] = useState<WithId<EcommOrder> | null>(null);

    useEffect(() => {
        if(params.orderId) {
            getEcommOrderById(params.orderId as string).then(setOrder);
        }
    }, [params.orderId]);


    if (!order) {
        return <div className="flex items-center justify-center min-h-[50vh]">Loading...</div>; // Add skeleton loader here
    }
    

    return (
         <div className="container mx-auto px-4 py-12 flex justify-center">
             <Card className="w-full max-w-2xl text-center">
                <CardHeader>
                    <div className="mx-auto bg-green-100 text-green-700 rounded-full h-16 w-16 flex items-center justify-center mb-4">
                        <CheckCircle className="h-10 w-10" />
                    </div>
                    <CardTitle className="text-3xl">Thank you for your order!</CardTitle>
                    <CardDescription>
                        Your order has been placed successfully. A confirmation has been sent to your email.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-left">
                    <p className="font-semibold">Order ID: <span className="font-mono text-muted-foreground">{order._id.toString()}</span></p>
                    <Separator />
                    <h3 className="font-semibold text-lg">Order Summary</h3>
                    <ul className="space-y-2">
                        {order.items.map(item => (
                             <li key={item.productId} className="flex justify-between items-center text-sm">
                                <span>{item.productName} x {item.quantity}</span>
                                <span className="font-medium">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.price * item.quantity)}</span>
                             </li>
                        ))}
                    </ul>
                    <Separator />
                     <div className="space-y-2">
                        <div className="flex justify-between"><span>Subtotal</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.subtotal)}</span></div>
                        <div className="flex justify-between"><span>Shipping</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.shipping)}</span></div>
                        <div className="flex justify-between font-bold text-lg"><span className="text-foreground">Total</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.total)}</span></div>
                    </div>
                    <Separator />
                    <div>
                        <h3 className="font-semibold text-lg">Shipping to</h3>
                        <div className="text-muted-foreground">
                            <p>{order.shippingAddress.street}</p>
                            <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
                            <p>{order.shippingAddress.country}</p>
                        </div>
                    </div>
                    <div className="pt-4 flex justify-center">
                         <Button asChild>
                            <Link href={`/shop/${params.slug}`}>Continue Shopping</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
```
- src/app/shop/[slug]/account/orders/[orderId]/page.tsx:
```tsx
'use client';

import { getEcommOrderById } from '@/app/actions/custom-ecommerce.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { WithId, EcommOrder } from '@/lib/definitions';
import { CheckCircle, Package } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function OrderDetailsPage() {
    const params = useParams();
    const [order, setOrder] = useState<WithId<EcommOrder> | null>(null);

    useEffect(() => {
        if(params.orderId) {
            getEcommOrderById(params.orderId as string).then(setOrder);
        }
    }, [params.orderId]);

    if (!order) {
        return <div>Loading...</div>; // Add skeleton loader here
    }

    return (
        <div className="space-y-4">
             <Button asChild variant="ghost" className="-ml-4">
                 <Link href={`/shop/${params.slug}/account/orders`}>
                    &larr; Back to Order History
                </Link>
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Order Details</CardTitle>
                    <CardDescription>
                        Order #{order._id.toString()} - Placed on {new Date(order.createdAt).toLocaleDateString()}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                             <h3 className="font-semibold">Shipping Address</h3>
                             <address className="not-italic text-muted-foreground">
                                {order.customerInfo.name}<br />
                                {order.shippingAddress.street}<br />
                                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}<br />
                                {order.shippingAddress.country}
                             </address>
                        </div>
                         <div className="space-y-2">
                             <h3 className="font-semibold">Customer Information</h3>
                             <p className="text-muted-foreground">
                                {order.customerInfo.name}<br/>
                                {order.customerInfo.email}<br/>
                                {order.customerInfo.phone}
                            </p>
                        </div>
                    </div>
                     <Separator />
                    <div>
                        <h3 className="font-semibold text-lg mb-2">Order Items</h3>
                        <ul className="space-y-3">
                            {order.items.map(item => (
                                 <li key={item.productId} className="flex justify-between items-center text-sm">
                                    <span>{item.productName} &times; {item.quantity}</span>
                                    <span className="font-medium">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.price * item.quantity)}</span>
                                 </li>
                            ))}
                        </ul>
                    </div>
                     <Separator />
                     <div className="space-y-2">
                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.subtotal)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.shipping)}</span></div>
                        <div className="flex justify-between font-bold text-lg"><span className="text-foreground">Total</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.total)}</span></div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
```
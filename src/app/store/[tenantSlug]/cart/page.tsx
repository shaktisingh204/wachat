'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingCart, Trash2 } from 'lucide-react';

import {
    Button,
    Card,
    CardBody,
    EmptyState,
    IconButton,
    Input,
    PageActions,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Spinner,
    Table,
    TBody,
    Td,
    TFoot,
    Th,
    THead,
    Tr,
    useToast,
} from '@/components/sabcrm/20ui';

import { getOrCreateCart, updateCartItems, startCheckout } from '@/app/actions/storefront.actions';
import { getStoredCartId, setStoredCartId } from '../_components/add-to-cart-button';

interface CartShape {
    _id: string;
    currency?: string;
    lineItems: Array<{
        productId: string;
        name: string;
        imageUrl?: string;
        unitPrice: number;
        quantity: number;
        lineTotal: number;
    }>;
    totals: { subtotal: number; tax: number; shipping: number; total: number };
}

const SESSION_KEY = 'sabnode_storefront_session_id';

function getGuestSession(): string {
    if (typeof window === 'undefined') return '';
    let v = window.localStorage.getItem(SESSION_KEY);
    if (!v) {
        v = `g_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        window.localStorage.setItem(SESSION_KEY, v);
    }
    return v;
}

export default function CartPage(): React.JSX.Element {
    const params = useParams<{ tenantSlug: string }>();
    const router = useRouter();
    const { toast } = useToast();
    const tenantSlug = params.tenantSlug;
    const [cart, setCart] = React.useState<CartShape | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [busy, setBusy] = React.useState(false);

    const load = React.useCallback(async () => {
        const cartId = getStoredCartId() ?? undefined;
        const r = await getOrCreateCart({ tenantSlug, cartId, guestSessionId: getGuestSession() });
        if (r.ok) {
            const c = r.cart as CartShape;
            setStoredCartId(c._id);
            setCart(c);
        }
        setLoading(false);
    }, [tenantSlug]);

    React.useEffect(() => { load(); }, [load]);

    async function setQty(productId: string, qty: number) {
        if (!cart) return;
        const next = cart.lineItems
            .map((li) => (li.productId === productId ? { ...li, quantity: Math.max(0, qty) } : li))
            .filter((li) => li.quantity > 0);
        const r = await updateCartItems(cart._id, next);
        if (r.ok) setCart(r.cart as CartShape);
    }

    async function onCheckout() {
        if (!cart || cart.lineItems.length === 0) return;
        setBusy(true);
        const r = await startCheckout({ tenantSlug, cartId: cart._id });
        setBusy(false);
        if (r.ok) {
            router.push(`/store/${tenantSlug}/checkout/address?co=${r.checkoutId}`);
        } else {
            toast.error('Could not start checkout. Please try again.');
        }
    }

    const currency = cart?.currency ?? '₹';

    if (loading) {
        return (
            <div className="flex items-center gap-3 py-10 text-[var(--st-text-secondary)]">
                <Spinner label="Loading cart" />
                <span>Loading cart.</span>
            </div>
        );
    }

    if (!cart || cart.lineItems.length === 0) {
        return (
            <EmptyState
                icon={ShoppingCart}
                title="Your cart is empty"
                description="Browse the catalog and add a few items to get started."
                action={
                    <Button
                        variant="primary"
                        iconLeft={ArrowLeft}
                        onClick={() => router.push(`/store/${tenantSlug}`)}
                    >
                        Continue shopping
                    </Button>
                }
            />
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Your cart</PageTitle>
                    <PageDescription>
                        Review your items and adjust quantities before checkout.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button
                        variant="secondary"
                        iconLeft={ArrowLeft}
                        onClick={() => router.push(`/store/${tenantSlug}`)}
                    >
                        Keep shopping
                    </Button>
                </PageActions>
            </PageHeader>

            <Card padding="none">
                <CardBody className="p-0">
                    <Table>
                        <THead>
                            <Tr>
                                <Th>Product</Th>
                                <Th align="right">Price</Th>
                                <Th align="center" width={120}>Quantity</Th>
                                <Th align="right">Total</Th>
                                <Th align="center" width={56}>
                                    <span className="sr-only">Remove</span>
                                </Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {cart.lineItems.map((li) => (
                                <Tr key={li.productId}>
                                    <Td>
                                        <div className="flex items-center gap-3">
                                            {li.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={li.imageUrl}
                                                    alt={li.name}
                                                    className="h-12 w-12 rounded-[var(--st-radius)] object-cover"
                                                />
                                            ) : (
                                                <div
                                                    className="h-12 w-12 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]"
                                                    aria-hidden="true"
                                                />
                                            )}
                                            <span className="font-medium text-[var(--st-text)]">{li.name}</span>
                                        </div>
                                    </Td>
                                    <Td align="right" className="text-[var(--st-text-secondary)]">
                                        {currency} {li.unitPrice}
                                    </Td>
                                    <Td align="center">
                                        <Input
                                            type="number"
                                            min={0}
                                            inputSize="sm"
                                            value={li.quantity}
                                            aria-label={`Quantity for ${li.name}`}
                                            onChange={(e) => setQty(li.productId, Number(e.target.value))}
                                            className="w-20"
                                        />
                                    </Td>
                                    <Td align="right" className="font-medium text-[var(--st-text)]">
                                        {currency} {li.lineTotal}
                                    </Td>
                                    <Td align="center">
                                        <IconButton
                                            label={`Remove ${li.name}`}
                                            icon={Trash2}
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setQty(li.productId, 0)}
                                        />
                                    </Td>
                                </Tr>
                            ))}
                        </TBody>
                        <TFoot>
                            <Tr>
                                <Td colSpan={3} align="right" className="text-[var(--st-text-secondary)]">
                                    Subtotal
                                </Td>
                                <Td align="right" className="text-lg font-semibold text-[var(--st-text)]">
                                    {currency} {cart.totals.total}
                                </Td>
                                <Td />
                            </Tr>
                        </TFoot>
                    </Table>
                </CardBody>
            </Card>

            <div className="flex flex-col items-stretch justify-end gap-3 sm:flex-row sm:items-center">
                <Button
                    variant="primary"
                    size="lg"
                    loading={busy}
                    onClick={onCheckout}
                >
                    {busy ? 'Starting checkout' : 'Checkout'}
                </Button>
            </div>
        </div>
    );
}

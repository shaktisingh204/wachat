'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

import {
    updateCheckout,
    placeOrder,
} from '@/app/actions/storefront.actions';

type Step = 'address' | 'shipping' | 'payment' | 'review' | 'confirm';

const ORDER: Step[] = ['address', 'shipping', 'payment', 'review', 'confirm'];

function StepIndicator({ active }: { active: Step }) {
    return (
        <div className="storefront-steps">
            {ORDER.map((s) => (
                <span key={s} className={`step ${s === active ? 'active' : ''}`}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
            ))}
        </div>
    );
}

export default function CheckoutStepPage(): React.JSX.Element {
    const params = useParams<{ tenantSlug: string; step: string }>();
    const search = useSearchParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug;
    const step = params.step as Step;
    const checkoutId = search.get('co') ?? '';
    const [busy, setBusy] = React.useState(false);
    const [addr, setAddr] = React.useState({
        name: '', email: '', phone: '',
        line1: '', city: '', state: '', postalCode: '', country: 'IN',
    });
    const [shipping, setShipping] = React.useState('standard');
    const [payment, setPayment] = React.useState('mock');
    const [orderCode, setOrderCode] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const goto = (next: Step) => router.push(`/store/${tenantSlug}/checkout/${next}?co=${checkoutId}`);

    async function saveAddress() {
        if (!checkoutId) return;
        setBusy(true);
        const r = await updateCheckout(checkoutId, 'shipping', { shippingAddress: addr, billingAddress: addr });
        setBusy(false);
        if (r.ok) goto('shipping');
        else setError(r.error);
    }

    async function saveShipping() {
        if (!checkoutId) return;
        setBusy(true);
        const r = await updateCheckout(checkoutId, 'payment', { shippingMethod: shipping });
        setBusy(false);
        if (r.ok) goto('payment');
    }

    async function savePayment() {
        if (!checkoutId) return;
        setBusy(true);
        const r = await updateCheckout(checkoutId, 'review', { paymentProvider: payment });
        setBusy(false);
        if (r.ok) goto('review');
    }

    async function confirm() {
        if (!checkoutId) return;
        setBusy(true);
        const r = await placeOrder({ tenantSlug, checkoutId });
        setBusy(false);
        if (r.ok) {
            setOrderCode(r.orderCode);
            router.replace(`/store/${tenantSlug}/checkout/confirm?co=${checkoutId}&code=${r.orderCode}`);
        } else {
            setError(r.error);
        }
    }

    React.useEffect(() => {
        if (step === 'confirm') {
            const code = search.get('code');
            if (code) setOrderCode(code);
        }
    }, [step, search]);

    return (
        <div className="max-w-2xl">
            <h1 className="mb-3 text-2xl font-semibold">Checkout</h1>
            <StepIndicator active={step} />

            {error && <p className="mb-3 text-sm text-zoru-ink">{error}</p>}

            {step === 'address' && (
                <div className="space-y-3">
                    {(['name', 'email', 'phone', 'line1', 'city', 'state', 'postalCode', 'country'] as const).map((k) => (
                        <input
                            key={k}
                            className="storefront-input"
                            placeholder={k}
                            value={addr[k]}
                            onChange={(e) => setAddr({ ...addr, [k]: e.target.value })}
                        />
                    ))}
                    <button onClick={saveAddress} disabled={busy} className="storefront-button">
                        {busy ? 'Saving…' : 'Continue to shipping →'}
                    </button>
                </div>
            )}

            {step === 'shipping' && (
                <div className="space-y-3">
                    <label className="flex items-center gap-2">
                        <input type="radio" name="ship" value="standard" checked={shipping === 'standard'} onChange={() => setShipping('standard')} />
                        Standard
                    </label>
                    <label className="flex items-center gap-2">
                        <input type="radio" name="ship" value="express" checked={shipping === 'express'} onChange={() => setShipping('express')} />
                        Express
                    </label>
                    <button onClick={saveShipping} disabled={busy} className="storefront-button">
                        {busy ? 'Saving…' : 'Continue to payment →'}
                    </button>
                </div>
            )}

            {step === 'payment' && (
                <div className="space-y-3">
                    <label className="flex items-center gap-2">
                        <input type="radio" name="pay" value="mock" checked={payment === 'mock'} onChange={() => setPayment('mock')} />
                        Pay later (mock gateway — dev)
                    </label>
                    <p className="text-xs opacity-70">
                        TODO: render concrete payment options once a real IPaymentGateway is configured.
                    </p>
                    <button onClick={savePayment} disabled={busy} className="storefront-button">
                        {busy ? 'Saving…' : 'Continue to review →'}
                    </button>
                </div>
            )}

            {step === 'review' && (
                <div className="space-y-3">
                    <p>Please review your order before placing it.</p>
                    <button onClick={confirm} disabled={busy} className="storefront-button">
                        {busy ? 'Placing…' : 'Place order'}
                    </button>
                </div>
            )}

            {step === 'confirm' && (
                <div className="space-y-3">
                    <h2 className="text-xl font-semibold">Thank you!</h2>
                    <p>Your order has been placed.</p>
                    {orderCode && (
                        <p>Order code: <strong>{orderCode}</strong></p>
                    )}
                    <a className="storefront-button secondary" href={`/store/${tenantSlug}`}>Back to shop</a>
                </div>
            )}
        </div>
    );
}

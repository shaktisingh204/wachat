'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

import {
    updateCheckout,
    placeOrder,
} from '@/app/actions/storefront.actions';
import {
    Alert,
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Field,
    Input,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Radio,
    RadioGroup,
} from '@/components/sabcrm/20ui';

type Step = 'address' | 'shipping' | 'payment' | 'review' | 'confirm';

const ORDER: Step[] = ['address', 'shipping', 'payment', 'review', 'confirm'];

const ADDRESS_FIELDS = [
    { key: 'name', label: 'Full name', placeholder: 'Priya Sharma' },
    { key: 'email', label: 'Email', placeholder: 'priya@example.com', type: 'email' },
    { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210', type: 'tel' },
    { key: 'line1', label: 'Address line', placeholder: '12 MG Road, Indiranagar' },
    { key: 'city', label: 'City', placeholder: 'Bengaluru' },
    { key: 'state', label: 'State', placeholder: 'Karnataka' },
    { key: 'postalCode', label: 'Postal code', placeholder: '560038' },
    { key: 'country', label: 'Country', placeholder: 'IN' },
] as const;

function StepIndicator({ active }: { active: Step }) {
    return (
        <div className="mb-5 flex flex-wrap items-center gap-2">
            {ORDER.map((s) => (
                <Badge key={s} tone={s === active ? 'accent' : 'neutral'} kind={s === active ? 'solid' : 'soft'}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                </Badge>
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
        <div className="ui20 mx-auto max-w-2xl">
            <PageHeader bordered={false}>
                <PageHeaderHeading>
                    <PageTitle>Checkout</PageTitle>
                    <PageDescription>Complete each step to place your order.</PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <StepIndicator active={step} />

            {error ? (
                <Alert tone="danger" className="mb-4" onClose={() => setError(null)}>
                    {error}
                </Alert>
            ) : null}

            {step === 'address' ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Shipping address</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="space-y-3">
                            {ADDRESS_FIELDS.map((f) => (
                                <Field key={f.key} label={f.label}>
                                    <Input
                                        type={'type' in f ? f.type : 'text'}
                                        placeholder={f.placeholder}
                                        value={addr[f.key]}
                                        onChange={(e) => setAddr({ ...addr, [f.key]: e.target.value })}
                                    />
                                </Field>
                            ))}
                            <Button
                                variant="primary"
                                onClick={saveAddress}
                                loading={busy}
                                iconRight={ArrowRight}
                            >
                                Continue to shipping
                            </Button>
                        </div>
                    </CardBody>
                </Card>
            ) : null}

            {step === 'shipping' ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Shipping method</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="space-y-4">
                            <RadioGroup value={shipping} onValueChange={setShipping} aria-label="Shipping method">
                                <Radio value="standard" label="Standard" />
                                <Radio value="express" label="Express" />
                            </RadioGroup>
                            <Button
                                variant="primary"
                                onClick={saveShipping}
                                loading={busy}
                                iconRight={ArrowRight}
                            >
                                Continue to payment
                            </Button>
                        </div>
                    </CardBody>
                </Card>
            ) : null}

            {step === 'payment' ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Payment</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="space-y-4">
                            <RadioGroup value={payment} onValueChange={setPayment} aria-label="Payment method">
                                <Radio value="mock" label="Pay later (mock gateway, dev)" />
                            </RadioGroup>
                            <p className="text-xs text-[var(--st-text-tertiary)]">
                                Concrete payment options appear once a real payment gateway is configured.
                            </p>
                            <Button
                                variant="primary"
                                onClick={savePayment}
                                loading={busy}
                                iconRight={ArrowRight}
                            >
                                Continue to review
                            </Button>
                        </div>
                    </CardBody>
                </Card>
            ) : null}

            {step === 'review' ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Review</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="space-y-4">
                            <p className="text-sm text-[var(--st-text-secondary)]">
                                Please review your order before placing it.
                            </p>
                            <Button variant="primary" onClick={confirm} loading={busy}>
                                Place order
                            </Button>
                        </div>
                    </CardBody>
                </Card>
            ) : null}

            {step === 'confirm' ? (
                <Card>
                    <CardBody>
                        <div className="flex flex-col items-center gap-3 py-6 text-center">
                            <span className="text-[var(--st-status-ok)]">
                                <CheckCircle2 size={40} aria-hidden="true" />
                            </span>
                            <h2 className="text-xl font-semibold text-[var(--st-text)]">Thank you</h2>
                            <p className="text-sm text-[var(--st-text-secondary)]">Your order has been placed.</p>
                            {orderCode ? (
                                <p className="text-sm text-[var(--st-text)]">
                                    Order code: <strong>{orderCode}</strong>
                                </p>
                            ) : null}
                            <Button variant="secondary" onClick={() => router.push(`/store/${tenantSlug}`)}>
                                Back to shop
                            </Button>
                        </div>
                    </CardBody>
                </Card>
            ) : null}
        </div>
    );
}

'use client';

import { CreditCard } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramPaymentsPage() {
    return (
        <TelegramPlaceholder
            title="Payments & Stars"
            description="Accept payments inside Telegram chats and Mini Apps — either Telegram Stars (XTR) or fiat through a provider token."
            icon={CreditCard}
            bullets={[
                'Stripe and 10+ other provider tokens for fiat invoices',
                'Telegram Stars (XTR) for digital goods and subscriptions',
                'Invoice links, recurring subscriptions, and refunds',
                'View star transactions and revenue dashboards',
            ]}
            docsHref="https://core.telegram.org/bots/payments"
        />
    );
}

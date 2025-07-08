
'use client';

import { CartView } from './cart-view';

export const CartBlockRenderer = ({ settings }: { settings: any }) => {
    // This block currently acts as a simple placeholder for the dynamic CartView.
    // Future settings could include layout options (e.g., one or two columns).
    return <CartView />;
};

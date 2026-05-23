import sys

with open('src/app/dashboard/crm/inventory/adjustments/[id]/page.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    '''<EntityPickerChip
                                                        entity="item"
                                                        id={String(l.productId)}
                                                        fallback="Item"
                                                    />''',
    '''<Link href={`/dashboard/crm/inventory/products/${l.productId}/ledger`} className="hover:underline">
                                                        <EntityPickerChip
                                                            entity="item"
                                                            id={String(l.productId)}
                                                            fallback="Item"
                                                        />
                                                    </Link>'''
)

content = content.replace(
    '''<EntityPickerChip
                                                entity="item"
                                                id={String(adj.productId)}
                                                fallback={productName || 'Item'}
                                            />''',
    '''<Link href={`/dashboard/crm/inventory/products/${adj.productId}/ledger`} className="hover:underline">
                                                <EntityPickerChip
                                                    entity="item"
                                                    id={String(adj.productId)}
                                                    fallback={productName || 'Item'}
                                                />
                                            </Link>'''
)

with open('src/app/dashboard/crm/inventory/adjustments/[id]/page.tsx', 'w') as f:
    f.write(content)


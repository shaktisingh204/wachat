const fs = require('fs');
const file = 'src/app/dashboard/crm/inventory/items/[productId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// add tab?: string to searchParams
content = content.replace(/searchParams: Promise<\{ print\?: string; qr\?: string \}>;/, "searchParams: Promise<{ print?: string; qr?: string; tab?: string }>;");

// pass defaultTab={sp.tab}
content = content.replace(/<ItemDetailBody product=\{product\} productId=\{productId\} \/>/, "<ItemDetailBody product={product} productId={productId} defaultTab={sp.tab} />");

fs.writeFileSync(file, content);

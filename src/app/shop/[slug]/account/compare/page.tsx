
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from "next/image";

const mockCompare = [
    { id: 1, name: "Cool T-Shirt", price: 25.00, imageUrl: "https://placehold.co/400x500.png", description: "A really cool t-shirt made of 100% cotton.", availability: "In Stock" },
    { id: 2, name: "Another T-Shirt", price: 22.00, imageUrl: "https://placehold.co/400x500.png", description: "Also a cool t-shirt, but a bit different.", availability: "In Stock" },
];

export default function CompareProductsPage() {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                 <h1 className="text-2xl font-bold">Compare Products</h1>
                 <Button variant="outline">Clear All</Button>
            </div>
            {mockCompare.length > 0 ? (
                 <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[150px]">Feature</TableHead>
                                    {mockCompare.map(product => (
                                        <TableHead key={product.id}>{product.name}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell></TableCell>
                                    {mockCompare.map(product => (
                                        <TableCell key={product.id}>
                                            <div className="relative h-40 w-full bg-muted rounded-md overflow-hidden">
                                                <Image src={product.imageUrl} alt={product.name} layout="fill" objectFit="cover" data-ai-hint="clothing fashion"/>
                                            </div>
                                        </TableCell>
                                    ))}
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-semibold">Price</TableCell>
                                     {mockCompare.map(product => (
                                        <TableCell key={product.id}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(product.price)}</TableCell>
                                    ))}
                                </TableRow>
                                 <TableRow>
                                    <TableCell className="font-semibold">Description</TableCell>
                                     {mockCompare.map(product => (
                                        <TableCell key={product.id} className="text-sm text-muted-foreground">{product.description}</TableCell>
                                    ))}
                                </TableRow>
                                 <TableRow>
                                    <TableCell className="font-semibold">Availability</TableCell>
                                     {mockCompare.map(product => (
                                        <TableCell key={product.id}>{product.availability}</TableCell>
                                    ))}
                                </TableRow>
                                 <TableRow>
                                    <TableCell></TableCell>
                                     {mockCompare.map(product => (
                                        <TableCell key={product.id}>
                                            <Button className="w-full">Add to Cart</Button>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        <p>You have no items to compare.</p>
                    </CardContent>
                </Card>
            )}
           
        </div>
    );
}


import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";

const mockDownloads = [
    { id: 1, orderId: "98765", product: "E-book: Mastering Next.js", downloadsRemaining: 3 },
    { id: 2, orderId: "54321", product: "UI Kit for Figma", downloadsRemaining: 1 },
];

export default function DownloadsPage() {
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">My Downloadable Products</h1>
            <Card>
                <CardContent className="p-0">
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order ID</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Downloads Remaining</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockDownloads.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-mono">#{item.orderId}</TableCell>
                                    <TableCell>{item.product}</TableCell>
                                    <TableCell>{item.downloadsRemaining}</TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm"><Download className="mr-2 h-4 w-4"/>Download</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

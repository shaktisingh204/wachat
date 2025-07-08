
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const mockReturns = [
    { id: 1, orderId: "12345", date: "2023-10-26", status: "Pending" },
    { id: 2, orderId: "12346", date: "2023-09-15", status: "Completed" },
];

export default function ReturnsPage() {
    return (
        <div className="space-y-4">
             <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Returns</h1>
                <Button>Request New Return</Button>
            </div>
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Return ID</TableHead>
                                <TableHead>Order ID</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockReturns.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-mono">#{item.id}</TableCell>
                                    <TableCell className="font-mono">#{item.orderId}</TableCell>
                                    <TableCell>{item.date}</TableCell>
                                    <TableCell><Badge>{item.status}</Badge></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

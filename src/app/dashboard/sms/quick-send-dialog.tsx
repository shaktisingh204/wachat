'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { sendQuickSms } from "@/app/actions/sms-quick.actions";
// import { toast } from "sonner"; // If sonner is available, else use alert or custom toast
const toast: any = { error: (m: string) => alert(m), success: (m: string) => console.log(m) };

export function QuickSendDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [to, setTo] = useState("");
    const [message, setMessage] = useState("");

    const handleSend = async () => {
        if (!to || !message) {
            alert("Phone number and message are required");
            return;
        }

        setLoading(true);
        try {
            const res = await sendQuickSms(to, message); // undefined templateId for raw message (might fail DLT)
            if (res.success) {
                alert("Message Sent!");
                setOpen(false);
                setTo("");
                setMessage("");
            } else {
                alert("Failed: " + res.error);
            }
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Send className="w-4 h-4 mr-2" /> Quick Send
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Send Quick Message</DialogTitle>
                    <DialogDescription>
                        Send a single SMS immediately. Note: DLT templates may be required for delivery in India.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="to" className="text-right">
                            To
                        </Label>
                        <Input
                            id="to"
                            placeholder="919876543210"
                            className="col-span-3"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="message" className="text-right">
                            Message
                        </Label>
                        <Textarea
                            id="message"
                            placeholder="Type your message..."
                            className="col-span-3"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleSend} disabled={loading}>
                        {loading && <span className="animate-spin mr-2">⏳</span>} Send Message
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

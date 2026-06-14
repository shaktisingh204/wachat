"use client";

import * as React from "react";
import { Delete, Phone } from "lucide-react";

import { Button, Card, Input, useToast } from "@/components/sabcrm/20ui";
import { placeCall } from "../conversations/actions";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

/**
 * Click-to-call softphone. Originates an outbound call through the SabCall
 * engine (Asterisk ARI). In-browser two-way audio (WebRTC over Asterisk WSS)
 * is gated separately and arrives with the softphone-mode work — this dialpad
 * places the call server-side regardless.
 */
export function Softphone({ initialNumber = "" }: { initialNumber?: string }) {
  const { toast } = useToast();
  const [number, setNumber] = React.useState(initialNumber);
  const [calling, setCalling] = React.useState(false);

  const press = (d: string) => setNumber((n) => (n + d).slice(0, 24));
  const backspace = () => setNumber((n) => n.slice(0, -1));

  const call = React.useCallback(async () => {
    const to = number.trim();
    if (!to) {
      toast({ title: "Enter a number", variant: "destructive" });
      return;
    }
    setCalling(true);
    const res = await placeCall(to);
    setCalling(false);
    if (res.success) {
      toast({ title: "Calling…", description: `Dialing ${to}` });
    } else {
      toast({ title: "Could not place call", description: res.error, variant: "destructive" });
    }
  }, [number, toast]);

  return (
    <Card className="flex w-full max-w-xs flex-col gap-3 p-4">
      <Input
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="+1 555 010 0000"
        inputMode="tel"
        aria-label="Number to call"
        className="text-center text-lg tracking-wide"
      />
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <Button
            key={k}
            variant="outline"
            className="h-12 text-base font-medium sc-press"
            onClick={() => press(k)}
            type="button"
          >
            {k}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          className={`flex-1 sc-press${calling ? " sc-pulse" : ""}`}
          iconLeft={Phone}
          loading={calling}
          disabled={calling}
          onClick={() => void call()}
        >
          {calling ? "Calling…" : "Call"}
        </Button>
        <Button
          variant="ghost"
          aria-label="Backspace"
          onClick={backspace}
          type="button"
          disabled={!number}
        >
          <Delete className="h-5 w-5" aria-hidden />
        </Button>
      </div>
    </Card>
  );
}

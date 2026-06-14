"use client";

import * as React from "react";
import { KeyRound, ShieldCheck } from "lucide-react";

import {
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  useToast,
} from "@/components/sabcrm/20ui";

import { submitFirstLoginPassword } from "./actions";

export function SetPasswordClient({
  email,
  name,
}: {
  email: string;
  name: string | null;
}) {
  const { toast } = useToast();
  const [pw, setPw] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const tooShort = pw.length > 0 && pw.length < 8;
  const mismatch = confirm.length > 0 && pw !== confirm;
  const canSubmit = pw.length >= 8 && pw === confirm && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const res = await submitFirstLoginPassword(pw);
    if (!res.ok) {
      setSubmitting(false);
      toast({ title: "Couldn’t set password", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Password set" });
    // Flag cleared + session re-minted — land in the app.
    window.location.href = "/dashboard";
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--zoru-surface-2,#f4f4f5)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--zoru-primary,#4f46e5)]/10">
            <ShieldCheck className="h-5 w-5 text-[var(--zoru-primary,#4f46e5)]" />
          </div>
          <CardTitle>Set your password</CardTitle>
          <CardDescription>
            {name ? `Welcome, ${name}. ` : ""}Choose a password for{" "}
            <span className="font-medium">{email}</span> to finish signing in.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field
            label="New password"
            help={tooShort ? "At least 8 characters, with a letter and a number." : undefined}
          >
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
              autoFocus
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm password" help={mismatch ? "Passwords don’t match." : undefined}>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </Field>
          <Button iconLeft={KeyRound} onClick={submit} loading={submitting} disabled={!canSubmit} className="w-full">
            Set password &amp; continue
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

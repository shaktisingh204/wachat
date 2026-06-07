"use client";

import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Input, Label, Separator, Skeleton, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  CheckCircle,
  Copy,
  Key,
  LoaderCircle,
  Trash2,
  } from "lucide-react";

import {
  addCustomDomain,
  deleteCustomDomain,
  getCustomDomains,
  verifyCustomDomain,
  } from "@/app/actions/url-shortener.actions";
import type { CustomDomain } from "@/lib/definitions";
import type { WithId } from "mongodb";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

/**
 * Zoru-only replacement for
 * `@/components/20ui-domain/ecomm-custom-domain-form`. Same server actions,
 * same data flow — only the visual layer changes.
 */

import * as React from "react";

const addDomainInitialState: { success?: boolean; error?: string } = {
  success: undefined,
  error: undefined,
};

function AddDomainButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="animate-spin" /> : null}
      Add domain
    </Button>
  );
}

function VerifyButton({
  domainId,
  onActionComplete,
}: {
  domainId: string;
  onActionComplete: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const onVerify = () => {
    startTransition(async () => {
      const result = await verifyCustomDomain(domainId);
      if (result.success) {
        toast({
          title: "Domain verified",
          description: "You can now use this domain for your shop.",
        });
        onActionComplete();
      } else {
        toast({
          title: "Verification failed",
          description: result.error,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Button onClick={onVerify} size="sm" disabled={isPending}>
      {isPending ? <LoaderCircle className="animate-spin" /> : null}
      Verify
    </Button>
  );
}

function DeleteButton({
  domainId,
  onActionComplete,
}: {
  domainId: string;
  onActionComplete: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const onDelete = () => {
    startTransition(async () => {
      const result = await deleteCustomDomain(domainId);
      if (!result.success) {
        toast({
          title: "Could not delete",
          description: result.error,
          variant: "destructive",
        });
      } else {
        onActionComplete();
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onDelete}
      disabled={isPending}
      aria-label="Delete domain"
    >
      {isPending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}

export function EcommCustomDomainForm() {
  const { toast } = useToast();
  const addFormRef = useRef<HTMLFormElement>(null);
  const [domains, setDomains] = useState<WithId<CustomDomain>[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const [addState, addAction] = useActionState(
    addCustomDomain,
    addDomainInitialState,
  );
  const { copy } = useCopyToClipboard();

  const fetchData = () => {
    startLoadingTransition(async () => {
      const data = await getCustomDomains();
      setDomains(data);
    });
  };

  useEffect(() => {
    fetchData();
  }, [addState]);

  useEffect(() => {
    if (addState.success) {
      toast({
        title: "Domain added",
        description: "Add the TXT record to your DNS provider to verify ownership.",
      });
      addFormRef.current?.reset();
    }
    if (addState.error) {
      toast({
        title: "Could not add domain",
        description: addState.error,
        variant: "destructive",
      });
    }
  }, [addState, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom domains</CardTitle>
        <CardDescription>
          Use your own domain for branded shop URLs (e.g.,
          shop.mybrand.com).
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-6">
        <form action={addAction} ref={addFormRef} className="space-y-2">
          <Label htmlFor="hostname">Add new domain</Label>
          <div className="flex gap-2">
            <Input
              id="hostname"
              name="hostname"
              placeholder="e.g., shop.mybrand.com"
              required
            />
            <AddDomainButton />
          </div>
        </form>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm tracking-tight text-[var(--st-text)]">Your domains</h4>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : domains.length > 0 ? (
            domains.map((domain) => (
              <div
                key={domain._id.toString()}
                className="space-y-4 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm tracking-tight text-[var(--st-text)]">
                      {domain.hostname}
                    </p>
                    {domain.verified ? (
                      <Badge>
                        <CheckCircle className="mr-1 h-3 w-3" /> Verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Unverified</Badge>
                    )}
                  </div>
                  <DeleteButton
                    domainId={domain._id.toString()}
                    onActionComplete={fetchData}
                  />
                </div>
                {domain.verified ? (
                  <div className="space-y-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm">
                    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
                      <span className="text-[var(--st-text-secondary)]">Type:</span>
                      <span>CNAME</span>
                      <span className="text-[var(--st-text-secondary)]">Host/Name:</span>
                      <span>{domain.hostname}</span>
                      <span className="text-[var(--st-text-secondary)]">
                        Value/Target:
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="break-all">cname.sabnode.com</span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => copy("cname.sabnode.com")}
                          aria-label="Copy CNAME target"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-3 text-sm">
                    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
                      <span className="text-[var(--st-text-secondary)]">Type:</span>
                      <span>TXT</span>
                      <span className="text-[var(--st-text-secondary)]">Host:</span>
                      <span>@ or {domain.hostname}</span>
                      <span className="text-[var(--st-text-secondary)]">Value:</span>
                      <div className="flex items-center gap-2">
                        <span className="break-all">
                          {domain.verificationCode}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => copy(domain.verificationCode)}
                          aria-label="Copy verification code"
                        >
                          <Key className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <VerifyButton
                        domainId={domain._id.toString()}
                        onActionComplete={fetchData}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="py-4 text-center text-sm text-[var(--st-text-secondary)]">
              No custom domains added yet.
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

"use client";

import { Button, Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle, Input, Label, RadioGroup, ZoruRadioGroupItem, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState } from "react";
import { useFormStatus } from "react-dom";
import { List,
  LoaderCircle,
  Plus,
  Save,
  Trash2 } from "lucide-react";

import { savePersistentMenu } from "@/app/actions/facebook.actions";
import type { EcommShop } from "@/lib/definitions";
import type { WithId } from "mongodb";

/**
 * Zoru-only replacement for `@/components/zoruui-domain/persistent-menu-form`.
 * Same external props (`shop`) and same `savePersistentMenu` server action.
 */

import * as React from "react";

const initialState: { success: boolean; error?: string } = {
  success: false,
  error: undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
      Save menu
    </Button>
  );
}

interface PersistentMenuFormProps {
  shop: WithId<EcommShop>;
}

type MenuItem = {
  type: "postback" | "web_url";
  title: string;
  payload?: string;
  url?: string;
};

export function PersistentMenuForm({ shop }: PersistentMenuFormProps) {
  const [state, formAction] = useActionState(savePersistentMenu, initialState);
  const { toast } = useToast();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    setMenuItems((shop?.persistentMenu as MenuItem[]) || []);
  }, [shop]);

  useEffect(() => {
    if (state.success) {
      toast({ title: "Persistent menu updated" });
    }
    if (state.error) {
      toast({
        title: "Could not update menu",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast]);

  const handleItemChange = (
    index: number,
    field: keyof MenuItem,
    value: string,
  ) => {
    const newItems = [...menuItems];
    const item = { ...newItems[index], [field]: value };
    if (field === "type") {
      if (value === "web_url") delete item.payload;
      else delete item.url;
    }
    newItems[index] = item;
    setMenuItems(newItems);
  };

  const handleAddItem = () => {
    if (menuItems.length < 3) {
      setMenuItems((prev) => [...prev, { type: "postback", title: "" }]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setMenuItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <form action={formAction}>
      <input type="hidden" name="shopId" value={shop._id.toString()} />
      <input
        type="hidden"
        name="menuItems"
        value={JSON.stringify(menuItems)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            Persistent menu
          </CardTitle>
          <CardDescription>
            Set up a static menu that&rsquo;s always available to users in
            your Messenger chat window. You can have up to 3 top-level items.
            Note: this menu is set at the page level and will be overwritten
            by the last shop saved.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          {menuItems.map((item, index) => (
            <div
              key={index}
              className="relative space-y-3 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] p-4"
            >
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                className="absolute right-2 top-2"
                onClick={() => handleRemoveItem(index)}
                aria-label="Remove menu item"
              >
                <Trash2 />
              </Button>
              <h4 className="text-sm tracking-tight text-[var(--st-text)]">
                Menu item {index + 1}
              </h4>
              <div className="space-y-1.5">
                <Label htmlFor={`title-${index}`}>Title</Label>
                <Input
                  id={`title-${index}`}
                  value={item.title}
                  onChange={(e) =>
                    handleItemChange(index, "title", e.target.value)
                  }
                  maxLength={30}
                  required
                />
              </div>
              <RadioGroup
                value={item.type}
                onValueChange={(val: string) =>
                  handleItemChange(index, "type", val)
                }
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <ZoruRadioGroupItem
                    value="postback"
                    id={`type-postback-${index}`}
                  />
                  <Label
                    htmlFor={`type-postback-${index}`}
                    className="font-normal"
                  >
                    Trigger flow
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <ZoruRadioGroupItem
                    value="web_url"
                    id={`type-url-${index}`}
                  />
                  <Label
                    htmlFor={`type-url-${index}`}
                    className="font-normal"
                  >
                    Open web URL
                  </Label>
                </div>
              </RadioGroup>
              {item.type === "postback" ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`payload-${index}`}>
                    Payload (trigger keyword)
                  </Label>
                  <Input
                    id={`payload-${index}`}
                    value={item.payload || ""}
                    onChange={(e) =>
                      handleItemChange(index, "payload", e.target.value)
                    }
                    placeholder="e.g., MENU_BROWSE_PRODUCTS"
                    required
                  />
                  <p className="text-xs text-[var(--st-text-secondary)]">
                    This keyword will trigger the corresponding flow.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor={`url-${index}`}>Website URL</Label>
                  <Input
                    id={`url-${index}`}
                    type="url"
                    value={item.url || ""}
                    onChange={(e) =>
                      handleItemChange(index, "url", e.target.value)
                    }
                    placeholder="https://example.com"
                    required
                  />
                </div>
              )}
            </div>
          ))}
          {menuItems.length < 3 && (
            <Button
              type="button"
              variant="outline"
              block
              onClick={handleAddItem}
            >
              <Plus />
              Add menu item
            </Button>
          )}
        </CardBody>
        <CardFooter>
          <SubmitButton />
        </CardFooter>
      </Card>
    </form>
  );
}

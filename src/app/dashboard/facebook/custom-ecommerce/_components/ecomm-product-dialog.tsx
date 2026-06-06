"use client";

import {
  Accordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  Button,
  DatePicker,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  ScrollArea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle,
  Plus,
  Save,
  Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

import { saveEcommProduct } from "@/app/actions/custom-ecommerce.actions";
import type {
  EcommProduct,
  EcommProductVariant,
  EcommShop,
  } from "@/lib/definitions";
import type { WithId } from "mongodb";

/**
 * Zoru-only replacement for `@/components/zoruui-domain/ecomm-product-dialog`.
 *
 * Same external props (`isOpen`, `onOpenChange`, `shop`, `product`,
 * `onSuccess`) and the same `saveEcommProduct` server action — only the
 * visual layer is rebuilt with zoru atoms.
 */

import * as React from "react";

import { SabFileUrlInput } from "@/components/sabfiles";

const initialState: { message?: string | null; error?: string } = {
  message: null,
  error: undefined,
};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
      {isEditing ? "Save changes" : "Create product"}
    </Button>
  );
}

interface EcommProductDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  shop: WithId<EcommShop>;
  product?: WithId<EcommProduct> | null;
  onSuccess: () => void;
}

export function EcommProductDialog({
  isOpen,
  onOpenChange,
  shop,
  product,
  onSuccess,
}: EcommProductDialogProps) {
  const [state, formAction] = useActionState(
    saveEcommProduct as unknown as (
      prevState: typeof initialState,
      formData: FormData,
    ) => Promise<typeof initialState>,
    initialState,
  );
  const p = product as Record<string, unknown> | null | undefined;
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const isEditing = !!product;

  const [variants, setVariants] = useState<EcommProductVariant[]>([]);
  const [salePriceEffectiveDate, setSalePriceEffectiveDate] = useState<
    Date | undefined
  >();
  const [imageLink, setImageLink] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setVariants(product?.variants || []);
      const raw = (product as unknown as { sale_price_effective_date?: string })
        ?.sale_price_effective_date;
      setSalePriceEffectiveDate(raw ? new Date(raw) : undefined);
      setImageLink(product?.imageUrl ?? "");
    }
  }, [isOpen, product]);

  useEffect(() => {
    if (state.message) {
      toast({ title: "Product saved", description: state.message });
      onSuccess();
      onOpenChange(false);
    }
    if (state.error) {
      toast({
        title: "Could not save product",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast, onOpenChange, onSuccess]);

  const handleAddVariant = () =>
    setVariants((prev) => [...prev, { id: uuidv4(), name: "", options: "" }]);
  const handleRemoveVariant = (id: string) =>
    setVariants((prev) => prev.filter((v) => v.id !== id));
  const handleVariantChange = (
    id: string,
    field: "name" | "options",
    value: string,
  ) =>
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)),
    );

  const onDialogChange = (open: boolean) => {
    if (!open) {
      formRef.current?.reset();
      setVariants([]);
      setSalePriceEffectiveDate(undefined);
      setImageLink("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onDialogChange}>
      <ZoruDialogContent className="sm:max-w-3xl">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="shopId" value={shop._id.toString()} />
          {isEditing && product ? (
            <input
              type="hidden"
              name="productId"
              value={product._id.toString()}
            />
          ) : null}
          <input
            type="hidden"
            name="variants"
            value={JSON.stringify(variants)}
          />
          <input
            type="hidden"
            name="sale_price_effective_date"
            value={salePriceEffectiveDate?.toISOString() ?? ""}
          />

          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {isEditing ? "Edit product" : "Add new product"}
            </ZoruDialogTitle>
          </ZoruDialogHeader>

          <ScrollArea className="-mx-6 my-4 max-h-[70vh] px-6">
            <Accordion
              type="multiple"
              defaultValue={["basic", "pricing", "identifiers"]}
              className="w-full"
            >
              <ZoruAccordionItem value="basic">
                <ZoruAccordionTrigger>Basic information</ZoruAccordionTrigger>
                <ZoruAccordionContent className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="title">Product name *</Label>
                    <Input
                      id="title"
                      name="title"
                      defaultValue={product?.name}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      name="description"
                      defaultValue={product?.description}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="link">Product link *</Label>
                    <Input
                      id="link"
                      name="link"
                      type="url"
                      defaultValue={p?.link as string | undefined}
                      placeholder="https://your-store.com/product/item"
                      required
                    />
                  </div>
                </ZoruAccordionContent>
              </ZoruAccordionItem>

              <ZoruAccordionItem value="images">
                <ZoruAccordionTrigger>Images</ZoruAccordionTrigger>
                <ZoruAccordionContent className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="image_link">Main image URL *</Label>
                    <SabFileUrlInput
                      id="image_link"
                      name="image_link"
                      accept="image"
                      value={imageLink}
                      onChange={setImageLink}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="additional_image_link">
                      Additional image URLs (one per line)
                    </Label>
                    <Textarea
                      id="additional_image_link"
                      name="additional_image_link"
                      defaultValue={
                        Array.isArray(p?.additional_image_link)
                          ? (p?.additional_image_link as string[]).join("\n")
                          : undefined
                      }
                    />
                  </div>
                </ZoruAccordionContent>
              </ZoruAccordionItem>

              <ZoruAccordionItem value="pricing">
                <ZoruAccordionTrigger>
                  Pricing &amp; availability
                </ZoruAccordionTrigger>
                <ZoruAccordionContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="price">Price *</Label>
                      <Input
                        id="price"
                        name="price"
                        placeholder={`e.g. 999 ${shop.currency}`}
                        defaultValue={`${product?.price ?? ""} ${shop.currency}`}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="availability">
                        Availability *
                      </Label>
                      <Select
                        name="availability"
                        defaultValue={
                          (p?.availability as string | undefined) ?? "in stock"
                        }
                      >
                        <ZoruSelectTrigger id="availability">
                          <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                          <ZoruSelectItem value="in stock">
                            In stock
                          </ZoruSelectItem>
                          <ZoruSelectItem value="out of stock">
                            Out of stock
                          </ZoruSelectItem>
                          <ZoruSelectItem value="preorder">
                            Preorder
                          </ZoruSelectItem>
                        </ZoruSelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="sale_price">Sale price</Label>
                      <Input
                        id="sale_price"
                        name="sale_price"
                        defaultValue={p?.sale_price as string | undefined}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Sale dates</Label>
                      <DatePicker
                        value={salePriceEffectiveDate}
                        onChange={setSalePriceEffectiveDate}
                      />
                    </div>
                  </div>
                </ZoruAccordionContent>
              </ZoruAccordionItem>

              <ZoruAccordionItem value="identifiers">
                <ZoruAccordionTrigger>
                  Identifiers &amp; categories
                </ZoruAccordionTrigger>
                <ZoruAccordionContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="retailer_id">
                        SKU / retailer_id *
                      </Label>
                      <Input
                        id="retailer_id"
                        name="retailer_id"
                        defaultValue={p?.retailer_id as string | undefined}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="condition">Condition *</Label>
                      <Select
                        name="condition"
                        defaultValue={(p?.condition as string | undefined) ?? "new"}
                      >
                        <ZoruSelectTrigger id="condition">
                          <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                          <ZoruSelectItem value="new">New</ZoruSelectItem>
                          <ZoruSelectItem value="used">Used</ZoruSelectItem>
                          <ZoruSelectItem value="refurbished">
                            Refurbished
                          </ZoruSelectItem>
                        </ZoruSelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="brand">Brand</Label>
                      <Input
                        id="brand"
                        name="brand"
                        defaultValue={p?.brand as string | undefined}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="gtin">GTIN (Barcode)</Label>
                      <Input
                        id="gtin"
                        name="gtin"
                        defaultValue={p?.gtin as string | undefined}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="google_product_category">
                        Google product category
                      </Label>
                      <Input
                        id="google_product_category"
                        name="google_product_category"
                        defaultValue={
                          p?.google_product_category as string | undefined
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="product_type">
                        Your product type
                      </Label>
                      <Input
                        id="product_type"
                        name="product_type"
                        defaultValue={p?.product_type as string | undefined}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="mpn">MPN</Label>
                      <Input
                        id="mpn"
                        name="mpn"
                        defaultValue={p?.mpn as string | undefined}
                      />
                    </div>
                  </div>
                </ZoruAccordionContent>
              </ZoruAccordionItem>

              <ZoruAccordionItem value="variants">
                <ZoruAccordionTrigger>
                  Variants (e.g. size, color)
                </ZoruAccordionTrigger>
                <ZoruAccordionContent className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="item_group_id">
                      Item group ID
                    </Label>
                    <Input
                      id="item_group_id"
                      name="item_group_id"
                      defaultValue={p?.item_group_id as string | undefined}
                    />
                    <p className="text-xs text-[var(--st-text-secondary)]">
                      All variants of the same product must share the same
                      group ID.
                    </p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Variant attributes</Label>
                    <div className="space-y-3">
                      {variants.map((variant) => (
                        <div
                          key={variant.id}
                          className="grid grid-cols-[1fr_2fr_auto] items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-2"
                        >
                          <Input
                            placeholder="Name (e.g. Color)"
                            value={variant.name}
                            onChange={(e) =>
                              handleVariantChange(
                                variant.id,
                                "name",
                                e.target.value,
                              )
                            }
                          />
                          <Input
                            placeholder="Options (comma-separated)"
                            value={variant.options}
                            onChange={(e) =>
                              handleVariantChange(
                                variant.id,
                                "options",
                                e.target.value,
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveVariant(variant.id)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      block
                      className="mt-2"
                      onClick={handleAddVariant}
                    >
                      <Plus />
                      Add variant attribute
                    </Button>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="gender">Gender</Label>
                      <Select
                        name="gender"
                        defaultValue={p?.gender as string | undefined}
                      >
                        <ZoruSelectTrigger>
                          <ZoruSelectValue placeholder="Select…" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                          <ZoruSelectItem value="male">Male</ZoruSelectItem>
                          <ZoruSelectItem value="female">Female</ZoruSelectItem>
                          <ZoruSelectItem value="unisex">Unisex</ZoruSelectItem>
                        </ZoruSelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="age_group">Age group</Label>
                      <Select
                        name="age_group"
                        defaultValue={p?.age_group as string | undefined}
                      >
                        <ZoruSelectTrigger>
                          <ZoruSelectValue placeholder="Select…" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                          <ZoruSelectItem value="adult">Adult</ZoruSelectItem>
                          <ZoruSelectItem value="kids">Kids</ZoruSelectItem>
                        </ZoruSelectContent>
                      </Select>
                    </div>
                  </div>
                </ZoruAccordionContent>
              </ZoruAccordionItem>

              <ZoruAccordionItem value="stock">
                <ZoruAccordionTrigger>
                  Stock &amp; shipping
                </ZoruAccordionTrigger>
                <ZoruAccordionContent className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="inventory">Stock quantity</Label>
                    <Input
                      id="inventory"
                      name="inventory"
                      type="number"
                      defaultValue={p?.inventory as string | number | undefined}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="shipping_weight">
                      Shipping weight
                    </Label>
                    <Input
                      id="shipping_weight"
                      name="shipping_weight"
                      defaultValue={p?.shipping_weight as string | undefined}
                      placeholder="e.g. 2.5 kg"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label>Length (cm)</Label>
                      <Input
                        name="shipping_length"
                        type="number"
                        step="0.01"
                        defaultValue={
                          (p?.dimensions as { length?: number } | undefined)
                            ?.length
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Width (cm)</Label>
                      <Input
                        name="shipping_width"
                        type="number"
                        step="0.01"
                        defaultValue={
                          (p?.dimensions as { width?: number } | undefined)
                            ?.width
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Height (cm)</Label>
                      <Input
                        name="shipping_height"
                        type="number"
                        step="0.01"
                        defaultValue={
                          (p?.dimensions as { height?: number } | undefined)
                            ?.height
                        }
                      />
                    </div>
                  </div>
                </ZoruAccordionContent>
              </ZoruAccordionItem>
            </Accordion>
          </ScrollArea>

          <ZoruDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onDialogChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton isEditing={isEditing} />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}

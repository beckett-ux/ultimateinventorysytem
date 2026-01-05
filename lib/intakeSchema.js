import { z } from "zod";

import { approvedBrands } from "@/lib/approvedBrands";

const approvedBrandSet = new Set(approvedBrands);

export const intakeInputSchema = z.object({
  brand: z
    .string()
    .trim()
    .min(1, "Brand is required")
    .refine((value) => approvedBrandSet.has(value), {
      message: "Brand must be an approved brand name",
    }),
  itemName: z.string().trim().min(1, "Item name is required"),
  category: z.string().trim().min(1, "Category is required"),
  subCategory: z.string().trim().min(1, "Sub-category is required"),
  shopifyDescription: z
    .string()
    .trim()
    .min(1, "Shopify description is required"),
  size: z.string().trim().min(1, "Size is required"),
  condition: z.string().trim().min(1, "Condition is required"),
  cost: z.string().trim().min(1, "Cost is required"),
  price: z.string().trim().min(1, "Price is required"),
  location: z.string().trim().min(1, "Location is required"),
});

export const intakeOutputSchema = z.object({
  title: z.string(),
  titleFormat: z.string(),
  titleFormatRules: z.array(z.string()),
  normalizedBrand: z.string(),
  categoryPath: z.string(),
  tags: z.array(z.string()),
  pricing: z.object({
    cost: z.string(),
    price: z.string(),
  }),
  location: z.string(),
  shopifyDescription: z.string(),
});

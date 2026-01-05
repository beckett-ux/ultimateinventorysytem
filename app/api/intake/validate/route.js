import { NextResponse } from "next/server";
import { intakeInputSchema, intakeOutputSchema } from "@/lib/intakeSchema";

const normalizeTitle = ({ brand, category, subCategory }) => {
  return [brand, category, subCategory]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");
};

const titleFormat = "{BrandName} {ItemDescription} {SubCategory}";

const titleFormatRules = [
  "Title must contain exactly three components: BrandName, ItemDescription, SubCategory.",
  "BrandName must match the approved brand list exactly (spelling/casing).",
  "ItemDescription should be a short identifying phrase (no brand repeat, avoid subcategory repeat unless needed).",
  "SubCategory must be the final selected category label.",
  "Use single spaces only. No punctuation or separators.",
];

const normalizeTags = ({ size, condition, location }) => {
  return [
    `size_${size.trim()}`,
    `condition_${condition.trim()}`,
    `loc_${location.trim()}`,
    "needs_photos",
  ].filter(Boolean);
};

const normalizeCategoryPath = ({ category, subCategory }) => {
  return `${category.trim()} > ${subCategory.trim()}`;
};

export async function POST(request) {
  try {
    const payload = await request.json();
    const parsed = intakeInputSchema.parse(payload);

    const response = {
      title: normalizeTitle(parsed),
      titleFormat,
      titleFormatRules,
      normalizedBrand: parsed.brand.trim(),
      categoryPath: normalizeCategoryPath(parsed),
      tags: normalizeTags(parsed),
      pricing: {
        cost: parsed.cost.trim(),
        price: parsed.price.trim(),
      },
      location: parsed.location.trim(),
      shopifyDescription: parsed.shopifyDescription.trim(),
    };

    const output = intakeOutputSchema.parse(response);

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    if (error?.issues) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

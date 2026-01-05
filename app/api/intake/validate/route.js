import { NextResponse } from "next/server";
import { intakeInputSchema, intakeOutputSchema } from "@/lib/intakeSchema";

const normalizeTitle = ({ brand, category, subCategory }) => {
  return [brand, category, subCategory]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");
};

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
      normalizedBrand: parsed.brand.trim(),
      categoryPath: normalizeCategoryPath(parsed),
      tags: normalizeTags(parsed),
      pricing: {
        cost: parsed.cost.trim(),
        price: parsed.price.trim(),
      },
      location: parsed.location.trim(),
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

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { intakeInputSchema, intakeOutputSchema } from "@/lib/intakeSchema";

const MAX_ITEM_DESCRIPTION_WORDS = 6;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toTitleCase = (value) => {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const normalizeTitle = ({ brand, itemDescription, subCategory }) => {
  return [brand, itemDescription, subCategory]
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
  "Use title case for ItemDescription and SubCategory.",
];

const gptTitleSchema = z.object({
  title: z.string().min(1, "Title is required"),
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const parseGptJson = (content) => {
  try {
    return JSON.parse(content);
  } catch (error) {
    return { error };
  }
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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const gptPrompt = [
      "You are normalizing product titles.",
      `Brand: ${parsed.brand.trim()}`,
      `ItemDescription: ${parsed.itemName.trim()}`,
      `SubCategory: ${parsed.subCategory.trim()}`,
      `Format: ${titleFormat}`,
      "Rules:",
      ...titleFormatRules.map((rule) => `- ${rule}`),
      `Keep ItemDescription to ${MAX_ITEM_DESCRIPTION_WORDS} words or fewer.`,
      'Return JSON only in the form: {"title":"Brand ItemDescription SubCategory"}',
    ].join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return JSON only. No extra text." },
        { role: "user", content: gptPrompt },
      ],
    });

    const gptContent = completion.choices?.[0]?.message?.content?.trim();
    const gptJson = parseGptJson(gptContent || "");
    if (gptJson.error) {
      return NextResponse.json(
        { error: "GPT response was not valid JSON" },
        { status: 400 }
      );
    }

    const gptResult = gptTitleSchema.safeParse(gptJson);
    if (!gptResult.success) {
      return NextResponse.json(
        { error: "GPT output validation failed", details: gptResult.error.issues },
        { status: 400 }
      );
    }

    const normalizedBrand = parsed.brand.trim();
    const normalizedSubCategory = toTitleCase(parsed.subCategory.trim());
    const normalizedTitle = gptResult.data.title.replace(/\s+/g, " ").trim();
    const brandPattern = new RegExp(
      `^${escapeRegExp(normalizedBrand)}\\s+`,
      "i"
    );
    const subCategoryPattern = new RegExp(
      `\\s+${escapeRegExp(parsed.subCategory.trim())}$`,
      "i"
    );
    const extractedItemDescription = normalizedTitle
      .replace(brandPattern, "")
      .replace(subCategoryPattern, "")
      .trim();
    const rawItemDescription =
      extractedItemDescription || parsed.itemName.trim();
    const shortItemDescription = rawItemDescription
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, MAX_ITEM_DESCRIPTION_WORDS)
      .join(" ");
    const normalizedItemDescription = toTitleCase(shortItemDescription);
    const normalizedTitleOutput = normalizeTitle({
      brand: normalizedBrand,
      itemDescription: normalizedItemDescription,
      subCategory: normalizedSubCategory,
    });

    const response = {
      title: normalizedTitleOutput,
      titleFormat,
      titleFormatRules,
      normalizedBrand,
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

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { intakeInputSchema, intakeOutputSchema } from "@/lib/intakeSchema";

const MAX_ITEM_DESCRIPTION_WORDS = 6;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const endsWithWord = (value, word) => {
  if (!value || !word) {
    return false;
  }
  const escaped = escapeRegExp(word);
  return new RegExp(`\\b${escaped}$`, "i").test(value.trim());
};

const toTitleCase = (value) => {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const dedupeAdjacentWords = (value) => {
  if (!value) {
    return "";
  }
  const tokens = value.split(/\s+/).filter(Boolean);
  const deduped = [];
  for (const token of tokens) {
    const last = deduped[deduped.length - 1];
    if (last && last.toLowerCase() === token.toLowerCase()) {
      continue;
    }
    deduped.push(token);
  }
  if (
    deduped.length > 1 &&
    deduped[deduped.length - 1].toLowerCase() ===
      deduped[deduped.length - 2].toLowerCase()
  ) {
    deduped.pop();
  }
  return deduped.join(" ");
};

const normalizeTitle = ({ brand, itemDescription, subCategory }) => {
  return [brand, itemDescription, subCategory]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");
};

const titleFormat = "{BrandName} {ItemDescription} {SubCategory}";

const titleFormatRules = [
  "Title must contain BrandName and ItemDescription, and include SubCategory unless it already appears at the end of ItemDescription.",
  "ItemDescription should be a short identifying phrase (no brand repeat, avoid subcategory repeat unless needed).",
  "SubCategory must be the final selected category label.",
  "Use single spaces only. No punctuation or separators.",
  "Use title case for ItemDescription and SubCategory.",
  "Avoid adjacent duplicate words in ItemDescription or SubCategory.",
  "If ItemDescription already ends with the SubCategory, remove it from ItemDescription instead of repeating it.",
];

const gptTitleSchema = z.object({
  title: z.string().min(1, "Title is required"),
});

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

const extractCategoryParts = (categoryPath) => {
  const parts = categoryPath
    .split(/›|>/)
    .map((part) => part.trim())
    .filter(Boolean);
  const category = parts[0] || categoryPath.trim();
  const subCategory = parts[parts.length - 1] || categoryPath.trim();

  return { category, subCategory };
};

export async function POST(request) {
  try {
    const payload = await request.json();
    const parsed = intakeInputSchema.parse(payload);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const { category, subCategory } = extractCategoryParts(parsed.categoryPath);

    const gptPrompt = [
      "You are normalizing product titles.",
      `Brand: ${parsed.brand.trim()}`,
      `ItemDescription: ${parsed.itemName.trim()}`,
      `SubCategory: ${subCategory.trim()}`,
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
    const normalizedSubCategory = toTitleCase(subCategory.trim());
    const normalizedTitle = gptResult.data.title.replace(/\s+/g, " ").trim();
    const brandPattern = new RegExp(
      `^${escapeRegExp(normalizedBrand)}\\s+`,
      "i"
    );
    const subCategoryPattern = new RegExp(
      `\\s+${escapeRegExp(subCategory.trim())}$`,
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
    const normalizedItemDescriptionBase = dedupeAdjacentWords(
      toTitleCase(shortItemDescription)
    );
    let normalizedItemDescription = normalizedItemDescriptionBase;
    let includeSubCategory = true;
    if (endsWithWord(normalizedItemDescription, normalizedSubCategory)) {
      if (
        normalizedItemDescription.trim().toLowerCase() ===
        normalizedSubCategory.toLowerCase()
      ) {
        includeSubCategory = false;
      } else {
        const subCategoryPattern = new RegExp(
          `\\b${escapeRegExp(normalizedSubCategory)}$`,
          "i"
        );
        normalizedItemDescription = normalizedItemDescription
          .replace(subCategoryPattern, "")
          .trim();
      }
    }

    const normalizedTitleOutput = dedupeAdjacentWords(
      normalizeTitle({
        brand: normalizedBrand,
        itemDescription: normalizedItemDescription,
        subCategory: includeSubCategory ? normalizedSubCategory : "",
      })
    );

    const response = {
      title: normalizedTitleOutput,
      titleFormat,
      titleFormatRules,
      normalizedBrand,
      categoryPath: `${category.trim()} > ${normalizedSubCategory}`,
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

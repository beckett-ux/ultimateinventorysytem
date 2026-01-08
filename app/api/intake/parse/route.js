import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const quickInputSchema = z.object({
  rawInput: z.string().trim().min(1, "rawInput is required"),
});

const quickParseSchema = z
  .object({
    brand: z.string().default(""),
    itemName: z.string().default(""),
    categoryPath: z.string().default(""),
    shopifyDescription: z.string().default(""),
    size: z.string().default(""),
    condition: z.string().default(""),
    cost: z.string().default(""),
    price: z.string().default(""),
    location: z.string().default(""),
    vendorSource: z.string().default(""),
  })
  .strict();

const parseGptJson = (content) => {
  try {
    return JSON.parse(content);
  } catch (error) {
    return { error };
  }
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const roundToHalf = (value) => Math.round(value * 2) / 2;

const parseFirstNumber = (value) => {
  if (typeof value === "number") {
    return value;
  }
  if (!value) {
    return null;
  }
  const match = `${value}`.match(/(\d+(\.\d+)?)/);
  if (!match) {
    return null;
  }
  const parsed = Number.parseFloat(match[1]);
  return Number.isNaN(parsed) ? null : parsed;
};

const formatConditionValue = (value) => {
  const normalized = Number.parseFloat(value);
  if (Number.isNaN(normalized)) {
    return "";
  }
  const formatted = normalized.toFixed(1);
  return formatted.endsWith(".0") ? formatted.replace(".0", "") : formatted;
};

const normalizeConditionInput = (value) => {
  const parsed = parseFirstNumber(value);
  if (parsed === null) {
    return "";
  }
  const rounded = roundToHalf(clamp(parsed, 0, 10));
  return formatConditionValue(rounded);
};

const parseMoney = (value) => {
  if (!value) {
    return "";
  }
  const cleaned = `${value}`.replace(/[^0-9.]/g, "");
  if (!cleaned) {
    return "";
  }
  const [whole, ...rest] = cleaned.split(".");
  const normalized = rest.length ? `${whole}.${rest.join("")}` : whole;
  return normalized.replace(/^0+(?=\d)/, "");
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

const normalizeShopifyDescription = (value) => {
  if (!value) {
    return "";
  }
  const lines = value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.join("\n");
};

export async function POST(request) {
  try {
    const payload = await request.json();
    const parsedInput = quickInputSchema.parse(payload);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const gptPrompt = [
      "You are extracting product intake fields from freeform text.",
      "The input may be multiline: line 1 can be the brand, line 2+ includes item details.",
      "Use the brand line as brand only; do not repeat the brand in itemName.",
      "Return JSON only with the following keys:",
      "brand, itemName, categoryPath, shopifyDescription, size, condition, cost, price, location, vendorSource.",
      "If any value is unknown, return an empty string.",
      "Do not hallucinate. Keep brand exact. Keep itemName short.",
      "Do not append category words redundantly in itemName.",
      "Condition must be a numeric string 0-10 without '/10'.",
      "Cost and price must be numeric strings without '$'.",
      "Avoid adjacent duplicate words in itemName. Do not repeat category words in itemName.",
      "If condition is written like 9/10, return 9.",
      "Generate shopifyDescription as store-ready copy with corrected spelling and grammar.",
      "Do not include internal cost/pricing in shopifyDescription.",
      "shopifyDescription format (plain text with line breaks, keep consistent order):",
      "Line 1: Single sentence summary (Brand + item + size if known).",
      "Line 2: Condition sentence using normalized score (Condition: 9/10. ...).",
      "Line 3: Includes: ... (only if provided).",
      "Line 4: Ships from <location> (only if provided).",
      'Example input: "Rick Owens, pony hair, Ramone, size 12, sneaker"',
      'Possible output: {"brand":"Rick Owens","itemName":"Pony Hair Ramones","categoryPath":"Mens > Shoes > Sneakers","size":"12","condition":"8","cost":"300","price":"900","location":"","vendorSource":""}',
      `Input: """${parsedInput.rawInput}"""`,
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

    const gptResult = quickParseSchema.safeParse(gptJson);
    if (!gptResult.success) {
      return NextResponse.json(
        {
          error: "GPT output validation failed",
          details: gptResult.error.issues,
        },
        { status: 400 }
      );
    }

    const normalized = {
      ...gptResult.data,
      brand: gptResult.data.brand.trim(),
      itemName: dedupeAdjacentWords(gptResult.data.itemName.trim()),
      categoryPath: gptResult.data.categoryPath.trim(),
      shopifyDescription: normalizeShopifyDescription(
        gptResult.data.shopifyDescription
      ),
      size: gptResult.data.size.trim(),
      condition: normalizeConditionInput(gptResult.data.condition),
      cost: parseMoney(gptResult.data.cost),
      price: parseMoney(gptResult.data.price),
      location: gptResult.data.location.trim(),
      vendorSource: gptResult.data.vendorSource.trim(),
    };

    return NextResponse.json(normalized, { status: 200 });
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

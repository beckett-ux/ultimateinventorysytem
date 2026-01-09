import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

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
    vendor: z.string().default(""),
    consignmentPayoutPct: z.union([z.number(), z.string()]).optional(),
    intakeCost: z.union([z.number(), z.string()]).optional(),
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

const formatSizeNumber = (value) => {
  const parsed = parseFirstNumber(value);
  if (parsed === null) {
    return "";
  }
  return Number.isInteger(parsed) ? `${parsed}` : `${parsed}`;
};

const sizeLabelPattern = "(?:US|U\\.S\\.|IT|EU)";
const sizeNumberPattern = "\\d+(?:\\.\\d+)?";
const sizeLabelRegex = new RegExp(
  `\\b(${sizeLabelPattern})\\s*(${sizeNumberPattern})\\b`,
  "gi"
);
const sizeLabelReverseRegex = new RegExp(
  `\\b(${sizeNumberPattern})\\s*(${sizeLabelPattern})\\b`,
  "gi"
);
const sizeLineRegex = new RegExp(
  `\\b${sizeLabelPattern}\\s*${sizeNumberPattern}\\b`,
  "i"
);
const sizeLineReverseRegex = new RegExp(
  `\\b${sizeNumberPattern}\\s*${sizeLabelPattern}\\b`,
  "i"
);

const normalizeSizeLabel = (label) =>
  label.replace(/\./g, "").toUpperCase();

const extractLabeledSizes = (value) => {
  if (!value) {
    return {};
  }
  const input = `${value}`;
  const sizes = {};
  for (const match of input.matchAll(sizeLabelRegex)) {
    const label = normalizeSizeLabel(match[1]);
    const size = formatSizeNumber(match[2]);
    if (size && !sizes[label]) {
      sizes[label] = size;
    }
  }
  for (const match of input.matchAll(sizeLabelReverseRegex)) {
    const label = normalizeSizeLabel(match[2]);
    const size = formatSizeNumber(match[1]);
    if (size && !sizes[label]) {
      sizes[label] = size;
    }
  }
  return sizes;
};

const extractPreferredSizes = (rawInput, gptSize) => {
  const fromGpt = extractLabeledSizes(gptSize);
  const fromRaw = extractLabeledSizes(rawInput);
  const combined = { ...fromGpt, ...fromRaw };
  const us = combined.US || "";
  const altLabel = combined.IT ? "IT" : combined.EU ? "EU" : "";
  const altValue = altLabel ? combined[altLabel] : "";
  return { us, altLabel, altValue };
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

const normalizeLocation = (value) => {
  if (!value) {
    return "";
  }
  const normalized = `${value}`.toLowerCase();
  const charlotteIndex = normalized.indexOf("charlotte");
  const dupontIndex = normalized.indexOf("dupont");
  if (charlotteIndex === -1 && dupontIndex === -1) {
    return "";
  }
  if (charlotteIndex === -1) {
    return "DuPont Store";
  }
  if (dupontIndex === -1) {
    return "Charlotte Store";
  }
  return charlotteIndex <= dupontIndex ? "Charlotte Store" : "DuPont Store";
};

const normalizePayoutPercent = (value) => {
  const parsed = parseFirstNumber(value);
  if (parsed === null) {
    return null;
  }
  return clamp(parsed, 0, 100);
};

const consignmentKeywordsPattern =
  "\\bconsign(?:ment|ing|ed)?\\b|\\bconsignee\\b|selling it for";

const hasConsignmentKeywords = (value) => {
  if (!value) {
    return false;
  }
  const regex = new RegExp(consignmentKeywordsPattern, "i");
  return regex.test(`${value}`);
};

const findConsignmentPercent = (value) => {
  if (!value) {
    return null;
  }
  const input = `${value}`;
  const keywordRegex = new RegExp(consignmentKeywordsPattern, "gi");
  const keywordMatches = [...input.matchAll(keywordRegex)];
  if (!keywordMatches.length) {
    return null;
  }
  const percentMatches = [...input.matchAll(/(\d{1,3}(?:\.\d+)?)\s*%/g)];
  if (!percentMatches.length) {
    return null;
  }
  for (const percentMatch of percentMatches) {
    const percentIndex = percentMatch.index ?? -1;
    for (const keywordMatch of keywordMatches) {
      const keywordIndex = keywordMatch.index ?? -1;
      if (percentIndex >= 0 && keywordIndex >= 0) {
        const distance = Math.abs(percentIndex - keywordIndex);
        if (distance <= 60) {
          return parseFirstNumber(percentMatch[1]);
        }
      }
    }
  }
  return null;
};

const extractConsignmentDetails = (value) => {
  if (!value) {
    return { isConsignment: false, payoutPct: null };
  }
  const input = `${value}`;
  const splitMatch = input.match(
    /(\d{1,3}(?:\.\d+)?)\s*\/\s*(\d{1,3}(?:\.\d+)?)/
  );
  const hasKeywords = hasConsignmentKeywords(input);
  const isConsignment = Boolean(splitMatch) || hasKeywords;
  if (!isConsignment) {
    return { isConsignment: false, payoutPct: null };
  }
  let payoutPct = null;
  if (splitMatch) {
    payoutPct = parseFirstNumber(splitMatch[1]);
  } else if (hasKeywords) {
    payoutPct = findConsignmentPercent(input);
  }
  if (payoutPct === null) {
    payoutPct = 60;
  }
  const normalizedPayout = normalizePayoutPercent(payoutPct);
  return {
    isConsignment: true,
    payoutPct: normalizedPayout === null ? 60 : normalizedPayout,
  };
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

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasUsSizeToken = (value, usSize) => {
  if (!value || !usSize) {
    return false;
  }
  const escaped = escapeRegex(usSize);
  const directPattern = new RegExp(`\\bUS\\s*${escaped}\\b`, "i");
  const reversePattern = new RegExp(`\\b${escaped}\\s*US\\b`, "i");
  return directPattern.test(value) || reversePattern.test(value);
};

const stripSizeLines = (value) => {
  if (!value) {
    return "";
  }
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return false;
    }
    if (/^size\b/i.test(trimmed) && /\d/.test(trimmed)) {
      return false;
    }
    if (sizeLineRegex.test(trimmed) || sizeLineReverseRegex.test(trimmed)) {
      return false;
    }
    return true;
  });
  return filtered.join("\n");
};

const bannedShopifyDescriptionWords = [
  "stylish",
  "great",
  "amazing",
  "beautiful",
  "stunning",
  "premium",
  "luxury",
  "perfect",
  "incredible",
  "iconic",
  "must-have",
];

const sanitizeShopifyDescription = (value, { brand, itemName }) => {
  if (!value) {
    return "";
  }
  let cleaned = value;
  if (brand) {
    cleaned = cleaned.replace(new RegExp(escapeRegex(brand), "gi"), "");
  }
  if (itemName) {
    cleaned = cleaned.replace(new RegExp(escapeRegex(itemName), "gi"), "");
  }
  cleaned = cleaned.replace(
    /\b(?:mens|men's|womens|women's)?\s*size\s*\d+(\.\d+)?\b/gi,
    ""
  );
  cleaned = cleaned.replace(/\bcondition\s*:?[^.\n]*\b/gi, "");
  cleaned = cleaned.replace(/\bbought for[^.\n]*\b/gi, "");
  cleaned = cleaned.replace(/\bsell for[^.\n]*\b/gi, "");
  cleaned = cleaned.replace(/\bdupont(?: store)?\b/gi, "");
  cleaned = cleaned.replace(/\bcharlotte(?: store)?\b/gi, "");
  cleaned = cleaned.replace(/\s+,/g, ",");
  cleaned = cleaned.replace(/,\s*\./g, ".");
  cleaned = cleaned.replace(/^[\s,.-]+/g, "");
  cleaned = cleaned.replace(/[\s,.-]+$/g, "");
  cleaned = cleaned.replace(/[ \t]+\n/g, "\n");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned;
};

const stripBannedShopifyDescriptionWords = (value) => {
  if (!value) {
    return "";
  }
  const bannedPattern = bannedShopifyDescriptionWords
    .map((word) => escapeRegex(word))
    .join("|");
  const regex = new RegExp(`\\b(?:${bannedPattern})\\b`, "gi");
  return value.replace(regex, "").replace(/[ \t]{2,}/g, " ").trim();
};

const extractVendorFromInput = (value) => {
  if (!value) {
    return "";
  }
  const input = `${value}`;
  const vendorMatch = input.match(
    /\bvendor\b\s*[:=-]?\s*([^\n,;.]+?)(?=\s+is\s+consigning\b|$|[\n,;.])/i
  );
  if (vendorMatch) {
    return vendorMatch[1].trim();
  }
  const consigningMatch = input.match(
    /\b([^\n,;.]+?)\s+is\s+consigning\b/i
  );
  if (consigningMatch) {
    return consigningMatch[1].trim();
  }
  return "";
};

export async function POST(request) {
  try {
    const payload = await request.json();
    const parsedInput = quickInputSchema.parse(payload);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const gptPrompt = [
      "You are extracting product intake fields from freeform text.",
      "The input may be multiline: line 1 can be the brand, line 2+ includes item details.",
      "Use the brand line as brand only; do not repeat the brand in itemName.",
      "Return JSON only with the following keys:",
      "brand, itemName, categoryPath, shopifyDescription, size, condition, cost, price, location, vendorSource, vendor, consignmentPayoutPct, intakeCost.",
      "If any value is unknown, return an empty string.",
      "Do not hallucinate. Keep brand exact. Keep itemName short.",
      "Do not append category words redundantly in itemName.",
      "Condition must be a numeric string 0-10 without '/10'.",
      "Cost and price must be numeric strings without '$'.",
      "Avoid adjacent duplicate words in itemName. Do not repeat category words in itemName.",
      "If condition is written like 9/10, return 9.",
      "Generate shopifyDescription as store-ready notes only.",
      "shopifyDescription must ONLY include notes not represented by structured fields.",
      "Do not include brand, itemName, categoryPath, size, condition score, cost, price, vendor, or location.",
      "Do not put brand, category, size, price, or condition into shopifyDescription.",
      "Description should be short and factual and only include extra notes like damage, material, repairs, or oddities.",
      "If there are no additional notes, return an empty string for shopifyDescription.",
      "Tone must be neutral, factual, and professional.",
      "No hype words or opinions. Do not use subjective adjectives like: stylish, great, amazing, beautiful, stunning, premium, luxury, perfect, incredible, iconic, must-have.",
      "Do not use exclamation points.",
      "Do not address the reader (no 'you' or 'your').",
      "Keep it concise: 1–2 sentences max.",
      "Only include factual notes not already captured by structured fields (damage, material, finish/wash, special construction, included accessories).",
      "Use a single short paragraph or 1–2 bullet points max with correct spelling and grammar.",
      "Consignment + Vendor + Location rules:",
      "If the text includes consign, consignment, consignee, we are selling it for him/her/them, or a split like 60/40, treat it as consignment.",
      "Extract vendor if the text contains vendor <name> or <name> is consigning patterns. Use the name as written (title-casing is fine but do not invent names).",
      'Extract location strictly as: "DuPont Store" if it mentions dupont; "Charlotte Store" if it mentions charlotte.',
      "Extract consignmentPayoutPct:",
      "If it includes A/B near consignment, use A as payout percent (example: 60/40 -> 60).",
      "If it includes an explicit percent like 70%, use 70.",
      "If nothing is specified but consignment is detected, default to 60.",
      "If consignment is detected, set cost to 0 and leave intakeCost empty.",
      'Example input: "Rick Owens, pony hair, Ramone, size 12, sneaker"',
      'Possible output: {"brand":"Rick Owens","itemName":"Pony Hair Ramones","categoryPath":"Mens > Shoes > Sneakers","size":"12","condition":"8","cost":"300","price":"900","location":"","vendorSource":"","vendor":"","consignmentPayoutPct":"","intakeCost":""}',
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

    const consignmentDetails = extractConsignmentDetails(parsedInput.rawInput);
    const gptPayoutPct = normalizePayoutPercent(
      gptResult.data.consignmentPayoutPct
    );
    const payoutPct = consignmentDetails.isConsignment
      ? consignmentDetails.payoutPct
      : gptPayoutPct;
    const isConsignment =
      consignmentDetails.isConsignment || gptPayoutPct !== null;
    const parsedIntakeCost = parseFirstNumber(gptResult.data.intakeCost);
    const normalizedIntakeCost = isConsignment
      ? undefined
      : parsedIntakeCost ?? undefined;
    const normalizedCost = isConsignment ? "0" : parseMoney(gptResult.data.cost);
    const extractedVendor = extractVendorFromInput(parsedInput.rawInput);
    const sizeDetails = extractPreferredSizes(
      parsedInput.rawInput,
      gptResult.data.size
    );
    const standardizedUsSize = sizeDetails.us ? `US ${sizeDetails.us}` : "";
    const hasMultipleSizes = Boolean(
      standardizedUsSize && sizeDetails.altValue
    );
    const baseItemName = dedupeAdjacentWords(gptResult.data.itemName.trim());
    const normalizedItemName =
      standardizedUsSize &&
      !hasMultipleSizes &&
      !hasUsSizeToken(baseItemName, sizeDetails.us)
        ? dedupeAdjacentWords(`${baseItemName} ${standardizedUsSize}`.trim())
        : baseItemName;
    const normalizedShopifyDescriptionBase =
      stripBannedShopifyDescriptionWords(
        normalizeShopifyDescription(
          sanitizeShopifyDescription(gptResult.data.shopifyDescription, {
            brand: gptResult.data.brand,
            itemName: gptResult.data.itemName,
          })
        )
      );
    let normalizedShopifyDescription = normalizedShopifyDescriptionBase;
    if (standardizedUsSize) {
      normalizedShopifyDescription = stripSizeLines(
        normalizedShopifyDescription
      );
      if (hasMultipleSizes) {
        const sizeLine = `Size: ${sizeDetails.altLabel} ${sizeDetails.altValue} / ${standardizedUsSize}`;
        normalizedShopifyDescription = normalizedShopifyDescription
          ? `${normalizedShopifyDescription}\n${sizeLine}`
          : sizeLine;
      }
    }

    const normalized = {
      ...gptResult.data,
      brand: gptResult.data.brand.trim(),
      itemName: normalizedItemName,
      categoryPath: gptResult.data.categoryPath.trim(),
      shopifyDescription: normalizedShopifyDescription,
      size: standardizedUsSize || gptResult.data.size.trim(),
      condition: normalizeConditionInput(gptResult.data.condition),
      cost: normalizedCost,
      price: parseMoney(gptResult.data.price),
      location: normalizeLocation(parsedInput.rawInput),
      vendorSource: gptResult.data.vendorSource.trim(),
      vendor: extractedVendor,
      consignmentPayoutPct: payoutPct ?? undefined,
      intakeCost: normalizedIntakeCost,
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

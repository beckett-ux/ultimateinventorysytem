import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const quickInputSchema = z.object({
  rawInput: z.string().trim().min(1, "rawInput is required"),
});

const quickParseSchema = z.object({
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
});

const parseGptJson = (content) => {
  try {
    return JSON.parse(content);
  } catch (error) {
    return { error };
  }
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
      "Return JSON only with the following keys:",
      "brand, itemName, categoryPath, shopifyDescription, size, condition, cost, price, location, vendorSource.",
      "If any value is unknown, return an empty string.",
      "Do not hallucinate. Keep brand exact. Keep itemName short.",
      'Example input: "Rick Owens, pony hair, Ramone, size 12, sneaker"',
      'Possible output: {"brand":"Rick Owens","itemName":"Pony Hair Ramones","categoryPath":"Mens > Shoes > Sneakers","size":"12","condition":"","cost":"","price":"","location":"","vendorSource":""}',
      `Input: "${parsedInput.rawInput}"`,
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

    return NextResponse.json(gptResult.data, { status: 200 });
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

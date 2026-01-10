import { NextResponse } from "next/server";
import { z } from "zod";
import sql from "@/lib/db";

export const runtime = "nodejs";

const intakeInsertSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  sku: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  condition: z.string().nullable().optional(),
  price_cents: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(request) {
  const diagnostics = {
    method: request.method,
    contentType: request.headers.get("content-type"),
    rawBodyLength: 0,
  };

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unable to read request body.", diagnostics },
      { status: 400 }
    );
  }

  diagnostics.rawBodyLength = Buffer.byteLength(rawBody, "utf8");

  if (!rawBody || rawBody.trim().length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Request body is empty. If you are sending JSON, ensure you are including a request body and that no middleware is consuming it.",
        diagnostics,
      },
      { status: 400 }
    );
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body is malformed JSON.", diagnostics },
      { status: 400 }
    );
  }

  const parsed = intakeInsertSchema.safeParse(payload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues?.[0];
    return NextResponse.json(
      {
        ok: false,
        error: firstIssue?.message || "Validation failed.",
        details: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  try {
    const [inserted] = await sql`
      INSERT INTO inventory_items (
        title,
        sku,
        brand,
        category,
        condition,
        price_cents,
        notes
      )
      VALUES (
        ${parsed.data.title},
        ${parsed.data.sku ?? null},
        ${parsed.data.brand ?? null},
        ${parsed.data.category ?? null},
        ${parsed.data.condition ?? null},
        ${parsed.data.price_cents ?? null},
        ${parsed.data.notes ?? null}
      )
      RETURNING id
    `;

    return NextResponse.json({ ok: true, id: inserted?.id }, { status: 200 });
  } catch (error) {
    if (error?.code === "MISSING_DATABASE_URL") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "DATABASE_URL is not configured. Set DATABASE_URL in your environment (for local dev, in .env.local).",
        },
        { status: 500 }
      );
    }

    if (error?.code === "42P01") {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Database table "inventory_items" is missing. Run the schema bootstrap steps in the README (Local Database) to create it.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: false, error: error?.message || "Unexpected error." },
      { status: 500 }
    );
  }
}


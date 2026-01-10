import { NextResponse } from "next/server";
import sql from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

  if (!hasDatabaseUrl) {
    return NextResponse.json(
      { ok: false, hasDatabaseUrl: false, dbConnected: false },
      { status: 503 }
    );
  }

  try {
    await sql`select 1 as ok`;

    return NextResponse.json(
      { ok: true, hasDatabaseUrl: true, dbConnected: true },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, hasDatabaseUrl: true, dbConnected: false },
      { status: 503 }
    );
  }
}


import { NextResponse } from "next/server";

/** Wrap a handler so DB/connection errors return clean JSON instead of crashing. */
export async function handle<T>(fn: () => Promise<T>) {
  try {
    const data = await fn();
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error("[api error]", err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Unknown error",
        code: err?.code || null,
      },
      { status: 500 }
    );
  }
}

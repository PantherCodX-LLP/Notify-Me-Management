import { handle } from "@/lib/api";
import { getContext } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const ctx = await getContext(true);
    return {
      database: ctx.db,
      databases: ctx.databases,
      detected: ctx.detected,
      mapping: ctx.mapping,
      tables: ctx.tables.map((t) => ({
        name: t.name,
        rowEstimate: t.rowEstimate,
        comment: t.comment,
        columns: t.columns,
      })),
    };
  });
}
